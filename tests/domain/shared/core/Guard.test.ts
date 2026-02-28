// Source: src/domain/shared/core/Guard.ts
//
// NOTE: Guard is imported from the device-inventory barrel as required by
// project convention. If Guard is not yet re-exported from that barrel, add
//   export * from '../shared/core/Guard';
// (or equivalent) to src/domain/device-inventory/index.ts so this import
// resolves correctly at runtime.

import { Guard } from '../../../../src/domain/shared/core';

// ---------------------------------------------------------------------------
// Type alias to keep test helpers readable without using `any`
// ---------------------------------------------------------------------------
type UnknownValue = unknown;

describe('Guard', () => {
  // =========================================================================
  describe('combine()', () => {
    it('should return succeeded true when given an empty array', () => {
      const result = Guard.combine([]);

      expect(result.succeeded).toBe(true);
    });

    it('should return succeeded true when all guard results succeeded', () => {
      const result = Guard.combine([
        { succeeded: true },
        { succeeded: true },
        { succeeded: true }
      ]);

      expect(result.succeeded).toBe(true);
    });

    it('should return succeeded true with no message when all guard results succeeded', () => {
      const result = Guard.combine([
        { succeeded: true },
        { succeeded: true }
      ]);

      expect(result.succeeded).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should return the first failing result when the first element fails', () => {
      const firstFail = {
        succeeded: false,
        message: 'first failure'
      };

      const result = Guard.combine([
        firstFail,
        { succeeded: false, message: 'second failure' }
      ]);

      expect(result).toBe(firstFail);
    });

    it('should return the first failing result when a middle element fails', () => {
      const middleFail = {
        succeeded: false,
        message: 'middle failure'
      };

      const result = Guard.combine([
        { succeeded: true },
        middleFail,
        { succeeded: false, message: 'later failure' }
      ]);

      expect(result).toBe(middleFail);
    });

    it('should return the failing result when the last element is the only failure', () => {
      const lastFail = { succeeded: false, message: 'last failure' };

      const result = Guard.combine([
        { succeeded: true },
        { succeeded: true },
        lastFail
      ]);

      expect(result).toBe(lastFail);
    });

    it('should short-circuit and not evaluate guards after the first failure', () => {
      const firstFail = { succeeded: false, message: 'Error A' };
      const secondFail = { succeeded: false, message: 'Error B' };

      const result = Guard.combine([
        { succeeded: true },
        firstFail,
        secondFail
      ]);

      // Must be the exact same object reference — not the second failure
      expect(result).toBe(firstFail);
      expect(result.message).toBe('Error A');
    });

    it('should preserve the exact message from the failing result', () => {
      const expectedMessage = 'something specific went wrong';
      const fail = { succeeded: false, message: expectedMessage };

      const result = Guard.combine([{ succeeded: true }, fail]);

      expect(result.message).toBe(expectedMessage);
    });
  });

  // =========================================================================
  describe('againstNullOrUndefined()', () => {
    it('should return failure when argument is null', () => {
      const result = Guard.againstNullOrUndefined(null, 'fieldName');

      expect(result.succeeded).toBe(false);
    });

    it('should include the argument name in the error message when null', () => {
      const result = Guard.againstNullOrUndefined(null, 'fieldName');

      expect(result.message).toBe('fieldName is null or undefined');
    });

    it('should return failure when argument is undefined', () => {
      const result = Guard.againstNullOrUndefined(
        undefined,
        'fieldName'
      );

      expect(result.succeeded).toBe(false);
    });

    it('should include the argument name in the error message when undefined', () => {
      const result = Guard.againstNullOrUndefined(
        undefined,
        'fieldName'
      );

      expect(result.message).toBe('fieldName is null or undefined');
    });

    it('should return success when argument is 0 (falsy but valid)', () => {
      const result = Guard.againstNullOrUndefined(0, 'count');

      expect(result.succeeded).toBe(true);
    });

    it('should return success when argument is an empty string (falsy but valid)', () => {
      const result = Guard.againstNullOrUndefined('', 'label');

      expect(result.succeeded).toBe(true);
    });

    it('should return success when argument is false (falsy but valid)', () => {
      const result = Guard.againstNullOrUndefined(false, 'active');

      expect(result.succeeded).toBe(true);
    });

    it('should return success when argument is a non-empty string', () => {
      const result = Guard.againstNullOrUndefined('hello', 'name');

      expect(result.succeeded).toBe(true);
    });

    it('should return success when argument is a positive number', () => {
      const result = Guard.againstNullOrUndefined(42, 'port');

      expect(result.succeeded).toBe(true);
    });

    it('should return success when argument is an object', () => {
      const result = Guard.againstNullOrUndefined(
        { key: 'value' },
        'config'
      );

      expect(result.succeeded).toBe(true);
    });

    it('should return success when argument is an array', () => {
      const result = Guard.againstNullOrUndefined([], 'items');

      expect(result.succeeded).toBe(true);
    });

    it('should return success with no message property when argument is valid', () => {
      const result = Guard.againstNullOrUndefined('value', 'name');

      expect(result.succeeded).toBe(true);
      expect(result.message).toBeUndefined();
    });
  });

  // =========================================================================
  describe('againstNullOrUndefinedBulk()', () => {
    it('should return success when a single-element array holds a valid value', () => {
      const result = Guard.againstNullOrUndefinedBulk([
        { argument: 'hello', argumentName: 'name' }
      ]);

      expect(result.succeeded).toBe(true);
    });

    it('should return success when all arguments are valid', () => {
      const result = Guard.againstNullOrUndefinedBulk([
        { argument: 'hello', argumentName: 'name' },
        { argument: 42, argumentName: 'port' },
        { argument: false, argumentName: 'active' }
      ]);

      expect(result.succeeded).toBe(true);
    });

    it('should return failure when the first argument is null', () => {
      const result = Guard.againstNullOrUndefinedBulk([
        { argument: null, argumentName: 'firstField' },
        { argument: 'valid', argumentName: 'secondField' }
      ]);

      expect(result.succeeded).toBe(false);
      expect(result.message).toBe('firstField is null or undefined');
    });

    it('should return failure for the first null argument in a single-element array', () => {
      const result = Guard.againstNullOrUndefinedBulk([
        { argument: null, argumentName: 'onlyField' }
      ]);

      expect(result.succeeded).toBe(false);
      expect(result.message).toBe('onlyField is null or undefined');
    });

    it('should return failure when a middle argument is undefined', () => {
      const result = Guard.againstNullOrUndefinedBulk([
        { argument: 'valid', argumentName: 'first' },
        { argument: undefined, argumentName: 'middle' },
        { argument: 'also valid', argumentName: 'last' }
      ]);

      expect(result.succeeded).toBe(false);
      expect(result.message).toBe('middle is null or undefined');
    });

    it('should return failure for the first failing argument and short-circuit remaining checks', () => {
      const result = Guard.againstNullOrUndefinedBulk([
        { argument: null, argumentName: 'firstNull' },
        { argument: null, argumentName: 'secondNull' }
      ]);

      expect(result.succeeded).toBe(false);
      expect(result.message).toBe('firstNull is null or undefined');
    });

    it('should accept 0 as a valid argument (falsy but not null/undefined)', () => {
      const result = Guard.againstNullOrUndefinedBulk([
        { argument: 0, argumentName: 'zeroValue' }
      ]);

      expect(result.succeeded).toBe(true);
    });

    it('should accept empty string as a valid argument', () => {
      const result = Guard.againstNullOrUndefinedBulk([
        { argument: '', argumentName: 'emptyString' }
      ]);

      expect(result.succeeded).toBe(true);
    });
  });

  // =========================================================================
  describe('inRange()', () => {
    it('should return success when number equals the minimum boundary', () => {
      const result = Guard.inRange(1, 1, 10, 'port');

      expect(result.succeeded).toBe(true);
    });

    it('should return success when number equals the maximum boundary', () => {
      const result = Guard.inRange(10, 1, 10, 'port');

      expect(result.succeeded).toBe(true);
    });

    it('should return success when number is between min and max', () => {
      const result = Guard.inRange(5, 1, 10, 'port');

      expect(result.succeeded).toBe(true);
    });

    it('should return failure when number is one below the minimum', () => {
      const result = Guard.inRange(0, 1, 10, 'port');

      expect(result.succeeded).toBe(false);
    });

    it('should return failure when number is well below the minimum', () => {
      const result = Guard.inRange(-50, 1, 10, 'port');

      expect(result.succeeded).toBe(false);
    });

    it('should return failure when number is one above the maximum', () => {
      const result = Guard.inRange(11, 1, 10, 'port');

      expect(result.succeeded).toBe(false);
    });

    it('should return failure when number is well above the maximum', () => {
      const result = Guard.inRange(9999, 1, 10, 'port');

      expect(result.succeeded).toBe(false);
    });

    it('should include the argument name, min, and max in the error message on failure', () => {
      const result = Guard.inRange(0, 1, 10, 'port');

      expect(result.message).toBe(
        'port is not within range 1 to 10.'
      );
    });

    it('should return success with a negative range when number equals negative min', () => {
      const result = Guard.inRange(-10, -10, -1, 'temperature');

      expect(result.succeeded).toBe(true);
    });

    it('should return success with a negative range when number equals negative max', () => {
      const result = Guard.inRange(-1, -10, -1, 'temperature');

      expect(result.succeeded).toBe(true);
    });

    it('should return failure when number is outside a negative range', () => {
      const result = Guard.inRange(0, -10, -1, 'temperature');

      expect(result.succeeded).toBe(false);
      expect(result.message).toBe(
        'temperature is not within range -10 to -1.'
      );
    });

    it('should return success when range min and max are equal and number matches', () => {
      const result = Guard.inRange(5, 5, 5, 'fixed');

      expect(result.succeeded).toBe(true);
    });

    it('should return failure when range min and max are equal and number does not match', () => {
      const result = Guard.inRange(6, 5, 5, 'fixed');

      expect(result.succeeded).toBe(false);
    });
  });

  // =========================================================================
  describe('allInRange()', () => {
    it('should return success when the array is empty', () => {
      const result = Guard.allInRange([], 1, 10, 'nums');

      expect(result.succeeded).toBe(true);
    });

    it('should return success when all numbers are within the range', () => {
      const result = Guard.allInRange([1, 5, 10], 1, 10, 'nums');

      expect(result.succeeded).toBe(true);
    });

    it('should return success when all numbers sit exactly on the boundaries', () => {
      const result = Guard.allInRange([1, 1, 10, 10], 1, 10, 'nums');

      expect(result.succeeded).toBe(true);
    });

    it('should return failure when one number is below the minimum', () => {
      const result = Guard.allInRange([0, 5, 10], 1, 10, 'nums');

      expect(result.succeeded).toBe(false);
    });

    it('should return failure when one number is above the maximum', () => {
      const result = Guard.allInRange([1, 5, 11], 1, 10, 'nums');

      expect(result.succeeded).toBe(false);
    });

    it('should return failure when the last element is the only out-of-range value', () => {
      const result = Guard.allInRange([3, 7, 100], 1, 10, 'nums');

      expect(result.succeeded).toBe(false);
    });

    it('should return failure when the first element is the only out-of-range value', () => {
      const result = Guard.allInRange([-1, 5, 9], 1, 10, 'nums');

      expect(result.succeeded).toBe(false);
    });

    it('should use the generic out-of-range message (not the per-element message)', () => {
      const result = Guard.allInRange([1, 200], 1, 10, 'nums');

      expect(result.message).toBe('nums is not within the range.');
    });

    it('should return failure when every number is outside the range', () => {
      const result = Guard.allInRange([20, 30, 40], 1, 10, 'nums');

      expect(result.succeeded).toBe(false);
    });
  });

  // =========================================================================
  describe('againstAtLeast()', () => {
    it('should return success when numChars equals the minimum boundary', () => {
      const result = Guard.againstAtLeast(1, 1, 'name');

      expect(result.succeeded).toBe(true);
    });

    it('should return success when numChars is well above the minimum', () => {
      const result = Guard.againstAtLeast(50, 1, 'name');

      expect(result.succeeded).toBe(true);
    });

    it('should return failure when numChars is one below the minimum', () => {
      const result = Guard.againstAtLeast(0, 1, 'name');

      expect(result.succeeded).toBe(false);
    });

    it('should return failure with exact error message when numChars is below minimum', () => {
      const result = Guard.againstAtLeast(0, 1, 'name');

      expect(result.message).toBe(
        'name must be at least 1 characters.'
      );
    });

    it('should return failure when numChars is zero and minimum is a larger number', () => {
      const result = Guard.againstAtLeast(0, 5, 'description');

      expect(result.succeeded).toBe(false);
      expect(result.message).toBe(
        'description must be at least 5 characters.'
      );
    });

    it('should return success when numChars equals a higher minimum boundary', () => {
      const result = Guard.againstAtLeast(10, 10, 'label');

      expect(result.succeeded).toBe(true);
    });

    it('should return failure when numChars is one below a higher minimum', () => {
      const result = Guard.againstAtLeast(9, 10, 'label');

      expect(result.succeeded).toBe(false);
    });
  });

  // =========================================================================
  describe('againstAtMost()', () => {
    it('should return success when numChars equals the maximum boundary', () => {
      const result = Guard.againstAtMost(255, 255, 'field');

      expect(result.succeeded).toBe(true);
    });

    it('should return success when numChars is well below the maximum', () => {
      const result = Guard.againstAtMost(10, 255, 'field');

      expect(result.succeeded).toBe(true);
    });

    it('should return success when numChars is 0', () => {
      const result = Guard.againstAtMost(0, 255, 'field');

      expect(result.succeeded).toBe(true);
    });

    it('should return failure when numChars is one above the maximum', () => {
      const result = Guard.againstAtMost(256, 255, 'field');

      expect(result.succeeded).toBe(false);
    });

    it('should return failure with the exact error message when numChars exceeds max', () => {
      const result = Guard.againstAtMost(256, 255, 'field');

      expect(result.message).toBe(
        'field must be at most 255 characters.'
      );
    });

    it('should return failure when numChars is well above the maximum', () => {
      const result = Guard.againstAtMost(10000, 255, 'field');

      expect(result.succeeded).toBe(false);
    });

    it('should return failure with a custom maximum reflected in the message', () => {
      const result = Guard.againstAtMost(11, 10, 'tag');

      expect(result.message).toBe(
        'tag must be at most 10 characters.'
      );
    });
  });

  // =========================================================================
  describe('isString()', () => {
    it('should return success when value is a non-empty string', () => {
      const result = Guard.isString('hello world', 'label');

      expect(result.succeeded).toBe(true);
    });

    it('should return success when value is an empty string', () => {
      const result = Guard.isString('', 'label');

      expect(result.succeeded).toBe(true);
    });

    it('should return failure when value is a number', () => {
      const result = Guard.isString(123 as UnknownValue, 'label');

      expect(result.succeeded).toBe(false);
      expect(result.message).toBe('label must be a string.');
    });

    it('should return failure when value is a boolean', () => {
      const result = Guard.isString(true as UnknownValue, 'label');

      expect(result.succeeded).toBe(false);
    });

    it('should return failure when value is null', () => {
      const result = Guard.isString(null as UnknownValue, 'label');

      expect(result.succeeded).toBe(false);
    });

    it('should return failure when value is undefined', () => {
      const result = Guard.isString(
        undefined as UnknownValue,
        'label'
      );

      expect(result.succeeded).toBe(false);
    });

    it('should return failure when value is a plain object', () => {
      const result = Guard.isString({} as UnknownValue, 'label');

      expect(result.succeeded).toBe(false);
    });

    it('should return failure when value is an array', () => {
      const result = Guard.isString([] as UnknownValue, 'label');

      expect(result.succeeded).toBe(false);
    });

    it('should include the argument name in the error message', () => {
      const result = Guard.isString(99 as UnknownValue, 'deviceName');

      expect(result.message).toBe('deviceName must be a string.');
    });
  });

  // =========================================================================
  describe('isNumber()', () => {
    it('should return success when value is a positive integer', () => {
      const result = Guard.isNumber(42, 'count');

      expect(result.succeeded).toBe(true);
    });

    it('should return success when value is 0', () => {
      const result = Guard.isNumber(0, 'count');

      expect(result.succeeded).toBe(true);
    });

    it('should return success when value is a negative number', () => {
      const result = Guard.isNumber(-10, 'count');

      expect(result.succeeded).toBe(true);
    });

    it('should return success when value is a float', () => {
      const result = Guard.isNumber(3.14, 'pi');

      expect(result.succeeded).toBe(true);
    });

    it('should return failure when value is NaN', () => {
      const result = Guard.isNumber(NaN, 'count');

      expect(result.succeeded).toBe(false);
      expect(result.message).toBe('count must be a valid number.');
    });

    it('should return failure when value is a numeric string', () => {
      const result = Guard.isNumber('42' as UnknownValue, 'count');

      expect(result.succeeded).toBe(false);
    });

    it('should return failure when value is a boolean', () => {
      const result = Guard.isNumber(true as UnknownValue, 'count');

      expect(result.succeeded).toBe(false);
    });

    it('should return failure when value is null', () => {
      const result = Guard.isNumber(null as UnknownValue, 'count');

      expect(result.succeeded).toBe(false);
    });

    it('should return failure when value is undefined', () => {
      const result = Guard.isNumber(
        undefined as UnknownValue,
        'count'
      );

      expect(result.succeeded).toBe(false);
    });

    it('should include the argument name in the error message', () => {
      const result = Guard.isNumber('abc' as UnknownValue, 'port');

      expect(result.message).toBe('port must be a valid number.');
    });
  });

  // =========================================================================
  describe('isBoolean()', () => {
    it('should return success when value is literal true', () => {
      const result = Guard.isBoolean(true, 'active');

      expect(result.succeeded).toBe(true);
    });

    it('should return success when value is literal false', () => {
      const result = Guard.isBoolean(false, 'active');

      expect(result.succeeded).toBe(true);
    });

    it('should return failure when value is the string "true"', () => {
      const result = Guard.isBoolean(
        'true' as UnknownValue,
        'active'
      );

      expect(result.succeeded).toBe(false);
      expect(result.message).toBe('active must be a boolean.');
    });

    it('should return failure when value is the string "false"', () => {
      const result = Guard.isBoolean(
        'false' as UnknownValue,
        'active'
      );

      expect(result.succeeded).toBe(false);
    });

    it('should return failure when value is the number 1', () => {
      const result = Guard.isBoolean(1 as UnknownValue, 'active');

      expect(result.succeeded).toBe(false);
    });

    it('should return failure when value is the number 0', () => {
      const result = Guard.isBoolean(0 as UnknownValue, 'active');

      expect(result.succeeded).toBe(false);
    });

    it('should return failure when value is null', () => {
      const result = Guard.isBoolean(null as UnknownValue, 'active');

      expect(result.succeeded).toBe(false);
    });

    it('should return failure when value is undefined', () => {
      const result = Guard.isBoolean(
        undefined as UnknownValue,
        'active'
      );

      expect(result.succeeded).toBe(false);
    });

    it('should include the argument name in the error message', () => {
      const result = Guard.isBoolean(
        'yes' as UnknownValue,
        'enabled'
      );

      expect(result.message).toBe('enabled must be a boolean.');
    });
  });

  // =========================================================================
  describe('isDate()', () => {
    it('should return success when value is a valid Date instance', () => {
      const result = Guard.isDate(new Date(), 'createdAt');

      expect(result.succeeded).toBe(true);
    });

    it('should return success when value is a specific valid Date', () => {
      const result = Guard.isDate(
        new Date('2024-01-01T00:00:00.000Z'),
        'createdAt'
      );

      expect(result.succeeded).toBe(true);
    });

    it('should return failure when value is an invalid Date (new Date("invalid"))', () => {
      const result = Guard.isDate(new Date('invalid'), 'createdAt');

      expect(result.succeeded).toBe(false);
      expect(result.message).toBe('createdAt must be a valid Date.');
    });

    it('should return failure when value is a date-like string', () => {
      const result = Guard.isDate(
        '2024-01-01' as UnknownValue,
        'createdAt'
      );

      expect(result.succeeded).toBe(false);
    });

    it('should return failure when value is a timestamp number', () => {
      const result = Guard.isDate(
        Date.now() as UnknownValue,
        'createdAt'
      );

      expect(result.succeeded).toBe(false);
    });

    it('should return failure when value is null', () => {
      const result = Guard.isDate(null as UnknownValue, 'createdAt');

      expect(result.succeeded).toBe(false);
    });

    it('should return failure when value is undefined', () => {
      const result = Guard.isDate(
        undefined as UnknownValue,
        'createdAt'
      );

      expect(result.succeeded).toBe(false);
    });

    it('should return failure when value is a plain object', () => {
      const result = Guard.isDate(
        { time: '2024-01-01' } as UnknownValue,
        'createdAt'
      );

      expect(result.succeeded).toBe(false);
    });

    it('should include the argument name in the error message on failure', () => {
      const result = Guard.isDate(
        'not-a-date' as UnknownValue,
        'updatedAt'
      );

      expect(result.message).toBe('updatedAt must be a valid Date.');
    });
  });

  // =========================================================================
  describe('greaterThan()', () => {
    it('should return failure when actualValue equals minValue (boundary — strictly greater is required)', () => {
      const result = Guard.greaterThan(10, 10, 'score');

      expect(result.succeeded).toBe(false);
    });

    it('should return failure with the exact error message when actualValue equals minValue', () => {
      const result = Guard.greaterThan(10, 10, 'score');

      expect(result.message).toBe('score must be greater than 10.');
    });

    it('should return failure when actualValue is one less than minValue', () => {
      const result = Guard.greaterThan(10, 9, 'score');

      expect(result.succeeded).toBe(false);
      expect(result.message).toBe('score must be greater than 10.');
    });

    it('should return failure when actualValue is well below minValue', () => {
      const result = Guard.greaterThan(100, -50, 'score');

      expect(result.succeeded).toBe(false);
    });

    it('should return success when actualValue is one more than minValue', () => {
      const result = Guard.greaterThan(10, 11, 'score');

      expect(result.succeeded).toBe(true);
    });

    it('should return success when actualValue is well above minValue', () => {
      const result = Guard.greaterThan(0, 999, 'largeCount');

      expect(result.succeeded).toBe(true);
    });

    it('should return success when both values are negative and actualValue is greater', () => {
      const result = Guard.greaterThan(-10, -5, 'temperature');

      expect(result.succeeded).toBe(true);
    });

    it('should return failure when both values are negative and actualValue is less', () => {
      const result = Guard.greaterThan(-5, -10, 'temperature');

      expect(result.succeeded).toBe(false);
    });

    it('should include the argument name and minValue in the error message', () => {
      const result = Guard.greaterThan(0, 0, 'pingCount');

      expect(result.message).toBe(
        'pingCount must be greater than 0.'
      );
    });
  });
});

// TODO: Test - isString() with a String object (new String('hello')) which has typeof 'object' — currently fails the guard
// TODO: Test - isNumber() with Infinity and -Infinity — these pass typeof === 'number' and are not NaN, so the guard succeeds
// TODO: Test - allInRange() behaviour is documented as returning the last failing result internally but the public message always uses the generic form; verify no per-element message leaks out
// TODO: Test - combine() with a large array (performance/edge case: 1000 elements, last one fails)
// TODO: Test - againstNullOrUndefinedBulk() with an empty array (no iteration — should return success)
