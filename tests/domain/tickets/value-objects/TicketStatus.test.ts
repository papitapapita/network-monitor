// Source: src/domain/tickets/value-objects/TicketStatus.ts

import { describe, it, expect } from '@jest/globals';
import { TicketStatus } from '../../../../src/domain/tickets';

describe('TicketStatus', () => {
  describe('create()', () => {
    it.each([
      TicketStatus.OPEN,
      TicketStatus.ASSIGNED,
      TicketStatus.IN_PROGRESS,
      TicketStatus.RESOLVED,
      TicketStatus.CANCELLED
    ])('should accept %s', (status) => {
      expect(TicketStatus.create(status).isSuccess).toBe(true);
    });

    it('should normalize case and whitespace', () => {
      const result = TicketStatus.create('  open  ');

      expect(result.isSuccess).toBe(true);
      expect(result.value.value).toBe(TicketStatus.OPEN);
    });

    it('should reject an unknown status', () => {
      const result = TicketStatus.create('ARCHIVED');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid ticket status');
    });

    it('should reject a null status', () => {
      expect(
        TicketStatus.create(null as unknown as string).isFailure
      ).toBe(true);
    });
  });

  describe('isTerminal()', () => {
    it('[TKT-009] should be true for RESOLVED', () => {
      expect(
        TicketStatus.reconstitute(TicketStatus.RESOLVED).isTerminal()
      ).toBe(true);
    });

    it('[TKT-010] should be true for CANCELLED', () => {
      expect(
        TicketStatus.reconstitute(TicketStatus.CANCELLED).isTerminal()
      ).toBe(true);
    });

    it.each([
      TicketStatus.OPEN,
      TicketStatus.ASSIGNED,
      TicketStatus.IN_PROGRESS
    ])('should be false for %s', (status) => {
      expect(TicketStatus.reconstitute(status).isTerminal()).toBe(
        false
      );
    });
  });
});
