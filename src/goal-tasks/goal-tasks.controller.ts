import { Controller, Get, Post, Patch, Param, Body, Logger } from '@nestjs/common';
import { GoalTasksService } from './goal-tasks.service';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

@Controller('goals')
export class GoalTasksController {
  private readonly logger = new Logger(GoalTasksController.name);

  constructor(private readonly goalTasksService: GoalTasksService) {}

  /**
   * Get today's tasks for a goal
   */
  @Get(':id/today-tasks')
  async getTodayTasks(@Param('id') goalId: string) {
    this.logger.log(`GET /goals/${goalId}/today-tasks`);
    return this.goalTasksService.getTodayTasks(goalId);
  }

  /**
   * Generate tasks for today
   */
  @Post(':id/generate-tasks')
  async generateTasks(@Param('id') goalId: string) {
    this.logger.log(`POST /goals/${goalId}/generate-tasks`);
    return this.goalTasksService.generateTasksForToday(goalId);
  }

  /**
   * Update task status
   */
  @Patch('tasks/:taskId/status')
  async updateTaskStatus(
    @Param('taskId') taskId: string,
    @Body() updateTaskStatusDto: UpdateTaskStatusDto
  ) {
    this.logger.log(`PATCH /goals/tasks/${taskId}/status`);
    return this.goalTasksService.updateTaskStatus(
      taskId,
      updateTaskStatusDto.status
    );
  }
}
