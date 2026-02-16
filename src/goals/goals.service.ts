import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { Prisma } from '@prisma/client';
import { DateTimeService } from '../common/date-time/date-time.service';

@Injectable()
export class GoalsService {
  private readonly logger = new Logger(GoalsService.name);

  constructor(
    private prisma: PrismaService,
    private dateTimeService: DateTimeService
  ) {}

  async create(createGoalDto: CreateGoalDto) {
    try {
      // Validate date
      const deadline = this.dateTimeService.parseDate(createGoalDto.deadline);
      if (!this.dateTimeService.isValidDate(deadline)) {
        throw new BadRequestException('Invalid deadline date format');
      }

      // Check if user exists
      const userExists = await this.prisma.user.findUnique({
        where: { id: createGoalDto.userId },
        select: { id: true },
      });

      if (!userExists) {
        throw new NotFoundException(`User with ID ${createGoalDto.userId} not found`);
      }

      const goal = await this.prisma.goal.create({
        data: {
          ...createGoalDto,
          deadline,
        },
      });

      // New goals have no tasks, so progress is always 0
      return {
        ...goal,
        progress: 0,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to create goal: ${error.message}`, error.stack);

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2003: Foreign key constraint violation
        if (error.code === 'P2003') {
          throw new BadRequestException('Invalid user ID');
        }
      }

      throw new InternalServerErrorException('Failed to create goal');
    }
  }

  async findAll(userId?: string) {
    try {
      // Validate userId if provided
      if (userId && !this.isValidUUID(userId)) {
        throw new BadRequestException('Invalid user ID format');
      }

      // Fetch all goals for the user
      const goals = await this.prisma.goal.findMany({
        where: userId ? { userId } : undefined,
        orderBy: {
          createdAt: 'desc',
        },
      });

      // If no goals, return empty array
      if (goals.length === 0) {
        return [];
      }

      // Extract goal IDs
      const goalIds = goals.map((goal) => goal.id);

      // Fetch all daily tasks for these goals in a single query
      const dailyTasks = await this.prisma.dailyTask.findMany({
        where: {
          goalId: { in: goalIds },
        },
        select: {
          goalId: true,
          difficulty: true,
          status: true,
        },
      });

      // Group tasks by goalId and calculate progress
      const progressMap = new Map<string, number>();

      // Initialize progress for all goals to 0
      goals.forEach((goal) => {
        progressMap.set(goal.id, 0);
      });

      // Group tasks by goalId
      const tasksByGoal = new Map<string, typeof dailyTasks>();
      dailyTasks.forEach((task) => {
        if (!tasksByGoal.has(task.goalId)) {
          tasksByGoal.set(task.goalId, []);
        }
        tasksByGoal.get(task.goalId)!.push(task);
      });

      // Calculate progress for each goal
      tasksByGoal.forEach((tasks, goalId) => {
        const totalDifficulty = tasks.reduce((sum, task) => sum + task.difficulty, 0);
        const completedDifficulty = tasks
          .filter((task) => task.status === 'COMPLETED')
          .reduce((sum, task) => sum + task.difficulty, 0);

        const progress = totalDifficulty > 0 
          ? Math.round((completedDifficulty / totalDifficulty) * 100)
          : 0;

        // Clamp between 0 and 100
        progressMap.set(goalId, Math.max(0, Math.min(100, progress)));
      });

      // Map progress back to goals
      return goals.map((goal) => ({
        ...goal,
        progress: progressMap.get(goal.id) ?? 0,
      }));
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to fetch goals: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch goals');
    }
  }

  async findOne(id: string) {
    try {
      // Validate UUID format
      if (!this.isValidUUID(id)) {
        throw new BadRequestException('Invalid goal ID format');
      }

      const goal = await this.prisma.goal.findUnique({
        where: { id },
      });

      if (!goal) {
        throw new NotFoundException(`Goal with ID ${id} not found`);
      }

      // Fetch all daily tasks for this goal
      const dailyTasks = await this.prisma.dailyTask.findMany({
        where: { goalId: id },
        select: {
          difficulty: true,
          status: true,
        },
      });

      // Calculate progress
      const totalDifficulty = dailyTasks.reduce((sum, task) => sum + task.difficulty, 0);
      const completedDifficulty = dailyTasks
        .filter((task) => task.status === 'COMPLETED')
        .reduce((sum, task) => sum + task.difficulty, 0);

      const progress = totalDifficulty > 0 
        ? Math.round((completedDifficulty / totalDifficulty) * 100)
        : 0;

      // Clamp between 0 and 100
      const clampedProgress = Math.max(0, Math.min(100, progress));

      return {
        ...goal,
        progress: clampedProgress,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to fetch goal ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch goal');
    }
  }

  async update(id: string, updateGoalDto: UpdateGoalDto) {
    try {
      // Validate UUID format
      if (!this.isValidUUID(id)) {
        throw new BadRequestException('Invalid goal ID format');
      }

      // Check if goal exists
      const existingGoal = await this.prisma.goal.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existingGoal) {
        throw new NotFoundException(`Goal with ID ${id} not found`);
      }

      // Parse deadline if provided
      const data: any = { ...updateGoalDto };
      if (updateGoalDto.deadline) {
        const deadline = this.dateTimeService.parseDate(updateGoalDto.deadline);
        if (!this.dateTimeService.isValidDate(deadline)) {
          throw new BadRequestException('Invalid deadline date format');
        }
        data.deadline = deadline;
      }

      const updatedGoal = await this.prisma.goal.update({
        where: { id },
        data,
      });

      // Fetch daily tasks to calculate progress
      const dailyTasks = await this.prisma.dailyTask.findMany({
        where: { goalId: id },
        select: {
          difficulty: true,
          status: true,
        },
      });

      // Calculate progress
      const totalDifficulty = dailyTasks.reduce((sum, task) => sum + task.difficulty, 0);
      const completedDifficulty = dailyTasks
        .filter((task) => task.status === 'COMPLETED')
        .reduce((sum, task) => sum + task.difficulty, 0);

      const progress = totalDifficulty > 0 
        ? Math.round((completedDifficulty / totalDifficulty) * 100)
        : 0;

      // Clamp between 0 and 100
      const clampedProgress = Math.max(0, Math.min(100, progress));

      return {
        ...updatedGoal,
        progress: clampedProgress,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to update goal ${id}: ${error.message}`, error.stack);

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2025: Record not found
        if (error.code === 'P2025') {
          throw new NotFoundException(`Goal with ID ${id} not found`);
        }
      }

      throw new InternalServerErrorException('Failed to update goal');
    }
  }

  async remove(id: string) {
    try {
      // Validate UUID format
      if (!this.isValidUUID(id)) {
        throw new BadRequestException('Invalid goal ID format');
      }

      // Check if goal exists and fetch tasks before deletion
      const existingGoal = await this.prisma.goal.findUnique({
        where: { id },
      });

      if (!existingGoal) {
        throw new NotFoundException(`Goal with ID ${id} not found`);
      }

      // Fetch daily tasks to calculate progress before deletion
      const dailyTasks = await this.prisma.dailyTask.findMany({
        where: { goalId: id },
        select: {
          difficulty: true,
          status: true,
        },
      });

      // Delete the goal (cascade will delete tasks)
      const deletedGoal = await this.prisma.goal.delete({
        where: { id },
      });

      // Calculate progress
      const totalDifficulty = dailyTasks.reduce((sum, task) => sum + task.difficulty, 0);
      const completedDifficulty = dailyTasks
        .filter((task) => task.status === 'COMPLETED')
        .reduce((sum, task) => sum + task.difficulty, 0);

      const progress = totalDifficulty > 0 
        ? Math.round((completedDifficulty / totalDifficulty) * 100)
        : 0;

      // Clamp between 0 and 100
      const clampedProgress = Math.max(0, Math.min(100, progress));

      return {
        ...deletedGoal,
        progress: clampedProgress,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to delete goal ${id}: ${error.message}`, error.stack);

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2025: Record not found
        if (error.code === 'P2025') {
          throw new NotFoundException(`Goal with ID ${id} not found`);
        }
      }

      throw new InternalServerErrorException('Failed to delete goal');
    }
  }

  private isValidUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id) || /^[a-zA-Z0-9-_]+$/.test(id); // Allow custom IDs like 'user-1'
  }
}
