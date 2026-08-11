import { PollingInterval } from '../../../../src/domain/wireless-monitoring/value-objects/PollingInterval';

describe('[WLS-006] PollingInterval (wireless-monitoring)', () => {
  describe('create(seconds)', () => {
    describe('valid input', () => {
      it('should succeed for a value inside the range', () => {
        const result = PollingInterval.create(3600);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(3600);
      });

      it('should accept the minimum boundary of 60 seconds', () => {
        const result = PollingInterval.create(60);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(60);
      });

      it('should accept the maximum boundary', () => {
        const result = PollingInterval.create(86400);

        expect(result.isSuccess).toBe(true);
        expect(result.value.seconds).toBe(86400);
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

      it('should fail just below the minimum', () => {
        const result = PollingInterval.create(59);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('60');
      });

      it('should reject an interval valid for ICMP polling but too fast for AirOS', () => {
        const result = PollingInterval.create(5);

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

      it('should fail for a non-integer value', () => {
        const result = PollingInterval.create(60.5);

        expect(result.isFailure).toBe(true);
      });

      it('should fail just above the maximum', () => {
        const result = PollingInterval.create(86401);

        expect(result.isFailure).toBe(true);
      });
    });
  });

  describe('reconstitute(seconds)', () => {
    it('should rebuild a PollingInterval from a trusted persisted value', () => {
      const interval = PollingInterval.reconstitute(3600);

      expect(interval.seconds).toBe(3600);
    });

    it('should bypass validation for out-of-range values', () => {
      const interval = PollingInterval.reconstitute(30);

      expect(interval.seconds).toBe(30);
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
