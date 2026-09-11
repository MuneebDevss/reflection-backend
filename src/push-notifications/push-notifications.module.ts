import {Module} from '@nestjs/common';
import {PushNotificationsService} from './push-notifications.service';
import {PrismaService} from '../prisma/prisma.service';
import {PushNotificationsController} from './push-notifications.controller';
import { BullModule } from '@nestjs/bullmq';
import { PushNotificationProcessor } from './push-notification.processor';
@Module({
    imports: [
        BullModule.registerQueue({
            name: 'notification-queue',
        }),
    ],
    providers: [PrismaService, PushNotificationsService, PushNotificationProcessor],
    controllers: [PushNotificationsController],
    exports: [PushNotificationsService],
    
})
export class PushNotificationsModule {}