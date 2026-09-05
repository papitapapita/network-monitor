// Source: src/domain/quoting/value-objects/QuotationLineItem.ts

import { describe, it, expect } from '@jest/globals';
import { QuotationLineItem } from '../../../../src/domain/quoting';
import { DeviceModelId } from '../../../../src/domain/shared/ids';
import { Money } from '../../../../src/domain/shared/value-objects';

function validProps(overrides: Record<string, unknown> = {}) {
  return {
    deviceModelId: DeviceModelId.create(),
    deviceModelName: 'LiteBeam 5AC',
    vendorName: 'Ubiquiti',
    deviceType: 'ANTENNA',
    imageUrl: null,
    description: 'LiteBeam 5AC antenna, roof-mounted',
    unitPrice: Money.create(89.99).value,
    quantity: 1,
    ...overrides
  };
}

describe('QuotationLineItem', () => {
  describe('create()', () => {
    it('should succeed with valid props', () => {
      const result = QuotationLineItem.create(validProps());
      expect(result.isSuccess).toBe(true);
    });

    it('should default deviceModelId to null when omitted', () => {
      const props = validProps();
      delete (props as Partial<typeof props>).deviceModelId;
      const result = QuotationLineItem.create(
        props as ReturnType<typeof validProps>
      );
      expect(result.isSuccess).toBe(true);
      expect(result.value.deviceModelId).toBeNull();
    });

    it('should fail when deviceModelName is empty', () => {
      const result = QuotationLineItem.create(
        validProps({ deviceModelName: '   ' })
      );
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('empty');
    });

    it('should fail when deviceModelName exceeds 150 characters', () => {
      const result = QuotationLineItem.create(
        validProps({ deviceModelName: 'A'.repeat(151) })
      );
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('150');
    });

    it('should fail when description is empty', () => {
      const result = QuotationLineItem.create(
        validProps({ description: '' })
      );
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('empty');
    });

    it('should trim the description', () => {
      const result = QuotationLineItem.create(
        validProps({ description: '  Camera + bracket  ' })
      );
      expect(result.value.description).toBe('Camera + bracket');
    });

    it('should fail when quantity is zero', () => {
      const result = QuotationLineItem.create(
        validProps({ quantity: 0 })
      );
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('positive integer');
    });

    it('should fail when quantity is negative', () => {
      const result = QuotationLineItem.create(
        validProps({ quantity: -1 })
      );
      expect(result.isFailure).toBe(true);
    });

    it('should fail when quantity is not an integer', () => {
      const result = QuotationLineItem.create(
        validProps({ quantity: 1.5 })
      );
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('positive integer');
    });

    it('should fail when unitPrice is missing', () => {
      const result = QuotationLineItem.create(
        validProps({ unitPrice: undefined })
      );
      expect(result.isFailure).toBe(true);
    });

    it('should accept a null imageUrl', () => {
      const result = QuotationLineItem.create(
        validProps({ imageUrl: null })
      );
      expect(result.isSuccess).toBe(true);
      expect(result.value.imageUrl).toBeNull();
    });

    it('should accept a valid imageUrl', () => {
      const result = QuotationLineItem.create(
        validProps({ imageUrl: 'https://example.com/antenna.jpg' })
      );
      expect(result.isSuccess).toBe(true);
      expect(result.value.imageUrl).toBe(
        'https://example.com/antenna.jpg'
      );
    });
  });

  describe('lineTotal', () => {
    it('should multiply unitPrice by quantity', () => {
      const item = QuotationLineItem.create(
        validProps({
          unitPrice: Money.create(19.99).value,
          quantity: 3
        })
      ).value;

      // 19.99 * 3 = 59.97, exact at the cent level.
      expect(item.lineTotal.cents).toBe(5997);
    });

    it('should equal unitPrice when quantity is 1', () => {
      const unitPrice = Money.create(45.5).value;
      const item = QuotationLineItem.create(
        validProps({ unitPrice, quantity: 1 })
      ).value;

      expect(item.lineTotal.cents).toBe(unitPrice.cents);
    });
  });
});
