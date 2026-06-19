import {Module} from '@nestjs/common';
import {PushNotificationsService} from './push-notifications.service';
import {PrismaService} from '../prisma/prisma.service';
import {PushNotificationsController} from './push-notifications.controller';
import { BullModule } from '@nestjs/bullmq';
@Module({
    providers: [PushNotificationsService, PrismaService],
    controllers: [PushNotificationsController],
    exports: [PushNotificationsService],
    imports: [
        BullModule.registerQueue({
            name: 'notification-queue',
        }),
    ],
})
export class PushNotificationsModule {}