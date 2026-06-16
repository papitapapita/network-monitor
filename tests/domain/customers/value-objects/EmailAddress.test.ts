// Source: src/domain/customers/value-objects/EmailAddress.ts

import { describe, it, expect } from '@jest/globals';
import { EmailAddress } from '../../../../src/domain/customers';

describe('EmailAddress', () => {
  describe('create()', () => {
    it('should succeed for a valid email and normalize to lowercase', () => {
      const result = EmailAddress.create('  John.Doe@Example.COM ');
      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe('john.doe@example.com');
    });

    it('should fail for a malformed email', () => {
      const result = EmailAddress.create('not-an-email');
      expect(result.isFailure).toBe(true);
    });

    it('should fail for empty input', () => {
      const result = EmailAddress.create('   ');
      expect(result.isFailure).toBe(true);
    });

    it('should fail when exceeding the max length', () => {
      const long = `${'a'.repeat(250)}@b.com`;
      const result = EmailAddress.create(long);
      expect(result.isFailure).toBe(true);
    });
  });

  describe('equals()', () => {
    it('should be equal regardless of original casing', () => {
      const a = EmailAddress.create('A@B.com').value;
      const b = EmailAddress.create('a@b.com').value;
      expect(a.equals(b)).toBe(true);
    });
  });
});
