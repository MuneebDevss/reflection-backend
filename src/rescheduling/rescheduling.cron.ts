import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

@Injectable()
export class TaskCronJobService {
  constructor
  (
    private readonly prismaService: PrismaService,
    @InjectQueue('rescheduling') private readonly queue: Queue
  ) {}
  // Runs every minute
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    const userIds: string[] = await this.prismaService.user.findMany({ select: { id: true } }).
    then(users => users.map(u => u.id));
    for (const userId of userIds) {
        await this.queue.add('reschedule', { userId: userId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
    }
  }
}