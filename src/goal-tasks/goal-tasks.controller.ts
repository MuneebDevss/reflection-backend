import { Controller, Get, Post, Patch, Param, Body, Query, Logger } from '@nestjs/common';
import { GoalTasksService } from './goal-tasks.service';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { GetAllTasksDto } from './dto/get-all-tasks.dto';
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

  /**
   * Get previous tasks for a goal based on period
   * period can be LastWeek, LastDay, LastMonth, AllTime
   * LastWeek: tasks from the last 7 days
   * LastDay: tasks from the last 24 hours
   * LastMonth: tasks from the last 30 days
   *  AllTime: all tasks
   **/

   @Get(':id/previous-tasks')
  async getPreviousTasks(
    @Param('id') goalId: string,
    @Query() getAllTasksDto: GetAllTasksDto
  ) {
    this.logger.log(`GET /goals/${goalId}/previous-tasks with period: ${getAllTasksDto.period}`);
    return this.goalTasksService.getPreviousTasks(
      goalId,
      getAllTasksDto.period
    );
  }
}
