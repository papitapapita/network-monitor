import { NetworkDeviceStatus } from '../../../src/domain';

describe('NetworkDeviceStatus', () => {
  describe('create', () => {
    describe('when valid status', () => {
      it('should create NetworkDeviceStatus with ONLINE', () => {
        const result = NetworkDeviceStatus.create('ONLINE');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('ONLINE');
        expect(result.value.toString()).toBe('ONLINE');
      });

      it('should create NetworkDeviceStatus with OFFLINE', () => {
        const result = NetworkDeviceStatus.create('OFFLINE');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('OFFLINE');
      });

      it('should create NetworkDeviceStatus with MAINTENANCE', () => {
        const result = NetworkDeviceStatus.create('MAINTENANCE');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('MAINTENANCE');
      });

      it('should create NetworkDeviceStatus with UNKNOWN', () => {
        const result = NetworkDeviceStatus.create('UNKNOWN');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('UNKNOWN');
      });

      it('should normalize to uppercase', () => {
        const result = NetworkDeviceStatus.create('online');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('ONLINE');
      });

      it('should trim whitespace', () => {
        const result = NetworkDeviceStatus.create('  OFFLINE  ');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('OFFLINE');
      });

      it('should handle mixed case', () => {
        const result = NetworkDeviceStatus.create('MaInTeNaNcE');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('MAINTENANCE');
      });
    });

    describe('when invalid status', () => {
      it('should fail for null', () => {
        const result = NetworkDeviceStatus.create(null as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('status');
      });

      it('should fail for undefined', () => {
        const result = NetworkDeviceStatus.create(undefined as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('status');
      });

      it('should fail for empty string', () => {
        const result = NetworkDeviceStatus.create('');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('cannot be empty');
      });

      it('should fail for whitespace only', () => {
        const result = NetworkDeviceStatus.create('   ');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('cannot be empty');
      });

      it('should fail for invalid status value', () => {
        const result = NetworkDeviceStatus.create('INVALID_STATUS');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid device status');
      });

      it('should fail for random string', () => {
        const result = NetworkDeviceStatus.create('random');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid device status');
      });
    });
  });

  describe('convenience factory methods', () => {
    it('should create ONLINE status with createOnline', () => {
      const result = NetworkDeviceStatus.createOnline();

      expect(result.toString()).toBe('ONLINE');
      expect(result.isOnline()).toBe(true);
    });

    it('should create OFFLINE status with createOffline', () => {
      const result = NetworkDeviceStatus.createOffline();

      expect(result.toString()).toBe('OFFLINE');
      expect(result.isOffline()).toBe(true);
    });

    it('should create MAINTENANCE status with createMaintenance', () => {
      const result = NetworkDeviceStatus.createMaintenance();

      expect(result.toString()).toBe('MAINTENANCE');
      expect(result.isMaintenance()).toBe(true);
    });

    it('should create UNKNOWN status with createUnknown', () => {
      const result = NetworkDeviceStatus.createUnknown();

      expect(result.toString()).toBe('UNKNOWN');
      expect(result.isUnknown()).toBe(true);
    });
  });

  describe('status checking methods', () => {
    it('should correctly identify ONLINE status', () => {
      const status = NetworkDeviceStatus.createOnline();

      expect(status.isOnline()).toBe(true);
      expect(status.isOffline()).toBe(false);
      expect(status.isMaintenance()).toBe(false);
      expect(status.isUnknown()).toBe(false);
    });

    it('should correctly identify OFFLINE status', () => {
      const status = NetworkDeviceStatus.createOffline();

      expect(status.isOnline()).toBe(false);
      expect(status.isOffline()).toBe(true);
      expect(status.isMaintenance()).toBe(false);
      expect(status.isUnknown()).toBe(false);
    });

    it('should correctly identify MAINTENANCE status', () => {
      const status = NetworkDeviceStatus.createMaintenance();

      expect(status.isOnline()).toBe(false);
      expect(status.isOffline()).toBe(false);
      expect(status.isMaintenance()).toBe(true);
      expect(status.isUnknown()).toBe(false);
    });

    it('should correctly identify UNKNOWN status', () => {
      const status = NetworkDeviceStatus.createUnknown();

      expect(status.isOnline()).toBe(false);
      expect(status.isOffline()).toBe(false);
      expect(status.isMaintenance()).toBe(false);
      expect(status.isUnknown()).toBe(true);
    });
  });

  describe('getDisplayName', () => {
    it('should return correct display name for ONLINE', () => {
      const status = NetworkDeviceStatus.createOnline();

      expect(status.getDisplayName()).toBe('Online');
    });

    it('should return correct display name for OFFLINE', () => {
      const status = NetworkDeviceStatus.createOffline();

      expect(status.getDisplayName()).toBe('Offline');
    });

    it('should return correct display name for MAINTENANCE', () => {
      const status = NetworkDeviceStatus.createMaintenance();

      expect(status.getDisplayName()).toBe('Maintenance');
    });

    it('should return correct display name for UNKNOWN', () => {
      const status = NetworkDeviceStatus.createUnknown();

      expect(status.getDisplayName()).toBe('Unknown');
    });
  });

  describe('getColor', () => {
    it('should return green for ONLINE', () => {
      const status = NetworkDeviceStatus.createOnline();

      expect(status.getColor()).toBe('green');
    });

    it('should return red for OFFLINE', () => {
      const status = NetworkDeviceStatus.createOffline();

      expect(status.getColor()).toBe('red');
    });

    it('should return yellow for MAINTENANCE', () => {
      const status = NetworkDeviceStatus.createMaintenance();

      expect(status.getColor()).toBe('yellow');
    });

    it('should return gray for UNKNOWN', () => {
      const status = NetworkDeviceStatus.createUnknown();

      expect(status.getColor()).toBe('gray');
    });
  });

  describe('canTransitionTo', () => {
    it('should allow UNKNOWN to transition to any status', () => {
      const unknown = NetworkDeviceStatus.createUnknown();
      const online = NetworkDeviceStatus.createOnline();
      const offline = NetworkDeviceStatus.createOffline();
      const maintenance = NetworkDeviceStatus.createMaintenance();

      expect(unknown.canTransitionTo(online)).toBe(true);
      expect(unknown.canTransitionTo(offline)).toBe(true);
      expect(unknown.canTransitionTo(maintenance)).toBe(true);
      expect(unknown.canTransitionTo(unknown)).toBe(true);
    });

    it('should allow MAINTENANCE to transition to any status', () => {
      const maintenance = NetworkDeviceStatus.createMaintenance();
      const online = NetworkDeviceStatus.createOnline();
      const offline = NetworkDeviceStatus.createOffline();
      const unknown = NetworkDeviceStatus.createUnknown();

      expect(maintenance.canTransitionTo(online)).toBe(true);
      expect(maintenance.canTransitionTo(offline)).toBe(true);
      expect(maintenance.canTransitionTo(unknown)).toBe(true);
      expect(maintenance.canTransitionTo(maintenance)).toBe(true);
    });

    it('should allow any status to transition to MAINTENANCE', () => {
      const online = NetworkDeviceStatus.createOnline();
      const offline = NetworkDeviceStatus.createOffline();
      const unknown = NetworkDeviceStatus.createUnknown();
      const maintenance = NetworkDeviceStatus.createMaintenance();

      expect(online.canTransitionTo(maintenance)).toBe(true);
      expect(offline.canTransitionTo(maintenance)).toBe(true);
      expect(unknown.canTransitionTo(maintenance)).toBe(true);
    });

    it('should allow ONLINE to transition to OFFLINE', () => {
      const online = NetworkDeviceStatus.createOnline();
      const offline = NetworkDeviceStatus.createOffline();

      expect(online.canTransitionTo(offline)).toBe(true);
    });

    it('should allow OFFLINE to transition to ONLINE', () => {
      const offline = NetworkDeviceStatus.createOffline();
      const online = NetworkDeviceStatus.createOnline();

      expect(offline.canTransitionTo(online)).toBe(true);
    });

    it('should not allow ONLINE to transition to UNKNOWN', () => {
      const online = NetworkDeviceStatus.createOnline();
      const unknown = NetworkDeviceStatus.createUnknown();

      expect(online.canTransitionTo(unknown)).toBe(false);
    });

    it('should not allow OFFLINE to transition to UNKNOWN', () => {
      const offline = NetworkDeviceStatus.createOffline();
      const unknown = NetworkDeviceStatus.createUnknown();

      expect(offline.canTransitionTo(unknown)).toBe(false);
    });
  });

  describe('equals', () => {
    it('should return true for same status values', () => {
      const status1 = NetworkDeviceStatus.createOnline();
      const status2 = NetworkDeviceStatus.createOnline();

      expect(status1.equals(status2)).toBe(true);
    });

    it('should return true for status created with different methods but same value', () => {
      const status1 = NetworkDeviceStatus.createOnline();
      const status2 = NetworkDeviceStatus.create('ONLINE');

      expect(status1.equals(status2.value)).toBe(true);
    });

    it('should return false for different status values', () => {
      const status1 = NetworkDeviceStatus.createOnline();
      const status2 = NetworkDeviceStatus.createOffline();

      expect(status1.equals(status2)).toBe(false);
    });

    it('should return false for null', () => {
      const status = NetworkDeviceStatus.createOnline();

      expect(status.equals(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      const status = NetworkDeviceStatus.createOnline();

      expect(status.equals(undefined as any)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the string value', () => {
      const status = NetworkDeviceStatus.createOnline();

      expect(status.toString()).toBe('ONLINE');
    });
  });

  describe('immutability', () => {
    it('should not allow mutation of props', () => {
      const status = NetworkDeviceStatus.createOnline();

      expect(() => {
        // @ts-expect-error - Testing immutability
        status.props = 'OFFLINE';
      }).toThrow();
    });

    it('should not allow reassignment of props reference', () => {
      const status = NetworkDeviceStatus.createOnline();

      // TypeScript prevents this at compile time
      expect(() => {
        // @ts-expect-error - props is readonly
        status.props = { value: 'OFFLINE' };
      }).toThrow();
    });
  });
});
