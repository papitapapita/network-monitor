import { Result } from 'domain/shared/core';

const CALENDAR_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Tickets are scheduled by calendar day, not by instant. Parsing at UTC
 * midnight keeps "2026-08-04" the same day regardless of where the server or
 * the caller sits, and the round-trip check rejects dates like 2026-02-30 that
 * `new Date` would silently roll forward.
 */
export function parseCalendarDate(
  value: string,
  field: string = 'date'
): Result<Date> {
  if (typeof value !== 'string') {
    return Result.fail<Date>(`Invalid ${field}: must be a string`);
  }

  const trimmed = value.trim();
  if (!CALENDAR_DATE_REGEX.test(trimmed)) {
    return Result.fail<Date>(
      `Invalid ${field}: must be a calendar date in YYYY-MM-DD format`
    );
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return Result.fail<Date>(
      `Invalid ${field}: ${value} is not a real date`
    );
  }

  if (parsed.toISOString().slice(0, 10) !== trimmed) {
    return Result.fail<Date>(
      `Invalid ${field}: ${value} is not a real date`
    );
  }

  return Result.ok<Date>(parsed);
}

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );
}
