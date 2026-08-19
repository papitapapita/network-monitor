// Source: src/domain/identity/value-objects/UserEmail.ts

import { UserEmail } from '../../../../src/domain/identity/value-objects/UserEmail';

describe('UserEmail', () => {
  // =========================================================================
  describe('create()', () => {
    describe('happy path', () => {
      it('should succeed with a valid email address', () => {
        const result = UserEmail.create('user@example.com');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('user@example.com');
      });

      it('should normalise uppercase to lowercase', () => {
        const result = UserEmail.create('User@Example.COM');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('user@example.com');
      });

      it('should trim leading and trailing whitespace before normalising', () => {
        const result = UserEmail.create('  admin@network.io  ');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('admin@network.io');
      });

      it('should accept an email at the maximum allowed length (255)', () => {
        const local = 'a'.repeat(243);
        const email = `${local}@example.com`;

        expect(email.length).toBe(255);

        const result = UserEmail.create(email);

        expect(result.isSuccess).toBe(true);
      });

      it('should accept subdomains', () => {
        const result = UserEmail.create('ops@mail.network.internal');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('ops@mail.network.internal');
      });
    });

    // -----------------------------------------------------------------------
    describe('null / undefined / type validation', () => {
      it('should fail when email is null', () => {
        const result = UserEmail.create(null as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('email');
      });

      it('should fail when email is undefined', () => {
        const result = UserEmail.create(
          undefined as unknown as string
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('email');
      });

      it('should fail when email is not a string', () => {
        const result = UserEmail.create(42 as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('email');
      });
    });

    // -----------------------------------------------------------------------
    describe('empty validation', () => {
      it('should fail when email is an empty string', () => {
        const result = UserEmail.create('');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });

      it('should fail when email is whitespace only', () => {
        const result = UserEmail.create('   ');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });
    });

    // -----------------------------------------------------------------------
    describe('length validation', () => {
      it('should fail when email exceeds 255 characters', () => {
        const local = 'a'.repeat(244);
        const email = `${local}@example.com`;

        expect(email.length).toBeGreaterThan(255);

        const result = UserEmail.create(email);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('255');
      });
    });

    // -----------------------------------------------------------------------
    describe('format validation', () => {
      it('should fail when email has no @ symbol', () => {
        const result = UserEmail.create('notanemail.com');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('not valid');
      });

      it('should fail when email has no domain part after @', () => {
        const result = UserEmail.create('user@');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('not valid');
      });

      it('should fail when email has no local part before @', () => {
        const result = UserEmail.create('@example.com');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('not valid');
      });

      it('should fail when email has no TLD dot separator', () => {
        const result = UserEmail.create('user@nodot');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('not valid');
      });

      it('should fail when email contains spaces inside', () => {
        const result = UserEmail.create('user name@example.com');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('not valid');
      });
    });
  });

  // =========================================================================
  describe('reconstitute()', () => {
    it('should return a UserEmail instance with the provided value', () => {
      const email = UserEmail.reconstitute('raw@domain.com');

      expect(email).toBeInstanceOf(UserEmail);
      expect(email.value).toBe('raw@domain.com');
    });

    it('should bypass validation and accept an arbitrary string', () => {
      expect(() =>
        UserEmail.reconstitute('not-an-email')
      ).not.toThrow();
    });

    it('should not normalise the value during reconstitute', () => {
      const email = UserEmail.reconstitute('PRESERVED@CASE.COM');

      expect(email.value).toBe('PRESERVED@CASE.COM');
    });
  });

  // =========================================================================
  describe('toString()', () => {
    it('should return the email string value', () => {
      const result = UserEmail.create('ops@example.com');

      expect(result.value.toString()).toBe('ops@example.com');
    });
  });

  // =========================================================================
  describe('equals()', () => {
    it('should return true for two emails with the same value', () => {
      const a = UserEmail.reconstitute('same@example.com');
      const b = UserEmail.reconstitute('same@example.com');

      expect(a.equals(b)).toBe(true);
    });

    it('should return false for two emails with different values', () => {
      const a = UserEmail.reconstitute('alice@example.com');
      const b = UserEmail.reconstitute('bob@example.com');

      expect(a.equals(b)).toBe(false);
    });

    it('should return false when compared to null', () => {
      const a = UserEmail.reconstitute('alice@example.com');

      expect(a.equals(null as unknown as UserEmail)).toBe(false);
    });
  });
});
