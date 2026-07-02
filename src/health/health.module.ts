import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DateTimeService } from '../common/date-time/date-time.service';
@Module({
  controllers: [HealthController],
  providers: [DateTimeService],
})
export class HealthModule {}