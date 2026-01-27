import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { CreateGoalSessionDto } from './dto/create-goal-session.dto';

@Injectable()
export class GoalSessionsService {
  private readonly logger = new Logger(GoalSessionsService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  async create(createGoalSessionDto: CreateGoalSessionDto) {
    try {
      const { userId, rawGoalText } = createGoalSessionDto;

      // Validate user exists
      const userExists = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!userExists) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // Generate questions using AI
      this.logger.log(`Generating AI questions for goal: ${rawGoalText}`);
      const generatedQuestions = await this.aiService.generateGoalQuestions(rawGoalText);

      // Create session with questions in a transaction
      const session = await this.prisma.goalSession.create({
        data: {
          userId,
          rawGoalText,
          status: 'in_progress',
          questions: {
            create: generatedQuestions.map(q => ({
              question: q.question,
              options: q.options,
              order: q.order,
            })),
          },
        },
        include: {
          questions: {
            orderBy: { order: 'asc' },
          },
        },
      });

      this.logger.log(`Created session ${session.id} with ${session.questions.length} questions`);

      return session;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to create goal session: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to create goal session');
    }
  }

  async findOne(id: string) {
    try {
      const session = await this.prisma.goalSession.findUnique({
        where: { id },
        include: {
          questions: {
            orderBy: { order: 'asc' },
            include: {
              answers: true,
            },
          },
        },
      });

      if (!session) {
        throw new NotFoundException(`Goal session with ID ${id} not found`);
      }

      return session;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to fetch session ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch goal session');
    }
  }

  async getNextQuestion(sessionId: string) {
    try {
      const session = await this.prisma.goalSession.findUnique({
        where: { id: sessionId },
        include: {
          questions: {
            orderBy: { order: 'asc' },
            include: {
              answers: true,
            },
          },
        },
      });

      if (!session) {
        throw new NotFoundException(`Goal session with ID ${sessionId} not found`);
      }

      // Find first unanswered question
      const nextQuestion = session.questions.find(q => q.answers.length === 0);

      if (!nextQuestion) {
        // All questions answered
        return {
          completed: true,
          question: null,
          totalQuestions: session.questions.length,
          answeredQuestions: session.questions.length,
        };
      }

      const answeredCount = session.questions.filter(q => q.answers.length > 0).length;

      return {
        completed: false,
        question: {
          id: nextQuestion.id,
          question: nextQuestion.question,
          options: nextQuestion.options,
          order: nextQuestion.order,
        },
        totalQuestions: session.questions.length,
        answeredQuestions: answeredCount,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to get next question for session ${sessionId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to get next question');
    }
  }

  async completeSession(sessionId: string) {
    try {
      // Fetch session with all questions and answers
      const session = await this.prisma.goalSession.findUnique({
        where: { id: sessionId },
        include: {
          questions: {
            orderBy: { order: 'asc' },
            include: {
              answers: true,
            },
          },
        },
      });

      if (!session) {
        throw new NotFoundException(`Goal session with ID ${sessionId} not found`);
      }

      // Prepare answers for AI
      const answers = session.questions
        .filter(q => q.answers.length > 0)
        .map(q => ({
          question: q.question,
          answer: q.answers[0].answer,
        }));

      // Generate goal summary using AI
      this.logger.log(`Generating goal summary for session ${sessionId}`);
      const { title, description, deadline } = await this.aiService.generateGoalSummary(
        session.rawGoalText,
        answers
      );

      // Create the goal
      const goal = await this.prisma.goal.create({
        data: {
          userId: session.userId,
          title,
          description,
          deadline,
          progress: 0,
        },
      });

      this.logger.log(`Created goal ${goal.id}: "${title}" for user ${session.userId}`);

      // Update session status and link to goal
      const updatedSession = await this.prisma.goalSession.update({
        where: { id: sessionId },
        data: { 
          status: 'completed',
          goalId: goal.id,
        },
        include: {
          questions: {
            include: {
              answers: true,
            },
          },
          goal: true,
        },
      });

      return updatedSession;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to complete session ${sessionId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to complete session');
    }
  }
}
