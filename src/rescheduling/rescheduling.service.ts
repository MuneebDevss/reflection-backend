import { DateTimeService } from '@common/date-time/date-time.service';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Task, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type PipelineTask = Pick<Task, 'id' | 'scheduledDate' | 'estimatedMinutes' | 'basePriority' | 'bumpCount'>;

export type RescheduleResult =
  | { success: true; seatedCount: number; graveyardCount: number }
  | { success: false; message: string };

@Injectable()
export class ReschedulingService {
  private readonly logger = new Logger(ReschedulingService.name);

  private readonly OVERDUE_WEIGHT = 0.5;
  private readonly GRAVEYARD_BUMP_THRESHOLD = 2;

  private static readonly BASE_PRIORITY_VALUES: Record<string, number> = {
    low: 1,
    medium: 2,
    high: 3,
  };

  constructor(
    private readonly dateTimeService: DateTimeService,
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * Helper to resolve the true local "Today" for a user's target timezone
   */
  private getUserLocalToday(timeZone: string): Date {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const y = parts.find(p => p.type === 'year')!.value;
    const m = parts.find(p => p.type === 'month')!.value;
    const d = parts.find(p => p.type === 'day')!.value;
    
    // Return explicit UTC baseline matching the user's localized date change
    return new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), 0, 0, 0, 0));
  }

  async rescheduleTasks(userId: string, date?: Date): Promise<RescheduleResult> {
    // FIX: Grab both capacity and timezone to lock down the scheduling boundary
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { dailyCapacityMinutes: true, timezone: true },
    });

    if (!user) throw new NotFoundException(`User not found: ${userId}`);

    const userTimezone = user.timezone || 'UTC';
    const capacityLimit = user.dailyCapacityMinutes ?? 480;
    
    // FIX: Align "today" exactly with the user's real-world midnight clock
    const today = date ? this.dateTimeService.startOfDay(date) : this.getUserLocalToday(userTimezone);

    // Fetch the raw overdue candidates
    const overdueTasks = await this.prismaService.task.findMany({
      where: { userId, status: 'pending', scheduledDate: { lt: today } },
      select: { id: true, scheduledDate: true, estimatedMinutes: true, basePriority: true, bumpCount: true },
    });

    if (overdueTasks.length === 0) {
      return { success: false, message: 'No overdue tasks to process.' };
    }

    // FIX: Performance Optimization — Pre-fetch ALL upcoming tasks for the max possible cascade window
    const maxCascadeDate = this.dateTimeService.addDays(today, this.GRAVEYARD_BUMP_THRESHOLD);
    const futureWindowTasks = await this.prismaService.task.findMany({
      where: { 
        userId, 
        scheduledDate: { gte: today, lte: maxCascadeDate }, 
        status: { not: 'graveyard' } 
      },
      select: { scheduledDate: true, estimatedMinutes: true },
    });

    // Map existing records in memory to avoid repetitive database calls inside the loop
    const dayConsumptionMap = new Map<string, number>();
    futureWindowTasks.forEach(t => {
      const key = t.scheduledDate.toISOString().split('T')[0];
      dayConsumptionMap.set(key, (dayConsumptionMap.get(key) || 0) + (t.estimatedMinutes ?? 0));
    });

    const tasksToUpdate: Prisma.TaskUpdateArgs[] = [];
    const logsToCreate: Prisma.RescheduleLogCreateManyInput[] = [];

    let currentDate = new Date(today);
    let pipelineQueue: PipelineTask[] = overdueTasks.map((t) => ({ ...t }));
    let graveyardCount = 0;

    // -------------------------------------------------------------------------
    // Sliding Cascade Window (In-Memory Processing Loop)
    // -------------------------------------------------------------------------
    while (pipelineQueue.length > 0) {
      const sorted = this.sortByScore(pipelineQueue, currentDate);
      const dateKey = currentDate.toISOString().split('T')[0];
      
      // Read current day allocation directly from pre-fetched map memory
      const alreadyConsumed = dayConsumptionMap.get(dateKey) || 0;
      let availableCapacity = Math.max(0, capacityLimit - alreadyConsumed);
      
      let usedMinutes = 0;
      const displaced: PipelineTask[] = [];

      for (const task of sorted) {
        const duration = task.estimatedMinutes ?? 0;
        if (usedMinutes + duration <= availableCapacity) {
          usedMinutes += duration;
          this.queueSeat(task, currentDate, tasksToUpdate, logsToCreate);
        } else {
          displaced.push(task);
        }
      }

      // Update the allocation map to reflect the newly assigned tasks if the pipeline shifts
      dayConsumptionMap.set(dateKey, alreadyConsumed + usedMinutes);

      if (displaced.length === 0) break;

      // Increment date reference forward safely
      currentDate = this.dateTimeService.addDays(currentDate, 1);
      pipelineQueue = [];

      for (const task of displaced) {
        const newBumpCount = (task.bumpCount ?? 0) + 1;

        if (newBumpCount > this.GRAVEYARD_BUMP_THRESHOLD) {
          this.queueGraveyard(task, currentDate, newBumpCount, tasksToUpdate, logsToCreate);
          graveyardCount++;
        } else {
          pipelineQueue.push({ ...task, bumpCount: newBumpCount });
        }
      }
    }

    // -------------------------------------------------------------------------
    // Atomic Commit Transaction
    // -------------------------------------------------------------------------
    if (tasksToUpdate.length > 0) {
  // Use interactive transaction syntax to safely allow config adjustments
  await this.prismaService.$transaction(
    async (tx) => {
      // 1. Fire off the task updates concurrently within the transaction block
      await Promise.all(tasksToUpdate.map((args) => tx.task.update(args)));

      // 2. Bulk insert all history logs in a single optimized command line execution
      if (logsToCreate.length > 0) {
        await tx.rescheduleLog.createMany({ data: logsToCreate });
      }
    },
    {
      timeout: 15000, // Extends baseline safety budget up to 15 full seconds
    },
  );
}

    const seatedCount = tasksToUpdate.length - graveyardCount;
    this.logger.log(`[${userId}] Rescheduled: seated=${seatedCount}, graveyarded=${graveyardCount}`);

    return { success: true, seatedCount, graveyardCount };
  }

  // ---------------------------------------------------------------------------
  // Scoring & Helpers
  // ---------------------------------------------------------------------------

  calculateCompositeScore(task: Pick<Task, 'scheduledDate' | 'basePriority'>, currentDate: Date): number {
    const scheduled = this.dateTimeService.startOfDay(new Date(task.scheduledDate));
    const target = this.dateTimeService.startOfDay(new Date(currentDate));
    const daysOverdue = Math.max(0, this.dateTimeService.getDaysDifference(scheduled, target));
    const base = ReschedulingService.BASE_PRIORITY_VALUES[task.basePriority] ?? 1;
    return base + daysOverdue * this.OVERDUE_WEIGHT;
  }

  private sortByScore(tasks: PipelineTask[], currentDate: Date): PipelineTask[] {
    return [...tasks].sort(
      (a, b) => this.calculateCompositeScore(b, currentDate) - this.calculateCompositeScore(a, currentDate),
    );
  }

  private queueSeat(
  task: PipelineTask,
  seatedDate: Date,
  tasksToUpdate: Prisma.TaskUpdateArgs[],
  logsToCreate: Prisma.RescheduleLogCreateManyInput[], // Updated type
  ): void {
    tasksToUpdate.push({
      where: { id: task.id },
      data: {
        scheduledDate: new Date(seatedDate),
        bumpCount: task.bumpCount,
      },
    });

    logsToCreate.push({
      taskId: task.id, // Direct assignment (required for createMany)
      fromDate: this.dateTimeService.startOfDay(new Date(task.scheduledDate)),
      toDate: new Date(seatedDate),
      reason: 'auto_overdue',
    });
  }

  private queueGraveyard(
  task: PipelineTask,
  decisionDate: Date,
  newBumpCount: number,
  tasksToUpdate: Prisma.TaskUpdateArgs[],
  logsToCreate: Prisma.RescheduleLogCreateManyInput[], // Updated type
): void {
  tasksToUpdate.push({
    where: { id: task.id },
    data: { status: 'graveyard', bumpCount: newBumpCount },
  });

  logsToCreate.push({
    taskId: task.id, // Direct assignment (required for createMany)
    fromDate: this.dateTimeService.startOfDay(new Date(task.scheduledDate)),
    toDate: new Date(decisionDate),
    reason: 'priority_battle_loss',
  });
}
}