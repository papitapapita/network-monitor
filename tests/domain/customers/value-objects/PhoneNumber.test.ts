// Source: src/domain/customers/value-objects/PhoneNumber.ts

import { describe, it, expect } from '@jest/globals';
import { PhoneNumber } from '../../../../src/domain/customers';

describe('PhoneNumber', () => {
  describe('create()', () => {
    it('should succeed for a plain national number', () => {
      const result = PhoneNumber.create('3001234567');
      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe('3001234567');
    });

    it('should strip spaces, dashes and parentheses', () => {
      const result = PhoneNumber.create('(300) 123-45 67');
      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe('3001234567');
    });

    it('should preserve a leading + country code', () => {
      const result = PhoneNumber.create('+57 300 123 4567');
      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe('+573001234567');
    });

    it('should fail for null', () => {
      const result = PhoneNumber.create(null as unknown as string);
      expect(result.isFailure).toBe(true);
    });

    it('should fail when there are no digits', () => {
      const result = PhoneNumber.create('abc');
      expect(result.isFailure).toBe(true);
    });

    it('should fail when below the minimum digit count', () => {
      const result = PhoneNumber.create('12345');
      expect(result.isFailure).toBe(true);
    });

    it('should fail when above the maximum digit count', () => {
      const result = PhoneNumber.create('1234567890123456');
      expect(result.isFailure).toBe(true);
    });
  });

  describe('equals()', () => {
    it('should be equal for the same normalized value', () => {
      const a = PhoneNumber.create('300 123 4567').value;
      const b = PhoneNumber.create('3001234567').value;
      expect(a.equals(b)).toBe(true);
    });

    it('should not be equal for different values', () => {
      const a = PhoneNumber.create('3001234567').value;
      const b = PhoneNumber.create('3009999999').value;
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('reconstitute()', () => {
    it('should not validate', () => {
      const phone = PhoneNumber.reconstitute('xx');
      expect(phone.value).toBe('xx');
    });
  });
});
