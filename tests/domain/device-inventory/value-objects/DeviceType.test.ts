// Source: src/domain/device-inventory/value-objects/DeviceType.ts

import { DeviceType } from '../../../../src/domain/device-inventory/value-objects';

describe('DeviceType', () => {
  // =========================================================================
  describe('create()', () => {
    describe('happy path', () => {
      const validValues = [
        'ANTENNA',
        'OTHER',
        'RADIO',
        'ROUTER',
        'ROUTERBOARD',
        'SERVER',
        'SWITCH'
      ];

      for (const value of validValues) {
        it(`should succeed for ${value}`, () => {
          const result = DeviceType.create(value);

          expect(result.isSuccess).toBe(true);
          expect(result.value.value).toBe(value);
        });
      }

      it('should normalise lowercase input to uppercase', () => {
        const result = DeviceType.create('router');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('ROUTER');
      });

      it('should trim surrounding whitespace', () => {
        const result = DeviceType.create('  switch  ');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('SWITCH');
      });
    });

    describe('validation failures', () => {
      it('should fail for an unrecognised type', () => {
        const result = DeviceType.create('TOASTER');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('TOASTER');
      });

      it('should reject a wireless role that is not a hardware type', () => {
        const result = DeviceType.create('ACCESS_POINT');

        expect(result.isFailure).toBe(true);
      });

      it('should list the valid types in the error message', () => {
        const result = DeviceType.create('TOASTER');

        expect(result.error).toContain('ANTENNA');
        expect(result.error).toContain('ROUTERBOARD');
      });

      it('should fail for an empty string', () => {
        const result = DeviceType.create('');

        expect(result.isFailure).toBe(true);
      });

      it('should fail for whitespace only', () => {
        const result = DeviceType.create('   ');

        expect(result.isFailure).toBe(true);
      });

      it('should fail for null', () => {
        const result = DeviceType.create(null as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('deviceType');
      });

      it('should fail for undefined', () => {
        const result = DeviceType.create(
          undefined as unknown as string
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('deviceType');
      });

      it('should fail for a non-string input', () => {
        const result = DeviceType.create(42 as unknown as string);

        expect(result.isFailure).toBe(true);
      });
    });
  });

  // =========================================================================
  describe('reconstitute()', () => {
    it('should bypass validation for values already in the store', () => {
      const type = DeviceType.reconstitute('TOASTER');

      expect(type.value).toBe('TOASTER');
    });

    it('should not normalise case', () => {
      const type = DeviceType.reconstitute('router');

      expect(type.value).toBe('router');
    });
  });

  // =========================================================================
  describe('isValid()', () => {
    it('should accept an exact valid value', () => {
      expect(DeviceType.isValid('ROUTER')).toBe(true);
    });

    it('should reject a lowercase value — callers normalise before asking', () => {
      expect(DeviceType.isValid('router')).toBe(false);
    });

    it('should reject an unrecognised value', () => {
      expect(DeviceType.isValid('TOASTER')).toBe(false);
    });

    it('should reject an empty string', () => {
      expect(DeviceType.isValid('')).toBe(false);
    });
  });

  // =========================================================================
  describe('equality', () => {
    it('should treat two instances of the same type as equal', () => {
      const a = DeviceType.create('SWITCH').value;
      const b = DeviceType.create('switch').value;

      expect(a.equals(b)).toBe(true);
    });

    it('should treat different types as unequal', () => {
      const a = DeviceType.create('SWITCH').value;
      const b = DeviceType.create('ROUTER').value;

      expect(a.equals(b)).toBe(false);
    });
  });

  // =========================================================================
  describe('toString()', () => {
    it('should return the underlying value', () => {
      const type = DeviceType.create('ROUTERBOARD').value;

      expect(type.toString()).toBe('ROUTERBOARD');
    });
  });
});
