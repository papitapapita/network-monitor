// Source: src/domain/device-inventory/value-objects/LocationType.ts

import { LocationType } from '../../../../src/domain/device-inventory/value-objects';

describe('LocationType', () => {
  // =========================================================================
  describe('[DEV-091] create()', () => {
    describe('happy path', () => {
      const validValues = [
        'TOWER',
        'DATACENTER',
        'POINT_OF_PRESENCE',
        'OFFICE',
        'CUSTOMER_PREMISES',
        'OTHER'
      ];

      for (const value of validValues) {
        it(`should succeed for ${value}`, () => {
          const result = LocationType.create(value);

          expect(result.isSuccess).toBe(true);
          expect(result.value.value).toBe(value);
        });
      }

      it('should normalise lowercase input to uppercase', () => {
        const result = LocationType.create('tower');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('TOWER');
      });

      it('should trim surrounding whitespace', () => {
        const result = LocationType.create('  office  ');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('OFFICE');
      });
    });

    describe('validation failures', () => {
      it('should fail for an unrecognised type', () => {
        const result = LocationType.create('ROOFTOP');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('ROOFTOP');
      });

      it('should list the valid types in the error message', () => {
        const result = LocationType.create('ROOFTOP');

        expect(result.error).toContain('TOWER');
        expect(result.error).toContain('CUSTOMER_PREMISES');
      });

      it('should fail for an empty string', () => {
        const result = LocationType.create('');

        expect(result.isFailure).toBe(true);
      });

      it('should fail for whitespace only', () => {
        const result = LocationType.create('   ');

        expect(result.isFailure).toBe(true);
      });

      it('should fail for null', () => {
        const result = LocationType.create(null as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('type');
      });

      it('should fail for undefined', () => {
        const result = LocationType.create(
          undefined as unknown as string
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('type');
      });

      it('should fail for a non-string input', () => {
        const result = LocationType.create(42 as unknown as string);

        expect(result.isFailure).toBe(true);
      });
    });
  });

  // =========================================================================
  describe('reconstitute()', () => {
    it('should bypass validation for values already in the store', () => {
      const type = LocationType.reconstitute('ROOFTOP');

      expect(type.value).toBe('ROOFTOP');
    });

    it('should not normalise case', () => {
      const type = LocationType.reconstitute('tower');

      expect(type.value).toBe('tower');
    });
  });

  // =========================================================================
  describe('[DEV-091] isValid()', () => {
    it('should accept an exact valid value', () => {
      expect(LocationType.isValid('TOWER')).toBe(true);
    });

    it('should reject a lowercase value — callers normalise before asking', () => {
      expect(LocationType.isValid('tower')).toBe(false);
    });

    it('should reject an unrecognised value', () => {
      expect(LocationType.isValid('ROOFTOP')).toBe(false);
    });

    it('should reject an empty string', () => {
      expect(LocationType.isValid('')).toBe(false);
    });
  });

  // =========================================================================
  describe('[DEV-096] isCustomerPremises()', () => {
    it('should return true for CUSTOMER_PREMISES', () => {
      const type = LocationType.create('CUSTOMER_PREMISES').value;

      expect(type.isCustomerPremises()).toBe(true);
    });

    it('should return false for any other type', () => {
      const type = LocationType.create('TOWER').value;

      expect(type.isCustomerPremises()).toBe(false);
    });
  });

  // =========================================================================
  describe('equality', () => {
    it('should treat two instances of the same type as equal', () => {
      const a = LocationType.create('OFFICE').value;
      const b = LocationType.create('office').value;

      expect(a.equals(b)).toBe(true);
    });

    it('should treat different types as unequal', () => {
      const a = LocationType.create('OFFICE').value;
      const b = LocationType.create('TOWER').value;

      expect(a.equals(b)).toBe(false);
    });
  });

  // =========================================================================
  describe('toString()', () => {
    it('should return the underlying value', () => {
      const type = LocationType.create('POINT_OF_PRESENCE').value;

      expect(type.toString()).toBe('POINT_OF_PRESENCE');
    });
  });
});
