import { Module } from '@nestjs/common';
import { GoalTasksController } from './goal-tasks.controller';
import { GoalTasksService } from './goal-tasks.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [GoalTasksController],
  providers: [GoalTasksService],
  exports: [GoalTasksService],
})
export class GoalTasksModule {}
