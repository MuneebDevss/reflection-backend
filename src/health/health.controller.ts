import { Controller, Get } from '@nestjs/common';
import { DateTimeService } from '../common/date-time/date-time.service';

@Controller('health')
export class HealthController {
  constructor(private dateTimeService: DateTimeService) {}

  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: this.dateTimeService.toISOString(),
      uptime: process.uptime(),
    };
  }
}
