// Source: src/domain/customers/value-objects/PaymentDay.ts

import { describe, it, expect } from '@jest/globals';
import { PaymentDay } from '../../../../src/domain/customers';

describe('PaymentDay', () => {
  describe('create()', () => {
    it.each([15, 30])('should accept %i', (day) => {
      const result = PaymentDay.create(day);
      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe(day);
    });

    it.each([0, 1, 14, 16, 28, 31, 15.5, -15])(
      'should reject %p',
      (day) => {
        const result = PaymentDay.create(day);
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(
          'Payment day must be one of 15, 30'
        );
      }
    );

    it('should reject a non-number', () => {
      const result = PaymentDay.create('15' as unknown as number);
      expect(result.isFailure).toBe(true);
    });

    it('should reject a missing value', () => {
      const result = PaymentDay.create(
        undefined as unknown as number
      );
      expect(result.isFailure).toBe(true);
    });
  });

  describe('default()', () => {
    it('should be the 30th', () => {
      expect(PaymentDay.default().value).toBe(30);
    });
  });

  it('should compare by value', () => {
    expect(
      PaymentDay.create(15).value.equals(PaymentDay.reconstitute(15))
    ).toBe(true);
    expect(
      PaymentDay.create(15).value.equals(PaymentDay.default())
    ).toBe(false);
  });
});
