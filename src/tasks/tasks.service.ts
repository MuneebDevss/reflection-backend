import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BasePriority, Prisma, Task, TaskStatus } from '@prisma/client';
import { CreateTaskDto } from './dto/create-tasks.dto';
import { UpdateTaskDto } from './dto/update-tasks.dto';
import { GetTasksByDateDto } from './dto/get-tasks-by-date.dto';
import { GetTasks } from './dto/get-tasks.dto';
import { DateTimeService } from '@common/date-time/date-time.service';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService, private readonly dateTimeService: DateTimeService) {}

  /**
   * Retrieves all tasks associated with a specific user
   * @param userId - Unique identifier of the user
   * @returns Array of task objects
   */
  async getTasks(userId: string, query: GetTasks): Promise<Task[]> {
  query.startDate?.setUTCHours(0, 0, 0, 0);
  query.endDate?.setUTCHours(23, 59, 59, 999);
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
      { compositeScore: 'desc' }, // within same day, higher score first
    ],
  });
}

  /**
   * Creates a new task for a specific user
   * @param userId - Unique identifier of the user creating the task
   * @param data - The task details payload
   * @returns The newly created task object
   */
  async createTask(userId: string, data: CreateTaskDto): Promise<Task> {
    const startofDay = this.dateTimeService.startOfDay(data.scheduleDate);
    return this.prisma.task.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        scheduledDate: startofDay,
        estimatedMinutes: data.estimatedMinutes ?? 0,
        basePriority: data.basePriority ?? BasePriority.medium, // Prisma enums default to uppercase
        planId: data.planId,
      },
    });
  }

  /**
   * Updates an existing task's details
   * @param taskId - Unique identifier of the task to update
   * @param data - Partial task details payload to apply
   * @returns The updated task object
   */
  async updateTask(taskId: string, data: UpdateTaskDto): Promise<Task> {
    return this.prisma.task.update({
      where: { id: taskId },
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

  /**
   * Deletes a specific task by its ID
   * @param taskId - Unique identifier of the task to delete
   * @returns The deleted task object
   */
  async deleteTask(taskId: string): Promise<Task> {
    return this.prisma.task.delete({
      where: { id: taskId },
    });
  }

  /**
   * Retrieves a single task by its unique identifier
   * @param taskId - Unique identifier of the task
   * @returns The found task object or null if not found
   */
  async getTaskById(taskId: string): Promise<Task | null> {
    return this.prisma.task.findUnique({
      where: { id: taskId },
    });
  }

  /**
   * Retrieves all incomplete tasks for a user where the scheduled date is in the past
   * @param userId - Unique identifier of the user
   * @returns Array of overdue task objects
   */
  async getOverdueTasks(userId: string): Promise<Task[]> {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    return this.prisma.task.findMany({
      where: {
        userId,
        scheduledDate: {
          lt: todayStart,
        },
        status: TaskStatus.pending, 
      },
    });
  }

  /**
   * Retrieves the tasks whose status is marked as graveyard
   * @param userId - Unique identifier of the user
   * @returns Array of graveyard task objects
   */
    async getGraveyardTasks(userId: string): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: {
        userId,
        status: TaskStatus.graveyard,
      },
    });
  }

  async getTasksByDate(userId: string, dto: GetTasksByDateDto): Promise<{
  date: string // 'YYYY-MM-DD'
  tasks: Task[]
  totalScheduledMinutes: number
  dailyCapacityMinutes: number
  }> {
  const { startDate, endDate, includeCapacity } = dto;

  // Normalize date bounds and fetch tasks in parallel with optional user lookup
  
  const startDateUTC = this.dateTimeService.startOfDay(startDate);
  const endDateUTC = this.dateTimeService.endOfDay(endDate);
  const [tasks, user] = await Promise.all([
    this.prisma.task.findMany({
      where: {
        userId,
        scheduledDate: { gte: startDateUTC, lte: endDateUTC },
        status: { in: [TaskStatus.pending, TaskStatus.completed] },
      },
    }),
    includeCapacity
      ? this.prisma.user.findUnique({
          where: { id: userId },
          select: { dailyCapacityMinutes: true },
        })
      : Promise.resolve(null),
  ]);

  if (includeCapacity && !user) {
    throw new NotFoundException(`User not found: ${userId}`);
  }

  const totalScheduledMinutes = tasks.reduce(
    (sum, task) => sum + (task.estimatedMinutes ?? 0),
    0,
  );

  return {
    date: startDate.toISOString().split('T')[0],
    tasks,
    totalScheduledMinutes,
    dailyCapacityMinutes: user?.dailyCapacityMinutes ?? 480,
  };
 }
 /**
  * Returns a per-day summary of scheduled minutes vs. daily_capacity_minutes
  * @param userId - Unique identifier of the user
  * @param startDate - Start date of the summary range
  * @param endDate - End date of the summary range
  * @returns Array of daily summaries with date, total scheduled minutes, and capacity
  */
  async getCapacitySummary(userId: string, { startDate, endDate }: { startDate: Date; endDate: Date }) {
    
    // Normalize date bounds
    const start = this.dateTimeService.startOfDay(startDate);
    const end = this.dateTimeService.endOfDay(endDate);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { dailyCapacityMinutes: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        scheduledDate: { gte: start, lte: end },
        status: { in: [TaskStatus.pending, TaskStatus.completed] },
      },
    });

    // Create a map of date strings to total scheduled minutes
    const dateMap: Record<string, number> = {};
    tasks.forEach((task) => {
      const dateStr = task.scheduledDate.toISOString().split('T')[0];
      dateMap[dateStr] = (dateMap[dateStr] || 0) + (task.estimatedMinutes ?? 0);
    });

    // Generate the summary for each day in the range
    const summary: { date: string; totalScheduledMinutes: number; dailyCapacityMinutes: number }[] = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      summary.push({
        date: dateStr,
        totalScheduledMinutes: dateMap[dateStr] || 0,
        dailyCapacityMinutes: user.dailyCapacityMinutes,
      });
    }

    return summary;
  }
  /**
   * Shifts tasks in bulk based on the provided shifts. Each shift contains a task ID and the number of days to shift.
   * @param userId - Unique identifier of the user
   * @param startDate - The start date of the range to consider for shifting tasks (inclusive).
   * @param endDate - The end date of the range to consider for shifting tasks (inclusive).
   * @param shiftToDate - The date to which the tasks should be shifted.
   * @returns A summary of the shifted tasks, including their new scheduled dates.
   * Note: This method performs a bulk update of tasks' scheduled dates and logs each change in the RescheduleLog table. It ensures that only pending tasks within the specified date range are shifted, and it operates within a single transaction for data integrity.
   */
async bulkShiftTasks(
  userId: string, 
  payload: { startDate: Date | string; endDate: Date | string; shiftToDate: Date | string }
) {
  // 1. Defensively parse and isolate dates (avoids mutation side-effects)
  const start = new Date(payload.startDate);
  const end = new Date(payload.endDate);
  const targetDate = new Date(payload.shiftToDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || isNaN(targetDate.getTime())) {
    throw new BadRequestException('Invalid date format.');
  }

  // Normalize bounds locally without mutating the original parameters
  const startOfDay = this.dateTimeService.startOfDay(start);
  const endOfDay = this.dateTimeService.endOfDay(end);
  const targetDateOfDay = this.dateTimeService.startOfDay(targetDate);

  // 2. Fetch only the IDs and scheduledDates to minimize memory allocation
  const tasksToShift = await this.prisma.task.findMany({
    where: {
      userId,
      scheduledDate: { gte: startOfDay, lte: endOfDay },
      status: TaskStatus.pending,
    },
    select: { id: true, scheduledDate: true },
  });

  if (tasksToShift.length === 0) {
    return { shiftedCount: 0, newDate: targetDateOfDay };
  }

  const today = this.dateTimeService.now();
  
  // Prepare logs for efficient bulk insertion
  const logsToCreate : Prisma.RescheduleLogCreateManyInput[] = tasksToShift.map((task) => ({
    taskId: task.id, 
    fromDate: task.scheduledDate,
    toDate: targetDateOfDay,
    reason: 'manual',
    createdAt: today,
  }));

  // 3. Optimized Transaction using Set-Based Operations (Exactly 2 Queries)
  await this.prisma.$transaction([
    // Query 1: Bulk update matches using a single WHERE clause
    this.prisma.task.updateMany({
      where: {
        id: { in: tasksToShift.map(t => t.id) },
      },
      data: { scheduledDate: targetDate },
    }),
    
    // Query 2: Single bulk-insert query for logs
    this.prisma.rescheduleLog.createMany({
      data: logsToCreate,
    }),
  ]);

  return {
    shiftedCount: tasksToShift.length,
    newDate: targetDateOfDay,
  };
}
/**
 * bulk creation of tasks
 * @param CreateTaskDto[] - Array of task creation payloads
 * @returns return Count of tasks created
 */
async bulkCreateTasks(userId: string, tasksData: CreateTaskDto[]): Promise<{ count: number }> {
  const tasksToCreate = tasksData.map(task => ({
    userId,
    title: task.title,
    description: task.description,
    scheduledDate: this.dateTimeService.startOfDay(task.scheduleDate),
    estimatedMinutes: task.estimatedMinutes ?? 0,
    basePriority: task.basePriority ?? BasePriority.medium,
    planId: task.planId,
  }));
  return this.prisma.task.createMany({ data: tasksToCreate });
}
}
