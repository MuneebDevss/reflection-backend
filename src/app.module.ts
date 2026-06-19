import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { DateTimeModule } from './common/date-time/date-time.module';
import { AuthModule } from './auth/auth.module';
import { TasksModule } from './tasks/tasks.module';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { ReschedulingModule } from './rescheduling/rescheduling.module';
import { PushNotificationsModule } from './push-notifications/push-notifications.module';
@Module({
  imports: [
    DateTimeModule,
    PrismaModule,
    UsersModule,
    AuthModule,  // Add AuthModule for JWT authentication
    TasksModule,
    ScheduleModule.forRoot(), // Enables scheduling globally
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
        // password: process.env.REDIS_PASSWORD, // Add if your Redis instance requires auth
      },
    }),
    ReschedulingModule,
    PushNotificationsModule,
  ],
})
export class AppModule {}
