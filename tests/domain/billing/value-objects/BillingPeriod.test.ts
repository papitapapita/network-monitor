// Source: src/domain/billing/value-objects/BillingPeriod.ts

import { describe, it, expect } from '@jest/globals';
import { BillingPeriod } from '../../../../src/domain/billing';

describe('BillingPeriod', () => {
  describe('create()', () => {
    it('should succeed for a valid year and month', () => {
      const result = BillingPeriod.create(2024, 3);
      expect(result.isSuccess).toBe(true);
      expect(result.value.year).toBe(2024);
      expect(result.value.month).toBe(3);
    });

    it('should accept the minimum year bound (2000)', () => {
      const result = BillingPeriod.create(2000, 1);
      expect(result.isSuccess).toBe(true);
    });

    it('should accept the maximum year bound (2100)', () => {
      const result = BillingPeriod.create(2100, 12);
      expect(result.isSuccess).toBe(true);
    });

    it('should fail for a year below the minimum bound', () => {
      const result = BillingPeriod.create(1999, 6);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('year');
    });

    it('should fail for a year above the maximum bound', () => {
      const result = BillingPeriod.create(2101, 6);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('year');
    });

    it('should fail for month 0', () => {
      const result = BillingPeriod.create(2024, 0);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('month');
    });

    it('should fail for month 13', () => {
      const result = BillingPeriod.create(2024, 13);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('month');
    });

    it('should accept month 1 (lower bound)', () => {
      const result = BillingPeriod.create(2024, 1);
      expect(result.isSuccess).toBe(true);
    });

    it('should accept month 12 (upper bound)', () => {
      const result = BillingPeriod.create(2024, 12);
      expect(result.isSuccess).toBe(true);
    });

    it('should fail for a non-integer year', () => {
      const result = BillingPeriod.create(2024.5, 3);
      expect(result.isFailure).toBe(true);
    });

    it('should fail for a non-integer month', () => {
      const result = BillingPeriod.create(2024, 3.5);
      expect(result.isFailure).toBe(true);
    });

    it('should fail for a null year', () => {
      const result = BillingPeriod.create(
        null as unknown as number,
        3
      );
      expect(result.isFailure).toBe(true);
    });

    it('should fail for an undefined month', () => {
      const result = BillingPeriod.create(
        2024,
        undefined as unknown as number
      );
      expect(result.isFailure).toBe(true);
    });
  });

  describe('fromString()', () => {
    it('should parse a valid "YYYY-MM" string', () => {
      const result = BillingPeriod.fromString('2024-03');
      expect(result.isSuccess).toBe(true);
      expect(result.value.year).toBe(2024);
      expect(result.value.month).toBe(3);
    });

    it('should parse December correctly', () => {
      const result = BillingPeriod.fromString('2024-12');
      expect(result.isSuccess).toBe(true);
      expect(result.value.month).toBe(12);
    });

    it('should fail for a missing zero-pad on month', () => {
      const result = BillingPeriod.fromString('2024-3');
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid billing period format');
    });

    it('should fail for a two-digit year', () => {
      const result = BillingPeriod.fromString('24-03');
      expect(result.isFailure).toBe(true);
    });

    it('should fail for a completely malformed string', () => {
      const result = BillingPeriod.fromString('not-a-period');
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid billing period format');
    });

    it('should fail for an empty string', () => {
      const result = BillingPeriod.fromString('');
      expect(result.isFailure).toBe(true);
    });

    it('should fail for a syntactically valid but out-of-range month', () => {
      const result = BillingPeriod.fromString('2024-13');
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('month');
    });

    it('should fail for a syntactically valid but out-of-range year', () => {
      const result = BillingPeriod.fromString('1999-01');
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('year');
    });

    it('should fail for null', () => {
      const result = BillingPeriod.fromString(
        null as unknown as string
      );
      expect(result.isFailure).toBe(true);
    });

    it('should fail for a non-string value', () => {
      const result = BillingPeriod.fromString(
        202403 as unknown as string
      );
      expect(result.isFailure).toBe(true);
    });
  });

  describe('toString()', () => {
    it('should zero-pad single-digit months', () => {
      const period = BillingPeriod.create(2024, 3).value;
      expect(period.toString()).toBe('2024-03');
    });

    it('should not pad two-digit months', () => {
      const period = BillingPeriod.create(2024, 12).value;
      expect(period.toString()).toBe('2024-12');
    });

    it('should round-trip through fromString', () => {
      const period = BillingPeriod.fromString('2000-01').value;
      expect(period.toString()).toBe('2000-01');
    });
  });
});
