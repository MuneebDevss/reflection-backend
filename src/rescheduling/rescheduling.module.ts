import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReschedulingService } from './rescheduling.service';
import { ReschedulingProcessor } from './rescheduling.processor';

@Module({
  imports: [
    // Registering a specific queue for engine operations
    BullModule.registerQueue({
      name: 'rescheduling-queue',
    }),
  ],
  providers: [ReschedulingService, ReschedulingProcessor],
  exports: [ReschedulingService],
})
export class ReschedulingModule {}