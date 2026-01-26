import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { GoalQuestionsService } from './goal-questions.service';
import { CreateAnswerDto } from './dto/create-answer.dto';

@Controller('goal-questions')
export class GoalQuestionsController {
  constructor(private readonly goalQuestionsService: GoalQuestionsService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.goalQuestionsService.findOne(id);
  }

  @Post(':id/answer')
  answerQuestion(@Param('id') id: string, @Body() createAnswerDto: CreateAnswerDto) {
    return this.goalQuestionsService.answerQuestion(id, createAnswerDto);
  }
}
