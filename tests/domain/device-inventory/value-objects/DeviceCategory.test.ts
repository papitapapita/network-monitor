// Source: src/domain/device-inventory/value-objects/DeviceCategory.ts

import { DeviceCategory } from '../../../../src/domain/device-inventory';

describe('DeviceCategory', () => {
  // =========================================================================
  describe('create()', () => {
    describe('happy path', () => {
      it('should succeed for CORE', () => {
        const result = DeviceCategory.create('CORE');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('CORE');
      });

      it('should succeed for DISTRIBUTION', () => {
        const result = DeviceCategory.create('DISTRIBUTION');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('DISTRIBUTION');
      });

      it('should succeed for POE', () => {
        const result = DeviceCategory.create('POE');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('POE');
      });

      it('should succeed for ACCESS_POINT', () => {
        const result = DeviceCategory.create('ACCESS_POINT');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('ACCESS_POINT');
      });

      it('should succeed for CLIENT_CPE', () => {
        const result = DeviceCategory.create('CLIENT_CPE');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('CLIENT_CPE');
      });

      it('should normalise lowercase to uppercase', () => {
        const result = DeviceCategory.create('core');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('CORE');
      });

      it('should trim whitespace before validation', () => {
        const result = DeviceCategory.create('  CORE  ');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('CORE');
      });
    });

    // -----------------------------------------------------------------------
    describe('null / undefined / type validation', () => {
      it('should fail when category is null', () => {
        const result = DeviceCategory.create(null as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('category');
      });

      it('should fail when category is undefined', () => {
        const result = DeviceCategory.create(undefined as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('category');
      });

      it('should fail when category is not a string', () => {
        const result = DeviceCategory.create(123 as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('category');
      });
    });

    // -----------------------------------------------------------------------
    describe('empty validation', () => {
      it('should fail when category is an empty string', () => {
        const result = DeviceCategory.create('');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });

      it('should fail when category is whitespace only', () => {
        const result = DeviceCategory.create('   ');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });
    });

    // -----------------------------------------------------------------------
    describe('invalid value validation', () => {
      it('should fail for an unrecognised category', () => {
        const result = DeviceCategory.create('ROUTER');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid device category');
      });

      it('should list all valid categories in the error message', () => {
        const result = DeviceCategory.create('UNKNOWN');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('CORE');
        expect(result.error).toContain('DISTRIBUTION');
        expect(result.error).toContain('POE');
        expect(result.error).toContain('ACCESS_POINT');
        expect(result.error).toContain('CLIENT_CPE');
      });
    });
  });

  // =========================================================================
  describe('static factory methods', () => {
    it('createCore() should return a CORE category', () => {
      expect(DeviceCategory.createCore().value).toBe('CORE');
    });

    it('createDistribution() should return a DISTRIBUTION category', () => {
      expect(DeviceCategory.createDistribution().value).toBe('DISTRIBUTION');
    });

    it('createPoe() should return a POE category', () => {
      expect(DeviceCategory.createPoe().value).toBe('POE');
    });

    it('createAccessPoint() should return an ACCESS_POINT category', () => {
      expect(DeviceCategory.createAccessPoint().value).toBe('ACCESS_POINT');
    });

    it('createClientCpe() should return a CLIENT_CPE category', () => {
      expect(DeviceCategory.createClientCpe().value).toBe('CLIENT_CPE');
    });
  });

  // =========================================================================
  describe('reconstitute()', () => {
    it('should return a DeviceCategory instance with the given value', () => {
      const cat = DeviceCategory.reconstitute('CORE');

      expect(cat).toBeInstanceOf(DeviceCategory);
      expect(cat.value).toBe('CORE');
    });

    it('should bypass validation (no error for arbitrary string)', () => {
      expect(() => DeviceCategory.reconstitute('LEGACY_CAT')).not.toThrow();
    });
  });

  // =========================================================================
  describe('predicate methods', () => {
    it('isCore() should return true only for CORE', () => {
      expect(DeviceCategory.createCore().isCore()).toBe(true);
      expect(DeviceCategory.createDistribution().isCore()).toBe(false);
    });

    it('isDistribution() should return true only for DISTRIBUTION', () => {
      expect(DeviceCategory.createDistribution().isDistribution()).toBe(true);
      expect(DeviceCategory.createCore().isDistribution()).toBe(false);
    });

    it('isPoe() should return true only for POE', () => {
      expect(DeviceCategory.createPoe().isPoe()).toBe(true);
      expect(DeviceCategory.createCore().isPoe()).toBe(false);
    });

    it('isAccessPoint() should return true only for ACCESS_POINT', () => {
      expect(DeviceCategory.createAccessPoint().isAccessPoint()).toBe(true);
      expect(DeviceCategory.createCore().isAccessPoint()).toBe(false);
    });

    it('isClientCpe() should return true only for CLIENT_CPE', () => {
      expect(DeviceCategory.createClientCpe().isClientCpe()).toBe(true);
      expect(DeviceCategory.createCore().isClientCpe()).toBe(false);
    });
  });

  // =========================================================================
  describe('getDisplayName()', () => {
    it('should return "Core" for CORE', () => {
      expect(DeviceCategory.createCore().getDisplayName()).toBe('Core');
    });

    it('should return "Distribution" for DISTRIBUTION', () => {
      expect(DeviceCategory.createDistribution().getDisplayName()).toBe('Distribution');
    });

    it('should return "PoE" for POE', () => {
      expect(DeviceCategory.createPoe().getDisplayName()).toBe('PoE');
    });

    it('should return "Access Point" for ACCESS_POINT', () => {
      expect(DeviceCategory.createAccessPoint().getDisplayName()).toBe('Access Point');
    });

    it('should return "Client CPE" for CLIENT_CPE', () => {
      expect(DeviceCategory.createClientCpe().getDisplayName()).toBe('Client CPE');
    });
  });

  // =========================================================================
  describe('toString()', () => {
    it('should return the raw value string', () => {
      expect(DeviceCategory.createCore().toString()).toBe('CORE');
    });

    it('should return consistent output on repeated calls', () => {
      const cat = DeviceCategory.createAccessPoint();

      expect(cat.toString()).toBe(cat.toString());
    });
  });

  // =========================================================================
  describe('equals()', () => {
    it('should return true for two categories with the same value', () => {
      const a = DeviceCategory.createCore();
      const b = DeviceCategory.createCore();

      expect(a.equals(b)).toBe(true);
    });

    it('should return false for two categories with different values', () => {
      const a = DeviceCategory.createCore();
      const b = DeviceCategory.createDistribution();

      expect(a.equals(b)).toBe(false);
    });

    it('should return false when compared to null', () => {
      const a = DeviceCategory.createCore();

      expect(a.equals(null as unknown as DeviceCategory)).toBe(false);
    });
  });

  // =========================================================================
  describe('immutability', () => {
    it('should be frozen after creation via create()', () => {
      const cat = DeviceCategory.create('CORE').value;

      expect(Object.isFrozen(cat)).toBe(true);
    });
  });
});
