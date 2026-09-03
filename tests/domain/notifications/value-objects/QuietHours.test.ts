// Source: src/domain/notifications/value-objects/QuietHours.ts

import { QuietHours } from '../../../../src/domain/notifications/value-objects/QuietHours';
import { TimeOfDay } from '../../../../src/domain/notifications/value-objects/TimeOfDay';

function time(value: string): TimeOfDay {
  return TimeOfDay.create(value).value;
}

describe('QuietHours', () => {
  describe('create(start, end)', () => {
    it('should succeed for a same-day window', () => {
      const result = QuietHours.create(time('08:00'), time('17:00'));

      expect(result.isSuccess).toBe(true);
    });

    it('should succeed for an overnight window', () => {
      const result = QuietHours.create(time('22:00'), time('07:00'));

      expect(result.isSuccess).toBe(true);
    });

    it('[NOT-171] should reject equal start and end', () => {
      const result = QuietHours.create(time('22:00'), time('22:00'));

      expect(result.isFailure).toBe(true);
    });
  });

  describe('[NOT-172] contains(now) — same-day window', () => {
    const window = QuietHours.create(
      time('08:00'),
      time('17:00')
    ).value;

    it('should be true in the middle of the window', () => {
      expect(window.contains(time('12:00'))).toBe(true);
    });

    it('should be true exactly at the start boundary', () => {
      expect(window.contains(time('08:00'))).toBe(true);
    });

    it('should be false exactly at the end boundary', () => {
      expect(window.contains(time('17:00'))).toBe(false);
    });

    it('should be false before the window', () => {
      expect(window.contains(time('07:59'))).toBe(false);
    });

    it('should be false after the window', () => {
      expect(window.contains(time('17:01'))).toBe(false);
    });
  });

  describe('[NOT-172] contains(now) — overnight window', () => {
    const window = QuietHours.create(
      time('22:00'),
      time('07:00')
    ).value;

    it('should be true right after the start boundary, before midnight', () => {
      expect(window.contains(time('23:30'))).toBe(true);
    });

    it('should be true right before the end boundary, after midnight', () => {
      expect(window.contains(time('03:00'))).toBe(true);
    });

    it('should be true exactly at the start boundary', () => {
      expect(window.contains(time('22:00'))).toBe(true);
    });

    it('should be false exactly at the end boundary', () => {
      expect(window.contains(time('07:00'))).toBe(false);
    });

    it('should be false in the middle of the day', () => {
      expect(window.contains(time('12:00'))).toBe(false);
    });
  });
});
