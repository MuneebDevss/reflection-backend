import { Injectable } from '@nestjs/common';
import { Tool, Context } from '@rekog/mcp-nest';
import { z } from 'zod';
import type { Request } from 'express';
import { TasksService } from '../../tasks/tasks.service';
import type { AuthenticatedContext } from '../types';

@Injectable()
export class TasksMcpTools {
  constructor(private readonly tasksService: TasksService) {}

  @Tool({
    name: 'create_task',
    description: 'Create a single to-do task for the authenticated user.',
    parameters: z.object({
      title: z.string().min(1).max(200).describe('The brief title of the task'),
      description: z.string().max(2000).optional().describe('Detailed context or notes for the task'),
      estimated_minutes: z.number().int().positive().describe('Expected duration to complete the task in minutes'),
      scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').describe('The target date for the task formatted as YYYY-MM-DD'),
      base_priority: z.enum(['low', 'medium', 'high']).describe('The baseline urgency level of the item'),
    }),
    annotations: {
      title: 'Create Task',
      readOnlyHint: false,
      destructiveHint: false,
    },
  })
  async createTask(input: any, context: AuthenticatedContext, request: Request) {
    try {
      const userId = this.getUserId({ request, ...context });

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
      return this.handleError(error, 'creating the task');
    }
  }

  @Tool({
    name: 'get_tasks',
    description: 'Fetch and view tasks within a specific calendar date range for the authenticated user.',
    parameters: z.object({
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Start date window in YYYY-MM-DD format'),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('End date window in YYYY-MM-DD format'),
      status: z.enum(['pending', 'completed', 'graveyard']).optional().describe('Filter results by specific status states'),
    }),
    annotations: {
      title: 'Get Tasks List',
      readOnlyHint: true,
      destructiveHint: false,
    },
  })
  async getTasks(input: any, context: Context, request: Request) {
    try {
      const userId = this.getUserId({ request, ...context });

      const tasks = await this.tasksService.getTasks(userId, {
        startDate: new Date(input.start_date), // FIX: parse string → Date
        endDate: new Date(input.end_date),     // FIX: parse string → Date
        status: input.status,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }],
      };
    } catch (error: any) {
      return this.handleError(error, 'retrieving tasks');
    }
  }

  @Tool({
    name: 'update_task',
    description: "Update details, priority, or execution dates on an existing task owned by the user.",
    parameters: z.object({
      task_id: z.string().uuid().describe('The unique UUID identifier of the target task'),
      title: z.string().min(1).max(200).optional().describe('New title value for the task'),
      description: z.string().max(2000).optional().describe('Updated contextual notes for the task'),
      estimated_minutes: z.number().int().positive().optional().describe('Revised execution duration in minutes'),
      scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Revised execution date in YYYY-MM-DD'),
      base_priority: z.enum(['low', 'medium', 'high']).optional().describe('Revised urgency priority status'),
    }),
    annotations: {
      title: 'Update Task Details',
      readOnlyHint: false,
      destructiveHint: false,
    },
  })
  async updateTask(input: any, context: AuthenticatedContext, request: Request) {
    try {
      const userId = this.getUserId({ request, ...context });

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
      return this.handleError(error, `updating task ID ${input.task_id}`);
    }
  }

  @Tool({
    name: 'delete_task',
    description: "Permanently erase and remove one of your tasks from the database.",
    parameters: z.object({
      task_id: z.string().uuid().describe('The unique UUID target identifier for deletion'),
    }),
    annotations: {
      title: 'Delete Task Entry',
      readOnlyHint: false,
      destructiveHint: true,
    },
  })
  async deleteTask(input: any, context: Context, request: Request) {
    try {
      const userId = this.getUserId({ request, ...context });
      await this.tasksService.deleteTask(input.task_id);

      return {
        content: [{ type: 'text', text: `Task ID ${input.task_id} has been permanently erased.` }],
      };
    } catch (error: any) {
      return this.handleError(error, `deleting task ID ${input.task_id}`);
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private getUserId(context: AuthenticatedContext): string {
    const ctx = context as any;
    const req = (typeof ctx.switchToHttp === 'function'
      ? ctx.switchToHttp().getRequest()
      : ctx.request || ctx.req) as Request & { mcpUserId?: string };

    if (!req.mcpUserId) {
      throw new Error('AUTH_EXPIRED');
    }
    return req.mcpUserId;
  }

  private handleError(error: any, action: string) {
    let message = `Action failed while ${action}. An unexpected runtime problem occurred.`;

    if (error.message === 'AUTH_EXPIRED' || error.status === 401) {
      message = 'Authentication expired or access token revoked. Please reconnect the connector to authorize access.';
    } else if (error.code === 'P2025' || error.status === 404) {
      message = `Target item not found while ${action}. Confirm that the task exists and belongs to your profile.`;
    } else if (error.message) {
      message = `Operation failed while ${action}: ${error.message}`;
    }

    return {
      content: [{ type: 'text', text: message }],
      isError: true,
    };
  }
}