import { Module } from '@nestjs/common';
import { GoalTasksController } from './goal-tasks.controller';
import { GoalTasksService } from './goal-tasks.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GoalTasksController],
  providers: [GoalTasksService],
  exports: [GoalTasksService],
})
export class GoalTasksModule {}
