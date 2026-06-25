import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReschedulingService } from './rescheduling.service';
import { ReschedulingProcessor } from './rescheduling.processor';
import { ReschedulingController } from './rsecheduling.controller';

@Module({
  imports: [
    // Registering a specific queue for engine operations
    BullModule.registerQueue({
      name: 'rescheduling-queue',
    }),
    BullModule.registerQueue({
      name: 'notification-queue',
    }),
  ],
  providers: [ReschedulingService, ReschedulingProcessor],
  exports: [ReschedulingService],
  controllers: [ReschedulingController],
})
export class ReschedulingModule {}