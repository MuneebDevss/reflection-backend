import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    const app = await NestFactory.create(AppModule);
    
    // Enable global exception filter
    app.useGlobalFilters(new AllExceptionsFilter());
    
    // Enable global logging interceptor
    app.useGlobalInterceptors(new LoggingInterceptor());
    
    // Enable CORS for frontend
    app.enableCors({
      origin: ['http://localhost:5173', 'http://localhost:8081'],
      credentials: true,
    });
    
    // Enable validation globally with detailed error messages
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const messages = errors.map(error => ({
          field: error.property,
          errors: Object.values(error.constraints || {}),
        }));
        return new BadRequestException({
          statusCode: 400,
          message: 'Validation failed',
          errors: messages,
        });
      },
    }));

    const port = process.env.PORT || 3001;
    await app.listen(port);
    logger.log(`🚀 Server running on http://localhost:${port}`);
  } catch (error) {
    logger.error('Failed to start the application', error.stack);
    process.exit(1);
  }
}

bootstrap();
