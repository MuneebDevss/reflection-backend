import { z } from 'zod';
export const MakeBulkShiftTasksSchema = z.object({
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('The inclusive start date of the task subset to shift'),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('The inclusive end date of the task subset to shift'),
      shift_to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('The target destination date to which tasks will migrate'),
    })

export const GetUserScheduleSchema = z.object({
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('The starting boundary date in YYYY-MM-DD format'),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('The ending boundary date in YYYY-MM-DD format'),
    })