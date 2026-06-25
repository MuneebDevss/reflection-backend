import { Module } from '@nestjs/common'
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TasksModule } from '../tasks/tasks.module';
@Module({
    imports : [PrismaModule, TasksModule],
    controllers: [PlansController],
    providers: [PlansService],
    exports: [PlansService],
})

export class PlansModule {}