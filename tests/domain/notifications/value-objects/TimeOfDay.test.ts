// Source: src/domain/notifications/value-objects/TimeOfDay.ts

import { TimeOfDay } from '../../../../src/domain/notifications/value-objects/TimeOfDay';

describe('TimeOfDay', () => {
  describe('create(value)', () => {
    it('should succeed for a valid HH:mm string', () => {
      const result = TimeOfDay.create('22:00');

      expect(result.isSuccess).toBe(true);
      expect(result.value.hours).toBe(22);
      expect(result.value.minutes).toBe(0);
    });

    it('should accept the earliest time of day', () => {
      const result = TimeOfDay.create('00:00');

      expect(result.isSuccess).toBe(true);
    });

    it('should accept the latest time of day', () => {
      const result = TimeOfDay.create('23:59');

      expect(result.isSuccess).toBe(true);
    });

    it('[NOT-171] should reject an hour above 23', () => {
      const result = TimeOfDay.create('24:00');

      expect(result.isFailure).toBe(true);
    });

    it('[NOT-171] should reject a minute above 59', () => {
      const result = TimeOfDay.create('07:60');

      expect(result.isFailure).toBe(true);
    });

    it('[NOT-171] should reject a non-HH:mm string', () => {
      const result = TimeOfDay.create('7:00 AM');

      expect(result.isFailure).toBe(true);
    });

    it('[NOT-171] should reject an empty string', () => {
      const result = TimeOfDay.create('');

      expect(result.isFailure).toBe(true);
    });

    it('should reject null', () => {
      const result = TimeOfDay.create(null as unknown as string);

      expect(result.isFailure).toBe(true);
    });
  });

  describe('[NOT-172] fromDate(date)', () => {
    it('should read the hours and minutes off the local wall clock', () => {
      const date = new Date(2026, 5, 1, 22, 30);

      const timeOfDay = TimeOfDay.fromDate(date);

      expect(timeOfDay.hours).toBe(22);
      expect(timeOfDay.minutes).toBe(30);
    });
  });

  describe('toMinutes()', () => {
    it('should convert to minutes since midnight', () => {
      const result = TimeOfDay.create('01:30');

      expect(result.value.toMinutes()).toBe(90);
    });
  });

  describe('toString()', () => {
    it('should pad back to a HH:mm string', () => {
      const result = TimeOfDay.create('07:05');

      expect(result.value.toString()).toBe('07:05');
    });
  });
});
