import { Guard } from '../../../src/domain/shared/kernel';

describe('Guard Utility Tests', () => {
  // ----------------------------------------------------
  // combine
  // ----------------------------------------------------
  describe('combine()', () => {
    it('returns success when all guards succeed', () => {
      const result = Guard.combine([
        { succeeded: true },
        { succeeded: true }
      ]);
      expect(result.succeeded).toBe(true);
    });

    it('returns the first failing guard result', () => {
      const fail = { succeeded: false, message: 'Error A' };
      const result = Guard.combine([
        { succeeded: true },
        fail,
        { succeeded: false, message: 'Error B' }
      ]);
      expect(result).toBe(fail);
    });
  });

  // ----------------------------------------------------
  // againstNullOrUndefined
  // ----------------------------------------------------
  describe('againstNullOrUndefined()', () => {
    it('returns failure when argument is null', () => {
      const result = Guard.againstNullOrUndefined(null, 'arg');
      expect(result.succeeded).toBe(false);
      expect(result.message).toBe('arg is null or undefined');
    });

    it('returns failure when argument is undefined', () => {
      const result = Guard.againstNullOrUndefined(undefined, 'arg');
      expect(result.succeeded).toBe(false);
    });

    it('returns success when argument is valid', () => {
      const result = Guard.againstNullOrUndefined('value', 'arg');
      expect(result.succeeded).toBe(true);
    });
  });

  // ----------------------------------------------------
  // againstNullOrUndefinedBulk
  // ----------------------------------------------------
  describe('againstNullOrUndefinedBulk()', () => {
    it('returns success when all arguments are valid', () => {
      const result = Guard.againstNullOrUndefinedBulk([
        { argument: 1, argumentName: 'a' },
        { argument: 'hello', argumentName: 'b' }
      ]);
      expect(result.succeeded).toBe(true);
    });

    it('returns first failure when one argument is invalid', () => {
      const result = Guard.againstNullOrUndefinedBulk([
        { argument: 3, argumentName: 'valid' },
        { argument: null, argumentName: 'invalid' }
      ]);

      expect(result.succeeded).toBe(false);
      expect(result.message).toBe('invalid is null or undefined');
    });
  });

  // ----------------------------------------------------
  // inRange
  // ----------------------------------------------------
  describe('inRange()', () => {
    it('returns success when number is inside range', () => {
      const result = Guard.inRange(5, 1, 10, 'num');
      expect(result.succeeded).toBe(true);
    });

    it('returns failure when number is outside range', () => {
      const result = Guard.inRange(15, 1, 10, 'num');
      expect(result.succeeded).toBe(false);
      expect(result.message).toBe('num is not within range 1 to 10.');
    });
  });

  // ----------------------------------------------------
  // allInRange
  // ----------------------------------------------------
  describe('allInRange()', () => {
    it('returns success when all numbers are inside range', () => {
      const result = Guard.allInRange([2, 5, 7], 1, 10, 'nums');
      expect(result.succeeded).toBe(true);
    });

    it('returns failure when any number is outside range', () => {
      const result = Guard.allInRange([3, 9, 20], 1, 10, 'nums');
      expect(result.succeeded).toBe(false);
      expect(result.message).toBe('nums is not within the range.');
    });
  });

  // ----------------------------------------------------
  // againstAtLeast
  // ----------------------------------------------------
  describe('againstAtLeast()', () => {
    it('returns failure when numChars < 1', () => {
      const result = Guard.againstAtLeast(0, 1, 'name');
      expect(result.succeeded).toBe(false);
      expect(result.message).toBe(
        'name must be at least 1 characters.'
      );
    });

    it('returns success when numChars >= 1', () => {
      const result = Guard.againstAtLeast(5, 1, 'name');
      expect(result.succeeded).toBe(true);
    });
  });

  // ----------------------------------------------------
  // againstAtMost
  // ----------------------------------------------------
  describe('againstAtMost()', () => {
    it('returns failure when numChars > 255', () => {
      const result = Guard.againstAtMost(256, 255, 'field');
      expect(result.succeeded).toBe(false);
      expect(result.message).toBe(
        'field must be at most 255 characters.'
      );
    });

    it('returns success when numChars <= 255', () => {
      const result = Guard.againstAtMost(200, 255, 'field');
      expect(result.succeeded).toBe(true);
    });
  });

  // ----------------------------------------------------
  // isString
  // ----------------------------------------------------
  describe('isString()', () => {
    it('returns failure when value is not a string', () => {
      const result = Guard.isString(123, 'field');
      expect(result.succeeded).toBe(false);
      expect(result.message).toBe('field must be a string.');
    });

    it('returns success when value is a string', () => {
      const result = Guard.isString('hello', 'field');
      expect(result.succeeded).toBe(true);
    });
  });

  // ----------------------------------------------------
  // isNumber
  // ----------------------------------------------------
  describe('isNumber()', () => {
    it('returns failure when value is not a number', () => {
      const result = Guard.isNumber('abc', 'age');
      expect(result.succeeded).toBe(false);
    });

    it('returns failure when value is NaN', () => {
      const result = Guard.isNumber(NaN, 'age');
      expect(result.succeeded).toBe(false);
    });

    it('returns success when value is a number', () => {
      const result = Guard.isNumber(42, 'age');
      expect(result.succeeded).toBe(true);
    });
  });

  // ----------------------------------------------------
  // isBoolean
  // ----------------------------------------------------
  describe('isBoolean()', () => {
    it('returns failure when value is not a boolean', () => {
      const result = Guard.isBoolean('true', 'active');
      expect(result.succeeded).toBe(false);
      expect(result.message).toBe('active must be a boolean.');
    });

    it('returns success when value is boolean', () => {
      const result = Guard.isBoolean(true, 'active');
      expect(result.succeeded).toBe(true);
    });
  });

  // ----------------------------------------------------
  // isDate
  // ----------------------------------------------------
  describe('isDate()', () => {
    it('returns failure when value is not a date', () => {
      const result = Guard.isDate('not-date', 'createdAt');
      expect(result.succeeded).toBe(false);
    });

    it('returns failure when date is invalid', () => {
      const result = Guard.isDate(new Date('invalid'), 'createdAt');
      expect(result.succeeded).toBe(false);
    });

    it('returns success with a valid date', () => {
      const result = Guard.isDate(new Date(), 'createdAt');
      expect(result.succeeded).toBe(true);
    });
  });

  // ----------------------------------------------------
  // greaterThan
  // ----------------------------------------------------
  describe('greaterThan()', () => {
    it('returns failure when actualValue <= minValue', () => {
      const result = Guard.greaterThan(10, 10, 'score');
      expect(result.succeeded).toBe(false);
      expect(result.message).toBe('score must be greater than 10.');
    });

    it('returns success when actualValue > minValue', () => {
      const result = Guard.greaterThan(10, 20, 'score');
      expect(result.succeeded).toBe(true);
    });
  });

  // ----------------------------------------------------
  // isValidEmail
  // ----------------------------------------------------
  describe('isValidEmail()', () => {
    it('returns failure for invalid email format', () => {
      const result = Guard.isValidEmail('invalid-email', 'email');
      expect(result.succeeded).toBe(false);
      expect(result.message).toBe(
        'email is not a valid email address'
      );
    });

    it('returns success for valid email format', () => {
      const result = Guard.isValidEmail('user@example.com', 'email');
      expect(result.succeeded).toBe(true);
    });
  });
});
