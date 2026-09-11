import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../app.module';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { LoggingInterceptor } from '../interceptors/logging.interceptor';
import { DateTimeService } from '../common/date-time/date-time.service';
import cookieParser from 'cookie-parser';
import type { Request, Response } from 'express';

type ExpressHandler = (request: Request, response: Response) => unknown;

let cachedServer: ExpressHandler;

async function bootstrapServer(): Promise<ExpressHandler> {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  const dateTimeService = app.get(DateTimeService);
  app.useGlobalFilters(new AllExceptionsFilter(dateTimeService));
  app.useGlobalInterceptors(new LoggingInterceptor(dateTimeService));

  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        'https://claude.ai',
        'https://api.claude.ai',
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'mcp-session-id'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.setGlobalPrefix('api', {
    exclude: ['mcp', '.well-known/*path', 'oauth/*path',{ path: '/', method: RequestMethod.GET },],
  });

  await app.init();

  return app.getHttpAdapter().getInstance();
}

const handler: ExpressHandler = async (request, response) => {
  if (!cachedServer) {
    cachedServer = await bootstrapServer();
  }
  return cachedServer(request, response);
};

export { handler };
export default handler;
