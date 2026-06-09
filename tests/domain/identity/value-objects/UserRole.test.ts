// Source: src/domain/identity/value-objects/UserRole.ts

import { UserRole } from '../../../../src/domain/identity/value-objects/UserRole';

describe('UserRole', () => {
  // =========================================================================
  describe('create()', () => {
    describe('happy path', () => {
      it('should succeed for ADMIN', () => {
        const result = UserRole.create('ADMIN');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('ADMIN');
      });

      it('should succeed for OPERATOR', () => {
        const result = UserRole.create('OPERATOR');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('OPERATOR');
      });

      it('should succeed for VIEWER', () => {
        const result = UserRole.create('VIEWER');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('VIEWER');
      });

      it('should normalise lowercase input to uppercase', () => {
        const result = UserRole.create('admin');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('ADMIN');
      });

      it('should normalise mixed-case input to uppercase', () => {
        const result = UserRole.create('Operator');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('OPERATOR');
      });

      it('should trim surrounding whitespace before normalising', () => {
        const result = UserRole.create('  viewer  ');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('VIEWER');
      });
    });

    // -----------------------------------------------------------------------
    describe('null / undefined / type validation', () => {
      it('should fail when role is null', () => {
        const result = UserRole.create(null as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('role');
      });

      it('should fail when role is undefined', () => {
        const result = UserRole.create(undefined as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('role');
      });

      it('should fail when role is not a string', () => {
        const result = UserRole.create(1 as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('role');
      });
    });

    // -----------------------------------------------------------------------
    describe('invalid value validation', () => {
      it('should fail for an unrecognised role string', () => {
        const result = UserRole.create('SUPERUSER');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid role');
      });

      it('should include the invalid value in the error message', () => {
        const result = UserRole.create('GUEST');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('GUEST');
      });

      it('should list all valid roles in the error message', () => {
        const result = UserRole.create('UNKNOWN');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('ADMIN');
        expect(result.error).toContain('OPERATOR');
        expect(result.error).toContain('VIEWER');
      });

      it('should fail for an empty string', () => {
        const result = UserRole.create('');

        expect(result.isFailure).toBe(true);
      });
    });
  });

  // =========================================================================
  describe('reconstitute()', () => {
    it('should return a UserRole instance with the provided value', () => {
      const role = UserRole.reconstitute('ADMIN');

      expect(role).toBeInstanceOf(UserRole);
      expect(role.value).toBe('ADMIN');
    });

    it('should bypass validation and accept an arbitrary string', () => {
      expect(() => UserRole.reconstitute('LEGACY_ROLE')).not.toThrow();
    });
  });

  // =========================================================================
  describe('predicate methods', () => {
    describe('isAdmin()', () => {
      it('should return true only for ADMIN role', () => {
        expect(UserRole.reconstitute('ADMIN').isAdmin()).toBe(true);
      });

      it('should return false for OPERATOR', () => {
        expect(UserRole.reconstitute('OPERATOR').isAdmin()).toBe(false);
      });

      it('should return false for VIEWER', () => {
        expect(UserRole.reconstitute('VIEWER').isAdmin()).toBe(false);
      });
    });

    describe('isOperator()', () => {
      it('should return true only for OPERATOR role', () => {
        expect(UserRole.reconstitute('OPERATOR').isOperator()).toBe(true);
      });

      it('should return false for ADMIN', () => {
        expect(UserRole.reconstitute('ADMIN').isOperator()).toBe(false);
      });

      it('should return false for VIEWER', () => {
        expect(UserRole.reconstitute('VIEWER').isOperator()).toBe(false);
      });
    });

    describe('isViewer()', () => {
      it('should return true only for VIEWER role', () => {
        expect(UserRole.reconstitute('VIEWER').isViewer()).toBe(true);
      });

      it('should return false for ADMIN', () => {
        expect(UserRole.reconstitute('ADMIN').isViewer()).toBe(false);
      });

      it('should return false for OPERATOR', () => {
        expect(UserRole.reconstitute('OPERATOR').isViewer()).toBe(false);
      });
    });
  });

  // =========================================================================
  describe('toString()', () => {
    it('should return the raw role string', () => {
      expect(UserRole.reconstitute('ADMIN').toString()).toBe('ADMIN');
    });

    it('should return the same value on repeated calls', () => {
      const role = UserRole.reconstitute('VIEWER');

      expect(role.toString()).toBe(role.toString());
    });
  });

  // =========================================================================
  describe('equals()', () => {
    it('should return true for two roles with the same value', () => {
      const a = UserRole.reconstitute('ADMIN');
      const b = UserRole.reconstitute('ADMIN');

      expect(a.equals(b)).toBe(true);
    });

    it('should return false for two roles with different values', () => {
      const a = UserRole.reconstitute('ADMIN');
      const b = UserRole.reconstitute('VIEWER');

      expect(a.equals(b)).toBe(false);
    });

    it('should return false when compared to null', () => {
      const a = UserRole.reconstitute('OPERATOR');

      expect(a.equals(null as unknown as UserRole)).toBe(false);
    });
  });
});
