// Source: src/domain/device-monitoring/value-objects/FailureThreshold.ts

import { FailureThreshold } from '../../../../src/domain/device-monitoring/value-objects/FailureThreshold';

describe('FailureThreshold', () => {
  // ===========================================================================
  describe('constants', () => {
    it('should have MIN of 1', () => {
      expect(FailureThreshold.MIN).toBe(1);
    });

    it('should have MAX of 100', () => {
      expect(FailureThreshold.MAX).toBe(100);
    });
  });

  // ===========================================================================
  describe('create()', () => {
    describe('happy path', () => {
      it('should return a successful Result for a valid count', () => {
        const result = FailureThreshold.create(3);

        expect(result.isSuccess).toBe(true);
      });

      it('should expose the count via the value getter', () => {
        const result = FailureThreshold.create(3);

        expect(result.value.value).toBe(3);
      });

      it('should accept the minimum boundary value of 1', () => {
        const result = FailureThreshold.create(1);

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe(1);
      });

      it('should accept the maximum boundary value of 100', () => {
        const result = FailureThreshold.create(100);

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe(100);
      });

      it('should accept a typical mid-range value of 5', () => {
        const result = FailureThreshold.create(5);

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe(5);
      });
    });

    describe('validation failures', () => {
      it('should fail when count is null', () => {
        const result = FailureThreshold.create(null as unknown as number);

        expect(result.isFailure).toBe(true);
      });

      it('should fail when count is undefined', () => {
        const result = FailureThreshold.create(undefined as unknown as number);

        expect(result.isFailure).toBe(true);
      });

      it('should fail when count is NaN', () => {
        const result = FailureThreshold.create(NaN);

        expect(result.isFailure).toBe(true);
      });

      it('should fail when count is below the minimum of 1', () => {
        const result = FailureThreshold.create(0);

        expect(result.isFailure).toBe(true);
      });

      it('should fail when count is negative', () => {
        const result = FailureThreshold.create(-1);

        expect(result.isFailure).toBe(true);
      });

      it('should fail when count exceeds the maximum of 100', () => {
        const result = FailureThreshold.create(101);

        expect(result.isFailure).toBe(true);
      });

      it('should fail when count is a non-integer float', () => {
        const result = FailureThreshold.create(2.5);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('integer');
      });

      it('should fail when count is 1.1', () => {
        const result = FailureThreshold.create(1.1);

        expect(result.isFailure).toBe(true);
      });

      it('should include "failuresBeforeDown" in the error message when null', () => {
        const result = FailureThreshold.create(null as unknown as number);

        expect(result.error).toContain('failuresBeforeDown');
      });

      it('should include a range error when out of bounds', () => {
        const result = FailureThreshold.create(0);

        expect(result.error).toContain('failuresBeforeDown');
      });
    });
  });

  // ===========================================================================
  describe('reconstitute()', () => {
    it('should build a FailureThreshold from trusted props without validation', () => {
      const threshold = FailureThreshold.reconstitute({ count: 7 });

      expect(threshold.value).toBe(7);
    });

    it('should reconstitute the minimum value of 1', () => {
      const threshold = FailureThreshold.reconstitute({ count: 1 });

      expect(threshold.value).toBe(1);
    });

    it('should reconstitute the maximum value of 100', () => {
      const threshold = FailureThreshold.reconstitute({ count: 100 });

      expect(threshold.value).toBe(100);
    });
  });

  // ===========================================================================
  describe('toString()', () => {
    it('should return the count as a string', () => {
      const threshold = FailureThreshold.create(5).value;

      expect(threshold.toString()).toBe('5');
    });

    it('should return "1" for the minimum value', () => {
      const threshold = FailureThreshold.create(1).value;

      expect(threshold.toString()).toBe('1');
    });

    it('should return "100" for the maximum value', () => {
      const threshold = FailureThreshold.create(100).value;

      expect(threshold.toString()).toBe('100');
    });
  });

  // ===========================================================================
  describe('equals()', () => {
    it('should return true for two thresholds with the same count', () => {
      const a = FailureThreshold.create(3).value;
      const b = FailureThreshold.create(3).value;

      expect(a.equals(b)).toBe(true);
    });

    it('should return false for two thresholds with different counts', () => {
      const a = FailureThreshold.create(3).value;
      const b = FailureThreshold.create(5).value;

      expect(a.equals(b)).toBe(false);
    });

    it('should return false when comparing against undefined', () => {
      const a = FailureThreshold.create(3).value;

      expect(a.equals(undefined)).toBe(false);
    });
  });
});
