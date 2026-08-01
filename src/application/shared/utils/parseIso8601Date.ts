// `new Date(value)` accepts "March 5, 2020" and rolls "2024-02-31" over into
// March, so the shape and the calendar have to be checked before parsing for
// the ISO 8601 promise in the error message to hold.
const ISO_8601 =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function exceeds(part: string | undefined, max: number): boolean {
  return part !== undefined && Number(part) > max;
}

export function parseIso8601Date(value: string): Date | null {
  const trimmed = value.trim();
  const match = ISO_8601.exec(trimmed);
  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12) {
    return null;
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  if (
    exceeds(match[4], 23) ||
    exceeds(match[5], 59) ||
    exceeds(match[6], 59)
  ) {
    return null;
  }

  const parsed = new Date(trimmed);

  return isNaN(parsed.getTime()) ? null : parsed;
}
