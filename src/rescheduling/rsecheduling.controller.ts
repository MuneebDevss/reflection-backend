import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ReschedulingService } from './rescheduling.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '@auth/decorators';
import { TaskCronJobService } from './rescheduling.cron';

@Controller('reschedule')
export class ReschedulingController {
  constructor(private readonly reschedulingService: ReschedulingService, private readonly cronJobService: TaskCronJobService) {}

  @UseGuards(JwtAuthGuard)
  @Post('run')
    async runRescheduling(@GetUser('userId') userId: string, @Body('date') date: string) {
        const currentDate = new Date(date);
       return this.reschedulingService.rescheduleTasks(userId, currentDate);
    }
    /**
     * Converting it to a POST endpoint to run by a outside scheduler
     * 
     */
    @Post('cron')
    async runCronRescheduling(@Headers('x-cron-secret') cronSecret: string) {
        const systemSecret = process.env.CRON_SECRET_KEY;
        if (!systemSecret || cronSecret !== systemSecret) {
          throw new UnauthorizedException('Invalid cron security context signature.');
        }
        return this.cronJobService.handleCron();
    }
}