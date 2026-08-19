// Source: src/presentation/http/validation/ticket.schemas.ts

import { describe, it, expect } from '@jest/globals';
import {
  createTicketSchema,
  updateTicketSchema,
  getTicketByIdSchema,
  deleteTicketSchema,
  listTicketsSchema,
  technicianDaySchema,
  assignTicketSchema,
  scheduleTicketSchema,
  resolveTicketSchema,
  cancelTicketSchema
} from '../../../../src/presentation/http/validation/ticket.schemas';

const UUID = 'c5228bee-15a8-420c-a5ca-39d209f944e5';
const OTHER_UUID = '550e8400-e29b-41d4-a716-446655440000';

const validBody = {
  title: 'No internet',
  description: 'Link down since 7am',
  category: 'CONNECTIVITY',
  customerId: UUID
};

describe('ticket.schemas', () => {
  describe('createTicketSchema', () => {
    it('accepts a minimal valid body', () => {
      const result = createTicketSchema.safeParse({
        body: validBody
      });

      expect(result.success).toBe(true);
    });

    it('trims the title and description', () => {
      const result = createTicketSchema.parse({
        body: { ...validBody, title: '  Padded  ' }
      });

      expect(result.body.title).toBe('Padded');
    });

    it('[TKT-004] rejects a body with neither a customer nor a device', () => {
      const result = createTicketSchema.safeParse({
        body: {
          title: 'Orphan',
          description: 'Nothing linked',
          category: 'OTHER'
        }
      });

      expect(result.success).toBe(false);
    });

    it('[TKT-004] accepts a device-only body', () => {
      const result = createTicketSchema.safeParse({
        body: {
          title: 'Tower job',
          description: 'Backhaul flapping',
          category: 'MAINTENANCE',
          deviceId: UUID
        }
      });

      expect(result.success).toBe(true);
    });

    it('[TKT-001] rejects an empty title', () => {
      expect(
        createTicketSchema.safeParse({
          body: { ...validBody, title: '   ' }
        }).success
      ).toBe(false);
    });

    it('[TKT-002] rejects a title over 150 characters', () => {
      expect(
        createTicketSchema.safeParse({
          body: { ...validBody, title: 'x'.repeat(151) }
        }).success
      ).toBe(false);
    });

    it('rejects an unknown category', () => {
      expect(
        createTicketSchema.safeParse({
          body: { ...validBody, category: 'SPACESHIP' }
        }).success
      ).toBe(false);
    });

    it('rejects an unknown priority', () => {
      expect(
        createTicketSchema.safeParse({
          body: { ...validBody, priority: 'CATASTROPHIC' }
        }).success
      ).toBe(false);
    });

    it('rejects a non-UUID customer id', () => {
      expect(
        createTicketSchema.safeParse({
          body: { ...validBody, customerId: 'abc' }
        }).success
      ).toBe(false);
    });

    it('accepts a well formed address', () => {
      const result = createTicketSchema.safeParse({
        body: {
          ...validBody,
          address: {
            street: 'Calle 5',
            municipality: 'Popayán',
            neighborhood: 'Centro',
            latitude: 2.4448,
            longitude: -76.6147
          }
        }
      });

      expect(result.success).toBe(true);
    });

    it('rejects an out-of-range latitude', () => {
      expect(
        createTicketSchema.safeParse({
          body: {
            ...validBody,
            address: {
              street: 'Calle 5',
              municipality: 'Popayán',
              neighborhood: 'Centro',
              latitude: 91,
              longitude: 0
            }
          }
        }).success
      ).toBe(false);
    });

    it('rejects a scheduledFor that is not YYYY-MM-DD', () => {
      expect(
        createTicketSchema.safeParse({
          body: { ...validBody, scheduledFor: '04/08/2026' }
        }).success
      ).toBe(false);
    });

    it('accepts a well formed scheduledFor', () => {
      expect(
        createTicketSchema.safeParse({
          body: { ...validBody, scheduledFor: '2026-08-04' }
        }).success
      ).toBe(true);
    });
  });

  describe('updateTicketSchema', () => {
    it('accepts a single field', () => {
      expect(
        updateTicketSchema.safeParse({
          params: { id: UUID },
          body: { title: 'Updated' }
        }).success
      ).toBe(true);
    });

    it('rejects an empty body', () => {
      expect(
        updateTicketSchema.safeParse({
          params: { id: UUID },
          body: {}
        }).success
      ).toBe(false);
    });

    it('rejects a malformed id', () => {
      expect(
        updateTicketSchema.safeParse({
          params: { id: 'nope' },
          body: { title: 'Updated' }
        }).success
      ).toBe(false);
    });
  });

  describe('id-only schemas', () => {
    it.each([
      ['getTicketByIdSchema', getTicketByIdSchema],
      ['deleteTicketSchema', deleteTicketSchema]
    ])(
      '%s accepts a UUID and rejects anything else',
      (_name, schema) => {
        expect(
          schema.safeParse({ params: { id: UUID } }).success
        ).toBe(true);
        expect(
          schema.safeParse({ params: { id: 'not-a-uuid' } }).success
        ).toBe(false);
      }
    );
  });

  describe('listTicketsSchema', () => {
    it('coerces limit and offset to numbers', () => {
      const result = listTicketsSchema.parse({
        query: { limit: '25', offset: '50' }
      });

      expect(result.query.limit).toBe(25);
      expect(result.query.offset).toBe(50);
    });

    it('coerces boolean flags from their string form', () => {
      const result = listTicketsSchema.parse({
        query: { unassignedOnly: 'true', openOnly: 'false' }
      });

      expect(result.query.unassignedOnly).toBe(true);
      expect(result.query.openOnly).toBe(false);
    });

    it('rejects a limit above 100', () => {
      expect(
        listTicketsSchema.safeParse({ query: { limit: '500' } })
          .success
      ).toBe(false);
    });

    it('rejects a non-numeric limit', () => {
      expect(
        listTicketsSchema.safeParse({ query: { limit: 'many' } })
          .success
      ).toBe(false);
    });

    it('rejects an unknown status filter', () => {
      expect(
        listTicketsSchema.safeParse({ query: { status: 'ARCHIVED' } })
          .success
      ).toBe(false);
    });

    it('rejects a malformed date filter', () => {
      expect(
        listTicketsSchema.safeParse({
          query: { scheduledFrom: 'yesterday' }
        }).success
      ).toBe(false);
    });

    it('accepts an empty query', () => {
      expect(listTicketsSchema.safeParse({ query: {} }).success).toBe(
        true
      );
    });
  });

  describe('technicianDaySchema', () => {
    it('requires a technician id', () => {
      expect(
        technicianDaySchema.safeParse({ query: {} }).success
      ).toBe(false);
    });

    it('accepts a technician id with no date', () => {
      expect(
        technicianDaySchema.safeParse({
          query: { technicianId: UUID }
        }).success
      ).toBe(true);
    });

    it('rejects a malformed date', () => {
      expect(
        technicianDaySchema.safeParse({
          query: { technicianId: UUID, date: '4 Aug' }
        }).success
      ).toBe(false);
    });
  });

  describe('action schemas', () => {
    it('assignTicketSchema requires a technician id', () => {
      expect(
        assignTicketSchema.safeParse({
          params: { id: UUID },
          body: {}
        }).success
      ).toBe(false);

      expect(
        assignTicketSchema.safeParse({
          params: { id: UUID },
          body: { technicianId: OTHER_UUID }
        }).success
      ).toBe(true);
    });

    it('scheduleTicketSchema requires scheduledFor but accepts null', () => {
      expect(
        scheduleTicketSchema.safeParse({
          params: { id: UUID },
          body: {}
        }).success
      ).toBe(false);

      expect(
        scheduleTicketSchema.safeParse({
          params: { id: UUID },
          body: { scheduledFor: null }
        }).success
      ).toBe(true);
    });

    it('[TKT-043] resolveTicketSchema requires non-empty notes', () => {
      expect(
        resolveTicketSchema.safeParse({
          params: { id: UUID },
          body: { resolutionNotes: '   ' }
        }).success
      ).toBe(false);

      expect(
        resolveTicketSchema.safeParse({
          params: { id: UUID },
          body: { resolutionNotes: 'Fixed' }
        }).success
      ).toBe(true);
    });

    it('[TKT-044] cancelTicketSchema requires a reason of at most 255 characters', () => {
      expect(
        cancelTicketSchema.safeParse({
          params: { id: UUID },
          body: { reason: '' }
        }).success
      ).toBe(false);

      expect(
        cancelTicketSchema.safeParse({
          params: { id: UUID },
          body: { reason: 'x'.repeat(256) }
        }).success
      ).toBe(false);

      expect(
        cancelTicketSchema.safeParse({
          params: { id: UUID },
          body: { reason: 'Duplicate' }
        }).success
      ).toBe(true);
    });
  });
});
