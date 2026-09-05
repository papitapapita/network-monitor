// Source: src/domain/shared/value-objects/Money.ts

import { describe, it, expect } from '@jest/globals';
import { Money } from '../../../../src/domain/shared/value-objects';

describe('Money', () => {
  describe('create()', () => {
    it('should convert a whole-currency amount to integer cents', () => {
      const result = Money.create(12);
      expect(result.isSuccess).toBe(true);
      expect(result.value.cents).toBe(1200);
    });

    it('should round a two-decimal amount to exact cents', () => {
      const result = Money.create(19.99);
      expect(result.isSuccess).toBe(true);
      expect(result.value.cents).toBe(1999);
    });

    it('should round amounts that would otherwise drift under raw float math', () => {
      // 19.999 * 100 === 1999.9000000000003 in raw float arithmetic;
      // Math.round pins it to the nearest cent.
      const result = Money.create(19.999);
      expect(result.isSuccess).toBe(true);
      expect(result.value.cents).toBe(2000);
    });

    it('should accept zero', () => {
      const result = Money.create(0);
      expect(result.isSuccess).toBe(true);
      expect(result.value.cents).toBe(0);
    });

    it('should fail for a negative amount', () => {
      const result = Money.create(-5);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('cannot be negative');
    });

    it('should fail for NaN', () => {
      const result = Money.create(NaN);
      expect(result.isFailure).toBe(true);
    });

    it('should fail for Infinity', () => {
      const result = Money.create(Infinity);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('finite number');
    });

    it('should fail for -Infinity', () => {
      const result = Money.create(-Infinity);
      expect(result.isFailure).toBe(true);
    });

    it('should fail for null', () => {
      const result = Money.create(null as unknown as number);
      expect(result.isFailure).toBe(true);
    });

    it('should fail for undefined', () => {
      const result = Money.create(undefined as unknown as number);
      expect(result.isFailure).toBe(true);
    });

    it('should fail for a non-number value', () => {
      const result = Money.create('12.50' as unknown as number);
      expect(result.isFailure).toBe(true);
    });
  });

  describe('fromCents()', () => {
    it('should create Money from a non-negative integer cents value', () => {
      const result = Money.fromCents(1250);
      expect(result.isSuccess).toBe(true);
      expect(result.value.cents).toBe(1250);
    });

    it('should accept zero cents', () => {
      const result = Money.fromCents(0);
      expect(result.isSuccess).toBe(true);
      expect(result.value.cents).toBe(0);
    });

    it('should fail for a non-integer cents value', () => {
      const result = Money.fromCents(100.5);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('integer');
    });

    it('should fail for a negative cents value', () => {
      const result = Money.fromCents(-100);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('cannot be negative');
    });

    it('should fail for NaN', () => {
      const result = Money.fromCents(NaN);
      expect(result.isFailure).toBe(true);
    });

    it('should fail for Infinity', () => {
      const result = Money.fromCents(Infinity);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('integer');
    });

    it('should fail for null', () => {
      const result = Money.fromCents(null as unknown as number);
      expect(result.isFailure).toBe(true);
    });

    it('should fail for undefined', () => {
      const result = Money.fromCents(undefined as unknown as number);
      expect(result.isFailure).toBe(true);
    });
  });

  describe('zero()', () => {
    it('should return Money with zero cents', () => {
      expect(Money.zero().cents).toBe(0);
    });
  });

  describe('add()', () => {
    it('should add two amounts without floating point drift', () => {
      // 0.1 + 0.2 === 0.30000000000000004 in raw float arithmetic;
      // cents-based addition must land exactly on 0.3.
      const a = Money.create(0.1).value;
      const b = Money.create(0.2).value;
      const sum = a.add(b);
      expect(sum.cents).toBe(30);
      expect(sum.toNumber()).toBe(0.3);
    });

    it('should stay exact when summing many amounts that drift under raw floats', () => {
      let total = Money.zero();
      for (let i = 0; i < 10; i++) {
        total = total.add(Money.create(0.1).value);
      }
      expect(total.cents).toBe(100);
      expect(total.toNumber()).toBe(1);
    });

    it('should not mutate either operand', () => {
      const a = Money.create(10).value;
      const b = Money.create(5).value;
      a.add(b);
      expect(a.cents).toBe(1000);
      expect(b.cents).toBe(500);
    });

    it('should return a new Money instance', () => {
      const a = Money.zero();
      const b = Money.create(1).value;
      expect(a.add(b)).not.toBe(a);
      expect(a.add(b)).not.toBe(b);
    });
  });

  describe('multiply()', () => {
    it('should scale cents by an integer factor', () => {
      const unitPrice = Money.create(19.99).value;
      expect(unitPrice.multiply(3).cents).toBe(5997);
    });

    it('should return zero when multiplied by zero', () => {
      const price = Money.create(10).value;
      expect(price.multiply(0).cents).toBe(0);
    });

    it('should not mutate the original instance', () => {
      const price = Money.create(10).value;
      price.multiply(4);
      expect(price.cents).toBe(1000);
    });

    it('should return a new Money instance', () => {
      const price = Money.create(10).value;
      expect(price.multiply(2)).not.toBe(price);
    });
  });

  describe('toNumber()', () => {
    it('should convert cents back to a decimal amount', () => {
      expect(Money.create(1250.5).value.toNumber()).toBe(1250.5);
    });

    it('should return 0 for zero', () => {
      expect(Money.zero().toNumber()).toBe(0);
    });
  });

  describe('format()', () => {
    it('should format with two decimal places', () => {
      expect(Money.create(1250.5).value.format()).toBe('1250.50');
    });

    it('should format zero as "0.00"', () => {
      expect(Money.zero().format()).toBe('0.00');
    });

    it('should format sub-dollar amounts with a leading zero', () => {
      expect(Money.create(0.5).value.format()).toBe('0.50');
    });
  });

  describe('equals()', () => {
    it('should be equal for the same cents value', () => {
      const a = Money.create(19.99).value;
      const b = Money.fromCents(1999).value;
      expect(a.equals(b)).toBe(true);
    });

    it('should not be equal for different cents values', () => {
      const a = Money.create(19.99).value;
      const b = Money.create(20).value;
      expect(a.equals(b)).toBe(false);
    });

    it('should return false when compared to undefined', () => {
      const a = Money.zero();
      expect(a.equals(undefined)).toBe(false);
    });
  });
});
