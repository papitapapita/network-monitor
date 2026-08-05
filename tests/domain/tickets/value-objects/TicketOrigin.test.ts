// Source: src/domain/tickets/value-objects/TicketOrigin.ts

import { describe, it, expect } from '@jest/globals';
import { TicketOrigin } from '../../../../src/domain/tickets';

describe('TicketOrigin', () => {
  it.each([
    TicketOrigin.MANUAL,
    TicketOrigin.DEVICE_ALERT,
    TicketOrigin.WIRELESS_ALERT
  ])('should accept %s', (origin) => {
    expect(TicketOrigin.create(origin).isSuccess).toBe(true);
  });

  it('should reject an unknown origin', () => {
    const result = TicketOrigin.create('IMPORTED');

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid ticket origin');
  });

  it('[TKT-112] should report MANUAL as not coming from an alert', () => {
    const origin = TicketOrigin.reconstitute(TicketOrigin.MANUAL);

    expect(origin.isManual()).toBe(true);
    expect(origin.isFromAlert()).toBe(false);
  });

  it.each([TicketOrigin.DEVICE_ALERT, TicketOrigin.WIRELESS_ALERT])(
    '[TKT-110] should report %s as coming from an alert',
    (value) => {
      expect(TicketOrigin.reconstitute(value).isFromAlert()).toBe(
        true
      );
    }
  );
});
