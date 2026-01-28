import { Injectable } from '@nestjs/common';

@Injectable()
export class DateTimeService {
  /**
   * Gets the start of today (00:00:00.000) in UTC timezone.
   * @returns Date object set to the beginning of the current day in UTC
   * @example
   * // Returns: 2026-01-28T00:00:00.000Z
   * getStartOfTodayUTC()
   */
  getStartOfTodayUTC(): Date {
    return new Date(new Date().setUTCHours(0, 0, 0, 0));
  }

  /**
   * Gets the end of today (24:00:00.000 or start of next day) in UTC timezone.
   * @returns Date object set to the beginning of the next day in UTC
   * @example
   * // Returns: 2026-01-29T00:00:00.000Z
   * getEndOfTodayUTC()
   */
  getEndOfTodayUTC(): Date {
    return new Date(new Date().setUTCHours(24, 0, 0, 0));
  }

  /**
   * Gets the start of day (00:00:00.000) in local timezone for a given date.
   * @param date - Optional date to normalize. Defaults to current date.
   * @returns Date object set to the beginning of the day (local timezone)
   * @example
   * // Returns: 2026-01-28T00:00:00.000 (local time)
   * getStartOfDayLocal()
   */
  getStartOfDayLocal(date: Date = new Date()): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  /**
   * Adds a specified number of days to a date.
   * @param days - Number of days to add
   * @param to - Starting date. Defaults to current date.
   * @returns New Date object with days added
   * @example
   * // Returns date 7 days from now
   * addDays(7)
   */
  addDays(days: number, to: Date = new Date()): Date {
    const date = new Date(to);
    date.setDate(date.getDate() + days);
    return date;
  }

  /**
   * Subtracts a specified number of days from a date.
   * @param days - Number of days to subtract
   * @param from - Starting date. Defaults to current date.
   * @returns New Date object with days subtracted
   * @example
   * // Returns date from 7 days ago
   * subtractDays(7)
   */
  subtractDays(days: number, from: Date = new Date()): Date {
    const date = new Date(from);
    date.setDate(date.getDate() - days);
    return date;
  }

  /**
   * Subtracts a specified number of months from a date.
   * @param months - Number of months to subtract
   * @param from - Starting date. Defaults to current date.
   * @returns New Date object with months subtracted
   * @example
   * // Returns date from 1 month ago
   * subtractMonths(1)
   */
  subtractMonths(months: number, from: Date = new Date()): Date {
    const date = new Date(from);
    date.setMonth(date.getMonth() - months);
    return date;
  }

  /**
   * Gets the earliest possible date (Unix epoch: January 1, 1970).
   * @returns Date object representing Unix epoch (time 0)
   * @example
   * // Returns: 1970-01-01T00:00:00.000Z
   * getEpochDate()
   */
  getEpochDate(): Date {
    return new Date(0);
  }

  /**
   * Calculates the number of days between two dates.
   * @param from - Start date
   * @param to - End date
   * @returns Number of days (can be fractional). Returns ceiling value for whole days.
   * @example
   * // Returns: 7
   * getDaysDifference(startDate, endDate)
   */
  getDaysDifference(from: Date, to: Date): number {
    const millisecondsDiff = to.getTime() - from.getTime();
    const daysDiff = millisecondsDiff / (1000 * 60 * 60 * 24);
    return Math.ceil(daysDiff);
  }

  /**
   * Converts a date to ISO string and extracts only the date portion (YYYY-MM-DD).
   * @param date - Date to convert
   * @returns Date string in YYYY-MM-DD format
   * @example
   * // Returns: "2026-01-28"
   * toDateOnlyString(new Date())
   */
  toDateOnlyString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Validates whether a date is valid (not NaN).
   * @param date - Date object or string to validate
   * @returns True if date is valid, false otherwise
   * @example
   * // Returns: true
   * isValidDate(new Date())
   * // Returns: false
   * isValidDate(new Date('invalid'))
   */
  isValidDate(date: Date | string): boolean {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return !isNaN(dateObj.getTime());
  }

  /**
   * Parses a string or date input into a Date object.
   * @param input - Date string or Date object
   * @returns Parsed Date object
   * @throws Error if date is invalid
   * @example
   * // Returns: Date object
   * parseDate("2026-01-28")
   */
  parseDate(input: Date | string): Date {
    const date = typeof input === 'string' ? new Date(input) : input;
    if (!this.isValidDate(date)) {
      throw new Error(`Invalid date: ${input}`);
    }
    return date;
  }

  /**
   * Gets the current timestamp in milliseconds.
   * @returns Current time in milliseconds since Unix epoch
   * @example
   * // Returns: 1738051200000
   * now()
   */
  now(): number {
    return Date.now();
  }

  /**
   * Calculates elapsed time in milliseconds from a start timestamp.
   * @param startTime - Start timestamp in milliseconds
   * @returns Elapsed time in milliseconds
   * @example
   * const start = dateTimeService.now();
   * // ... some operation ...
   * const elapsed = dateTimeService.getElapsedTime(start); // Returns: 150 (ms)
   */
  getElapsedTime(startTime: number): number {
    return Date.now() - startTime;
  }

  /**
   * Gets the current date and time.
   * @returns New Date object representing current moment
   * @example
   * // Returns: current Date object
   * getCurrentDate()
   */
  getCurrentDate(): Date {
    return new Date();
  }

  /**
   * Converts any date to ISO string format.
   * @param date - Optional date to convert. Defaults to current date.
   * @returns ISO 8601 formatted string
   * @example
   * // Returns: "2026-01-28T12:34:56.789Z"
   * toISOString()
   */
  toISOString(date: Date = new Date()): string {
    return date.toISOString();
  }

  /**
   * Normalizes a date to UTC midnight (00:00:00.000).
   * @param date - Optional date to normalize. Defaults to current date.
   * @returns Date object set to UTC midnight
   * @example
   * // Returns: 2026-01-28T00:00:00.000Z
   * normalizeToUTCMidnight()
   */
  normalizeToUTCMidnight(date: Date = new Date()): Date {
    const normalized = new Date(date);
    normalized.setUTCHours(0, 0, 0, 0);
    return normalized;
  }
}
