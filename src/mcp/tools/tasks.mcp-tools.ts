import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Tool, Context } from '@rekog/mcp-nest';
import type { Request } from 'express';
import { TasksService } from '../../tasks/tasks.service';
import { UsersService } from '../../users/users.service';
import type { AuthenticatedContext } from '../types';
import { getUserId } from '../decorator/get-mcp-user';
import { handleError } from '../decorator/error-handling';
import { GetTasksSchema, CreateTaskSchema, UpdateTaskSchema, DeleteTaskSchema } from '../schemas/task.schema';
import { getUtcDateForTimezone } from '../decorator/helpers';

@Injectable()
export class TasksMcpTools {
  constructor(
    private readonly tasksService: TasksService,
    private readonly usersService: UsersService, // Added to pull user configurations dynamically
  ) {}

  @Tool({
    name: 'create_task',
    description: 'Create a single to-do task for the authenticated user.',
    parameters: CreateTaskSchema,
    annotations: {
      title: 'Create Task',
      readOnlyHint: false,
      destructiveHint: false,
    },
  })
  async createTask(input: any, context: AuthenticatedContext, request: Request) {
    try {
      const userId = getUserId({ request, ...context });

      // Fetch the user configuration to ensure accurate local calendar placement
      const user = await this.usersService.findOne(userId);

      const userTimezone = user.timezone || 'UTC';
      const parsedScheduleDate = getUtcDateForTimezone(input.scheduledDate, userTimezone, false);

      const task = await this.tasksService.createTask(userId, {
        title: input.title,
        description: input.description,
        estimatedMinutes: input.estimatedMinutes ?? 0,
        scheduleDate: parsedScheduleDate, // Safe local midnight representation
        basePriority: input.basePriority ?? 'medium',
      });

      return {
        content: [{ type: 'text', text: `Successfully created task "${task.title}" scheduled for ${task.scheduledDate.toISOString()}.` }],
      };
    } catch (error: any) {
      return handleError(error, 'creating the task');
    }
  }

  @Tool({
    name: 'get_tasks',
    description: 'Fetch and view tasks within a specific calendar date range for the authenticated user.',
    parameters: GetTasksSchema,
    annotations: {
      title: 'Get Tasks List',
      readOnlyHint: true,
      destructiveHint: false,
    },
  })
  async getTasks(input: any, context: AuthenticatedContext, request: Request) {
    try {
      const userId = getUserId({ request, ...context });

      const user = await this.usersService.findOne(userId);

      const userTimezone = user.timezone || 'UTC';
      
      // Calculate start window boundary (00:00:00 local time mapping)
      const startDate = getUtcDateForTimezone(input.startDate, userTimezone, false);
      // Calculate end window boundary (23:59:59 local time mapping)
      const endDate = getUtcDateForTimezone(input.endDate, userTimezone, true);

      const tasks = await this.tasksService.getTasks(userId, {
        startDate,
        endDate,
        status: input.status,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }],
      };
    } catch (error: any) {
      return handleError(error, 'retrieving tasks');
    }
  }

  @Tool({
    name: 'update_task',
    description: "Update details, priority, or execution dates on an existing task owned by the user.",
    parameters: UpdateTaskSchema,
    annotations: {
      title: 'Update Task Details',
      readOnlyHint: false,
      destructiveHint: false,
    },
  })
  async updateTask(input: any, context: AuthenticatedContext, request: Request) {
    try {
      const userId = getUserId({ request, ...context });

      let parsedScheduleDate: Date | undefined = undefined;

      if (input.scheduledDate) {
        const user = await this.usersService.findOne(userId);
        
        parsedScheduleDate = getUtcDateForTimezone(input.scheduledDate, user.timezone || 'UTC', false);
      }

      const task = await this.tasksService.updateTask(input.taskId, userId, {
        title: input.title,
        description: input.description,
        estimatedMinutes: input.estimatedMinutes ?? 0,
        scheduleDate: parsedScheduleDate,
        basePriority: input.basePriority ?? 'medium',
      });

      return {
        content: [{ type: 'text', text: `Updated task details successfully for "${task.title}".` }],
      };
    } catch (error: any) {
      return handleError(error, `updating task ID ${input.taskId}`);
    }
  }

  @Tool({
    name: 'delete_task',
    description: "Permanently erase and remove one of your tasks from the database.",
    parameters: DeleteTaskSchema,
    annotations: {
      title: 'Delete Task Entry',
      readOnlyHint: false,
      destructiveHint: true,
    },
  })
  async deleteTask(input: any, context: AuthenticatedContext, request: Request) {
    try {
      const userId = getUserId({ request, ...context });
      await this.tasksService.deleteTask(input.taskId, userId);

      return {
        content: [{ type: 'text', text: `Task ID ${input.taskId} has been permanently erased.` }],
      };
    } catch (error: any) {
      return handleError(error, `deleting task ID ${input.taskId}`);
    }
  }
}