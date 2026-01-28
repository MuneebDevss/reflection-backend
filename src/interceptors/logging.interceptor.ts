import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DateTimeService } from '../common/date-time/date-time.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private dateTimeService: DateTimeService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body } = request;
    const now = this.dateTimeService.now();

    this.logger.log(`➡️  ${method} ${url}`);
    
    if (body && Object.keys(body).length > 0) {
      this.logger.debug(`Request body: ${JSON.stringify(body)}`);
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const delay = this.dateTimeService.getElapsedTime(now);
          this.logger.log(`⬅️  ${method} ${url} ${response.statusCode} - ${delay}ms`);
        },
        error: (error) => {
          const delay = this.dateTimeService.getElapsedTime(now);
          this.logger.error(`❌ ${method} ${url} - ${error.message} - ${delay}ms`);
        },
      }),
    );
  }
}
