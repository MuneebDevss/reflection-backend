import { z } from 'zod';

export const CreateTaskSchema = z.object({
      title: z.string().min(1).max(200).describe('The brief title of the task'),
      description: z.string().max(2000).optional().describe('Detailed context or notes for the task'),
      estimated_minutes: z.number().int().positive().max(1440).describe('Expected duration to complete the task in minutes'),
      scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').describe('The target date for the task formatted as YYYY-MM-DD'),
      base_priority: z.enum(['low', 'medium', 'high']).describe('The baseline urgency level of the item'),
    });

export const CreateBulkTaskSchema = z.object({
  planId: z.uuid().min(1).max(200).describe('The unique UUID identifier of the plan to which the task will be added'),
  title: z.string().min(1).max(200).describe('The brief title of the task'),
  description: z.string().max(2000).optional().describe('Detailed context or notes for the task'),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').describe('The target date for the task formatted as YYYY-MM-DD'),
  estimatedMinutes: z.number().int().positive().max(1440).describe('Expected duration to complete the task in minutes'),
  basePriority: z.enum(['low', 'medium', 'high']).describe('The priority level of the task'),
});

export const GetTasksSchema = z.object({
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Start date window in YYYY-MM-DD format'),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('End date window in YYYY-MM-DD format'),
      status: z.enum(['pending', 'completed', 'graveyard']).optional().describe('Filter results by specific status states'),
    })

export const UpdateTaskSchema = z.object({
      task_id: z.uuid().describe('The unique UUID identifier of the target task'),
      title: z.string().min(1).max(200).optional().describe('New title value for the task'),
      description: z.string().max(2000).optional().describe('Updated contextual notes for the task'),
      estimated_minutes: z.number().int().positive().optional().describe('Revised execution duration in minutes'),
      scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Revised execution date in YYYY-MM-DD'),
      base_priority: z.enum(['low', 'medium', 'high']).optional().describe('Revised urgency priority status'),
    })

export const DeleteTaskSchema = z.object({
      task_id: z.uuid().describe('The unique UUID target identifier for deletion'),
    })