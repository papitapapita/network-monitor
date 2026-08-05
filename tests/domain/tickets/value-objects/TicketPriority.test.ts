// Source: src/domain/tickets/value-objects/TicketPriority.ts

import { describe, it, expect } from '@jest/globals';
import { TicketPriority } from '../../../../src/domain/tickets';

describe('TicketPriority', () => {
  describe('create()', () => {
    it.each([
      TicketPriority.LOW,
      TicketPriority.NORMAL,
      TicketPriority.HIGH,
      TicketPriority.URGENT
    ])('should accept %s', (priority) => {
      expect(TicketPriority.create(priority).isSuccess).toBe(true);
    });

    it('should normalize case and whitespace', () => {
      const result = TicketPriority.create(' urgent ');

      expect(result.value.value).toBe(TicketPriority.URGENT);
    });

    it('should reject an unknown priority', () => {
      const result = TicketPriority.create('CATASTROPHIC');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid ticket priority');
    });
  });

  describe('rank', () => {
    it('[TKT-076] should sort URGENT ahead of every other priority', () => {
      const ranks = [
        TicketPriority.LOW,
        TicketPriority.NORMAL,
        TicketPriority.HIGH,
        TicketPriority.URGENT
      ]
        .map((p) => TicketPriority.reconstitute(p))
        .sort((a, b) => a.rank - b.rank)
        .map((p) => p.value);

      expect(ranks).toEqual([
        TicketPriority.URGENT,
        TicketPriority.HIGH,
        TicketPriority.NORMAL,
        TicketPriority.LOW
      ]);
    });
  });
});
