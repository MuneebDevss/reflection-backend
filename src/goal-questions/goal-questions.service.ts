import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class GoalQuestionsService {
  private readonly logger = new Logger(GoalQuestionsService.name);

  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    try {
      const question = await this.prisma.goalQuestion.findUnique({
        where: { id },
        include: {
          answers: true,
        },
      });

      if (!question) {
        throw new NotFoundException(`Question with ID ${id} not found`);
      }

      return question;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to fetch question ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch question');
    }
  }

  async answerQuestion(questionId: string, createAnswerDto: CreateAnswerDto) {
    try {
      // Check if question exists
      const question = await this.prisma.goalQuestion.findUnique({
        where: { id: questionId },
        include: {
          answers: true,
        },
      });

      if (!question) {
        throw new NotFoundException(`Question with ID ${questionId} not found`);
      }

      // Check if already answered
      if (question.answers.length > 0) {
        throw new ConflictException('This question has already been answered');
      }

      // Create answer
      const answer = await this.prisma.goalAnswer.create({
        data: {
          questionId,
          answer: createAnswerDto.answerText,
        },
      });

      this.logger.log(`Answer created for question ${questionId}`);

      return {
        ...answer,
        question,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('This question has already been answered');
        }
      }

      this.logger.error(`Failed to answer question ${questionId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to save answer');
    }
  }
}
