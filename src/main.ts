import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { DateTimeService } from './common/date-time/date-time.service';
import cookieParser from 'cookie-parser'; // <-- Import this
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    const app = await NestFactory.create(AppModule);
    
    app.use(cookieParser());
    
    // Get DateTimeService from dependency injection container
    const dateTimeService = app.get(DateTimeService);
    
    // Enable global exception filter
    app.useGlobalFilters(new AllExceptionsFilter(dateTimeService));
    
    // Enable global logging interceptor
    app.useGlobalInterceptors(new LoggingInterceptor(dateTimeService));
    
    // Enable CORS for frontend
    app.enableCors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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
    }));

     /**
     * CRITICAL: if you set a global API prefix (e.g. '/api' for your REST
     * routes), you MUST exclude the MCP and OAuth discovery paths. Claude
     * hits these at fixed, well-known paths — '/mcp', '/.well-known/...',
     * '/oauth/authorize', '/oauth/token' — with no prefix awareness. Forgetting
     * this exclusion is the single most common reason "OAuth works in curl but
     * Claude can't connect" — the discovery request just 404s silently.
     */
    app.setGlobalPrefix('api', {
      exclude: [
        'mcp',
        'oauth/authorize',
        'oauth/token',
        'oauth/register',
        '.well-known/oauth-authorization-server',
        '.well-known/oauth-protected-resource',
      ],
    });
    
    const port = process.env.PORT || 3001;
    await app.listen(port, '0.0.0.0');
    logger.log(`🚀 Server running on http://localhost:${port}`);
  } catch (error: any) {
    logger.error('Failed to start the application', error.stack);
    process.exit(1);
  }
}

bootstrap();
