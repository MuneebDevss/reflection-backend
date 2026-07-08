import { Injectable, NotFoundException } from '@nestjs/common';
import { PlansService } from '../../plans/plans.service';
import { UsersService } from '../../users/users.service'; // Added to resolve local bulk timestamps
import { Tool, Context } from '@rekog/mcp-nest';
import { z } from 'zod';
import type { Request } from 'express';
import type { AuthenticatedContext } from '../types';
import { getUserId } from '../decorator/get-mcp-user';
import { TasksService } from '../../tasks/tasks.service';
import { handleError } from '../decorator/error-handling';
import { CreateBulkTaskSchema } from '../schemas/task.schema';
import { getUtcDateForTimezone } from '../decorator/helpers';
import { 
  AddTaskToPlanSchema, 
  createPlanSchema, 
  DeletePlanSchema, 
  GetPlanByIdSchema, 
  GetTasksForPlanSchema, 
  RemoveTaskFromPlanSchema, 
  updatePlanSchema 
} from '../schemas/plans.schema';

@Injectable()
export class PlansMcpTools {
  
  constructor(
    private readonly plansService: PlansService, 
    private readonly taskService: TasksService,
    private readonly userService: UsersService, // Injected for timezone mapping lookup
  ) {}

  @Tool({
    name: 'get_plans',
    description: "Gets the user's plans. Returns an array of plan objects.",
    parameters: z.object({}),
    annotations: {
      title: 'Get User Plans',
      readOnlyHint: true,
      destructiveHint: false,
    },
  })
  async getPlans(input: any, context: AuthenticatedContext, request: Request) {
    try {
      const userId = getUserId({ request, ...context });
      const plans = await this.plansService.getPlansByUserId(userId);
      return {
        content: [{ type: 'text', text: JSON.stringify(plans, null, 2) }],
      };
    } catch (error: any) {
      return handleError(error, 'retrieving plans');
    }
  }

  @Tool({
    name: 'get_plan_by_id',
    description: "Retrieves a specific plan by its ID. Returns the plan object.",
    parameters: GetPlanByIdSchema,
    annotations: {
      title: 'Get Plan by ID',
      readOnlyHint: true,
      destructiveHint: false,
    },
  })
  async getPlanById(input: { planId: string }, context: AuthenticatedContext, request: Request) {
    try {
      const userId = getUserId({ request, ...context });
      const plan = await this.plansService.getPlanById(input.planId, userId);
      return {
        content: [{ type: 'text', text: JSON.stringify(plan, null, 2) }],
      };
    } catch (error: any) {
      return handleError(error, 'retrieving plan');
    }
  }

  @Tool({
    name: 'create_plan',
    description: "Creates a new plan for the authenticated user. Returns the created plan object.",
    parameters: createPlanSchema,
    annotations: {
      title: 'Create Plan',
      readOnlyHint: false,
      destructiveHint: false,
    },
  })
  async createPlan(input: any, context: AuthenticatedContext, request: Request) {
    try {
      const userId = getUserId({ request, ...context });
      const plan = await this.plansService.createPlan(userId, {
        name: input.name,
        description: input.description,
        source: input.source,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(plan, null, 2) }],
      };
    } catch (error: any) {
      return handleError(error, 'creating plan');
    }
  }

  @Tool({
    name: 'update_plan',
    description: "Updates an existing plan's title or description by its ID.",
    parameters: updatePlanSchema,
    annotations: {
      title: 'Update Plan Details',
      readOnlyHint: false,
      destructiveHint: false,
    },
  })
  async updatePlan(input: { planId: string; name?: string; description?: string }, context: AuthenticatedContext, request: Request) {
    try {
      const userId = getUserId({ request, ...context });
      const plan = await this.plansService.updatePlan(input.planId, userId, {
        name: input.name,
        description: input.description,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(plan, null, 2) }],
      };
    } catch (error: any) {
      return handleError(error, 'updating plan');
    }
  }

  @Tool({
    name: 'delete_plan',
    description: "Deletes a plan by its ID and deletes its associated tasks.",
    parameters: DeletePlanSchema,
    annotations: {
      title: 'Delete Plan',
      readOnlyHint: false,
      destructiveHint: true,
    },
  })
  async deletePlan(input: { planId: string }, context: AuthenticatedContext, request: Request) {
    try {
      const userId = getUserId({ request, ...context });
      await this.plansService.deletePlan(input.planId, userId);
      return {
        content: [{ type: 'text', text: `Plan ${input.planId} successfully deleted.` }],
      };
    } catch (error: any) {
      return handleError(error, 'deleting plan');
    }
  }

  @Tool({
    name: 'get_tasks_for_plan',
    description: "Retrieves all tasks associated with a given plan ID.",
    parameters: GetTasksForPlanSchema,
    annotations: {
      title: 'Get Tasks for Plan',
      readOnlyHint: true,
      destructiveHint: false,
    },
  })
  async getTasksForPlan(input: { planId: string }, context: AuthenticatedContext, request: Request) {
    try {
      const userId = getUserId({ request, ...context });
      const tasks = await this.plansService.getTasksForPlan(userId, input.planId);
      return {
        content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }],
      };
    } catch (error: any) {
      return handleError(error, 'retrieving tasks for plan');
    }
  }

  @Tool({
    name: 'add_task_to_plan',
    description: "Links an existing task to an existing plan.",
    parameters: AddTaskToPlanSchema,
    annotations: {
      title: 'Add Task to Plan',
      readOnlyHint: false,
      destructiveHint: false,
    },
  })
  async addTaskToPlan(input: { planId: string; taskId: string }, context: AuthenticatedContext, request: Request) {
    try {
      const userId = getUserId({ request, ...context });
      const task = await this.plansService.addTaskToPlan(input.planId, userId, input.taskId);
      return {
        content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
      };
    } catch (error: any) {
      return handleError(error, 'adding task to plan');
    }
  }

  @Tool({
    name: 'remove_task_from_plan',
    description: "Removes a task from its plan group, making it an unassigned task.",
    parameters: RemoveTaskFromPlanSchema,
    annotations: {
      title: 'Remove Task from Plan',
      readOnlyHint: false,
      destructiveHint: false,
    },
  })
  async removeTaskFromPlan(input: { taskId: string }, context: AuthenticatedContext, request: Request) {
    try {
      const userId = getUserId({ request, ...context });
      const task = await this.plansService.removeTaskFromPlan(input.taskId, userId);
      return {
        content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
      };
    } catch (error: any) {
      return handleError(error, 'removing task from plan');
    }
  }
  
  @Tool({
    name: 'create_and_add_tasks_to_plan',
    description: 'Creates multiple new tasks and adds them to a specific plan. Returns the updated tasks.',
    parameters: z.object({
      tasks: z
        .array(CreateBulkTaskSchema)
        .min(1)
        .describe('List of tasks to create'),
    }),
    annotations: {
      title: 'Create Link Tasks to Plan',
      readOnlyHint: false,
      destructiveHint: false,
    },
  })
  async createAndAddTasksToPlan(input: any, context: AuthenticatedContext, request: Request) {
    try {
      const userId = getUserId({ request, ...context });
      
      const user = await this.userService.findOne(userId);
      if (!user) throw new NotFoundException('User profile not found.');
      const userTimezone = user.timezone || 'UTC';

      // FIX: Maps string arrays and shifts their YYYY-MM-DD format to safe Date objects before database persistence
      const mappedTasks = input.tasks.map((task: any) => ({
        ...task,
        scheduleDate: getUtcDateForTimezone(task.scheduledDate, userTimezone, false),
      }));

      // FIX: Safely destructure the response object so we log an actual number instead of '[object Object]'
      const { count } = await this.taskService.bulkCreateTasks(userId, mappedTasks);
      
      return {
        content: [{ type: 'text', text: `Successfully created ${count} tasks.` }],
      };
    } catch (error: any) {
      return handleError(error, 'creating and adding tasks to plan');
    }
  }
}