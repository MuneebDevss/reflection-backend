import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { RescheduleStrategy } from './reschedule-strategy.enum';
import { ReschedulingService } from './rescheduling.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '@auth/decorators';
import { TaskCronJobService } from './rescheduling.cron';

export class RescheduleRequestDto {
  @IsNotEmpty()
  @IsEnum(RescheduleStrategy, { message: 'Strategy must be one of CDU, HPF, or FG' })
  strategy: RescheduleStrategy;

  @IsOptional()
  @IsDateString()
  date?: string;
}

@Controller('reschedule')
export class ReschedulingController {
  constructor(private readonly reschedulingService: ReschedulingService, private readonly cronJobService: TaskCronJobService) {}

  @UseGuards(JwtAuthGuard)
  @Post('run')
    async runRescheduling(
      @GetUser('userId') userId: string,
      @Body() body: RescheduleRequestDto,
    ) {
       return this.reschedulingService.rescheduleTasks(
         userId,
         body.date ? new Date(body.date) : undefined,
         body.strategy,
       );
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
