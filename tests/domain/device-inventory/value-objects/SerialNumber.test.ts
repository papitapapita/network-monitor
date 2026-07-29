// Source: src/domain/device-inventory/value-objects/SerialNumber.ts

import { SerialNumber } from '../../../../src/domain/device-inventory';

describe('SerialNumber', () => {
  // =========================================================================
  describe('[DEV-045] create()', () => {
    describe('happy path', () => {
      it('should return a successful Result for a valid serial number', () => {
        const result = SerialNumber.create('SN-2024-XYZ-001');

        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
      });

      it('should expose the trimmed value', () => {
        const result = SerialNumber.create('  SN-001  ');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('SN-001');
      });

      it('should succeed for a single character', () => {
        const result = SerialNumber.create('X');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('X');
      });

      it('should succeed for exactly 100 characters', () => {
        const result = SerialNumber.create('A'.repeat(100));

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('A'.repeat(100));
      });

      it('should accept alphanumeric serial numbers', () => {
        const result = SerialNumber.create('ABC123456789');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('ABC123456789');
      });

      it('should accept serial numbers with hyphens and underscores', () => {
        const result = SerialNumber.create('SN-2024_MODEL-001');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('SN-2024_MODEL-001');
      });
    });

    // -----------------------------------------------------------------------
    describe('null / undefined / type validation', () => {
      it('should fail when serial is null', () => {
        const result = SerialNumber.create(null as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('serialNumber');
      });

      it('should fail when serial is undefined', () => {
        const result = SerialNumber.create(undefined as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('serialNumber');
      });

      it('should fail when serial is not a string', () => {
        const result = SerialNumber.create(99 as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('serialNumber');
      });
    });

    // -----------------------------------------------------------------------
    describe('empty / whitespace validation', () => {
      it('should fail when serial is an empty string', () => {
        const result = SerialNumber.create('');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });

      it('should fail when serial is whitespace only', () => {
        const result = SerialNumber.create('   ');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });
    });

    // -----------------------------------------------------------------------
    describe('max length validation', () => {
      it('should fail when serial exceeds 100 characters', () => {
        const result = SerialNumber.create('A'.repeat(101));

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('100');
      });
    });
  });

  // =========================================================================
  describe('reconstitute()', () => {
    it('should return a SerialNumber instance without validation', () => {
      const sn = SerialNumber.reconstitute('SN-PERSISTED-001');

      expect(sn).toBeInstanceOf(SerialNumber);
      expect(sn.value).toBe('SN-PERSISTED-001');
    });

    it('should preserve the exact value provided', () => {
      const raw = 'RAW-SN-XYZ';
      const sn = SerialNumber.reconstitute(raw);

      expect(sn.value).toBe(raw);
    });
  });

  // =========================================================================
  describe('toString()', () => {
    it('should return the string value', () => {
      const sn = SerialNumber.create('SN-99').value;

      expect(sn.toString()).toBe('SN-99');
    });

    it('should return consistent output on repeated calls', () => {
      const sn = SerialNumber.create('SN-CONST').value;

      expect(sn.toString()).toBe(sn.toString());
    });
  });

  // =========================================================================
  describe('equals()', () => {
    it('should return true for two serial numbers with the same value', () => {
      const a = SerialNumber.create('SN-001').value;
      const b = SerialNumber.create('SN-001').value;

      expect(a.equals(b)).toBe(true);
    });

    it('should return true after trimming produces the same value', () => {
      const a = SerialNumber.create('SN-001').value;
      const b = SerialNumber.create('  SN-001  ').value;

      expect(a.equals(b)).toBe(true);
    });

    it('should return false for two serial numbers with different values', () => {
      const a = SerialNumber.create('SN-001').value;
      const b = SerialNumber.create('SN-002').value;

      expect(a.equals(b)).toBe(false);
    });

    it('should return false when compared to null', () => {
      const a = SerialNumber.create('SN-001').value;

      expect(a.equals(null as unknown as SerialNumber)).toBe(false);
    });
  });

  // =========================================================================
  describe('immutability', () => {
    it('should be frozen after creation', () => {
      const sn = SerialNumber.create('SN-FROZEN').value;

      expect(Object.isFrozen(sn)).toBe(true);
    });
  });
});
