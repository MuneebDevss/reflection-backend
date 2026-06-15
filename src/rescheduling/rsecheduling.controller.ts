import { Body, Controller, Post } from '@nestjs/common';
import { ReschedulingService } from './rescheduling.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '@auth/decorators';

@Controller('reschedule')
@UseGuards(JwtAuthGuard)
export class ReschedulingController {
  constructor(private readonly reschedulingService: ReschedulingService) {}

  @Post('run')
    async runRescheduling(@GetUser('userId') userId: string, @Body() date: string) {
        const currentDate = new Date(date);
       return this.reschedulingService.rescheduleTasks(userId, currentDate);
    }
}