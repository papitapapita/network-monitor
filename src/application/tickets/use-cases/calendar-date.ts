import { Result } from 'domain/shared/core';
import { TimeBlock } from 'domain/tickets';

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

// A half-given block is a client mistake, not "no block": refusing it stops a
// forgotten endTime from silently scheduling the ticket for any time that day.
export function parseTimeBlock(
  startTime: string | null | undefined,
  endTime: string | null | undefined
): Result<TimeBlock | null> {
  const hasStart = startTime !== undefined && startTime !== null;
  const hasEnd = endTime !== undefined && endTime !== null;

  if (!hasStart && !hasEnd) {
    return Result.ok<TimeBlock | null>(null);
  }
  if (!hasStart || !hasEnd) {
    return Result.fail<TimeBlock | null>(
      'startTime and endTime must be provided together'
    );
  }

  const blockResult = TimeBlock.fromStrings(startTime, endTime);
  if (blockResult.isFailure) {
    return Result.fail<TimeBlock | null>(blockResult.error!);
  }
  return Result.ok<TimeBlock | null>(blockResult.value);
}
