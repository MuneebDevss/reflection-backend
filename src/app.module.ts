import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { GoalsModule } from './goals/goals.module';
import { AiModule } from './ai/ai.module';
import { GoalSessionsModule } from './goal-sessions/goal-sessions.module';
import { GoalQuestionsModule } from './goal-questions/goal-questions.module';
import { GoalTasksModule } from './goal-tasks/goal-tasks.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    GoalsModule,
    AiModule,
    GoalSessionsModule,
    GoalQuestionsModule,
    GoalTasksModule,
    HealthModule,
  ],
})
export class AppModule {}
