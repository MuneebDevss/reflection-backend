import { Injectable } from '@nestjs/common';
import { Tool, Context } from '@rekog/mcp-nest';
import { z } from 'zod';
import type { Request } from 'express';
import { TasksService } from '../../tasks/tasks.service';
import type { AuthenticatedContext } from '../types';

/**
 * ScheduleMcpTools
 * ────────────────
 * Handles schedule analysis and bulk adjustments for planning flows.
 */
@Injectable()
export class ScheduleMcpTools {
  constructor(private readonly tasksService: TasksService) {}

  @Tool({
    name: 'get_user_schedule',
    description:
      'Returns a per-day summary of scheduled minutes vs. daily_capacity_minutes ' +
      'for the authenticated user. Call this before generating any multi-day plan ' +
      'so the plan respects existing commitments and free capacity.',
    parameters: z.object({
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('The starting boundary date in YYYY-MM-DD format'),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('The ending boundary date in YYYY-MM-DD format'),
    }),
    annotations: {
      title: 'Get User Schedule Summary',
      readOnlyHint: true,
      destructiveHint: false,
    },
  })
  async getUserSchedule(input: any, context: Context, request: Request) {
    try {
      const userId = this.getUserId(request);

      const summary = await this.tasksService.getCapacitySummary(userId, {
        startDate: new Date(input.start_date), // FIX: parse string → Date
        endDate: new Date(input.end_date),     // FIX: parse string → Date
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
      };
    } catch (error: any) {
      return this.handleError(error, 'fetching your schedule overview');
    }
  }

  @Tool({
    name: 'bulk_shift_tasks',
    description:
      'Shifts tasks in bulk based on the provided parameters. Moves all items within a date window to a new date.',
    parameters: z.object({
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('The inclusive start date of the task subset to shift'),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('The inclusive end date of the task subset to shift'),
      shift_to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('The target destination date to which tasks will migrate'),
    }),
    annotations: {
      title: 'Bulk Shift Tasks',
      readOnlyHint: false,
      destructiveHint: false,
    },
  })
  async bulkShiftTasks(input: any, context: Context, request: Request) {
    try {
      const userId = this.getUserId(request);

      const tasksTransaction = await this.tasksService.bulkShiftTasks(userId, {
        startDate: new Date(input.start_date),   // FIX: parse string → Date
        endDate: new Date(input.end_date),        // FIX: parse string → Date
        shiftToDate: new Date(input.shift_to_date), // FIX: parse string → Date
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(tasksTransaction, null, 2) }],
      };
    } catch (error: any) {
      return this.handleError(error, 'executing bulk task date shifting');
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private getUserId(request: Request): string {
    const req = request as Request & { mcpUserId?: string };
    if (!req.mcpUserId) {
      throw new Error('AUTH_EXPIRED');
    }
    return req.mcpUserId;
  }

  private handleError(error: any, action: string) {
    let message = `Action failed while ${action}. An unexpected internal error occurred.`;

    if (error.message === 'AUTH_EXPIRED' || error.status === 401) {
      message = 'Authentication credentials expired or invalid. Please re-authenticate your connection hook.';
    } else if (error.code === 'P2025' || error.status === 404) {
      message = `No records matching your search scope were found while ${action}.`;
    } else if (error.message) {
      message = `Operation failed while ${action}: ${error.message}`;
    }

    return {
      content: [{ type: 'text', text: message }],
      isError: true,
    };
  }
}