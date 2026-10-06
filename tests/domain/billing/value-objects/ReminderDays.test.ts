// Source: src/domain/billing/value-objects/ReminderDays.ts

import { describe, it, expect } from '@jest/globals';
import { ReminderDays } from '../../../../src/domain/billing';

// Local Colombian time (UTC-5) written as an instant.
function bogota(isoLocal: string): Date {
  return new Date(`${isoLocal}-05:00`);
}

// The end of the 15th in Bogotá: a bill's due date.
const DUE_15_OCT = bogota('2026-10-15T23:59:59.999');

describe('ReminderDays', () => {
  it('[BIL-310] the cut day is the day after the last grace day', () => {
    expect(ReminderDays.cutDay(DUE_15_OCT, 3).toISOString()).toBe(
      '2026-10-19T00:00:00.000Z'
    );
    expect(ReminderDays.cutDay(DUE_15_OCT, 0).toISOString()).toBe(
      '2026-10-16T00:00:00.000Z'
    );
  });

  describe('[BIL-321] dueRangeFor', () => {
    function remindedOn(isoLocal: string, graceDays = 3): boolean {
      const range = ReminderDays.dueRangeFor(
        bogota(isoLocal),
        graceDays
      );
      return (
        range !== null &&
        DUE_15_OCT >= range.from &&
        DUE_15_OCT <= range.to
      );
    }

    it('reminds on the last two grace days only', () => {
      expect(remindedOn('2026-10-16T06:00:00')).toBe(false);
      expect(remindedOn('2026-10-17T06:00:00')).toBe(true);
      expect(remindedOn('2026-10-18T23:00:00')).toBe(true);
      expect(remindedOn('2026-10-19T06:00:00')).toBe(false);
    });

    it('with one grace day, reminds on that day', () => {
      expect(remindedOn('2026-10-15T12:00:00', 1)).toBe(false);
      expect(remindedOn('2026-10-16T06:00:00', 1)).toBe(true);
      expect(remindedOn('2026-10-17T06:00:00', 1)).toBe(false);
    });

    it('with two grace days, reminds on both', () => {
      expect(remindedOn('2026-10-16T06:00:00', 2)).toBe(true);
      expect(remindedOn('2026-10-17T06:00:00', 2)).toBe(true);
    });

    it('with no grace days, never reminds', () => {
      expect(
        ReminderDays.dueRangeFor(bogota('2026-10-16T06:00:00'), 0)
      ).toBeNull();
    });

    it('covers whole Colombian days', () => {
      const range = ReminderDays.dueRangeFor(
        bogota('2026-10-18T06:00:00'),
        3
      )!;

      expect(range.from.toISOString()).toBe(
        '2026-10-15T05:00:00.000Z'
      );
      expect(range.to.toISOString()).toBe('2026-10-17T04:59:59.999Z');
    });
  });
});
