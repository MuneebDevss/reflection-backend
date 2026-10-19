import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BasePriority, Prisma, Task, TaskStatus } from '@prisma/client';
import { CreateTaskDto } from './dto/create-tasks.dto';
import { UpdateTaskDto } from './dto/update-tasks.dto';
import { GetTasksByDateDto } from './dto/get-tasks-by-date.dto';
import { GetTasks } from './dto/get-tasks.dto';
import { DiscardTasksDto } from './dto/discard-tasks.dto';
import { DateTimeService } from '@common/date-time/date-time.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService, 
    private readonly dateTimeService: DateTimeService
  ) {}

  /**
   * Retrieves all tasks associated with a specific user
   */
  async getTasks(userId: string, query: GetTasks): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: {
        userId,
        ...(query.status && { status: query.status }),
        ...(query.planId && { planId: query.planId }),
        ...(query.startDate && query.endDate && {
          scheduledDate: {
            gte: query.startDate,
            lte: query.endDate,
          },
        }),
      },
      orderBy: [
        { scheduledDate: 'asc' },
        { compositeScore: 'desc' },
      ],
    });
  }

  /**
   * Creates a new task for a specific user
   */
  async createTask(userId: string, data: CreateTaskDto): Promise<Task> {
    return this.prisma.task.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        scheduledDate: data.scheduleDate,
        estimatedMinutes: data.estimatedMinutes ?? 0,
        basePriority: data.basePriority ?? BasePriority.medium,
        planId: data.planId,
      },
    });
  }

  /**
   * Updates an existing task's details
   */
  async updateTask(taskId: string, userId: string, data: UpdateTaskDto): Promise<Task> {
    return this.prisma.task.update({
      where: { id: taskId, userId },
      data: {
        title: data.title,
        description: data.description,
        scheduledDate: data.scheduleDate,
        estimatedMinutes: data.estimatedMinutes,
        basePriority: data.basePriority,
        status: data.status,
      },
    });
  }

  /** Marks one or more owned tasks as discarded without deleting them. */
  async discardTasks(userId: string, data: DiscardTasksDto): Promise<Task[]> {
    const taskIds = [...new Set(data.taskIds)];
    const result = await this.prisma.task.updateMany({
      where: { id: { in: taskIds }, userId },
      data: {
        status: TaskStatus.discarded,
        discardReason: data.reason?.trim() || null,
      },
    });

    if (result.count !== taskIds.length) {
      throw new NotFoundException('One or more tasks could not be found.');
    }

    return this.prisma.task.findMany({
      where: { id: { in: taskIds }, userId },
    });
  }

  /**
   * Deletes a specific task by its ID
   */
  async deleteTask(taskId: string, userId: string): Promise<Task> {
    return this.prisma.task.delete({
      where: { id: taskId, userId },
    });
  }

  /**
   * Retrieves a single task by its unique identifier
   */
  async getTaskById(taskId: string, userId: string): Promise<Task | null> {
    return this.prisma.task.findUnique({
      where: { id: taskId, userId },
    });
  }

  /**
   * Retrieves all incomplete tasks for a user where the scheduled date is in the past
   */
  async getOverdueTasks(userId: string, date: Date): Promise<Task[]> {
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format.');
    }
    return this.prisma.task.findMany({
      where: {
        userId,
        scheduledDate: {
          lt: date,
        },
        status: TaskStatus.pending, 
      },
    });
  }

  /**
   * Retrieves the tasks whose status is marked as graveyard
   */
  async getGraveyardTasks(userId: string): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: {
        userId,
        status: TaskStatus.graveyard,
      },
    });
  }

  /**
   * Retrieves tasks for a specific date range with safe timezone localization string output
   */
  async getTasksByDate(userId: string, dto: GetTasksByDateDto): Promise<{
    date: string // 'YYYY-MM-DD'
    tasks: Task[]
    totalScheduledMinutes: number
    dailyCapacityMinutes: number
    completedMinutes: number
    pendingMinutes: number
    minutesLeft: number
    isCurrentDay: boolean
    todayAvailableMinutes: number
    tasksCompletableToday: string[]
    projectedCompletionAt: string | null
  }> {
    const { startDate, endDate } = dto;

    // We fetch the user unconditionally here because we ALWAYS need the timezone 
    // to format the output string accurately matching the client's day perspective.
    const [tasks, user] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          userId,
          scheduledDate: { gte: startDate, lte: endDate },
          status: { in: [TaskStatus.pending, TaskStatus.completed] },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { dailyCapacityMinutes: true, timezone: true },
      }),
    ]);

    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    const totalScheduledMinutes = tasks.reduce(
      (sum, task) => sum + (task.estimatedMinutes ?? 0),
      0,
    );

    const completedMinutes = tasks
      .filter((task) => task.status === TaskStatus.completed)
      .reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0);
    const pendingTasks = tasks.filter((task) => task.status === TaskStatus.pending);
    const pendingMinutes = pendingTasks.reduce(
      (sum, task) => sum + (task.estimatedMinutes ?? 0),
      0,
    );

    const userTimezone = user.timezone || 'UTC';
    // Task dates are persisted as UTC calendar dates (@db.Date). The API receives
    // the selected calendar date at UTC midnight; do not format that boundary in
    // the user's timezone or negative offsets will turn Oct 18 into Oct 17.
    const date = startDate.toISOString().slice(0, 10);
    const now = new Date();
    const currentDate = this.dateTimeService.getCurrentDateInTimezone(userTimezone);
    const isCurrentDay = date === currentDate;
    const minutesUntilMidnight = isCurrentDay
      ? this.getMinutesUntilLocalMidnight(now, userTimezone)
      : 0;
    const remainingCapacityMinutes = Math.max(
      0,
      (user.dailyCapacityMinutes ?? 480) - completedMinutes,
    );
    const todayAvailableMinutes = isCurrentDay
      ? Math.min(minutesUntilMidnight, remainingCapacityMinutes)
      : 0;

    // Maximizing the number of tasks is achieved by selecting the shortest tasks
    // first. Priority and creation time make equal-length choices deterministic.
    const tasksCompletableToday: string[] = [];
    let availableMinutes = todayAvailableMinutes;
    if (isCurrentDay) {
      [...pendingTasks]
        .sort((a, b) =>
          (a.estimatedMinutes - b.estimatedMinutes) ||
          (b.compositeScore - a.compositeScore) ||
          (a.createdAt.getTime() - b.createdAt.getTime()),
        )
        .forEach((task) => {
          const minutes = task.estimatedMinutes ?? 0;
          if (minutes <= availableMinutes) {
            tasksCompletableToday.push(task.id);
            availableMinutes -= minutes;
          }
        });
    }

    const projectedCompletionAt = isCurrentDay
      ? new Date(now.getTime() + pendingMinutes * 60_000).toISOString()
      : null;

    return {
      date, // UTC calendar date key matching the persisted @db.Date value
      tasks,
      totalScheduledMinutes,
      dailyCapacityMinutes: user.dailyCapacityMinutes ?? 480,
      completedMinutes,
      pendingMinutes,
      minutesLeft: pendingMinutes,
      isCurrentDay,
      todayAvailableMinutes,
      tasksCompletableToday,
      projectedCompletionAt,
    };
  }

  /** Returns real elapsed minutes until the next local midnight, including DST changes. */
  private getMinutesUntilLocalMidnight(now: Date, timezone: string): number {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    const nextDay = new Date(Date.UTC(value('year'), value('month') - 1, value('day') + 1));
    const nextDate = nextDay.toISOString().slice(0, 10);
    const utcCandidate = new Date(`${nextDate}T00:00:00.000Z`);
    const localParts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    }).formatToParts(utcCandidate);
    const localValue = (type: string) => Number(localParts.find((part) => part.type === type)?.value ?? 0);
    const localAsUtc = Date.UTC(
      localValue('year'),
      localValue('month') - 1,
      localValue('day'),
      localValue('hour') === 24 ? 0 : localValue('hour'),
      localValue('minute'),
      localValue('second'),
    );
    const nextMidnight = new Date(utcCandidate.getTime() + utcCandidate.getTime() - localAsUtc);
    return Math.max(0, Math.ceil((nextMidnight.getTime() - now.getTime()) / 60_000));
  }

  /**
   * Returns a per-day summary of scheduled minutes vs. daily_capacity_minutes
   */
  async getCapacitySummary(userId: string, { startDate, endDate }: { startDate: Date; endDate: Date }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { dailyCapacityMinutes: true, timezone: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    const userTimezone = user.timezone || 'UTC';

    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        scheduledDate: { gte: startDate, lte: endDate },
        status: { in: [TaskStatus.pending, TaskStatus.completed] },
      },
    });

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }); 

    const dateMap: Record<string, number> = {};
    tasks.forEach((task) => {
      const dateStr = formatter.format(task.scheduledDate); 
      dateMap[dateStr] = (dateMap[dateStr] || 0) + (task.estimatedMinutes ?? 0);
    });

    const summary: { date: string; totalScheduledMinutes: number; dailyCapacityMinutes: number }[] = [];
    const currentLoopDate = new Date(startDate.getTime());

    while (currentLoopDate <= endDate) {
      const dateStr = formatter.format(currentLoopDate);
      
      summary.push({
        date: dateStr,
        totalScheduledMinutes: dateMap[dateStr] || 0,
        dailyCapacityMinutes: user.dailyCapacityMinutes,
      });

      currentLoopDate.setUTCDate(currentLoopDate.getUTCDate() + 1);
    }

    return summary;
  }

  /**
   * Shifts tasks in bulk safely across absolute UTC database structures
   */
  async bulkShiftTasks(
    userId: string, 
    payload: { startDate: Date | string; endDate: Date | string; shiftToDate: Date | string }
  ) {
    const start = new Date(payload.startDate);
    const end = new Date(payload.endDate);
    const targetDate = new Date(payload.shiftToDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || isNaN(targetDate.getTime())) {
      throw new BadRequestException('Invalid date format.');
    }

    const tasksToShift = await this.prisma.task.findMany({
      where: {
        userId,
        scheduledDate: { gte: start, lte: end },
        status: TaskStatus.pending,
      },
      select: { id: true, scheduledDate: true },
    });

    if (tasksToShift.length === 0) {
      return { shiftedCount: 0, newDate: targetDate };
    }

    const today = this.dateTimeService.now();
    
    const logsToCreate: Prisma.RescheduleLogCreateManyInput[] = tasksToShift.map((task) => ({
      taskId: task.id, 
      fromDate: task.scheduledDate,
      toDate: targetDate,
      reason: 'manual',
      createdAt: today,
    }));

    await this.prisma.$transaction([
      this.prisma.task.updateMany({
        where: {
          id: { in: tasksToShift.map(t => t.id) },
        },
        data: { scheduledDate: targetDate },
      }),
      this.prisma.rescheduleLog.createMany({
        data: logsToCreate,
      }),
    ]);

    return {
      shiftedCount: tasksToShift.length,
      newDate: targetDate,
    };
  }

  /**
   * Bulk creation of tasks directly accepting clean normalized client structures
   */
  async bulkCreateTasks(userId: string, tasksData: CreateTaskDto[]): Promise<{ count: number }> {
    const tasksToCreate = tasksData.map(task => ({
      userId,
      title: task.title,
      description: task.description,
      scheduledDate: task.scheduleDate,
      estimatedMinutes: task.estimatedMinutes ?? 0,
      basePriority: task.basePriority ?? BasePriority.medium,
      planId: task.planId,
    }));
    return this.prisma.task.createMany({ data: tasksToCreate });
  }
}
