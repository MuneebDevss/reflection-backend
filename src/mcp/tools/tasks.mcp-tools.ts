import { Injectable } from '@nestjs/common';
import { Tool, Context } from '@rekog/mcp-nest';
import { z } from 'zod';
import type { Request } from 'express';
import { TasksService } from '../../tasks/tasks.service';
import type { AuthenticatedContext } from '../types';
import { getUserId } from '../decorator/get-mcp-user';
import { handleError } from '../decorator/error-handling';
import { GetTasksSchema, CreateTaskSchema, UpdateTaskSchema, DeleteTaskSchema } from '../schemas/task.schema';

@Injectable()
export class TasksMcpTools {
  constructor(private readonly tasksService: TasksService) {}

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

      const task = await this.tasksService.createTask(userId, {
        title: input.title,
        description: input.description,
        estimatedMinutes: input.estimated_minutes,
        scheduleDate: new Date(input.scheduled_date), // FIX: parse string → Date
        basePriority: input.base_priority,
      });

      return {
        content: [{ type: 'text', text: `Successfully created task "${task.title}" scheduled for ${task.scheduledDate}.` }],
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

      const tasks = await this.tasksService.getTasks(userId, {
        startDate: new Date(input.start_date), // FIX: parse string → Date
        endDate: new Date(input.end_date),     // FIX: parse string → Date
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

      const task = await this.tasksService.updateTask(input.task_id, {
        title: input.title,
        description: input.description,
        estimatedMinutes: input.estimated_minutes,
        scheduleDate: input.scheduled_date ? new Date(input.scheduled_date) : undefined, // FIX: parse string → Date
        basePriority: input.base_priority,
      });

      return {
        content: [{ type: 'text', text: `Updated task details successfully for "${task.title}".` }],
      };
    } catch (error: any) {
      return handleError(error, `updating task ID ${input.task_id}`);
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
      await this.tasksService.deleteTask(input.task_id);

      return {
        content: [{ type: 'text', text: `Task ID ${input.task_id} has been permanently erased.` }],
      };
    } catch (error: any) {
      return handleError(error, `deleting task ID ${input.task_id}`);
    }
  }

}
