import { PollingInterval } from '../../../src/domain';

describe('PollingInterval', () => {
  describe('create', () => {
    describe('when valid seconds', () => {
      it('should create PollingInterval with valid seconds', () => {
        const result = PollingInterval.create(60);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(60);
      });

      it('should create PollingInterval with minimum seconds (1)', () => {
        const result = PollingInterval.create(1);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(1);
      });

      it('should create PollingInterval with maximum seconds (86400)', () => {
        const result = PollingInterval.create(86400);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(86400);
      });

      it('should round decimal seconds up', () => {
        const result = PollingInterval.create(60.7);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(61);
      });

      it('should round decimal seconds down', () => {
        const result = PollingInterval.create(60.3);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(60);
      });

      it('should round 0.5 to nearest even number', () => {
        const result = PollingInterval.create(60.5);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(61);
      });

      it('should create PollingInterval with typical polling values', () => {
        const intervals = [30, 60, 300, 600, 1800, 3600];

        intervals.forEach((seconds) => {
          const result = PollingInterval.create(seconds);
          expect(result.isSuccess).toBe(true);
          expect(result.value.seconds).toBe(seconds);
        });
      });
    });

    describe('when invalid seconds', () => {
      it('should fail for null', () => {
        const result = PollingInterval.create(null as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });

      it('should fail for undefined', () => {
        const result = PollingInterval.create(undefined as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });

      it('should fail for non-number value', () => {
        const result = PollingInterval.create('60' as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });

      it('should fail for zero seconds', () => {
        const result = PollingInterval.create(0);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });

      it('should fail for negative seconds', () => {
        const result = PollingInterval.create(-10);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });

      it('should fail for seconds below minimum', () => {
        const result = PollingInterval.create(0.5);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });

      it('should fail for seconds exceeding maximum (24 hours)', () => {
        const result = PollingInterval.create(86401);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });

      it('should fail for very large seconds value', () => {
        const result = PollingInterval.create(90000);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });

      it('should fail for NaN', () => {
        const result = PollingInterval.create(NaN);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });

      it('should fail for Infinity', () => {
        const result = PollingInterval.create(Infinity);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });
    });
  });

  describe('fromMinutes', () => {
    describe('when valid minutes', () => {
      it('should create PollingInterval from minutes', () => {
        const result = PollingInterval.fromMinutes(5);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(300);
      });

      it('should create PollingInterval from 1 minute', () => {
        const result = PollingInterval.fromMinutes(1);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(60);
      });

      it('should create PollingInterval from 10 minutes', () => {
        const result = PollingInterval.fromMinutes(10);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(600);
      });

      it('should create PollingInterval from 30 minutes', () => {
        const result = PollingInterval.fromMinutes(30);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(1800);
      });

      it('should create PollingInterval from maximum minutes (1440)', () => {
        const result = PollingInterval.fromMinutes(1440);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(86400);
      });

      it('should round fractional minutes to nearest second', () => {
        const result = PollingInterval.fromMinutes(1.5);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(90);
      });

      it('should create from decimal minutes', () => {
        const result = PollingInterval.fromMinutes(2.5);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(150);
      });
    });

    describe('when invalid minutes', () => {
      it('should fail for null', () => {
        const result = PollingInterval.fromMinutes(null as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });

      it('should fail for undefined', () => {
        const result = PollingInterval.fromMinutes(undefined as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });

      it('should fail for non-number value', () => {
        const result = PollingInterval.fromMinutes('5' as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });

      it('should fail for negative minutes', () => {
        const result = PollingInterval.fromMinutes(-5);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });

      it('should fail for zero minutes', () => {
        const result = PollingInterval.fromMinutes(0);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });

      it('should fail for minutes exceeding maximum', () => {
        const result = PollingInterval.fromMinutes(2000);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });

      it('should fail for NaN minutes', () => {
        const result = PollingInterval.fromMinutes(NaN);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });
    });
  });

  describe('fromHours', () => {
    describe('when valid hours', () => {
      it('should create PollingInterval from hours', () => {
        const result = PollingInterval.fromHours(1);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(3600);
      });

      it('should create PollingInterval from 2 hours', () => {
        const result = PollingInterval.fromHours(2);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(7200);
      });

      it('should create PollingInterval from maximum hours (24)', () => {
        const result = PollingInterval.fromHours(24);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(86400);
      });

      it('should round fractional hours to nearest second', () => {
        const result = PollingInterval.fromHours(0.5);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(1800);
      });

      it('should create from decimal hours', () => {
        const result = PollingInterval.fromHours(1.5);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(5400);
      });

      it('should create from small fractional hours', () => {
        const result = PollingInterval.fromHours(0.25);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(900);
      });
    });

    describe('when invalid hours', () => {
      it('should fail for null', () => {
        const result = PollingInterval.fromHours(null as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });

      it('should fail for undefined', () => {
        const result = PollingInterval.fromHours(undefined as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });

      it('should fail for non-number value', () => {
        const result = PollingInterval.fromHours('1' as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });

      it('should fail for negative hours', () => {
        const result = PollingInterval.fromHours(-1);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });

      it('should fail for zero hours', () => {
        const result = PollingInterval.fromHours(0);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });

      it('should fail for hours exceeding maximum (24)', () => {
        const result = PollingInterval.fromHours(48);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });

      it('should fail for NaN hours', () => {
        const result = PollingInterval.fromHours(NaN);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling interval');
      });
    });
  });

  describe('toMilliseconds', () => {
    it('should convert seconds to milliseconds', () => {
      const interval = PollingInterval.create(10).value;

      expect(interval.toMilliseconds()).toBe(10000);
    });

    it('should convert 1 second to 1000 milliseconds', () => {
      const interval = PollingInterval.create(1).value;

      expect(interval.toMilliseconds()).toBe(1000);
    });

    it('should convert 60 seconds to 60000 milliseconds', () => {
      const interval = PollingInterval.create(60).value;

      expect(interval.toMilliseconds()).toBe(60000);
    });

    it('should convert large seconds value to milliseconds', () => {
      const interval = PollingInterval.create(86400).value;

      expect(interval.toMilliseconds()).toBe(86400000);
    });
  });

  describe('toMinutes', () => {
    it('should convert 60 seconds to 1 minute', () => {
      const interval = PollingInterval.create(60).value;

      expect(interval.toMinutes()).toBe(1);
    });

    it('should convert 90 seconds to 1.5 minutes', () => {
      const interval = PollingInterval.create(90).value;

      expect(interval.toMinutes()).toBe(1.5);
    });

    it('should convert 300 seconds to 5 minutes', () => {
      const interval = PollingInterval.create(300).value;

      expect(interval.toMinutes()).toBe(5);
    });

    it('should convert 30 seconds to 0.5 minutes', () => {
      const interval = PollingInterval.create(30).value;

      expect(interval.toMinutes()).toBe(0.5);
    });

    it('should round to 2 decimal places', () => {
      const interval = PollingInterval.create(100).value;

      expect(interval.toMinutes()).toBe(1.67);
    });
  });

  describe('toHours', () => {
    it('should convert 3600 seconds to 1 hour', () => {
      const interval = PollingInterval.create(3600).value;

      expect(interval.toHours()).toBe(1);
    });

    it('should convert 7200 seconds to 2 hours', () => {
      const interval = PollingInterval.create(7200).value;

      expect(interval.toHours()).toBe(2);
    });

    it('should convert 1800 seconds to 0.5 hours', () => {
      const interval = PollingInterval.create(1800).value;

      expect(interval.toHours()).toBe(0.5);
    });

    it('should convert 86400 seconds to 24 hours', () => {
      const interval = PollingInterval.create(86400).value;

      expect(interval.toHours()).toBe(24);
    });

    it('should round to 2 decimal places', () => {
      const interval = PollingInterval.create(5000).value;

      expect(interval.toHours()).toBe(1.39);
    });
  });

  describe('toDisplayString', () => {
    describe('when displaying seconds', () => {
      it('should display singular second', () => {
        const interval = PollingInterval.create(1).value;

        expect(interval.toDisplayString()).toBe('1 second');
      });

      it('should display plural seconds', () => {
        const interval = PollingInterval.create(45).value;

        expect(interval.toDisplayString()).toBe('45 seconds');
      });

      it('should display 30 seconds correctly', () => {
        const interval = PollingInterval.create(30).value;

        expect(interval.toDisplayString()).toBe('30 seconds');
      });
    });

    describe('when displaying minutes', () => {
      it('should display singular minute', () => {
        const interval = PollingInterval.create(60).value;

        expect(interval.toDisplayString()).toBe('1 minute');
      });

      it('should display plural minutes', () => {
        const interval = PollingInterval.create(120).value;

        expect(interval.toDisplayString()).toBe('2 minutes');
      });

      it('should display 5 minutes', () => {
        const interval = PollingInterval.create(300).value;

        expect(interval.toDisplayString()).toBe('5 minutes');
      });

      it('should display 10 minutes', () => {
        const interval = PollingInterval.create(600).value;

        expect(interval.toDisplayString()).toBe('10 minutes');
      });

      it('should display 30 minutes', () => {
        const interval = PollingInterval.create(1800).value;

        expect(interval.toDisplayString()).toBe('30 minutes');
      });

      it('should round to nearest minute for display', () => {
        const interval = PollingInterval.create(150).value;

        expect(interval.toDisplayString()).toBe('3 minutes');
      });
    });

    describe('when displaying hours', () => {
      it('should display singular hour', () => {
        const interval = PollingInterval.create(3600).value;

        expect(interval.toDisplayString()).toBe('1 hour');
      });

      it('should display plural hours', () => {
        const interval = PollingInterval.create(7200).value;

        expect(interval.toDisplayString()).toBe('2 hours');
      });

      it('should display 6 hours', () => {
        const interval = PollingInterval.create(21600).value;

        expect(interval.toDisplayString()).toBe('6 hours');
      });

      it('should display 24 hours', () => {
        const interval = PollingInterval.create(86400).value;

        expect(interval.toDisplayString()).toBe('24 hours');
      });

      it('should round to nearest hour for display', () => {
        const interval = PollingInterval.create(5400).value;

        expect(interval.toDisplayString()).toBe('2 hours');
      });
    });
  });

  describe('equals', () => {
    it('should return true for same seconds values', () => {
      const interval1 = PollingInterval.create(60).value;
      const interval2 = PollingInterval.create(60).value;

      expect(interval1.equals(interval2)).toBe(true);
    });

    it('should return true for intervals created different ways but same seconds', () => {
      const interval1 = PollingInterval.create(300).value;
      const interval2 = PollingInterval.fromMinutes(5).value;

      expect(interval1.equals(interval2)).toBe(true);
    });

    it('should return true for intervals from hours and seconds', () => {
      const interval1 = PollingInterval.create(3600).value;
      const interval2 = PollingInterval.fromHours(1).value;

      expect(interval1.equals(interval2)).toBe(true);
    });

    it('should return false for different seconds values', () => {
      const interval1 = PollingInterval.create(60).value;
      const interval2 = PollingInterval.create(120).value;

      expect(interval1.equals(interval2)).toBe(false);
    });

    it('should return false for slightly different values', () => {
      const interval1 = PollingInterval.create(60).value;
      const interval2 = PollingInterval.create(61).value;

      expect(interval1.equals(interval2)).toBe(false);
    });

    it('should return false for null', () => {
      const interval = PollingInterval.create(60).value;

      expect(interval.equals(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      const interval = PollingInterval.create(60).value;

      expect(interval.equals(undefined as any)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return seconds as string', () => {
      const interval = PollingInterval.create(150).value;

      expect(interval.toString()).toBe('150');
    });

    it('should return 1 second as string', () => {
      const interval = PollingInterval.create(1).value;

      expect(interval.toString()).toBe('1');
    });

    it('should return large value as string', () => {
      const interval = PollingInterval.create(86400).value;

      expect(interval.toString()).toBe('86400');
    });
  });

  describe('getters', () => {
    it('should have correct seconds value', () => {
      const interval = PollingInterval.create(300).value;

      expect(interval.seconds).toBe(300);
    });

    it('should have correct seconds for interval from minutes', () => {
      const interval = PollingInterval.fromMinutes(5).value;

      expect(interval.seconds).toBe(300);
    });

    it('should have correct seconds for interval from hours', () => {
      const interval = PollingInterval.fromHours(1).value;

      expect(interval.seconds).toBe(3600);
    });
  });

  describe('immutability', () => {
    it('should not allow mutation of props', () => {
      const interval = PollingInterval.create(60).value;

      expect(() => {
        // @ts-expect-error - Testing immutability
        interval.props.seconds = 120;
      }).toThrow();
    });

    it('should not allow reassignment of props reference', () => {
      const interval = PollingInterval.create(60).value;

      // TypeScript prevents this at compile time
      // @ts-expect-error - props is readonly
      interval.props = { seconds: 120 };
    });
  });
});
