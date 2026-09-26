// Source: src/domain/billing/value-objects/CollectionAccountLineItem.ts

import { describe, it, expect } from '@jest/globals';
import { CollectionAccountLineItem } from '../../../../src/domain/billing';
import { Money } from '../../../../src/domain/shared/value-objects';

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    description: 'Cámara IP 4MP domo exterior',
    unitPrice: Money.create(185000).value,
    quantity: 4,
    ...overrides
  } as Parameters<typeof CollectionAccountLineItem.create>[0];
}

describe('CollectionAccountLineItem', () => {
  describe('create', () => {
    it('[BIL-211] builds a free-text line item and trims the description', () => {
      const result = CollectionAccountLineItem.create(
        makeProps({ description: '  Instalación  ' })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.description).toBe('Instalación');
      expect(result.value.quantity).toBe(4);
    });

    it('[BIL-211] computes lineTotal as unitPrice × quantity', () => {
      const item =
        CollectionAccountLineItem.create(makeProps()).value;

      expect(item.lineTotal.toNumber()).toBe(740000);
    });

    it('[BIL-211] rejects an empty description', () => {
      const result = CollectionAccountLineItem.create(
        makeProps({ description: '   ' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('description cannot be empty');
    });

    it('[BIL-211] rejects a description over 500 characters', () => {
      const result = CollectionAccountLineItem.create(
        makeProps({ description: 'x'.repeat(501) })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/cannot exceed 500/);
    });

    it.each([0, -1, 1.5])(
      '[BIL-211] rejects quantity %p',
      (quantity) => {
        const result = CollectionAccountLineItem.create(
          makeProps({ quantity })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(
          'quantity must be a positive integer'
        );
      }
    );

    it('[BIL-211] rejects a missing unit price', () => {
      const result = CollectionAccountLineItem.create(
        makeProps({ unitPrice: undefined })
      );

      expect(result.isFailure).toBe(true);
    });
  });
});
