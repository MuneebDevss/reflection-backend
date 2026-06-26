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
import { OAuthModule } from './OAuth/oauth.module';
import { McpModule } from './mcp/mcp.module';
import { PlansModule } from './plans/plans.module';
@Module({
  imports: [
    DateTimeModule,
    PrismaModule,
    UsersModule,
    AuthModule,  // Add AuthModule for JWT authentication
    TasksModule,
    PlansModule,
    ReschedulingModule,
    ScheduleModule.forRoot(), // Enables scheduling globally
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
      },
    }),
    ReschedulingModule,
    PushNotificationsModule,
    OAuthModule, // discovery + authorize + token endpoints
    McpModule,   // mounts /mcp inside this same app — see mcp.module.ts
  ],
})
export class AppModule {}
