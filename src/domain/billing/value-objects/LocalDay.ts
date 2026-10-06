// Colombia is UTC-5 with no daylight saving; billing days are local days.
export const LOCAL_OFFSET_MS = -5 * 60 * 60 * 1000;

// The Colombian calendar day holding `instant`, as UTC midnight of that date.
export function localDayOf(instant: Date): Date {
  const local = new Date(instant.getTime() + LOCAL_OFFSET_MS);
  return new Date(
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate()
    )
  );
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
