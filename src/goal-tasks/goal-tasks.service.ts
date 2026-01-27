import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class GoalTasksService {
  private readonly logger = new Logger(GoalTasksService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService
  ) {}

  /**
   * Get all tasks for today for a specific goal
   */
  async getTodayTasks(goalId: string) {
    // Verify goal exists
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
    });

    if (!goal) {
      throw new NotFoundException(`Goal with ID ${goalId} not found`);
    }

    // Get start and end of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tasks = await this.prisma.dailyTask.findMany({
      where: {
        goalId,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    this.logger.log(`Found ${tasks.length} tasks for goal ${goalId} for today`);
    return tasks;
  }

  /**
   * Generate tasks for today based on past performance
   */
  async generateTasksForToday(goalId: string) {
    // Verify goal exists
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
    });

    if (!goal) {
      throw new NotFoundException(`Goal with ID ${goalId} not found`);
    }

    // Check if tasks already exist for today
    const existingTasks = await this.getTodayTasks(goalId);
    if (existingTasks.length > 0) {
      this.logger.log(`Tasks already exist for goal ${goalId} today`);
      return existingTasks;
    }

    // Get start and end of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all previous tasks for this goal
    const previousTasks = await this.prisma.dailyTask.findMany({
      where: {
        goalId,
        date: {
          lt: today,
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Calculate task generation parameters
    const taskParams = this.calculateTaskParameters(goal, previousTasks);
    
    // Generate tasks using AI
    const generatedTasks = await this.aiService.generateTasks(
      {
        title: goal.title,
        description: goal.description,
        deadline: goal.deadline,
        progress: goal.progress,
      },
      previousTasks.map(t => ({
        title: t.title,
        description: t.description,
        date: t.date,
        difficulty: t.difficulty,
        status: t.status,
      })),
      taskParams.count,
      taskParams.difficulty
    );

    // Save generated tasks to database
    const tasks = await this.saveTasks(goalId, generatedTasks, taskParams.difficulty);

    this.logger.log(
      `Generated ${tasks.length} AI-powered tasks for goal ${goalId} with difficulty ${taskParams.difficulty}`
    );

    return tasks;
  }

  /**
   * Calculate task parameters based on past performance
   */
  private calculateTaskParameters(
    goal: any,
    previousTasks: any[]
  ): { count: number; difficulty: number } {
    const deadline = new Date(goal.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const daysUntilDeadline = Math.ceil(
      (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    // If no previous tasks, start with baseline
    if (previousTasks.length === 0) {
      return { count: 3, difficulty: 1 };
    }

    // Group tasks by date to find most recent day's tasks
    const tasksByDate = new Map<string, any[]>();
    previousTasks.forEach((task) => {
      const dateKey = task.date.toISOString().split('T')[0];
      if (!tasksByDate.has(dateKey)) {
        tasksByDate.set(dateKey, []);
      }
      tasksByDate.get(dateKey)!.push(task);
    });

    // Get most recent day's tasks
    const dates = Array.from(tasksByDate.keys()).sort().reverse();
    const mostRecentDate = dates[0];
    const mostRecentTasks = tasksByDate.get(mostRecentDate) || [];

    // Calculate completion rate for most recent tasks
    const completedCount = mostRecentTasks.filter(
      (t) => t.status === 'COMPLETED'
    ).length;
    const totalCount = mostRecentTasks.length;
    const completionRate = totalCount > 0 ? completedCount / totalCount : 0;

    // Get average difficulty of completed tasks
    const completedTasks = previousTasks.filter((t) => t.status === 'COMPLETED');
    const avgCompletedDifficulty =
      completedTasks.length > 0
        ? completedTasks.reduce((sum, t) => sum + t.difficulty, 0) / completedTasks.length
        : 1;

    let newCount = totalCount;
    let newDifficulty = Math.round(avgCompletedDifficulty);

    // If all tasks completed, increase count and difficulty
    if (completionRate === 1) {
      newCount = totalCount + 1;
      newDifficulty = Math.min(
        mostRecentTasks[0]?.difficulty + 1 || 1,
        5
      ); // Max difficulty of 5
    } else if (completionRate >= 0.7) {
      // If most tasks completed, keep count and slightly increase difficulty
      newCount = totalCount;
      newDifficulty = Math.min(
        Math.round(avgCompletedDifficulty + 0.5),
        5
      );
    } else {
      // If struggling, keep count same and base difficulty on completed tasks
      newCount = totalCount;
      newDifficulty = Math.max(Math.round(avgCompletedDifficulty), 1);
    }

    // Approaching deadline adjustment
    if (daysUntilDeadline <= 7 && daysUntilDeadline > 0) {
      newCount = Math.min(newCount + 1, 8); // Slightly increase task count
      newDifficulty = Math.min(newDifficulty + 1, 5); // Increase difficulty
    }

    // Ensure reasonable bounds
    newCount = Math.max(2, Math.min(newCount, 8));
    newDifficulty = Math.max(1, Math.min(newDifficulty, 5));

    return { count: newCount, difficulty: newDifficulty };
  }

  /**
   * Save AI-generated tasks to database
   */
  private async saveTasks(
    goalId: string,
    generatedTasks: { title: string; description: string | null; difficulty: number }[],
    difficulty: number
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tasks = [];

    for (const taskData of generatedTasks) {
      const task = await this.prisma.dailyTask.create({
        data: {
          goalId,
          title: taskData.title,
          description: taskData.description,
          date: today,
          difficulty: difficulty, // Use the calculated difficulty consistently
          status: 'PENDING',
        },
      });

      tasks.push(task);
    }

    return tasks;
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    taskId: string,
    status: 'PENDING' | 'COMPLETED' | 'SKIPPED'
  ) {
    const task = await this.prisma.dailyTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    const updatedTask = await this.prisma.dailyTask.update({
      where: { id: taskId },
      data: { status },
    });

    this.logger.log(`Updated task ${taskId} status to ${status}`);
    return updatedTask;
  }
}
