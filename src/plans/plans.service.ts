import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dtos/create-plan.dto';
import { UpdatePlanDto } from './dtos/update-plan.dto';
import { TasksService } from '../tasks/tasks.service';

@Injectable()
export class PlansService {
    constructor(private readonly prisma: PrismaService, private readonly taskService: TasksService) {}

    /**
     * Retrieves a plan by its ID
     * @param planId 
     * @returns 
     */
    async getPlanById(planId: string) {
        return this.prisma.planGroup.findUnique({
            where: { id: planId },
        });
    }

    /**
     * Retrieves all plans for a given user
     * @param userId 
     * @returns 
     */
    async getPlansByUserId(userId: string) {
        return this.prisma.planGroup.findMany({
            where: { userId },
        });
    }

    /**
     * Creates a new plan for a given user
     * @param userId 
     * @param planData 
     * @returns 
     */
    async createPlan(userId: string, planData: CreatePlanDto) {
        return this.prisma.planGroup.create({
            data: {
                userId,
                title: planData.name,
                goalDescription: planData.description,
                source: planData.source,
            },
        });
    }

    /**
     * Updates an existing plan with new data
     * @param planId 
     * @param planData 
     * @returns 
     */
    async updatePlan(planId: string, planData: UpdatePlanDto) {
        return this.prisma.planGroup.update({
            where: { id: planId },
            data: {
                title: planData.name,
                goalDescription: planData.description,
            },
        });
    }

    /**
     * Deletes a plan by its ID
     * @param planId 
     * @returns 
     */
    async deletePlan(planId: string) {
        await  this.prisma.planGroup.delete({
            where: { id: planId },
        });
        return this.prisma.task.updateMany({
            where: { planId },
            data: { planId: null },
        });
    }

    /**
     * Retrieves all tasks for a given plan
     * @param planId 
     * @returns 
     */
    async getTasksForPlan(userId: string, planId: string) {
        return this.taskService.getTasks(userId, { planId: planId });
    }

    /**
     * Adds a task to a plan by updating the task's planId field
     * @param planId 
     * @param taskId 
     * @returns 
     */
    async addTaskToPlan(planId: string, taskId: string) {
        return this.prisma.task.update({
            where: { id: taskId },
            data: { planId },
        });
    }

    /**
     * Removes a task from a plan by setting the task's planId field to null
     * @param taskId 
     * @returns 
     */
    async removeTaskFromPlan(taskId: string) {
        return this.prisma.task.update({
            where: { id: taskId },
            data: { planId: null },
        });
    }

}