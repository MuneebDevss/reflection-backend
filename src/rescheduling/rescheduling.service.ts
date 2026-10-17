import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Task } from '@prisma/client';
import { DateTimeService } from '@common/date-time/date-time.service';
import { PrismaService } from '../prisma/prisma.service';
import { RescheduleStrategy } from './reschedule-strategy.enum';

type SchedulingTask = Pick<
  Task,
  'id' | 'scheduledDate' | 'estimatedMinutes' | 'basePriority' | 'bumpCount'
>;

type PlannedUpdate = Prisma.TaskUpdateArgs;

export type RescheduleResult =
  | { success: true; strategy: RescheduleStrategy; seatedCount: number; graveyardCount: number }
  | { success: false; message: string };

/** Reschedules only pending overdue tasks using one of the three policies. */
@Injectable()
export class ReschedulingService {
  private readonly logger = new Logger(ReschedulingService.name);

  private static readonly PRIORITY: Record<string, number> = {
    low: 1,
    medium: 2,
    high: 3,
  };

  constructor(
    private readonly dateTimeService: DateTimeService,
    private readonly prismaService: PrismaService,
  ) {}

  async rescheduleTasks(
    userId: string,
    date: Date | undefined,
    strategy: RescheduleStrategy,
  ): Promise<RescheduleResult> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { dailyCapacityMinutes: true, timezone: true },
    });
    if (!user) throw new NotFoundException(`User not found: ${userId}`);

    const today = date
      ? this.dateTimeService.startOfDay(date)
      : this.getUserLocalToday(user.timezone || 'UTC');
    const pendingTasks = await this.prismaService.task.findMany({
      where: { userId, status: 'pending' },
      select: {
        id: true,
        scheduledDate: true,
        estimatedMinutes: true,
        basePriority: true,
        bumpCount: true,
      },
      orderBy: [{ scheduledDate: 'asc' }, { id: 'asc' }],
    });

    const overdue = pendingTasks.filter((task) => task.scheduledDate < today);
    const scheduled = pendingTasks.filter((task) => task.scheduledDate >= today);
    if (overdue.length === 0) {
      return { success: false, message: 'No overdue pending tasks to process.' };
    }

    const plan = strategy === RescheduleStrategy.CDU
      ? this.planCompleteDayUpdate(overdue, scheduled, today)
      : this.planCapacityStrategy(
          overdue,
          scheduled,
          today,
          user.dailyCapacityMinutes ?? 480,
          strategy as 'HPF' | 'FG',
        );

    await this.commitPlan(plan.updates, plan.logs);
    this.logger.log(`[${userId}] ${strategy} rescheduled ${plan.updates.length} pending overdue task(s)`);
    return {
      success: true,
      strategy,
      seatedCount: plan.updates.length,
      graveyardCount: 0,
    };
  }

  /** CDU compresses overdue and future date groups into consecutive days. */
  private planCompleteDayUpdate(
    overdue: SchedulingTask[],
    scheduled: SchedulingTask[],
    today: Date,
  ): { updates: PlannedUpdate[]; logs: Prisma.RescheduleLogCreateManyInput[] } {
    const updates: PlannedUpdate[] = [];
    const logs: Prisma.RescheduleLogCreateManyInput[] = [];
    let targetDate = new Date(today);

    for (const group of [...this.groupByDate(overdue), ...this.groupByDate(scheduled)]) {
      for (const task of group.tasks) {
        this.queueDateUpdate(task, targetDate, updates, logs);
      }
      targetDate = this.dateTimeService.addDays(targetDate, 1);
    }
    return { updates, logs };
  }

  /**
   * HPF and FG share the capacity scheduler. HPF orders by priority then age;
   * FG orders by overdue age then priority. Existing scheduled tasks provide
   * occupancy and are never moved by either strategy.
   */
  private planCapacityStrategy(
    overdue: SchedulingTask[],
    scheduled: SchedulingTask[],
    today: Date,
    capacityMinutes: number,
    strategy: 'HPF' | 'FG',
  ): { updates: PlannedUpdate[]; logs: Prisma.RescheduleLogCreateManyInput[] } {
    const ordered = [...overdue].sort((a, b) => {
      if (strategy === 'HPF') {
        return this.priority(b) - this.priority(a)
          || this.compareDates(a.scheduledDate, b.scheduledDate)
          || a.id.localeCompare(b.id);
      }
      return this.daysOverdue(b.scheduledDate, today) - this.daysOverdue(a.scheduledDate, today)
        || this.priority(b) - this.priority(a)
        || this.compareDates(a.scheduledDate, b.scheduledDate)
        || a.id.localeCompare(b.id);
    });

    const occupancy = new Map<string, number>();
    for (const task of scheduled) {
      const key = this.dateKey(task.scheduledDate);
      occupancy.set(key, (occupancy.get(key) ?? 0) + (task.estimatedMinutes ?? 0));
    }

    const updates: PlannedUpdate[] = [];
    const logs: Prisma.RescheduleLogCreateManyInput[] = [];
    for (const task of ordered) {
      const targetDate = this.findNextAvailableDate(
        today,
        task.estimatedMinutes ?? 0,
        capacityMinutes,
        occupancy,
      );
      const key = this.dateKey(targetDate);
      occupancy.set(key, (occupancy.get(key) ?? 0) + (task.estimatedMinutes ?? 0));
      this.queueDateUpdate(task, targetDate, updates, logs);
    }
    return { updates, logs };
  }

  private findNextAvailableDate(
    startDate: Date,
    duration: number,
    capacityMinutes: number,
    occupancy: Map<string, number>,
  ): Date {
    let candidate = new Date(startDate);
    for (;;) {
      const used = occupancy.get(this.dateKey(candidate)) ?? 0;
      const fits = used + duration <= capacityMinutes;
      const oversizedTaskCanStandAlone = used === 0 && duration > capacityMinutes;
      if (fits || oversizedTaskCanStandAlone) return candidate;
      candidate = this.dateTimeService.addDays(candidate, 1);
    }
  }

  private groupByDate(tasks: SchedulingTask[]): Array<{ date: Date; tasks: SchedulingTask[] }> {
    const groups = new Map<string, { date: Date; tasks: SchedulingTask[] }>();
    for (const task of tasks) {
      const key = this.dateKey(task.scheduledDate);
      const group = groups.get(key);
      if (group) group.tasks.push(task);
      else groups.set(key, { date: this.dateTimeService.startOfDay(task.scheduledDate), tasks: [task] });
    }
    return [...groups.values()].sort((a, b) => this.compareDates(a.date, b.date));
  }

  private queueDateUpdate(
    task: SchedulingTask,
    targetDate: Date,
    updates: PlannedUpdate[],
    logs: Prisma.RescheduleLogCreateManyInput[],
  ): void {
    const fromDate = this.dateTimeService.startOfDay(task.scheduledDate);
    const toDate = this.dateTimeService.startOfDay(targetDate);
    if (fromDate.getTime() === toDate.getTime()) return;

    updates.push({ where: { id: task.id }, data: { scheduledDate: toDate } });
    logs.push({ taskId: task.id, fromDate, toDate, reason: 'auto_overdue' });
  }

  private async commitPlan(
    updates: PlannedUpdate[],
    logs: Prisma.RescheduleLogCreateManyInput[],
  ): Promise<void> {
    if (updates.length === 0) return;
    await this.prismaService.$transaction(async (tx) => {
      await Promise.all(updates.map((update) => tx.task.update(update)));
      if (logs.length > 0) await tx.rescheduleLog.createMany({ data: logs });
    });
  }

  private priority(task: SchedulingTask): number {
    return ReschedulingService.PRIORITY[task.basePriority] ?? 1;
  }

  private daysOverdue(date: Date, today: Date): number {
    return Math.max(0, this.dateTimeService.getDaysDifference(
      this.dateTimeService.startOfDay(date),
      today,
    ));
  }

  private compareDates(a: Date, b: Date): number {
    return a.getTime() - b.getTime();
  }

  private dateKey(date: Date): string {
    return this.dateTimeService.toDateString(date);
  }

  private getUserLocalToday(timeZone: string): Date {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === 'year')!.value;
    const month = parts.find((part) => part.type === 'month')!.value;
    const day = parts.find((part) => part.type === 'day')!.value;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }
}
