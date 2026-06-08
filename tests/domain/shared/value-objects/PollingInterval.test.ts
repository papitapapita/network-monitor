// Source: src/domain/device-monitoring/value-objects/PollingInterval.ts

import { PollingInterval } from '../../../../src/domain/device-monitoring/value-objects/PollingInterval';

describe('PollingInterval (device-monitoring)', () => {
  // ===========================================================================
  describe('constants', () => {
    it('should have MIN_SECONDS of 1', () => {
      expect(PollingInterval.MIN_SECONDS).toBe(1);
    });

    it('should have MAX_SECONDS of 86400', () => {
      expect(PollingInterval.MAX_SECONDS).toBe(86400);
    });
  });

  // ===========================================================================
  describe('create()', () => {
    describe('happy path', () => {
      it('should return a successful Result for a valid seconds value', () => {
        const result = PollingInterval.create(60);

        expect(result.isSuccess).toBe(true);
      });

      it('should expose the seconds value via the getter', () => {
        const result = PollingInterval.create(60);

        expect(result.value.seconds).toBe(60);
      });

      it('should accept the minimum boundary value of 1', () => {
        const result = PollingInterval.create(1);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(1);
      });

      it('should accept the maximum boundary value of 86400', () => {
        const result = PollingInterval.create(86400);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(86400);
      });

      it('should accept a typical interval of 300 seconds', () => {
        const result = PollingInterval.create(300);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(300);
      });

      it('should round a decimal value of 60.7 up to 61', () => {
        const result = PollingInterval.create(60.7);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(61);
      });

      it('should round a decimal value of 60.4 down to 60', () => {
        const result = PollingInterval.create(60.4);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(60);
      });
    });

    describe('validation failures', () => {
      it('should fail when seconds is null', () => {
        const result = PollingInterval.create(null as unknown as number);

        expect(result.isFailure).toBe(true);
      });

      it('should fail when seconds is undefined', () => {
        const result = PollingInterval.create(undefined as unknown as number);

        expect(result.isFailure).toBe(true);
      });

      it('should fail when seconds is NaN', () => {
        const result = PollingInterval.create(NaN);

        expect(result.isFailure).toBe(true);
      });

      it('should fail when seconds is 0 — below minimum', () => {
        const result = PollingInterval.create(0);

        expect(result.isFailure).toBe(true);
      });

      it('should fail when seconds is negative', () => {
        const result = PollingInterval.create(-10);

        expect(result.isFailure).toBe(true);
      });

      it('should fail when seconds exceeds 86400', () => {
        const result = PollingInterval.create(86401);

        expect(result.isFailure).toBe(true);
      });

      it('should include "polling interval" in the error for an out-of-range value', () => {
        const result = PollingInterval.create(0);

        expect(result.error).toContain('polling interval');
      });

      it('should include a description in the error message for null input', () => {
        const result = PollingInterval.create(null as unknown as number);

        expect(result.error).toContain('polling interval seconds');
      });
    });
  });

  // ===========================================================================
  describe('fromMinutes()', () => {
    it('should convert 1 minute to 60 seconds', () => {
      const result = PollingInterval.fromMinutes(1);

      expect(result.isSuccess).toBe(true);
      expect(result.value.seconds).toBe(60);
    });

    it('should convert 5 minutes to 300 seconds', () => {
      const result = PollingInterval.fromMinutes(5);

      expect(result.isSuccess).toBe(true);
      expect(result.value.seconds).toBe(300);
    });

    it('should convert 1.5 minutes to 90 seconds', () => {
      const result = PollingInterval.fromMinutes(1.5);

      expect(result.isSuccess).toBe(true);
      expect(result.value.seconds).toBe(90);
    });

    it('should fail when 0 minutes produces 0 seconds — below minimum', () => {
      const result = PollingInterval.fromMinutes(0);

      expect(result.isFailure).toBe(true);
    });

    it('should fail when minutes is null', () => {
      const result = PollingInterval.fromMinutes(null as unknown as number);

      expect(result.isFailure).toBe(true);
    });

    it('should fail when minutes is NaN', () => {
      const result = PollingInterval.fromMinutes(NaN);

      expect(result.isFailure).toBe(true);
    });

    it('should fail when 1441 minutes produce 86460 seconds — above maximum', () => {
      const result = PollingInterval.fromMinutes(1441);

      expect(result.isFailure).toBe(true);
    });

    it('should include a description in the error for null minutes', () => {
      const result = PollingInterval.fromMinutes(null as unknown as number);

      expect(result.error).toContain('polling interval minutes');
    });
  });

  // ===========================================================================
  describe('fromHours()', () => {
    it('should convert 1 hour to 3600 seconds', () => {
      const result = PollingInterval.fromHours(1);

      expect(result.isSuccess).toBe(true);
      expect(result.value.seconds).toBe(3600);
    });

    it('should convert 24 hours to 86400 seconds — the maximum', () => {
      const result = PollingInterval.fromHours(24);

      expect(result.isSuccess).toBe(true);
      expect(result.value.seconds).toBe(86400);
    });

    it('should fail when hours is null', () => {
      const result = PollingInterval.fromHours(null as unknown as number);

      expect(result.isFailure).toBe(true);
    });

    it('should fail when hours is NaN', () => {
      const result = PollingInterval.fromHours(NaN);

      expect(result.isFailure).toBe(true);
    });

    it('should fail when 25 hours produce 90000 seconds — above maximum', () => {
      const result = PollingInterval.fromHours(25);

      expect(result.isFailure).toBe(true);
    });

    it('should include a description in the error for null hours', () => {
      const result = PollingInterval.fromHours(null as unknown as number);

      expect(result.error).toContain('polling interval hours');
    });
  });

  // ===========================================================================
  describe('reconstitute()', () => {
    it('should rebuild a PollingInterval from trusted persistence props', () => {
      const interval = PollingInterval.reconstitute({ seconds: 300 });

      expect(interval.seconds).toBe(300);
    });

    it('should return a PollingInterval instance', () => {
      const interval = PollingInterval.reconstitute({ seconds: 60 });

      expect(interval).toBeInstanceOf(PollingInterval);
    });
  });

  // ===========================================================================
  describe('toMilliseconds()', () => {
    it('should convert 1 second to 1000 ms', () => {
      expect(PollingInterval.create(1).value.toMilliseconds()).toBe(1000);
    });

    it('should convert 60 seconds to 60000 ms', () => {
      expect(PollingInterval.create(60).value.toMilliseconds()).toBe(60000);
    });

    it('should convert 3600 seconds to 3600000 ms', () => {
      expect(PollingInterval.create(3600).value.toMilliseconds()).toBe(3600000);
    });
  });

  // ===========================================================================
  describe('toMinutes()', () => {
    it('should convert 60 seconds to 1 minute', () => {
      expect(PollingInterval.create(60).value.toMinutes()).toBe(1);
    });

    it('should convert 300 seconds to 5 minutes', () => {
      expect(PollingInterval.create(300).value.toMinutes()).toBe(5);
    });

    it('should round to 2 decimal places for non-even values', () => {
      // 100 / 60 = 1.6666... → 1.67
      expect(PollingInterval.create(100).value.toMinutes()).toBe(1.67);
    });
  });

  // ===========================================================================
  describe('toHours()', () => {
    it('should convert 3600 seconds to 1 hour', () => {
      expect(PollingInterval.create(3600).value.toHours()).toBe(1);
    });

    it('should convert 7200 seconds to 2 hours', () => {
      expect(PollingInterval.create(7200).value.toHours()).toBe(2);
    });

    it('should convert 86400 seconds to 24 hours', () => {
      expect(PollingInterval.create(86400).value.toHours()).toBe(24);
    });
  });

  // ===========================================================================
  describe('toDisplayString()', () => {
    it('should display "1 second" for 1 second', () => {
      expect(PollingInterval.create(1).value.toDisplayString()).toBe('1 second');
    });

    it('should display plural "seconds" for values between 2 and 59', () => {
      expect(PollingInterval.create(30).value.toDisplayString()).toBe('30 seconds');
    });

    it('should display "59 seconds" at the seconds-to-minutes boundary', () => {
      expect(PollingInterval.create(59).value.toDisplayString()).toBe('59 seconds');
    });

    it('should display "1 minute" for 60 seconds', () => {
      expect(PollingInterval.create(60).value.toDisplayString()).toBe('1 minute');
    });

    it('should display plural "minutes" for values between 2 and 59 minutes', () => {
      expect(PollingInterval.create(300).value.toDisplayString()).toBe('5 minutes');
    });

    it('should display "1 hour" for 3600 seconds', () => {
      expect(PollingInterval.create(3600).value.toDisplayString()).toBe('1 hour');
    });

    it('should display plural "hours" for 7200 seconds', () => {
      expect(PollingInterval.create(7200).value.toDisplayString()).toBe('2 hours');
    });

    it('should display "24 hours" for 86400 seconds', () => {
      expect(PollingInterval.create(86400).value.toDisplayString()).toBe('24 hours');
    });
  });

  // ===========================================================================
  describe('toString()', () => {
    it('should return the seconds as a string', () => {
      expect(PollingInterval.create(120).value.toString()).toBe('120');
    });

    it('should return "1" for the minimum value', () => {
      expect(PollingInterval.create(1).value.toString()).toBe('1');
    });
  });

  // ===========================================================================
  describe('equals()', () => {
    it('should return true for two intervals with the same seconds', () => {
      const a = PollingInterval.create(60).value;
      const b = PollingInterval.create(60).value;

      expect(a.equals(b)).toBe(true);
    });

    it('should return false for intervals with different seconds', () => {
      const a = PollingInterval.create(60).value;
      const b = PollingInterval.create(120).value;

      expect(a.equals(b)).toBe(false);
    });

    it('should return false when comparing against undefined', () => {
      const a = PollingInterval.create(60).value;

      expect(a.equals(undefined)).toBe(false);
    });
  });
});
