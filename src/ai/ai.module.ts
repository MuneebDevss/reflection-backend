import { Module } from '@nestjs/common';
import { AiGoalService } from './ai-goal.service';
import { AiTaskService } from './ai-task.service';

@Module({
  providers: [AiGoalService],
  exports: [AiGoalService,AiTaskService],
})
export class AiModule {}
