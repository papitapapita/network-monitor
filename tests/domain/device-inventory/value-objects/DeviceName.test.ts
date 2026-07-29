// Source: src/domain/device-inventory/value-objects/DeviceName.ts

import { DeviceName } from '../../../../src/domain/device-inventory';

describe('DeviceName', () => {
  // =========================================================================
  describe('[DEV-041] create()', () => {
    describe('happy path', () => {
      it('should return a successful Result for a valid name', () => {
        const result = DeviceName.create('Core-Router-01');

        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
      });

      it('should expose the trimmed value', () => {
        const result = DeviceName.create('  Switch-01  ');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('Switch-01');
      });

      it('should succeed for a single character name', () => {
        const result = DeviceName.create('A');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('A');
      });

      it('should succeed for exactly 150 characters', () => {
        const result = DeviceName.create('A'.repeat(150));

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('A'.repeat(150));
      });

      it('should accept names with spaces and special characters', () => {
        const result = DeviceName.create('Core Router #1 (North)');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('Core Router #1 (North)');
      });
    });

    // -----------------------------------------------------------------------
    describe('null / undefined validation', () => {
      it('should fail when name is null', () => {
        const result = DeviceName.create(null as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });

      it('should fail when name is undefined', () => {
        const result = DeviceName.create(undefined as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });

      it('should fail when name is not a string', () => {
        const result = DeviceName.create(42 as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });
    });

    // -----------------------------------------------------------------------
    describe('empty / whitespace validation', () => {
      it('should fail when name is an empty string', () => {
        const result = DeviceName.create('');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });

      it('should fail when name is whitespace only', () => {
        const result = DeviceName.create('   ');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });
    });

    // -----------------------------------------------------------------------
    describe('max length validation', () => {
      it('should fail when name exceeds 150 characters', () => {
        const result = DeviceName.create('A'.repeat(151));

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('150');
      });
    });
  });

  // =========================================================================
  describe('reconstitute()', () => {
    it('should return a DeviceName instance without validation', () => {
      const name = DeviceName.reconstitute('Router-Persisted');

      expect(name).toBeInstanceOf(DeviceName);
      expect(name.value).toBe('Router-Persisted');
    });

    it('should preserve the exact value provided', () => {
      const raw = 'AP-Floor-3';
      const name = DeviceName.reconstitute(raw);

      expect(name.value).toBe(raw);
    });
  });

  // =========================================================================
  describe('toString()', () => {
    it('should return the string value', () => {
      const name = DeviceName.create('Edge-Switch-02').value;

      expect(name.toString()).toBe('Edge-Switch-02');
    });

    it('should return consistent output on repeated calls', () => {
      const name = DeviceName.create('Dist-01').value;

      expect(name.toString()).toBe(name.toString());
    });
  });

  // =========================================================================
  describe('equals()', () => {
    it('should return true for two names with the same value', () => {
      const a = DeviceName.create('Router-01').value;
      const b = DeviceName.create('Router-01').value;

      expect(a.equals(b)).toBe(true);
    });

    it('should return true after trimming produces the same value', () => {
      const a = DeviceName.create('Router-01').value;
      const b = DeviceName.create('  Router-01  ').value;

      expect(a.equals(b)).toBe(true);
    });

    it('should return false for two names with different values', () => {
      const a = DeviceName.create('Router-01').value;
      const b = DeviceName.create('Router-02').value;

      expect(a.equals(b)).toBe(false);
    });

    it('should return false when compared to null', () => {
      const a = DeviceName.create('Router-01').value;

      expect(a.equals(null as unknown as DeviceName)).toBe(false);
    });
  });

  // =========================================================================
  describe('immutability', () => {
    it('should be frozen after creation', () => {
      const name = DeviceName.create('Switch-Core').value;

      expect(Object.isFrozen(name)).toBe(true);
    });
  });
});
