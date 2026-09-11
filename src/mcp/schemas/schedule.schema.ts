import { z } from 'zod';
export const MakeBulkShiftTasksSchema = z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('The inclusive start date of the task subset to shift'),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('The inclusive end date of the task subset to shift'),
      shiftToDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('The target destination date to which tasks will migrate'),
    })

export const GetUserScheduleSchema = z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('The starting boundary date in YYYY-MM-DD format'),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('The ending boundary date in YYYY-MM-DD format'),
    })