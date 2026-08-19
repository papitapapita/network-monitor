// Source: src/domain/device-inventory/value-objects/DeviceCategory.ts

import { DeviceCategory } from '../../../../src/domain/device-inventory';

describe('DeviceCategory', () => {
  // =========================================================================
  describe('[DEV-043] create()', () => {
    describe('happy path', () => {
      it('should succeed for CPE', () => {
        const result = DeviceCategory.create('CPE');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('CPE');
      });

      it('should succeed for WIRELESS_CPE', () => {
        const result = DeviceCategory.create('WIRELESS_CPE');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('WIRELESS_CPE');
      });

      it('should succeed for ACCESS_POINT', () => {
        const result = DeviceCategory.create('ACCESS_POINT');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('ACCESS_POINT');
      });

      it('should succeed for GATEWAY', () => {
        const result = DeviceCategory.create('GATEWAY');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('GATEWAY');
      });

      it('should succeed for AGGREGATION_SWITCH', () => {
        const result = DeviceCategory.create('AGGREGATION_SWITCH');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('AGGREGATION_SWITCH');
      });

      it('should succeed for OTHER', () => {
        const result = DeviceCategory.create('OTHER');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('OTHER');
      });

      it('should normalise lowercase to uppercase', () => {
        const result = DeviceCategory.create('cpe');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('CPE');
      });

      it('should trim whitespace before validation', () => {
        const result = DeviceCategory.create('  CPE  ');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('CPE');
      });
    });

    // -----------------------------------------------------------------------
    describe('null / undefined / type validation', () => {
      it('should fail when category is null', () => {
        const result = DeviceCategory.create(
          null as unknown as string
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('category');
      });

      it('should fail when category is undefined', () => {
        const result = DeviceCategory.create(
          undefined as unknown as string
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('category');
      });

      it('should fail when category is not a string', () => {
        const result = DeviceCategory.create(
          123 as unknown as string
        );

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

      it('should fail for removed CORE category', () => {
        const result = DeviceCategory.create('CORE');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid device category');
      });

      it('should fail for removed DISTRIBUTION category', () => {
        const result = DeviceCategory.create('DISTRIBUTION');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid device category');
      });

      it('should fail for retired AP category', () => {
        const result = DeviceCategory.create('AP');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid device category');
      });

      it('should fail for ROUTERBOARD, now a hardware type not a role', () => {
        const result = DeviceCategory.create('ROUTERBOARD');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid device category');
      });

      it('should fail for retired SMART_SWITCH category', () => {
        const result = DeviceCategory.create('SMART_SWITCH');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid device category');
      });

      it('should fail for retired SMART_SWITCH_POE category', () => {
        const result = DeviceCategory.create('SMART_SWITCH_POE');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid device category');
      });

      it('should list all valid categories in the error message', () => {
        const result = DeviceCategory.create('UNKNOWN');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('CPE');
        expect(result.error).toContain('ACCESS_POINT');
        expect(result.error).toContain('GATEWAY');
        expect(result.error).toContain('AGGREGATION_SWITCH');
        expect(result.error).toContain('OTHER');
      });
    });
  });

  // =========================================================================
  describe('static factory methods', () => {
    it('createCpe() should return a CPE category', () => {
      expect(DeviceCategory.createCpe().value).toBe('CPE');
    });

    it('createAccessPoint() should return an ACCESS_POINT category', () => {
      expect(DeviceCategory.createAccessPoint().value).toBe(
        'ACCESS_POINT'
      );
    });

    it('createGateway() should return a GATEWAY category', () => {
      expect(DeviceCategory.createGateway().value).toBe('GATEWAY');
    });

    it('createAggregationSwitch() should return an AGGREGATION_SWITCH category', () => {
      expect(DeviceCategory.createAggregationSwitch().value).toBe(
        'AGGREGATION_SWITCH'
      );
    });

    it('createOther() should return an OTHER category', () => {
      expect(DeviceCategory.createOther().value).toBe('OTHER');
    });
  });

  // =========================================================================
  describe('reconstitute()', () => {
    it('should return a DeviceCategory instance with the given value', () => {
      const cat = DeviceCategory.reconstitute('CPE');

      expect(cat).toBeInstanceOf(DeviceCategory);
      expect(cat.value).toBe('CPE');
    });

    it('should bypass validation (no error for arbitrary string)', () => {
      expect(() =>
        DeviceCategory.reconstitute('LEGACY_CAT')
      ).not.toThrow();
    });
  });

  // =========================================================================
  describe('predicate methods', () => {
    it('isCpe() should return true only for CPE', () => {
      expect(DeviceCategory.createCpe().isCpe()).toBe(true);
      expect(DeviceCategory.createAccessPoint().isCpe()).toBe(false);
    });

    it('isAccessPoint() should return true only for ACCESS_POINT', () => {
      expect(DeviceCategory.createAccessPoint().isAccessPoint()).toBe(
        true
      );
      expect(DeviceCategory.createCpe().isAccessPoint()).toBe(false);
    });

    it('isGateway() should return true only for GATEWAY', () => {
      expect(DeviceCategory.createGateway().isGateway()).toBe(true);
      expect(DeviceCategory.createCpe().isGateway()).toBe(false);
    });

    it('isAggregationSwitch() should return true only for AGGREGATION_SWITCH', () => {
      expect(
        DeviceCategory.createAggregationSwitch().isAggregationSwitch()
      ).toBe(true);
      expect(DeviceCategory.createCpe().isAggregationSwitch()).toBe(
        false
      );
    });

    it('isOther() should return true only for OTHER', () => {
      expect(DeviceCategory.createOther().isOther()).toBe(true);
      expect(DeviceCategory.createCpe().isOther()).toBe(false);
    });
  });

  // =========================================================================
  describe('getDisplayName()', () => {
    it('should return "CPE" for CPE', () => {
      expect(DeviceCategory.createCpe().getDisplayName()).toBe('CPE');
    });

    it('should return "Access Point" for ACCESS_POINT', () => {
      expect(
        DeviceCategory.createAccessPoint().getDisplayName()
      ).toBe('Access Point');
    });

    it('should return "Gateway" for GATEWAY', () => {
      expect(DeviceCategory.createGateway().getDisplayName()).toBe(
        'Gateway'
      );
    });

    it('should return "Aggregation Switch" for AGGREGATION_SWITCH', () => {
      expect(
        DeviceCategory.createAggregationSwitch().getDisplayName()
      ).toBe('Aggregation Switch');
    });

    it('should return "Other" for OTHER', () => {
      expect(DeviceCategory.createOther().getDisplayName()).toBe(
        'Other'
      );
    });
  });

  // =========================================================================
  describe('toString()', () => {
    it('should return the raw value string', () => {
      expect(DeviceCategory.createCpe().toString()).toBe('CPE');
    });

    it('should return consistent output on repeated calls', () => {
      const cat = DeviceCategory.createAccessPoint();

      expect(cat.toString()).toBe(cat.toString());
    });
  });

  // =========================================================================
  describe('equals()', () => {
    it('should return true for two categories with the same value', () => {
      const a = DeviceCategory.createCpe();
      const b = DeviceCategory.createCpe();

      expect(a.equals(b)).toBe(true);
    });

    it('should return false for two categories with different values', () => {
      const a = DeviceCategory.createCpe();
      const b = DeviceCategory.createAccessPoint();

      expect(a.equals(b)).toBe(false);
    });

    it('should return false when compared to null', () => {
      const a = DeviceCategory.createCpe();

      expect(a.equals(null as unknown as DeviceCategory)).toBe(false);
    });
  });

  // =========================================================================
  describe('immutability', () => {
    it('should be frozen after creation via create()', () => {
      const cat = DeviceCategory.create('CPE').value;

      expect(Object.isFrozen(cat)).toBe(true);
    });
  });
});
