import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FlowProducer, Queue } from 'bullmq';
import { Redis } from 'ioredis'; // BullMQ uses ioredis under the hood
@Injectable()
export class TaskCronJobService {
  private flowProducer: FlowProducer;
  constructor
  (
    private readonly prismaService: PrismaService,
    @Inject('BULLMQ_CONNECTION') private readonly redisConnection: Redis,
  ) {
    this.flowProducer = new FlowProducer({ 
      connection: this.redisConnection 
    });
  }
  

  async handleCron() {
    const userIds = await this.prismaService.user.findMany({ select: { id: true } })
      .then(users => users.map(u => u.id));

    // 1. Creating child jobs (one per user for rescheduling)
    const childrenJobs = userIds.map(userId => ({
      name: 'reschedule',
      queueName: 'reschedule-queue',
      data: { userId },
      opts: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
    }));

    // 2. Creating the parent flow
    // The 'notifications' job will sit in a 'parent-waiting' state 
    // until EVERY SINGLE child job completes successfully.
    await this.flowProducer.add({
      name: 'send-batch-notifications',
      queueName: 'notifications-queue',
      data: { userIds }, // Passes the whole array to the notification worker!
      children: childrenJobs,
    });
  }
}