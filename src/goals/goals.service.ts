import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class GoalsService {
  private readonly logger = new Logger(GoalsService.name);

  constructor(private prisma: PrismaService) {}

  async create(createGoalDto: CreateGoalDto) {
    try {
      // Validate date
      const deadline = new Date(createGoalDto.deadline);
      if (isNaN(deadline.getTime())) {
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

      return await this.prisma.goal.create({
        data: {
          ...createGoalDto,
          deadline,
        },
      });
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

      return await this.prisma.goal.findMany({
        where: userId ? { userId } : undefined,
        orderBy: {
          createdAt: 'desc',
        },
      });
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

      return goal;
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

      return await this.prisma.goal.update({
        where: { id },
        data: updateGoalDto,
      });
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

      // Check if goal exists
      const existingGoal = await this.prisma.goal.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existingGoal) {
        throw new NotFoundException(`Goal with ID ${id} not found`);
      }

      return await this.prisma.goal.delete({
        where: { id },
      });
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
