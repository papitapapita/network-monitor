// Source: src/domain/device-inventory/value-objects/DeviceStatus.ts

import { DeviceStatus } from '../../../../src/domain/device-inventory';

describe('DeviceStatus', () => {
  // =========================================================================
  describe('create()', () => {
    describe('happy path', () => {
      it('should succeed for ACTIVE', () => {
        const result = DeviceStatus.create('ACTIVE');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('ACTIVE');
      });

      it('should succeed for DAMAGED', () => {
        const result = DeviceStatus.create('DAMAGED');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('DAMAGED');
      });

      it('should succeed for DECOMMISSIONED', () => {
        const result = DeviceStatus.create('DECOMMISSIONED');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('DECOMMISSIONED');
      });

      it('should succeed for INVENTORY', () => {
        const result = DeviceStatus.create('INVENTORY');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('INVENTORY');
      });

      it('should succeed for MAINTENANCE', () => {
        const result = DeviceStatus.create('MAINTENANCE');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('MAINTENANCE');
      });

      it('should normalise lowercase input to uppercase', () => {
        const result = DeviceStatus.create('active');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('ACTIVE');
      });

      it('should trim whitespace before validation', () => {
        const result = DeviceStatus.create('  ACTIVE  ');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('ACTIVE');
      });
    });

    // -----------------------------------------------------------------------
    describe('null / undefined / type validation', () => {
      it('should fail when status is null', () => {
        const result = DeviceStatus.create(null as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('status');
      });

      it('should fail when status is undefined', () => {
        const result = DeviceStatus.create(undefined as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('status');
      });

      it('should fail when status is not a string', () => {
        const result = DeviceStatus.create(1 as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('status');
      });
    });

    // -----------------------------------------------------------------------
    describe('empty validation', () => {
      it('should fail when status is empty string', () => {
        const result = DeviceStatus.create('');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });

      it('should fail when status is whitespace only', () => {
        const result = DeviceStatus.create('   ');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });
    });

    // -----------------------------------------------------------------------
    describe('invalid value validation', () => {
      it('should fail for an unrecognised status', () => {
        const result = DeviceStatus.create('BROKEN');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid device status');
      });

      it('should include the invalid value in the error message', () => {
        const result = DeviceStatus.create('UNKNOWN_STATUS');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('UNKNOWN_STATUS');
      });

      it('should list all valid statuses in the error message', () => {
        const result = DeviceStatus.create('INVALID');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('ACTIVE');
        expect(result.error).toContain('DAMAGED');
        expect(result.error).toContain('DECOMMISSIONED');
        expect(result.error).toContain('INVENTORY');
        expect(result.error).toContain('MAINTENANCE');
      });
    });
  });

  // =========================================================================
  describe('static factory methods', () => {
    it('createActive() should return an ACTIVE status', () => {
      expect(DeviceStatus.createActive().value).toBe('ACTIVE');
    });

    it('createDamaged() should return a DAMAGED status', () => {
      expect(DeviceStatus.createDamaged().value).toBe('DAMAGED');
    });

    it('createDecommissioned() should return a DECOMMISSIONED status', () => {
      expect(DeviceStatus.createDecommissioned().value).toBe('DECOMMISSIONED');
    });

    it('createInventory() should return an INVENTORY status', () => {
      expect(DeviceStatus.createInventory().value).toBe('INVENTORY');
    });

    it('createMaintenance() should return a MAINTENANCE status', () => {
      expect(DeviceStatus.createMaintenance().value).toBe('MAINTENANCE');
    });
  });

  // =========================================================================
  describe('reconstitute()', () => {
    it('should return a DeviceStatus instance with the provided value', () => {
      const status = DeviceStatus.reconstitute('ACTIVE');

      expect(status).toBeInstanceOf(DeviceStatus);
      expect(status.value).toBe('ACTIVE');
    });

    it('should bypass validation (no error thrown for arbitrary string)', () => {
      expect(() => DeviceStatus.reconstitute('LEGACY_STATUS')).not.toThrow();
    });
  });

  // =========================================================================
  describe('predicate methods', () => {
    it('isActive() should return true only for ACTIVE', () => {
      expect(DeviceStatus.createActive().isActive()).toBe(true);
      expect(DeviceStatus.createInventory().isActive()).toBe(false);
    });

    it('isDamaged() should return true only for DAMAGED', () => {
      expect(DeviceStatus.createDamaged().isDamaged()).toBe(true);
      expect(DeviceStatus.createActive().isDamaged()).toBe(false);
    });

    it('isDecommissioned() should return true only for DECOMMISSIONED', () => {
      expect(DeviceStatus.createDecommissioned().isDecommissioned()).toBe(true);
      expect(DeviceStatus.createActive().isDecommissioned()).toBe(false);
    });

    it('isInInventory() should return true only for INVENTORY', () => {
      expect(DeviceStatus.createInventory().isInInventory()).toBe(true);
      expect(DeviceStatus.createActive().isInInventory()).toBe(false);
    });

    it('isInMaintenance() should return true only for MAINTENANCE', () => {
      expect(DeviceStatus.createMaintenance().isInMaintenance()).toBe(true);
      expect(DeviceStatus.createActive().isInMaintenance()).toBe(false);
    });
  });

  // =========================================================================
  describe('getDisplayName()', () => {
    it('should return "Active" for ACTIVE', () => {
      expect(DeviceStatus.createActive().getDisplayName()).toBe('Active');
    });

    it('should return "Damaged" for DAMAGED', () => {
      expect(DeviceStatus.createDamaged().getDisplayName()).toBe('Damaged');
    });

    it('should return "Decommissioned" for DECOMMISSIONED', () => {
      expect(DeviceStatus.createDecommissioned().getDisplayName()).toBe('Decommissioned');
    });

    it('should return "Inventory" for INVENTORY', () => {
      expect(DeviceStatus.createInventory().getDisplayName()).toBe('Inventory');
    });

    it('should return "Maintenance" for MAINTENANCE', () => {
      expect(DeviceStatus.createMaintenance().getDisplayName()).toBe('Maintenance');
    });
  });

  // =========================================================================
  describe('toString()', () => {
    it('should return the raw value string', () => {
      expect(DeviceStatus.createActive().toString()).toBe('ACTIVE');
    });

    it('should return consistent output on repeated calls', () => {
      const status = DeviceStatus.createInventory();

      expect(status.toString()).toBe(status.toString());
    });
  });

  // =========================================================================
  describe('equals()', () => {
    it('should return true for two statuses with the same value', () => {
      const a = DeviceStatus.createActive();
      const b = DeviceStatus.createActive();

      expect(a.equals(b)).toBe(true);
    });

    it('should return false for two statuses with different values', () => {
      const a = DeviceStatus.createActive();
      const b = DeviceStatus.createInventory();

      expect(a.equals(b)).toBe(false);
    });

    it('should return false when compared to null', () => {
      const a = DeviceStatus.createActive();

      expect(a.equals(null as unknown as DeviceStatus)).toBe(false);
    });
  });

  // =========================================================================
  describe('immutability', () => {
    it('should be frozen after creation via create()', () => {
      const status = DeviceStatus.create('ACTIVE').value;

      expect(Object.isFrozen(status)).toBe(true);
    });
  });
});
