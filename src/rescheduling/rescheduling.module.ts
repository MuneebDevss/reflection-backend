import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReschedulingService } from './rescheduling.service';
import { ReschedulingProcessor } from './rescheduling.processor';
import { ReschedulingController } from './rsecheduling.controller';
import { TaskCronJobService } from './rescheduling.cron';
import Redis from 'ioredis';
@Module({
  imports: [
    BullModule,
    // Registering a specific queue for engine operations
    BullModule.registerQueue({
      name: 'rescheduling-queue',
    }),
    BullModule.registerQueue({
      name: 'notification-queue',
    }),
  ],
  providers: [
     {
      provide: 'REDIS_CONNECTION',
      useFactory: () =>
        new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: Number(process.env.REDIS_PORT) || 6379,
          username: process.env.REDIS_USERNAME,
          password: process.env.REDIS_PASSWORD,
        }),
    },
    ReschedulingService, ReschedulingProcessor, TaskCronJobService],
  exports: [ReschedulingService,'REDIS_CONNECTION'],
  controllers: [ReschedulingController],
})
export class ReschedulingModule {}