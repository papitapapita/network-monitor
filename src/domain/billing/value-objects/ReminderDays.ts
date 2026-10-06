import { LOCAL_OFFSET_MS, localDayOf } from './LocalDay';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DueRange {
  from: Date;
  to: Date;
}

// When payment reminders go out (BIL-321): on the last two grace days, the
// days just before the cut (BIL-310). Days are Colombian calendar days.
export class ReminderDays {
  // The cut day of a bill due at `dueDate`: the day after its last grace day.
  public static cutDay(dueDate: Date, graceDays: number): Date {
    return new Date(
      localDayOf(dueDate).getTime() + (graceDays + 1) * DAY_MS
    );
  }

  // The due dates, as instants, of the bills to remind on `now`'s day;
  // null when there are no grace days to remind in.
  public static dueRangeFor(
    now: Date,
    graceDays: number
  ): DueRange | null {
    if (graceDays < 1) return null;
    const today = localDayOf(now).getTime();
    const firstDueDay = today - graceDays * DAY_MS;
    const lastDueDay = Math.min(
      today - (graceDays - 1) * DAY_MS,
      today - DAY_MS
    );
    return {
      from: new Date(firstDueDay - LOCAL_OFFSET_MS),
      to: new Date(lastDueDay + DAY_MS - 1 - LOCAL_OFFSET_MS)
    };
  }
}
