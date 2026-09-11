import { Controller, Delete, Post } from '@nestjs/common'
import {  JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { GetUser } from '@auth/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { Body } from '@nestjs/common';
import { PushSubscriptionDto } from './dtos/push-subscription.dto';
import { PushNotificationsService } from './push-notifications.service';
@Controller('push_notifications')
@UseGuards(JwtAuthGuard)
export class PushNotificationsController {
    constructor(private readonly pushNotificationsService: PushNotificationsService) {}
    @Post('subscribe')
        async subscribe(@GetUser('userId') userId: string, @Body() body: PushSubscriptionDto) {
            // Using upsert so that if the user subscribes again from the same browser, 
            // you just update the existing record instead of creating duplicates.
            return this.pushNotificationsService.subscribe(userId, body);
        }
        @Delete('subscribe')
            async unsubscribe(@GetUser('userId') userId: string, @Body('endpoint') endpoint: string) {
            return this.pushNotificationsService.unsubscribe(userId, endpoint);
            }
}