import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PushNotificationsService } from './push-notifications.service';
@Processor('notification-queue')
export class PushNotificationProcessor extends WorkerHost {
    constructor(
        private readonly pushNotificationsService: PushNotificationsService,
    ) {
        super();
    }
    async process(job: Job) {
        switch (job.name) {
            case 'send-batch-notifications': {
                const { userIds } = job.data;
                await this.pushNotificationsService.sendRescheduleNotifications(userIds);
                break;
            }   
        }
    }
}