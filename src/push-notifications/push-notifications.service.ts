import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { PushSubscriptionDto } from './dtos/push-subscription.dto';

@Injectable()
export class PushNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    // 💡 Added required InjectQueue decorator to link correct instance
    @InjectQueue('notification-queue') private readonly queue: Queue,
  ) {}

  /**
   * NestJS Lifecycle Hook: Runs automatically when the module initializes.
   * Ensures VAPID identification keys are globally assigned to web-push protocol wrapper.
   */
  onModuleInit() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
      this.logger.warn('VAPID credentials are missing. Web push features will fail.');
      return;
    }

    webpush.setVapidDetails(
      'mailto:admin@yourdomain.com', // Replace with your operational support email
      publicKey,
      privateKey,
    );
    this.logger.log('Web-Push VAPID identity properties loaded successfully.');
  }

  /**
   * Registers or updates a device browser subscription endpoint for a user.
   */
  async subscribe(userId: string, subscription: PushSubscriptionDto) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: { 
        p256dhKey: subscription.p256dhKey, 
        authKey: subscription.authKey 
      },
      create: { 
        userId, 
        endpoint: subscription.endpoint, 
        p256dhKey: subscription.p256dhKey, 
        authKey: subscription.authKey 
      },
    });
  }

  /**
   * Deletes a specific subscription node from storage when unsubscribing.
   */
  async unsubscribe(userId: string, endpoint: string) {
    return this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  /**
   * Dispatches a single ad-hoc message layout out to the execution queue.
   */
  async addNotificationJob(userId: string, payload: any) {
    return this.queue.add(
      'send-single-notification', 
      { userId, payload }, 
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
    );
  }

  /**
   * Resolves target addresses across multiple users and fires batched notifications
   * asynchronously. Automatically cleans stale endpoints returning 410 Gone statuses.
   */
  async sendRescheduleNotifications(userIds: string[]) {
    // 1. Collect all valid active subscription channels across target list
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
    });

    if (subscriptions.length === 0) {
      this.logger.debug('No active web push channels found for given subscriber scope.');
      return;
    }

    const notificationPayload = JSON.stringify({
      title: 'Schedule Updated',
      body: 'Your overdue tasks have been rescheduled. Click to review your upcoming tasks.',
      icon: '/icon.png',
      data: {
        url: '/upcoming' // Intercepted by Service Worker context on client
      }
    });

    // 2. Map actions into parallel executions
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dhKey,
              auth: sub.authKey,
            },
          },
          notificationPayload
        );
      } catch (error: unknown) {
        // Handle explicit client token invalidation (410 - Gone)
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const webPushError = error as { statusCode: number };
          
          if (webPushError.statusCode === 410) {
            this.logger.warn(`Endpoint expired (410). Purging subscription node ID: ${sub.id}`);
            await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
            return;
          }
        }
        
        this.logger.error(`Failed to dispatch web push packet to endpoint: ${sub.endpoint}`, error);
      }
    });

    // 3. Execute all notification requests concurrently
    await Promise.all(sendPromises);
  }
}