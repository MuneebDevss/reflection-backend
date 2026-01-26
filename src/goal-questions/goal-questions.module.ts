import { Module } from '@nestjs/common';
import { GoalQuestionsService } from './goal-questions.service';
import { GoalQuestionsController } from './goal-questions.controller';

@Module({
  controllers: [GoalQuestionsController],
  providers: [GoalQuestionsService],
})
export class GoalQuestionsModule {}
