import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BasePriority, Task, TaskStatus } from '@prisma/client';
import { CreateTaskDto } from './dto/create-tasks.dto';
import { UpdateTaskDto } from './dto/update-tasks.dto';
import { GetTasksByDateDto } from './dto/get-tasks-by-date.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves all tasks associated with a specific user
   * @param userId - Unique identifier of the user
   * @returns Array of task objects
   */
  async getTasks(userId: string): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: { userId },
    });
  }

  /**
   * Creates a new task for a specific user
   * @param userId - Unique identifier of the user creating the task
   * @param data - The task details payload
   * @returns The newly created task object
   */
  async createTask(userId: string, data: CreateTaskDto): Promise<Task> {
    return this.prisma.task.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        scheduledDate: data.scheduleDate,
        estimatedMinutes: data.estimatedMinutes ?? 0,
        basePriority: data.basePriority ?? BasePriority.medium, // Prisma enums default to uppercase
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
    todayStart.setHours(0, 0, 0, 0);

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
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  const [tasks, user] = await Promise.all([
    this.prisma.task.findMany({
      where: {
        userId,
        scheduledDate: { gte: startDate, lte: endDate },
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

}