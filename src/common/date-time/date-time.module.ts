import { Module, Global } from '@nestjs/common';
import { DateTimeService } from './date-time.service';

/**
 * Global module that provides date/time utility services across the application.
 * Marked as @Global() so it doesn't need to be imported in every module.
 */
@Global()
@Module({
  providers: [DateTimeService],
  exports: [DateTimeService],
})
export class DateTimeModule {}
