import { DateTimeService } from '@common/date-time/date-time.service';
import { Injectable, Logger } from '@nestjs/common';
import { Task, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Tasks in the pipeline carry only the fields the engine actually needs.
// This is narrower than the full Task type and makes the data flow explicit.
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

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Deterministic rescheduling engine — Sliding Cascade Window.
   *
   * Overdue tasks are greedily seated into the first day they fit, starting
   * from today. Tasks that don't fit are bumped to the next day and
   * re-evaluated, until every task is either seated or graveyarded.
   * All writes land in a single atomic transaction.
   *
   * Capacity for each day = dailyCapacityMinutes − minutes already consumed
   * by ALL tasks that day (pending + completed), because a completed task
   * represents real time the person already spent.
   */
  async rescheduleTasks(userId: string, date?: Date): Promise<RescheduleResult> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { dailyCapacityMinutes: true},
    });

    if (!user) throw new Error(`User not found: ${userId}`);

    const capacityLimit = user.dailyCapacityMinutes ?? 480;
    const today = this.dateTimeService.startOfDay(new Date());
    const [todayConsumed, overdueTasks] = await Promise.all([
      // ALL tasks today (pending + completed) — completed work still consumed
      // the person's time and must be counted against remaining capacity.
      this.prismaService.task.findMany({
        where: { userId, scheduledDate: today, status: { not: 'graveyard' } },
        select: { estimatedMinutes: true },
      }),
      this.prismaService.task.findMany({
        where: { userId, status: 'pending', scheduledDate: { lt: today } },
        select: { id: true, scheduledDate: true, estimatedMinutes: true, basePriority: true, bumpCount: true },
      }),
    ]);

    if (overdueTasks.length === 0) {
      return { success: false, message: 'No overdue tasks to process.' };
    }

    const tasksToUpdate: Prisma.TaskUpdateArgs[] = [];
    const logsToCreate: Prisma.RescheduleLogCreateInput[] = [];

    /**  if called using the endpoint we will use the user passed date
     * Otherise for the cron job we will use the UTC date. 
     * This allows us to have a consistent "today" boundary for users in different timezones, 
     * while also giving us flexibility to run the engine for any arbitrary date if needed
     *  (e.g. for backfilling or testing).
     * */
    let currentDate = date || new Date(today);
    let availableCapacity = Math.max(0, capacityLimit - this.sumMinutes(todayConsumed));

    // Each task enters the pipeline carrying its original scheduledDate.
    // That original date is what drives composite scoring — it reflects true
    // staleness regardless of which candidate day we are currently evaluating.
    let pipelineQueue: PipelineTask[] = overdueTasks.map((t) => ({ ...t }));
    let graveyardCount = 0;

    // -------------------------------------------------------------------------
    // Sliding Cascade Window
    // -------------------------------------------------------------------------
    while (pipelineQueue.length > 0) {
      const sorted = this.sortByScore(pipelineQueue, currentDate);

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

      if (displaced.length === 0) break;

      // Move to the next day. Fetch its consumed minutes the same way as today
      // — all non-graveyard tasks, not just pending.
      currentDate = this.dateTimeService.addDays(currentDate, 1);

      const nextDayTasks = await this.prismaService.task.findMany({
        where: { userId, scheduledDate: currentDate, status: { not: 'graveyard' } },
        select: { estimatedMinutes: true },
      });

      availableCapacity = Math.max(0, capacityLimit - this.sumMinutes(nextDayTasks));

      pipelineQueue = [];

      for (const task of displaced) {
        const newBumpCount = (task.bumpCount ?? 0) + 1;

        if (newBumpCount > this.GRAVEYARD_BUMP_THRESHOLD) {
          this.queueGraveyard(task, currentDate, newBumpCount, tasksToUpdate, logsToCreate);
          graveyardCount++;
        } else {
          // scheduledDate is deliberately left as the original — composite
          // scoring must reflect how long this task has truly been overdue.
          pipelineQueue.push({ ...task, bumpCount: newBumpCount });
        }
      }
    }

    // -------------------------------------------------------------------------
    // Atomic commit
    // -------------------------------------------------------------------------
    if (tasksToUpdate.length > 0) {
      await this.prismaService.$transaction([
        ...tasksToUpdate.map((args) => this.prismaService.task.update(args)),
        ...logsToCreate.map((data) => this.prismaService.rescheduleLog.create({ data })),
      ]);
    }

    const seatedCount = tasksToUpdate.length - graveyardCount;

    this.logger.log(
      `[${userId}] Rescheduled: seated=${seatedCount}, graveyarded=${graveyardCount}`,
    );

    return { success: true, seatedCount, graveyardCount };
  }

  // ---------------------------------------------------------------------------
  // Scoring
  // ---------------------------------------------------------------------------

  /**
   * composite_score = base_priority + (days_overdue × OVERDUE_WEIGHT)
   *
   * days_overdue is measured from the task's original scheduledDate to
   * currentDate — NOT to today. As a task cascades into future days, its
   * score correctly reflects the full duration of its staleness.
   *
   * This value is computed at runtime only and is never persisted.
   */
  calculateCompositeScore(
    task: Pick<Task, 'scheduledDate' | 'basePriority'>,
    currentDate: Date,
  ): number {
    const scheduled = this.dateTimeService.startOfDay(new Date(task.scheduledDate));
    const target = this.dateTimeService.startOfDay(new Date(currentDate));
    const daysOverdue = Math.max(
      0,
      this.dateTimeService.getDaysDifference(scheduled, target),
    );
    const base = ReschedulingService.BASE_PRIORITY_VALUES[task.basePriority] ?? 1;
    return base + daysOverdue * this.OVERDUE_WEIGHT;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private sortByScore(tasks: PipelineTask[], currentDate: Date): PipelineTask[] {
    return [...tasks].sort(
      (a, b) =>
        this.calculateCompositeScore(b, currentDate) -
        this.calculateCompositeScore(a, currentDate),
    );
  }

  /**
   * Queues a write for a successfully seated task.
   * Always writes — every overdue task by definition has scheduledDate < today,
   * so seating it always changes either the date or the bumpCount (or both).
   */
  private queueSeat(
    task: PipelineTask,
    seatedDate: Date,
    tasksToUpdate: Prisma.TaskUpdateArgs[],
    logsToCreate: Prisma.RescheduleLogCreateInput[],
  ): void {
    tasksToUpdate.push({
      where: { id: task.id },
      data: {
        scheduledDate: new Date(seatedDate),
        bumpCount: task.bumpCount,
      },
    });

    logsToCreate.push({
      task: { connect: { id: task.id } },
      fromDate: this.dateTimeService.startOfDay(new Date(task.scheduledDate)),
      toDate: new Date(seatedDate),
      reason: 'auto_overdue',
    });
  }

  /**
   * Queues a graveyard promotion for a task that has exceeded the bump
   * threshold. toDate records when the final displacement decision was made,
   * not where the task originally came from.
   */
  private queueGraveyard(
    task: PipelineTask,
    decisionDate: Date,
    newBumpCount: number,
    tasksToUpdate: Prisma.TaskUpdateArgs[],
    logsToCreate: Prisma.RescheduleLogCreateInput[],
  ): void {
    tasksToUpdate.push({
      where: { id: task.id },
      data: { status: 'graveyard', bumpCount: newBumpCount },
    });

    logsToCreate.push({
      task: { connect: { id: task.id } },
      fromDate: this.dateTimeService.startOfDay(new Date(task.scheduledDate)),
      toDate: new Date(decisionDate),
      reason: 'priority_battle_loss',
    });
  }
  
  private sumMinutes(tasks: Pick<Task, 'estimatedMinutes'>[]): number {
    return tasks.reduce((sum, t) => sum + (t.estimatedMinutes ?? 0), 0);
  }
}
