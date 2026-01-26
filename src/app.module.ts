import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { GoalsModule } from './goals/goals.module';
import { AiModule } from './ai/ai.module';
import { GoalSessionsModule } from './goal-sessions/goal-sessions.module';
import { GoalQuestionsModule } from './goal-questions/goal-questions.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    GoalsModule,
    AiModule,
    GoalSessionsModule,
    GoalQuestionsModule,
  ],
})
export class AppModule {}
