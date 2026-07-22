import { PollingInterval } from '../../../../src/domain/device-monitoring/value-objects/PollingInterval';

describe('PollingInterval (device-monitoring)', () => {
  describe('bounds', () => {
    it('should expose a minimum of 5 seconds', () => {
      expect(PollingInterval.MIN_SECONDS).toBe(5);
    });

    it('should expose a maximum of 86400 seconds', () => {
      expect(PollingInterval.MAX_SECONDS).toBe(86400);
    });

    it('should expose a default of 60 seconds', () => {
      expect(PollingInterval.DEFAULT_SECONDS).toBe(60);
    });
  });

  describe('create(seconds)', () => {
    describe('valid input', () => {
      it('should succeed for a value inside the range', () => {
        const result = PollingInterval.create(60);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(60);
      });

      it('should accept the minimum boundary', () => {
        const result = PollingInterval.create(5);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(5);
      });

      it('should accept the maximum boundary', () => {
        const result = PollingInterval.create(86400);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(86400);
      });

      it('should round a fractional value up', () => {
        const result = PollingInterval.create(60.7);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(61);
      });

      it('should round a fractional value down', () => {
        const result = PollingInterval.create(60.4);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(60);
      });
    });

    describe('invalid input', () => {
      it('should fail for null', () => {
        const result = PollingInterval.create(
          null as unknown as number
        );

        expect(result.isFailure).toBe(true);
      });

      it('should fail for undefined', () => {
        const result = PollingInterval.create(
          undefined as unknown as number
        );

        expect(result.isFailure).toBe(true);
      });

      it('should fail for NaN', () => {
        const result = PollingInterval.create(NaN);

        expect(result.isFailure).toBe(true);
      });

      it('should fail for zero', () => {
        const result = PollingInterval.create(0);

        expect(result.isFailure).toBe(true);
      });

      it('should fail for a negative value', () => {
        const result = PollingInterval.create(-10);

        expect(result.isFailure).toBe(true);
      });

      it('should fail just below the minimum', () => {
        const result = PollingInterval.create(4);

        expect(result.isFailure).toBe(true);
      });

      it('should fail just above the maximum', () => {
        const result = PollingInterval.create(86401);

        expect(result.isFailure).toBe(true);
      });
    });
  });

  describe('createDefault()', () => {
    it('should build an interval at the default of 60 seconds', () => {
      expect(PollingInterval.createDefault().seconds).toBe(60);
    });
  });

  describe('reconstitute(props)', () => {
    it('should rebuild a PollingInterval from trusted persistence props', () => {
      const interval = PollingInterval.reconstitute({ seconds: 300 });

      expect(interval.seconds).toBe(300);
    });

    it('should bypass validation for out-of-range values', () => {
      const interval = PollingInterval.reconstitute({ seconds: 1 });

      expect(interval.seconds).toBe(1);
    });
  });

  describe('equality', () => {
    it('should treat two intervals of the same length as equal', () => {
      const a = PollingInterval.create(60).value;
      const b = PollingInterval.create(60).value;

      expect(a.equals(b)).toBe(true);
    });

    it('should treat two intervals of different lengths as unequal', () => {
      const a = PollingInterval.create(60).value;
      const b = PollingInterval.create(120).value;

      expect(a.equals(b)).toBe(false);
    });
  });
});
