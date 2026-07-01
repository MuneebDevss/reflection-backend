import { Injectable, NotFoundException } from '@nestjs/common';
import { Tool, Context } from '@rekog/mcp-nest';
import type { Request } from 'express';
import { UsersService } from '../../users/users.service';
import { TasksService } from '../../tasks/tasks.service';
import { getUserId } from '../decorator/get-mcp-user';
import { GetUserScheduleSchema, MakeBulkShiftTasksSchema } from '../schemas/schedule.schema';
import { handleError } from '../decorator/error-handling';
import { AuthenticatedContext } from '../types';
import { getUtcDateForTimezone } from '../decorator/helpers';

@Injectable()
export class ScheduleMcpTools {
  constructor(
    private readonly tasksService: TasksService, 
    private readonly userService: UsersService
  ) {}

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
      const user = await this.userService.findOne(userId);
      if (!user) throw new NotFoundException('User profile not found.');

      const parsedScheduleStartDate = getUtcDateForTimezone(input.start_date, user.timezone || 'UTC', false);
      const parsedScheduleEndDate = getUtcDateForTimezone(input.end_date, user.timezone || 'UTC', true);
      
      const summary = await this.tasksService.getCapacitySummary(userId, {
        startDate: parsedScheduleStartDate,
        endDate: parsedScheduleEndDate,
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
      const user = await this.userService.findOne(userId);
      if (!user) throw new NotFoundException('User profile not found.');

      const parsedScheduleStartDate = getUtcDateForTimezone(input.start_date, user.timezone || 'UTC', false);
      const parsedScheduleEndDate = getUtcDateForTimezone(input.end_date, user.timezone || 'UTC', true);
      
      // FIX: Changed endOfDay to false so shifted tasks land perfectly at 00:00:00 local time
      const parsedShiftToDate = getUtcDateForTimezone(input.shift_to_date, user.timezone || 'UTC', false);
      
      const tasksTransaction = await this.tasksService.bulkShiftTasks(userId, {
        startDate: parsedScheduleStartDate,
        endDate: parsedScheduleEndDate,
        shiftToDate: parsedShiftToDate,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(tasksTransaction, null, 2) }],
      };
    } catch (error: any) {
      return handleError(error, 'executing bulk task date shifting');
    }
  }
}