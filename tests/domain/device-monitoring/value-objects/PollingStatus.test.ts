import { PollingStatus } from '../../../../src/domain/device-inventory';

describe('PollingStatus', () => {
  describe('create', () => {
    describe('when valid status', () => {
      it('should create PollingStatus with SUCCESS', () => {
        const result = PollingStatus.create('SUCCESS');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('SUCCESS');
        expect(result.value.toString()).toBe('SUCCESS');
      });

      it('should create PollingStatus with FAILED', () => {
        const result = PollingStatus.create('FAILED');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('FAILED');
      });

      it('should create PollingStatus with TIMEOUT', () => {
        const result = PollingStatus.create('TIMEOUT');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('TIMEOUT');
      });

      it('should create PollingStatus with PARTIAL_SUCCESS', () => {
        const result = PollingStatus.create('PARTIAL_SUCCESS');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('PARTIAL_SUCCESS');
      });

      it('should normalize to uppercase', () => {
        const result = PollingStatus.create('success');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('SUCCESS');
      });

      it('should trim whitespace', () => {
        const result = PollingStatus.create('  FAILED  ');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('FAILED');
      });

      it('should handle mixed case', () => {
        const result = PollingStatus.create('PaRtIaL_SuCcEsS');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('PARTIAL_SUCCESS');
      });
    });

    describe('when invalid status', () => {
      it('should fail for null', () => {
        const result = PollingStatus.create(null as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling status');
      });

      it('should fail for undefined', () => {
        const result = PollingStatus.create(undefined as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('polling status');
      });

      it('should fail for empty string', () => {
        const result = PollingStatus.create('');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('cannot be empty');
      });

      it('should fail for whitespace only', () => {
        const result = PollingStatus.create('   ');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('cannot be empty');
      });

      it('should fail for invalid status value', () => {
        const result = PollingStatus.create('INVALID_STATUS');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid polling status');
      });

      it('should fail for random string', () => {
        const result = PollingStatus.create('random');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid polling status');
      });
    });
  });

  describe('convenience factory methods', () => {
    it('should create SUCCESS status with createSuccess', () => {
      const result = PollingStatus.createSuccess();

      expect(result.toString()).toBe('SUCCESS');
      expect(result.isSuccess()).toBe(true);
    });

    it('should create FAILED status with createFailed', () => {
      const result = PollingStatus.createFailed();

      expect(result.toString()).toBe('FAILED');
      expect(result.isFailed()).toBe(true);
    });

    it('should create TIMEOUT status with createTimeout', () => {
      const result = PollingStatus.createTimeout();

      expect(result.toString()).toBe('TIMEOUT');
      expect(result.isTimeout()).toBe(true);
    });

    it('should create PARTIAL_SUCCESS status with createPartialSuccess', () => {
      const result = PollingStatus.createPartialSuccess();

      expect(result.toString()).toBe('PARTIAL_SUCCESS');
      expect(result.isPartialSuccess()).toBe(true);
    });
  });

  describe('calculateFromPingResults', () => {
    describe('when all pings fail', () => {
      it('should return FAILED status', () => {
        const result = PollingStatus.calculateFromPingResults(0, 5);

        expect(result.isSuccess).toBe(true);
        expect(result.value.isFailed()).toBe(true);
        expect(result.value.value).toBe('FAILED');
      });
    });

    describe('when all pings succeed', () => {
      it('should return SUCCESS status', () => {
        const result = PollingStatus.calculateFromPingResults(5, 5);

        expect(result.isSuccess).toBe(true);
        expect(result.value.isSuccess()).toBe(true);
        expect(result.value.value).toBe('SUCCESS');
      });
    });

    describe('when some pings succeed', () => {
      it('should return PARTIAL_SUCCESS for 3/5 pings', () => {
        const result = PollingStatus.calculateFromPingResults(3, 5);

        expect(result.isSuccess).toBe(true);
        expect(result.value.isPartialSuccess()).toBe(true);
        expect(result.value.value).toBe('PARTIAL_SUCCESS');
      });

      it('should return PARTIAL_SUCCESS for 1/3 pings', () => {
        const result = PollingStatus.calculateFromPingResults(1, 3);

        expect(result.isSuccess).toBe(true);
        expect(result.value.isPartialSuccess()).toBe(true);
      });

      it('should return PARTIAL_SUCCESS for 4/10 pings', () => {
        const result = PollingStatus.calculateFromPingResults(4, 10);

        expect(result.isSuccess).toBe(true);
        expect(result.value.isPartialSuccess()).toBe(true);
      });
    });

    describe('when edge cases', () => {
      it('should handle single ping success', () => {
        const result = PollingStatus.calculateFromPingResults(1, 1);

        expect(result.isSuccess).toBe(true);
        expect(result.value.isSuccess()).toBe(true);
      });

      it('should handle single ping failure', () => {
        const result = PollingStatus.calculateFromPingResults(0, 1);

        expect(result.isSuccess).toBe(true);
        expect(result.value.isFailed()).toBe(true);
      });
    });

    describe('when invalid inputs', () => {
      it('should fail for null successfulPings', () => {
        const result = PollingStatus.calculateFromPingResults(
          null as any,
          5
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('successful pings');
      });

      it('should fail for null totalPings', () => {
        const result = PollingStatus.calculateFromPingResults(
          3,
          null as any
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('total pings');
      });

      it('should fail for undefined successfulPings', () => {
        const result = PollingStatus.calculateFromPingResults(
          undefined as any,
          5
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('successful pings');
      });

      it('should fail for undefined totalPings', () => {
        const result = PollingStatus.calculateFromPingResults(
          3,
          undefined as any
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('total pings');
      });

      it('should fail for negative successfulPings', () => {
        const result = PollingStatus.calculateFromPingResults(-1, 5);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain(
          'Successful pings cannot be negative'
        );
      });

      it('should fail for zero totalPings', () => {
        const result = PollingStatus.calculateFromPingResults(0, 0);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain(
          'Total pings must be greater than zero'
        );
      });

      it('should fail for negative totalPings', () => {
        const result = PollingStatus.calculateFromPingResults(3, -5);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain(
          'Total pings must be greater than zero'
        );
      });

      it('should fail when successfulPings exceeds totalPings', () => {
        const result = PollingStatus.calculateFromPingResults(10, 5);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain(
          'Successful pings cannot exceed total pings'
        );
      });

      it('should fail for non-number successfulPings', () => {
        const result = PollingStatus.calculateFromPingResults(
          'three' as any,
          5
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('successful pings');
      });

      it('should fail for non-number totalPings', () => {
        const result = PollingStatus.calculateFromPingResults(
          3,
          'five' as any
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('total pings');
      });
    });
  });

  describe('status checking methods', () => {
    it('should correctly identify SUCCESS status', () => {
      const status = PollingStatus.createSuccess();

      expect(status.isSuccess()).toBe(true);
      expect(status.isFailed()).toBe(false);
      expect(status.isTimeout()).toBe(false);
      expect(status.isPartialSuccess()).toBe(false);
    });

    it('should correctly identify FAILED status', () => {
      const status = PollingStatus.createFailed();

      expect(status.isSuccess()).toBe(false);
      expect(status.isFailed()).toBe(true);
      expect(status.isTimeout()).toBe(false);
      expect(status.isPartialSuccess()).toBe(false);
    });

    it('should correctly identify TIMEOUT status', () => {
      const status = PollingStatus.createTimeout();

      expect(status.isSuccess()).toBe(false);
      expect(status.isFailed()).toBe(false);
      expect(status.isTimeout()).toBe(true);
      expect(status.isPartialSuccess()).toBe(false);
    });

    it('should correctly identify PARTIAL_SUCCESS status', () => {
      const status = PollingStatus.createPartialSuccess();

      expect(status.isSuccess()).toBe(false);
      expect(status.isFailed()).toBe(false);
      expect(status.isTimeout()).toBe(false);
      expect(status.isPartialSuccess()).toBe(true);
    });
  });

  describe('isDeviceReachable', () => {
    it('should return true for SUCCESS status', () => {
      const status = PollingStatus.createSuccess();

      expect(status.isDeviceReachable()).toBe(true);
    });

    it('should return true for PARTIAL_SUCCESS status', () => {
      const status = PollingStatus.createPartialSuccess();

      expect(status.isDeviceReachable()).toBe(true);
    });

    it('should return false for FAILED status', () => {
      const status = PollingStatus.createFailed();

      expect(status.isDeviceReachable()).toBe(false);
    });

    it('should return false for TIMEOUT status', () => {
      const status = PollingStatus.createTimeout();

      expect(status.isDeviceReachable()).toBe(false);
    });
  });

  describe('getDisplayName', () => {
    it('should return correct display name for SUCCESS', () => {
      const status = PollingStatus.createSuccess();

      expect(status.getDisplayName()).toBe('Success');
    });

    it('should return correct display name for FAILED', () => {
      const status = PollingStatus.createFailed();

      expect(status.getDisplayName()).toBe('Failed');
    });

    it('should return correct display name for TIMEOUT', () => {
      const status = PollingStatus.createTimeout();

      expect(status.getDisplayName()).toBe('Timeout');
    });

    it('should return correct display name for PARTIAL_SUCCESS', () => {
      const status = PollingStatus.createPartialSuccess();

      expect(status.getDisplayName()).toBe('Partial Success');
    });
  });

  describe('getColor', () => {
    it('should return green for SUCCESS', () => {
      const status = PollingStatus.createSuccess();

      expect(status.getColor()).toBe('green');
    });

    it('should return red for FAILED', () => {
      const status = PollingStatus.createFailed();

      expect(status.getColor()).toBe('red');
    });

    it('should return orange for TIMEOUT', () => {
      const status = PollingStatus.createTimeout();

      expect(status.getColor()).toBe('orange');
    });

    it('should return yellow for PARTIAL_SUCCESS', () => {
      const status = PollingStatus.createPartialSuccess();

      expect(status.getColor()).toBe('yellow');
    });
  });

  describe('equals', () => {
    it('should return true for same status values', () => {
      const status1 = PollingStatus.createSuccess();
      const status2 = PollingStatus.createSuccess();

      expect(status1.equals(status2)).toBe(true);
    });

    it('should return true for status created with different methods but same value', () => {
      const status1 = PollingStatus.createSuccess();
      const status2 = PollingStatus.create('SUCCESS');

      expect(status1.equals(status2.value)).toBe(true);
    });

    it('should return false for different status values', () => {
      const status1 = PollingStatus.createSuccess();
      const status2 = PollingStatus.createFailed();

      expect(status1.equals(status2)).toBe(false);
    });

    it('should return false for null', () => {
      const status = PollingStatus.createSuccess();

      expect(status.equals(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      const status = PollingStatus.createSuccess();

      expect(status.equals(undefined as any)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the string value', () => {
      const status = PollingStatus.createSuccess();

      expect(status.toString()).toBe('SUCCESS');
    });
  });

  describe('immutability', () => {
    it('should not allow mutation of props', () => {
      const status = PollingStatus.createSuccess();

      expect(() => {
        // @ts-expect-error - Testing immutability
        status.props = 'FAILED';
      }).toThrow();
    });

    it('should not allow reassignment of props reference', () => {
      const status = PollingStatus.createSuccess();

      // TypeScript prevents this at compile time
      expect(() => {
        // @ts-expect-error - props is readonly
        status.props = { value: 'FAILED' };
      }).toThrow();
    });
  });
});
