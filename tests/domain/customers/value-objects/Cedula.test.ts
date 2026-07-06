// Source: src/domain/customers/value-objects/Cedula.ts

import { describe, it, expect } from '@jest/globals';
import { Cedula } from '../../../../src/domain/customers';

describe('Cedula', () => {
  describe('create()', () => {
    it('should succeed for a valid numeric id', () => {
      const result = Cedula.create('1036612345');
      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe('1036612345');
    });

    it('should strip dots and whitespace', () => {
      const result = Cedula.create(' 1.036.612 ');
      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe('1036612');
    });

    it('should fail for non-numeric characters', () => {
      const result = Cedula.create('10A36612');
      expect(result.isFailure).toBe(true);
    });

    it('should fail when too short', () => {
      const result = Cedula.create('12345');
      expect(result.isFailure).toBe(true);
    });

    it('should fail when too long', () => {
      const result = Cedula.create('12345678901');
      expect(result.isFailure).toBe(true);
    });

    it('should fail for empty input', () => {
      const result = Cedula.create('   ');
      expect(result.isFailure).toBe(true);
    });
  });

  describe('equals()', () => {
    it('should be equal for the same normalized value', () => {
      const a = Cedula.create('1.036.612').value;
      const b = Cedula.create('1036612').value;
      expect(a.equals(b)).toBe(true);
    });
  });
});
