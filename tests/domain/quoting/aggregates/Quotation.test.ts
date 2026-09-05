// Source: src/domain/quoting/aggregates/Quotation.ts

import { describe, it, expect } from '@jest/globals';
import {
  Quotation,
  QuotationStatus,
  QuotationLineItem,
  QuotationCreatedEvent,
  QuotationSentEvent,
  QuotationAcceptedEvent,
  QuotationRejectedEvent,
  QuotationExpiredEvent
} from '../../../../src/domain/quoting';
import {
  QuotationId,
  DeviceModelId
} from '../../../../src/domain/shared/ids';
import { Money } from '../../../../src/domain/shared/value-objects';

const CREATED_AT = new Date('2024-03-01T00:00:00.000Z');
const VALID_UNTIL = new Date('2024-04-01T00:00:00.000Z');
const BEFORE_VALID_UNTIL = new Date('2024-03-15T00:00:00.000Z');
const AFTER_VALID_UNTIL = new Date('2024-04-15T00:00:00.000Z');

function makeLineItem(
  overrides: Record<string, unknown> = {}
): QuotationLineItem {
  return QuotationLineItem.create({
    deviceModelId: DeviceModelId.create(),
    deviceModelName: 'LiteBeam 5AC',
    vendorName: 'Ubiquiti',
    deviceType: 'ANTENNA',
    imageUrl: null,
    description: 'LiteBeam 5AC antenna, roof-mounted',
    unitPrice: Money.create(89.99).value,
    quantity: 1,
    ...overrides
  }).value;
}

function validProps(overrides: Record<string, unknown> = {}) {
  return {
    customerId: null,
    customerName: 'Jane Prospect',
    customerPhone: null,
    customerEmail: null,
    customerAddress: null,
    lineItems: [makeLineItem()],
    validUntil: VALID_UNTIL,
    notes: null,
    createdBy: null,
    ...overrides
  };
}

function reconstituteQuotation(
  status: QuotationStatus,
  overrides: Record<string, unknown> = {}
): Quotation {
  return Quotation.reconstitute(QuotationId.create(), {
    code: 1,
    status,
    customerId: null,
    customerName: 'Jane Prospect',
    customerPhone: null,
    customerEmail: null,
    customerAddress: null,
    lineItems: [makeLineItem()],
    validUntil: VALID_UNTIL,
    notes: null,
    sentAt: status !== QuotationStatus.DRAFT ? CREATED_AT : null,
    acceptedAt:
      status === QuotationStatus.ACCEPTED ? CREATED_AT : null,
    rejectedAt:
      status === QuotationStatus.REJECTED ? CREATED_AT : null,
    rejectionReason:
      status === QuotationStatus.REJECTED ? 'Too expensive' : null,
    expiredAt: status === QuotationStatus.EXPIRED ? CREATED_AT : null,
    createdBy: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides
  });
}

describe('Quotation', () => {
  describe('create()', () => {
    it('should fail with an empty lineItems array', () => {
      const result = Quotation.create(validProps({ lineItems: [] }));
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('at least one line item');
    });

    it('should fail when customerName is empty', () => {
      const result = Quotation.create(
        validProps({ customerName: '   ' })
      );
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('empty');
    });

    it('should fail when customerName exceeds 150 characters', () => {
      const result = Quotation.create(
        validProps({ customerName: 'A'.repeat(151) })
      );
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('150');
    });

    it('should default to DRAFT status', () => {
      const quotation = Quotation.create(validProps()).value;
      expect(quotation.status).toBe(QuotationStatus.DRAFT);
    });

    it('should default code to null', () => {
      const quotation = Quotation.create(validProps()).value;
      expect(quotation.code).toBeNull();
    });

    it('should default every transition date and rejectionReason to null', () => {
      const quotation = Quotation.create(validProps()).value;
      expect(quotation.sentAt).toBeNull();
      expect(quotation.acceptedAt).toBeNull();
      expect(quotation.rejectedAt).toBeNull();
      expect(quotation.rejectionReason).toBeNull();
      expect(quotation.expiredAt).toBeNull();
    });

    it('should emit a QuotationCreatedEvent', () => {
      const quotation = Quotation.create(validProps()).value;
      expect(quotation.domainEvents).toHaveLength(1);
      expect(quotation.domainEvents[0]).toBeInstanceOf(
        QuotationCreatedEvent
      );
    });

    it('should compute total as the exact cent-accurate sum of line items', () => {
      const quotation = Quotation.create(
        validProps({
          lineItems: [
            makeLineItem({
              unitPrice: Money.create(19.99).value,
              quantity: 2
            }),
            makeLineItem({
              unitPrice: Money.create(39.99).value,
              quantity: 1
            })
          ]
        })
      ).value;

      // (19.99 * 2) + 39.99 = 79.97, exact at the cent level.
      expect(quotation.total.cents).toBe(7997);
      expect(quotation.subtotal.cents).toBe(7997);
    });

    it('should succeed with valid props', () => {
      const result = Quotation.create(validProps());
      expect(result.isSuccess).toBe(true);
    });
  });

  describe('replaceLineItems()', () => {
    it('should succeed from DRAFT and update the line items', () => {
      const quotation = reconstituteQuotation(QuotationStatus.DRAFT);
      const newItem = makeLineItem({ description: 'New camera' });

      const result = quotation.replaceLineItems([newItem]);

      expect(result.isSuccess).toBe(true);
      expect(quotation.lineItems).toHaveLength(1);
      expect(quotation.lineItems[0].description).toBe('New camera');
    });

    it('should fail with an empty array', () => {
      const quotation = reconstituteQuotation(QuotationStatus.DRAFT);
      const result = quotation.replaceLineItems([]);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('at least one line item');
    });

    it('should fail from SENT', () => {
      const quotation = reconstituteQuotation(QuotationStatus.SENT);
      const result = quotation.replaceLineItems([makeLineItem()]);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Cannot modify line items of a sent quotation'
      );
    });

    it('should fail from ACCEPTED', () => {
      const quotation = reconstituteQuotation(
        QuotationStatus.ACCEPTED
      );
      const result = quotation.replaceLineItems([makeLineItem()]);
      expect(result.isFailure).toBe(true);
    });

    it('should not emit any domain event', () => {
      const quotation = reconstituteQuotation(QuotationStatus.DRAFT);
      quotation.clearEvents();
      quotation.replaceLineItems([makeLineItem()]);
      expect(quotation.domainEvents).toHaveLength(0);
    });
  });

  describe('updateDetails()', () => {
    it('should succeed from DRAFT and update the given fields', () => {
      const quotation = reconstituteQuotation(QuotationStatus.DRAFT);
      const newValidUntil = new Date('2024-05-01T00:00:00.000Z');

      const result = quotation.updateDetails({
        customerName: 'John Buyer',
        validUntil: newValidUntil,
        notes: 'Includes installation'
      });

      expect(result.isSuccess).toBe(true);
      expect(quotation.customerName).toBe('John Buyer');
      expect(quotation.validUntil).toEqual(newValidUntil);
      expect(quotation.notes).toBe('Includes installation');
    });

    it('should leave fields not provided unchanged', () => {
      const quotation = reconstituteQuotation(QuotationStatus.DRAFT, {
        customerPhone: '555-1234'
      });

      quotation.updateDetails({ customerName: 'John Buyer' });

      expect(quotation.customerPhone).toBe('555-1234');
    });

    it('should fail when customerName becomes empty', () => {
      const quotation = reconstituteQuotation(QuotationStatus.DRAFT);
      const result = quotation.updateDetails({ customerName: '   ' });
      expect(result.isFailure).toBe(true);
    });

    it('should fail from SENT', () => {
      const quotation = reconstituteQuotation(QuotationStatus.SENT);
      const result = quotation.updateDetails({
        customerName: 'John Buyer'
      });
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Cannot update details of a sent quotation'
      );
    });
  });

  describe('send()', () => {
    it('should succeed from DRAFT, set sentAt, and emit QuotationSentEvent', () => {
      const quotation = reconstituteQuotation(QuotationStatus.DRAFT);
      quotation.clearEvents();

      const result = quotation.send();

      expect(result.isSuccess).toBe(true);
      expect(quotation.status).toBe(QuotationStatus.SENT);
      expect(quotation.sentAt).not.toBeNull();
      expect(quotation.domainEvents[0]).toBeInstanceOf(
        QuotationSentEvent
      );
    });

    it('should fail from SENT (already sent)', () => {
      const quotation = reconstituteQuotation(QuotationStatus.SENT);
      const result = quotation.send();
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Cannot send a SENT quotation');
    });

    it('should fail from ACCEPTED', () => {
      const quotation = reconstituteQuotation(
        QuotationStatus.ACCEPTED
      );
      const result = quotation.send();
      expect(result.isFailure).toBe(true);
    });

    it('should fail from REJECTED', () => {
      const quotation = reconstituteQuotation(
        QuotationStatus.REJECTED
      );
      const result = quotation.send();
      expect(result.isFailure).toBe(true);
    });

    it('should fail from EXPIRED', () => {
      const quotation = reconstituteQuotation(
        QuotationStatus.EXPIRED
      );
      const result = quotation.send();
      expect(result.isFailure).toBe(true);
    });
  });

  describe('accept()', () => {
    it('should succeed from SENT, set acceptedAt, and emit QuotationAcceptedEvent', () => {
      const quotation = reconstituteQuotation(QuotationStatus.SENT);
      quotation.clearEvents();

      const result = quotation.accept();

      expect(result.isSuccess).toBe(true);
      expect(quotation.status).toBe(QuotationStatus.ACCEPTED);
      expect(quotation.acceptedAt).not.toBeNull();
      expect(quotation.domainEvents[0]).toBeInstanceOf(
        QuotationAcceptedEvent
      );
    });

    it('should fail from DRAFT (not sent yet)', () => {
      const quotation = reconstituteQuotation(QuotationStatus.DRAFT);
      const result = quotation.accept();
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Cannot accept a DRAFT quotation'
      );
    });

    it('should fail from ACCEPTED (terminal)', () => {
      const quotation = reconstituteQuotation(
        QuotationStatus.ACCEPTED
      );
      const result = quotation.accept();
      expect(result.isFailure).toBe(true);
    });
  });

  describe('reject()', () => {
    it('should succeed from SENT with a reason, and emit QuotationRejectedEvent', () => {
      const quotation = reconstituteQuotation(QuotationStatus.SENT);
      quotation.clearEvents();

      const result = quotation.reject('Too expensive');

      expect(result.isSuccess).toBe(true);
      expect(quotation.status).toBe(QuotationStatus.REJECTED);
      expect(quotation.rejectedAt).not.toBeNull();
      expect(quotation.rejectionReason).toBe('Too expensive');
      expect(quotation.domainEvents[0]).toBeInstanceOf(
        QuotationRejectedEvent
      );
    });

    it('should fail when reason is empty', () => {
      const quotation = reconstituteQuotation(QuotationStatus.SENT);
      const result = quotation.reject('   ');
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('reason is required');
    });

    it('should fail when reason exceeds 255 characters', () => {
      const quotation = reconstituteQuotation(QuotationStatus.SENT);
      const result = quotation.reject('A'.repeat(256));
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('255');
    });

    it('should fail from DRAFT', () => {
      const quotation = reconstituteQuotation(QuotationStatus.DRAFT);
      const result = quotation.reject('Too expensive');
      expect(result.isFailure).toBe(true);
    });

    it('should fail from a terminal status', () => {
      const quotation = reconstituteQuotation(
        QuotationStatus.ACCEPTED
      );
      const result = quotation.reject('Too expensive');
      expect(result.isFailure).toBe(true);
    });
  });

  describe('markExpired()', () => {
    it('should succeed from SENT when now is past validUntil', () => {
      const quotation = reconstituteQuotation(QuotationStatus.SENT);
      quotation.clearEvents();

      const result = quotation.markExpired(AFTER_VALID_UNTIL);

      expect(result.isSuccess).toBe(true);
      expect(quotation.status).toBe(QuotationStatus.EXPIRED);
      expect(quotation.expiredAt).not.toBeNull();
      expect(quotation.domainEvents[0]).toBeInstanceOf(
        QuotationExpiredEvent
      );
    });

    it('should fail from SENT when now is before validUntil', () => {
      const quotation = reconstituteQuotation(QuotationStatus.SENT);
      const result = quotation.markExpired(BEFORE_VALID_UNTIL);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not past its validity date');
    });

    it('should fail from DRAFT', () => {
      const quotation = reconstituteQuotation(QuotationStatus.DRAFT);
      const result = quotation.markExpired(AFTER_VALID_UNTIL);
      expect(result.isFailure).toBe(true);
    });

    it('should fail from ACCEPTED', () => {
      const quotation = reconstituteQuotation(
        QuotationStatus.ACCEPTED
      );
      const result = quotation.markExpired(AFTER_VALID_UNTIL);
      expect(result.isFailure).toBe(true);
    });
  });

  describe('isTerminal()', () => {
    it('should return false for DRAFT', () => {
      expect(
        reconstituteQuotation(QuotationStatus.DRAFT).isTerminal()
      ).toBe(false);
    });

    it('should return false for SENT', () => {
      expect(
        reconstituteQuotation(QuotationStatus.SENT).isTerminal()
      ).toBe(false);
    });

    it('should return true for ACCEPTED', () => {
      expect(
        reconstituteQuotation(QuotationStatus.ACCEPTED).isTerminal()
      ).toBe(true);
    });

    it('should return true for REJECTED', () => {
      expect(
        reconstituteQuotation(QuotationStatus.REJECTED).isTerminal()
      ).toBe(true);
    });

    it('should return true for EXPIRED', () => {
      expect(
        reconstituteQuotation(QuotationStatus.EXPIRED).isTerminal()
      ).toBe(true);
    });
  });
});
