import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { DateTimeModule } from './common/date-time/date-time.module';
import { AuthModule } from './auth/auth.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    DateTimeModule,
    PrismaModule,
    UsersModule,
    AuthModule,  // Add AuthModule for JWT authentication
    TasksModule,
  ],
})
export class AppModule {}
