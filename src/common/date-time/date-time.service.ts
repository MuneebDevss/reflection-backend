import { Injectable } from '@nestjs/common';

@Injectable()
export class DateTimeService {

  now(): Date {
    return new Date();
  }

  getElapsedTime(start: Date): number {
    const now = this.now();
    return now.getTime() - start.getTime();
  }
  /**
   * Returns "today" as a YYYY-MM-DD string in the user's local timezone.
   * This is the only method that intentionally converts UTC → local time,
   * used purely for display purposes (e.g. showing the user their local date).
   * All internal scheduling logic uses UTC — do not use this for engine logic.
   */
  getCurrentDateInTimezone(timezone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const year  = parts.find((p) => p.type === 'year')!.value;
    const month = parts.find((p) => p.type === 'month')!.value;
    const day   = parts.find((p) => p.type === 'day')!.value;

    return `${year}-${month}-${day}`;
  }

  /**
   * Returns a new Date set to UTC midnight (00:00:00.000Z) for the given date.
   * Uses setUTCHours to guarantee UTC regardless of the server's local timezone.
   *
   * @example
   * startOfDay(new Date('2026-06-14T18:30:00Z')) // → 2026-06-14T00:00:00.000Z
   */
  startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Returns the number of whole elapsed calendar days between two dates.
   * Operates on raw milliseconds (always UTC) so it is timezone-safe by nature.
   * Math.round absorbs any floating-point drift from DST boundaries.
   *
   * @example
   * getDaysDifference(yesterday, today) // → 1
   * getDaysDifference(today, today)     // → 0
   */
  getDaysDifference(from: Date, to: Date): number {
    const ms = to.getTime() - from.getTime();
    return Math.round(ms / (1000 * 60 * 60 * 24));
  }

  /**
   * Returns a new Date with `days` added, in UTC.
   * Uses setUTCDate/getUTCDate to avoid local-timezone day boundary shifts.
   *
   * @example
   * addDays(new Date('2026-01-31T00:00:00Z'), 1) // → 2026-02-01T00:00:00.000Z
   */
  addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }

  /**
   * Returns a new Date with `days` subtracted, in UTC.
   *
   * @example
   * subtractDays(new Date('2026-01-08T00:00:00Z'), 7) // → 2026-01-01T00:00:00.000Z
   */
  subtractDays(date: Date, days: number): Date {
    return this.addDays(date, -days);
  }

  /**
   * Returns a new Date with `months` subtracted, in UTC.
   * Uses setUTCMonth/getUTCMonth to stay UTC-safe.
   *
   * @example
   * subtractMonths(new Date('2026-03-15T00:00:00Z'), 1) // → 2026-02-15T00:00:00.000Z
   */
  subtractMonths(date: Date, months: number): Date {
    const d = new Date(date);
    d.setUTCMonth(d.getUTCMonth() - months);
    return d;
  }

  /** Returns the current moment as a Date (UTC internally, as all JS Dates are). */
  getCurrentDate(): Date {
    return new Date();
  }

  /**
   * Parses a string or Date into a validated Date object.
   * @throws if the input does not represent a valid date.
   */
  parseDate(input: Date | string): Date {
    const d = typeof input === 'string' ? new Date(input) : new Date(input);
    if (isNaN(d.getTime())) throw new Error(`Invalid date: ${input}`);
    return d;
  }

  /**
   * Returns a YYYY-MM-DD string for the given date in UTC.
   * toISOString() always emits UTC, so this is timezone-safe.
   */
  toDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /** Returns true if the given date or string represents a valid date. */
  isValidDate(date: Date | string): boolean {
    const d = typeof date === 'string' ? new Date(date) : date;
    return !isNaN(d.getTime());
  }
}