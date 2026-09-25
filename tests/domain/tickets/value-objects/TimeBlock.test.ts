// Source: src/domain/tickets/value-objects/TimeBlock.ts

import { describe, it, expect } from '@jest/globals';
import { TimeBlock } from '../../../../src/domain/tickets';
import { TimeOfDay } from '../../../../src/domain/shared/value-objects';

describe('TimeBlock', () => {
  describe('create()', () => {
    it('should succeed when the end is after the start', () => {
      const result = TimeBlock.create({
        start: TimeOfDay.create('10:00').value,
        end: TimeOfDay.create('12:00').value
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.start.toString()).toBe('10:00');
      expect(result.value.end.toString()).toBe('12:00');
    });

    it('[TKT-078] should refuse a block that ends when it starts', () => {
      const result = TimeBlock.create({
        start: TimeOfDay.create('10:00').value,
        end: TimeOfDay.create('10:00').value
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(
        'Time block end must be later than its start'
      );
    });

    it('[TKT-078] should refuse an overnight block', () => {
      const result = TimeBlock.create({
        start: TimeOfDay.create('22:00').value,
        end: TimeOfDay.create('02:00').value
      });

      expect(result.isFailure).toBe(true);
    });

    it('should refuse a missing start', () => {
      const result = TimeBlock.create({
        start: null as unknown as TimeOfDay,
        end: TimeOfDay.create('12:00').value
      });

      expect(result.isFailure).toBe(true);
    });
  });

  describe('fromStrings()', () => {
    it('should parse two HH:mm strings', () => {
      const result = TimeBlock.fromStrings('08:15', '09:45');

      expect(result.isSuccess).toBe(true);
      expect(result.value.toString()).toBe('08:15-09:45');
    });

    it('should name the start when it is malformed', () => {
      const result = TimeBlock.fromStrings('8am', '09:45');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid start time');
    });

    it('should name the end when it is malformed', () => {
      const result = TimeBlock.fromStrings('08:00', '24:00');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid end time');
    });
  });

  describe('equals()', () => {
    it('should treat blocks with the same times as equal', () => {
      const a = TimeBlock.fromStrings('10:00', '11:00').value;
      const b = TimeBlock.fromStrings('10:00', '11:00').value;

      expect(a.equals(b)).toBe(true);
    });

    it('should treat blocks with different times as different', () => {
      const a = TimeBlock.fromStrings('10:00', '11:00').value;
      const b = TimeBlock.fromStrings('10:00', '11:30').value;

      expect(a.equals(b)).toBe(false);
    });
  });
});
