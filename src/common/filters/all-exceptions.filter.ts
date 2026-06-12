import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DateTimeService } from '../date-time/date-time.service';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private dateTimeService: DateTimeService) {}
  
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        error = (exceptionResponse as any).error || error;
      }
    }
    else if (exception instanceof Prisma.PrismaClientKnownRequestError){
      // Switch through common Prisma Error Codes
    switch (exception.code) {
      case 'P2002': {
        // Unique constraint violation (e.g., duplicate email)
        const status = HttpStatus.CONFLICT;
        response.status(status).json({
          statusCode: status,
          message: 'A record with this unique field already exists.',
          error: 'Conflict',
        });
        break;
      }
      case 'P2025': {
        // Record not found
        const status = HttpStatus.NOT_FOUND;
        response.status(status).json({
          statusCode: status,
          message: 'The requested resource could not be found.',
          error: 'Not Found',
        });
        break;
      }
      default:
        // Hand off any unhandled Prisma errors to the default NestJS global filter
        break;
      }
    }
     else if (exception instanceof Error) {
      message = exception.message;
    }

    // Log the error
    this.logger.error(
      `HTTP ${status} Error: ${message}`,
      exception instanceof Error ? exception.stack : 'No stack trace',
      `${request.method} ${request.url}`,
    );
     // 🔴 Unknown / unexpected errors
    console.error('Unhandled exception:', exception);

    // Send response
    response.status(status).json({
      statusCode: status,
      timestamp: this.dateTimeService.toISOString(),
      path: request.url,
      method: request.method,
      message,
      error,
    });
  }
}
