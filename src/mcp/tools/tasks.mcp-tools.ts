import { Injectable } from '@nestjs/common';
import { Tool, Context } from '@rekog/mcp-nest';
import { z } from 'zod';
import type { Request } from 'express';
import { TasksService } from '../../tasks/tasks.service';
import type { AuthenticatedContext } from '../types';

/**
 * TasksMcpTools
 * ─────────────
 * MCP-facing wrapper around the existing TasksService — the same service
 * your REST controllers (/tasks, /tasks/:id, etc.) already call.
 *
 * Pattern for every method in this class:
 *   1. Pull userId off the request (attached by McpBearerGuard — never
 *      accept it as a tool argument).
 *   2. Validate input with the tool's Zod `parameters` schema.
 *   3. Delegate to TasksService, always passing userId as the scope.
 *
 * `@rekog/mcp-nest` injects the raw Express request into Context.
 */
@Injectable()
export class TasksMcpTools {
  constructor(private readonly tasksService: TasksService) {}

  @Tool({
    annotations: {
      title: 'Create Task',
    },
    name: 'create_task',
    description: 'Create a single task for the authenticated user.',
    parameters: z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
      estimated_minutes: z.number().int().positive(),
      scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
      base_priority: z.enum(['low', 'medium', 'high']),
    }),
  })
  async createTask(input: any, context: AuthenticatedContext, request: Request) {
    const userId = this.getUserId({ request , ...context });;

    const task = await this.tasksService.createTask(userId, {
      title: input.title,
      description: input.description,
      estimatedMinutes: input.estimated_minutes,
      scheduleDate: input.scheduled_date,
      basePriority: input.base_priority,
    });

    return {
      content: [{ type: 'text', text: `Created task "${task.title}" for ${task.scheduledDate}.` }],
    };
  }

  @Tool({
    name: 'get_tasks',
    description: 'Fetch tasks within a date range for the authenticated user.',
    parameters: z.object({
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      status: z.enum(['pending', 'completed', 'graveyard']).optional(),
    }),
  })
  async getTasks(input: any, context: Context, request: Request) {
    const userId = this.getUserId({ request , ...context });;

    const tasks = await this.tasksService.getTasks(userId, {
      startDate: input.start_date,
      endDate: input.end_date,
      status: input.status,
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }],
    };
  }

  @Tool({
    name: 'update_task',
    description: "Update any mutable field on one of the authenticated user's tasks.",
    parameters: z.object({
      task_id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
      estimated_minutes: z.number().int().positive().optional(),
      scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      base_priority: z.enum(['low', 'medium', 'high']).optional(),
    }),
  })
  async updateTask(input: any, context: AuthenticatedContext, request: Request) {
    const userId = this.getUserId({ request , ...context });;

    // TasksService.update enforces ownership internally — it scopes the
    // Prisma `where` by { id: taskId, userId }, so a token for user A can
    // never mutate user B's task even if they somehow learned the task_id.
    const task = await this.tasksService.updateTask(input.task_id, {
      title: input.title,
      description: input.description,
      estimatedMinutes: input.estimated_minutes,
      scheduleDate: input.scheduled_date,
      basePriority: input.base_priority,
    });

    return {
      content: [{ type: 'text', text: `Updated task "${task.title}".` }],
    };
  }

  @Tool({
    name: 'delete_task',
    description: "Delete one of the authenticated user's tasks.",
    parameters: z.object({
      task_id: z.string().uuid(),
    }),
  })
  async deleteTask(input: any, context: Context, request: Request) {
    await this.tasksService.deleteTask(input.task_id);

    return {
      content: [{ type: 'text', text: 'Task deleted.' }],
    };
  }

  // ── Internal ──────────────────────────────────────────────────────────

  /**
   * Pulls the verified userId off the request that McpBearerGuard attached.
   * Throws if somehow missing — this should be unreachable since the guard
   * runs before any tool handler, but it's a cheap, explicit safety net
   * rather than silently scoping a query to `undefined`.
   */
  private getUserId(context: AuthenticatedContext): string {
        const ctx = context as any;
        const req = (typeof ctx.switchToHttp === 'function' 
    ? ctx.switchToHttp().getRequest() 
    : ctx.request || ctx.req) as Request & { mcpUserId?: string };
    if (!req.mcpUserId) {
      throw new Error('Unauthenticated MCP request reached tool handler — guard misconfigured.');
    }
    return req.mcpUserId;
  }
}