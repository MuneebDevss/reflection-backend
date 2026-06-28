import { Injectable } from '@nestjs/common';
import { Tool, Context } from '@rekog/mcp-nest';
import type { Request } from 'express';
import { TasksService } from '../../tasks/tasks.service';
import { getUserId } from '../decorator/get-mcp-user';
import { GetUserScheduleSchema, MakeBulkShiftTasksSchema } from '../schemas/schedule.schema';
import { handleError } from '../decorator/error-handling';
import { AuthenticatedContext } from '../types';

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
    parameters: GetUserScheduleSchema,
    annotations: {
      title: 'Get User Schedule Summary',
      readOnlyHint: true,
      destructiveHint: false,
    },
  })
  async getUserSchedule(input: any, context: AuthenticatedContext, request: Request) {
    try {
      const userId: string = getUserId({ request, ...context });

      const summary = await this.tasksService.getCapacitySummary(userId, {
        startDate: new Date(input.start_date), // FIX: parse string → Date
        endDate: new Date(input.end_date),     // FIX: parse string → Date
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
      };
    } catch (error: any) {
      return handleError(error, 'fetching your schedule overview');
    }
  }

  @Tool({
    name: 'bulk_shift_tasks',
    description:
      'Shifts tasks in bulk based on the provided parameters. Moves all items within a date window to a new date.',
    parameters: MakeBulkShiftTasksSchema,
    annotations: {
      title: 'Bulk Shift Tasks',
      readOnlyHint: false,
      destructiveHint: false,
    },
  })
  async bulkShiftTasks(input: any, context: AuthenticatedContext, request: Request) {
    try {
      const userId = getUserId({ request, ...context });

      const tasksTransaction = await this.tasksService.bulkShiftTasks(userId, {
        startDate: new Date(input.start_date),   // FIX: parse string → Date
        endDate: new Date(input.end_date),        // FIX: parse string → Date
        shiftToDate: new Date(input.shift_to_date), // FIX: parse string → Date
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(tasksTransaction, null, 2) }],
      };
    } catch (error: any) {
      return handleError(error, 'executing bulk task date shifting');
    }
  }
  
}


