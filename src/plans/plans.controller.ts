import { Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { PlansService } from './plans.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { GetUser } from '@auth/decorators';
import { CreatePlanDto } from './dtos/create-plan.dto';
import { UpdatePlanDto } from './dtos/update-plan.dto';

@UseGuards(JwtAuthGuard)
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

    /**
     * Get all plans for the authenticated user
     * @param userId 
     * @returns 
     */
    @Get()
    async getAllPlans(@GetUser('userId') userId: string) {
        return this.plansService.getPlansByUserId(userId);
    }

    /**
     * Create a new plan for the authenticated user
     * @param userId 
     * @param createPlanDto 
     * @returns 
     */
    @Post()
    async createPlan(@GetUser('userId') userId: string, createPlanDto: CreatePlanDto) {
        return this.plansService.createPlan(userId, createPlanDto);
    }
    
    /**
     * Update an existing plan with new data
     * @param id 
     * @param updatePlanDto 
     * @returns 
     */
    @Patch(':id')
    async updatePlan(@Param('id') id: string, updatePlanDto: UpdatePlanDto, @GetUser('userId') userId: string) {
        return this.plansService.updatePlan(id, userId, updatePlanDto);
    }

    /**
     * Delete a plan by its ID
     * @param id 
     * @returns 
     */
    @Delete(':id')
    async deletePlan(@Param('id') id: string, @GetUser('userId') userId: string) {
        return this.plansService.deletePlan(id, userId);
    }

    /**
     * Get all tasks for a specific plan
     * @param id 
     * @returns 
     */
    @Get(':id/tasks')
    async getTasksForPlan(@GetUser('userId') userId: string, @Param('id') id: string) {
        return this.plansService.getTasksForPlan(userId, id);
    }

    /**
     * Add a task to a specific plan
     * @param planId 
     * @param taskId 
     * @returns 
     */
    @Post(':id/tasks/:taskId')
    async addTaskToPlan(@Param('id') planId: string, @GetUser('userId') userId: string, @Param('taskId') taskId: string) {
        return this.plansService.addTaskToPlan(planId, userId, taskId);
    }

    /**
     * Remove a task from a specific plan
     * @param taskId 
     * @returns 
     */
    @Delete('tasks/:taskId')
    async removeTaskFromPlan(@GetUser('userId') userId: string, @Param('taskId') taskId: string) {
        return this.plansService.removeTaskFromPlan(taskId, userId);
    }
    
    /**
     * Get a specific plan by its ID
     * @param id 
     * @returns plan details
     */
    @Get(':id')
    async getPlanById(@Param('id') id: string, @GetUser('userId') userId: string) {
        return this.plansService.getPlanById(id, userId);
    }
}
