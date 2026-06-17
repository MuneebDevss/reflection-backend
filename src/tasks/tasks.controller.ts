import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Delete,
  Request,
  UseGuards,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateTaskDto } from './dto/update-tasks.dto';
import { CreateTaskDto } from './dto/create-tasks.dto';
import { GetUser } from '@auth/decorators';
import { GetTasksByDateDto } from './dto/get-tasks-by-date.dto';
import { GetTasks } from './dto/get-tasks.dto';

/**
 * Interface representing an Express request payload injected with auth data via JwtAuthGuard.
 */


@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  /**
   * Retrieves all tasks belonging to the currently authenticated user
   * @param req - Authenticated request containing user context
   * @returns Array of tasks
   */
  @Get()
  async getTasks(@GetUser('userId') userId: string, @Query() query: GetTasks) {
    return this.tasksService.getTasks(userId , query);
  }

  /**
   * Retrieves all overdue tasks for the authenticated user
   * NOTE: Placed above dynamic route parameters to avoid routing conflicts
   * @param req - Authenticated request containing user context
   * @returns Array of overdue tasks
   */
  @Get('overdue')
  async getOverdueTasks(@GetUser('userId') userId: string) {
    return this.tasksService.getOverdueTasks(userId);
  }

  /**
   * Retrieves all graveyard (archived/old) tasks for the authenticated user
   * NOTE: Placed above dynamic route parameters to avoid routing conflicts
   * @param req - Authenticated request containing user context
   * @returns Array of graveyard tasks
   */
  @Get('graveyard')
  async getGraveyardTasks(@GetUser('userId') userId: string) {
    return this.tasksService.getGraveyardTasks(userId);
  }

  /**
   * Retrieves all tasks scheduled for a specific date,
   * along with total scheduled minutes and daily capacity
   * @param req - Authenticated request containing user context
   * @query data - Payload containing date range and capacity inclusion flag
   * @returns Object containing the date, array of tasks, total scheduled minutes, and daily capacity
   */
  @Get('by-date')
  async getTasksByDate(
    @GetUser('userId') userId: string,
    @Query() data: GetTasksByDateDto,
  ) {
    return this.tasksService.getTasksByDate(userId, data);
  }

  /**
   * Retrieves a specific task by its unique ID
   * @param req - Authenticated request containing user context
   * @param id - Valid UUID string of the target task
   * @returns Found task payload or null
   */
  @Get(':id')
  async getTaskById(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    // Note: Production environments should ensure this task belongs to userId inside the service
    return this.tasksService.getTaskById(id);
  }

  /**
   * Creates a new task assigned to the authenticated user
   * @param req - Authenticated request containing user context
   * @param data - Payload containing task creation constraints
   * @returns The newly created task object
   */
  @Post()
  async createTask(@GetUser('userId') userId: string, @Body() data: CreateTaskDto) {
    return this.tasksService.createTask(userId, data);
  }

  /**
   * Partially updates an existing task's properties
   * @param req - Authenticated request containing user context
   * @param id - Valid UUID string of the target task
   * @param data - Payload containing fields to update
   * @returns The updated task object
   */
  @Patch(':id')
  async updateTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateTaskDto,
  ) {
    return this.tasksService.updateTask(id, data);
  }

  /**
   * Deletes a specific task from the system
   * @param req - Authenticated request containing user context
   * @param id - Valid UUID string of the target task to delete
   * @returns The deleted task object structure
   */
  @Delete(':id')
  async deleteTask(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    // Note: Production environments should ensure this task belongs to req.userId inside the service
    return this.tasksService.deleteTask(id);
  }
  
}