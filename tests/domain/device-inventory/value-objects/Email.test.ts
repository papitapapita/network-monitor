import { Email } from '../../../../src/domain/device-inventory';

describe('Email', () => {
  describe('create', () => {
    describe('when valid email', () => {
      it('should create Email with valid format', () => {
        const result = Email.create('user@example.com');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('user@example.com');
      });

      it('should normalize email to lowercase', () => {
        const result = Email.create('USER@EXAMPLE.COM');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('user@example.com');
      });

      it('should normalize mixed case email', () => {
        const result = Email.create('TestUser@Domain.COM');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('testuser@domain.com');
      });

      it('should trim whitespace', () => {
        const result = Email.create('  user@example.com  ');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('user@example.com');
      });

      it('should trim and normalize together', () => {
        const result = Email.create('  UPPER@Example.COM  ');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('upper@example.com');
      });

      it('should accept email with subdomain', () => {
        const result = Email.create('user@mail.example.com');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('user@mail.example.com');
      });

      it('should accept email with numbers', () => {
        const result = Email.create('user123@example456.com');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('user123@example456.com');
      });

      it('should accept email with dots in local part', () => {
        const result = Email.create('first.last@example.com');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('first.last@example.com');
      });

      it('should accept email with plus sign', () => {
        const result = Email.create('user+tag@example.com');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('user+tag@example.com');
      });

      it('should accept email with hyphens', () => {
        const result = Email.create('user-name@example-domain.com');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe(
          'user-name@example-domain.com'
        );
      });

      it('should accept email with underscores', () => {
        const result = Email.create('user_name@example.com');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('user_name@example.com');
      });
    });

    describe('when invalid email', () => {
      it('should fail for null', () => {
        const result = Email.create(null as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('email');
      });

      it('should fail for undefined', () => {
        const result = Email.create(undefined as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('email');
      });

      it('should fail for non-string value', () => {
        const result = Email.create(123 as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('string');
      });

      it('should fail for empty string', () => {
        const result = Email.create('');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('at least 1');
      });

      it('should fail for whitespace only', () => {
        const result = Email.create('   ');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('at least 1');
      });

      it('should fail for invalid format (missing @)', () => {
        const result = Email.create('userexample.com');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('valid email');
      });

      it('should fail for invalid format (missing local part)', () => {
        const result = Email.create('@example.com');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('valid email');
      });

      it('should fail for invalid format (missing domain)', () => {
        const result = Email.create('user@');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('valid email');
      });

      it('should fail for invalid format (multiple @)', () => {
        const result = Email.create('user@@example.com');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('valid email');
      });

      it('should fail for invalid format (spaces in email)', () => {
        const result = Email.create('user name@example.com');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('valid email');
      });

      it('should fail for invalid format (missing TLD)', () => {
        const result = Email.create('user@example');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('valid email');
      });

      it('should fail for invalid format (special characters)', () => {
        const result = Email.create('user#name@example.com');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('valid email');
      });
    });

    describe('when email exceeds length constraints', () => {
      it('should fail when total email exceeds 320 characters', () => {
        const longEmail = 'a'.repeat(310) + '@example.com';

        const result = Email.create(longEmail);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('at most 320');
      });

      it('should succeed for email with exactly 320 characters', () => {
        // Create email with exactly 320 chars: local (64) + @ (1) + domain (255)
        const local = 'a'.repeat(64);
        const domain = 'a'.repeat(243) + '.example.com'; // 255 chars
        const email = `${local}@${domain}`;

        const result = Email.create(email);

        expect(result.isSuccess).toBe(true);
      });

      it('should fail when local part exceeds 64 characters', () => {
        const longLocal = 'a'.repeat(65) + '@example.com';

        const result = Email.create(longLocal);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('local email part');
        expect(result.error).toContain('at most 64');
      });

      it('should succeed for local part with exactly 64 characters', () => {
        const maxLocal = 'a'.repeat(64) + '@example.com';

        const result = Email.create(maxLocal);

        expect(result.isSuccess).toBe(true);
      });

      it('should fail when domain exceeds 255 characters', () => {
        const longDomain = 'user@' + 'a'.repeat(256) + '.com';

        const result = Email.create(longDomain);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('domain email part');
        expect(result.error).toContain('at most 255');
      });

      it('should succeed for domain with exactly 255 characters', () => {
        const maxDomain = 'user@' + 'a'.repeat(243) + '.example.com'; // 255 chars

        const result = Email.create(maxDomain);

        expect(result.isSuccess).toBe(true);
      });
    });
  });

  describe('equals', () => {
    it('should return true for same email values', () => {
      const email1 = Email.create('user@example.com').value;
      const email2 = Email.create('user@example.com').value;

      expect(email1.equals(email2)).toBe(true);
    });

    it('should return true for emails that normalize to same value', () => {
      const email1 = Email.create('USER@EXAMPLE.COM').value;
      const email2 = Email.create('user@example.com').value;

      expect(email1.equals(email2)).toBe(true);
    });

    it('should return true for emails with whitespace differences', () => {
      const email1 = Email.create('  user@example.com  ').value;
      const email2 = Email.create('user@example.com').value;

      expect(email1.equals(email2)).toBe(true);
    });

    it('should return false for different email values', () => {
      const email1 = Email.create('user1@example.com').value;
      const email2 = Email.create('user2@example.com').value;

      expect(email1.equals(email2)).toBe(false);
    });

    it('should return false for different domains', () => {
      const email1 = Email.create('user@example.com').value;
      const email2 = Email.create('user@domain.com').value;

      expect(email1.equals(email2)).toBe(false);
    });

    it('should return false for null', () => {
      const email = Email.create('user@example.com').value;

      expect(email.equals(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      const email = Email.create('user@example.com').value;

      expect(email.equals(undefined as any)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the email value', () => {
      const email = Email.create('user@example.com').value;

      expect(email.toString()).toBe('user@example.com');
    });

    it('should return normalized email value', () => {
      const email = Email.create('USER@EXAMPLE.COM').value;

      expect(email.toString()).toBe('user@example.com');
    });
  });

  describe('immutability', () => {
    it('should not allow mutation of props', () => {
      const email = Email.create('user@example.com').value;

      expect(() => {
        // @ts-expect-error - Testing immutability
        email.props.value = 'hacker@malicious.com';
      }).toThrow();
    });

    it('should not allow reassignment of props reference', () => {
      const email = Email.create('user@example.com').value;

      // TypeScript prevents this at compile time
      expect(() => {
        // @ts-expect-error - props is readonly
        email.props = { value: 'hacker@malicious.com' };
      }).toThrow();
    });
  });
});
