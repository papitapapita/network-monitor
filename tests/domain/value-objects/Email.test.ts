import { Email } from '../../../src/domain';

describe('Email Value Object', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validation failures', () => {
    it('should fail when email is null', () => {
      const result = Email.create(null as any);
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('email is null or undefined');
    });

    it('should fail when email is undefined', () => {
      const result = Email.create(undefined as any);
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('email is null or undefined');
    });

    it('should fail when email is not a string', () => {
      const result = Email.create(123 as any);
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('email must be a string');
    });

    it('should fail when email is empty or whitespace', () => {
      const result = Email.create('   ');
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain(
        'email must be at least 1 character'
      );
    });

    it('should fail when email format is invalid', () => {
      const result = Email.create('invalid@');
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('email is not a valid email address');
    });

    it('should fail when email exceeds 320 characters', () => {
      const longEmail = 'a'.repeat(310) + '@example.com'; // >320

      const result = Email.create(longEmail);

      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain(
        'email must be at most 320 characters'
      );
    });

    it('should fail if local part exceeds 64 characters', () => {
      const longLocal = 'a'.repeat(65) + '@example.com';

      const result = Email.create(longLocal);

      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain(
        'local email part must be at most 64 characters'
      );
    });

    it('should fail if domain exceeds 255 characters', () => {
      const longDomain = 'test@' + 'a'.repeat(256) + '.com';

      const result = Email.create(longDomain);

      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain(
        'domain email part must be at most 255 characters'
      );
    });
  });

  describe('successful creation', () => {
    it('should create a valid email', () => {
      const result = Email.create('TestUser@DOMAIN.com');

      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe('testuser@domain.com');
    });

    it('should trim and lowercase email', () => {
      const result = Email.create('  UPPER@Example.COM  ');

      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe('upper@example.com');
    });
  });

  describe('toString', () => {
    it('should return the email value', () => {
      const result = Email.create('test@example.com');

      expect(result.value.toString()).toBe('test@example.com');
    });
  });
});
