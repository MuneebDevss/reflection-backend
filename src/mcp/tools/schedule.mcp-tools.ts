import { Injectable } from '@nestjs/common';
import { Tool, Context } from '@rekog/mcp-nest';
import { z } from 'zod';
import type { Request } from 'express';
import { TasksService } from '../../tasks/tasks.service';
import type { AuthenticatedContext } from '../types';
/**
 * ScheduleMcpTools
 * ────────────────
 * get_user_schedule ships now (Phase 6 — Claude needs this before it can
 * reason about plan generation in Phase 7). bulk_shift_tasks lands in
 * Phase 8 as a stub for now.
 */
@Injectable()
export class ScheduleMcpTools {
  constructor(private readonly tasksService: TasksService) {}

  @Tool({
    name: 'get_user_schedule',
    description:
      'Returns a per-day summary of scheduled minutes vs. daily_capacity_minutes ' +
      "for the authenticated user. Call this before generating any multi-day plan " +
      'so the plan respects existing commitments and free capacity.',
    parameters: z.object({
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  })
  async getUserSchedule(input: any, context: Context, request: Request) {

    const req = request as Request & { mcpUserId?: string };
    if (!req.mcpUserId) {
      throw new Error('Unauthenticated MCP request reached tool handler — guard misconfigured.');
    }

    const summary = await this.tasksService.getCapacitySummary(req.mcpUserId, {
      startDate: input.start_date,
      endDate: input.end_date,
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
    };
  }

  /**
   * Updates the tasks dates in bulk based on the provided shifts. Each shift contains a task ID and the number of days to shift.
   * @param startDate - The start date of the range to consider for shifting tasks (inclusive).
   * @param endDate - The end date of the range to consider for shifting tasks (inclusive).
   * @param shift_to_date - The date to which the tasks should be shifted.
   * @returns A summary of the shifted tasks, including their new scheduled dates.
   */
  @Tool({
    name:'bulk_shift_tasks',
    description:
      'Shifts tasks in bulk based on the provided shifts. Each shift contains a task ID and the number of days to shift.',
    parameters: z.object({
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      shift_to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  })
    async bulkShiftTasks(input: any, context: Context, request: Request) {
        const req = request as Request & { mcpUserId?: string };
        if (!req.mcpUserId) {
          throw new Error('Unauthenticated MCP request reached tool handler — guard misconfigured.');
        }
        const tasksTransaction = await this.tasksService.bulkShiftTasks(req.mcpUserId, {
            startDate: input.start_date,
            endDate: input.end_date,
            shiftToDate: input.shift_to_date,
        });
        return {
            content: [{ type: 'text', text: JSON.stringify(tasksTransaction, null, 2) }],
        };
    }
}