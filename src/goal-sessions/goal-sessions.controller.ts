import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { GoalSessionsService } from './goal-sessions.service';
import { CreateGoalSessionDto } from './dto/create-goal-session.dto';

@Controller('goal-sessions')
export class GoalSessionsController {
  constructor(private readonly goalSessionsService: GoalSessionsService) {}

  @Post()
  create(@Body() createGoalSessionDto: CreateGoalSessionDto) {
    return this.goalSessionsService.create(createGoalSessionDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.goalSessionsService.findOne(id);
  }

  @Get(':id/next-question')
  getNextQuestion(@Param('id') id: string) {
    return this.goalSessionsService.getNextQuestion(id);
  }

  @Post(':id/complete')
  completeSession(@Param('id') id: string) {
    return this.goalSessionsService.completeSession(id);
  }
}
