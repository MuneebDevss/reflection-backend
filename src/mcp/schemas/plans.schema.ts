import { z } from 'zod';
export const createPlanSchema = z.object({
      name: z.string().describe('The name/title of the new plan'),
      description: z.string().optional().describe('Optional description of the new plan'),
    });
export const updatePlanSchema = z.object({
      planId: z.uuid().describe('The ID of the plan to update'),
      name: z.string().optional().describe('The new title for the plan'),
      description: z.string().optional().describe('The new description for the plan'),
    });

export const AddTaskToPlanSchema = z.object({
      planId: z.uuid().describe('The ID of the destination plan'),
      taskId: z.uuid().describe('The ID of the task to associate with the plan'),
    })

export const RemoveTaskFromPlanSchema = z.object({
      taskId: z.uuid().describe('The ID of the task to unassign from its plan'),
    })

export const GetTasksForPlanSchema = z.object({
      planId: z.uuid().describe('The ID of the plan whose tasks you want to retrieve'),
    })

export const GetPlanByIdSchema = z.object({
      planId: z.uuid().describe('The unique UUID identifier of the target plan'),
    })

export const DeletePlanSchema = z.object({
      planId: z.uuid().describe('The ID of the plan to delete'),
    })