import { Module } from '@nestjs/common';
import { GoalSessionsService } from './goal-sessions.service';
import { GoalSessionsController } from './goal-sessions.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [GoalSessionsController],
  providers: [GoalSessionsService],
  exports: [GoalSessionsService],
})
export class GoalSessionsModule {}
