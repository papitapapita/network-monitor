// Source: src/application/tickets/mappers/TicketMapper.ts

import { describe, it, expect } from '@jest/globals';
import { TicketMapper } from '../../../../src/application/tickets/mappers';
import {
  Ticket,
  TicketPriority,
  TicketCategory,
  TicketOrigin,
  TicketStatus,
  ServiceAddress
} from '../../../../src/domain/tickets';
import {
  CustomerId,
  DeviceId,
  TechnicianId
} from '../../../../src/domain/shared/ids';

function makeTicket(overrides: Record<string, unknown> = {}): Ticket {
  const result = Ticket.create({
    title: 'No internet',
    description: 'Link down',
    priority: TicketPriority.reconstitute(TicketPriority.HIGH),
    category: TicketCategory.reconstitute(
      TicketCategory.CONNECTIVITY
    ),
    origin: TicketOrigin.reconstitute(TicketOrigin.MANUAL),
    originAlertId: null,
    customerId: CustomerId.create(),
    deviceId: DeviceId.create(),
    address: null,
    scheduledFor: null,
    createdBy: null,
    ...overrides
  } as Parameters<typeof Ticket.create>[0]);
  if (result.isFailure) throw new Error(result.error);
  return result.value;
}

describe('TicketMapper (application)', () => {
  describe('toDTO()', () => {
    it('renders ids as strings and value objects as their primitive', () => {
      const ticket = makeTicket();

      const dto = TicketMapper.toDTO(ticket);

      expect(dto.id).toBe(ticket.id.toString());
      expect(dto.status).toBe(TicketStatus.OPEN);
      expect(dto.priority).toBe(TicketPriority.HIGH);
      expect(dto.category).toBe(TicketCategory.CONNECTIVITY);
      expect(dto.origin).toBe(TicketOrigin.MANUAL);
    });

    it('renders timestamps as ISO strings', () => {
      const dto = TicketMapper.toDTO(makeTicket());

      expect(dto.createdAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
    });

    it('renders the scheduled visit as a calendar day, not a timestamp', () => {
      const ticket = makeTicket();
      ticket.schedule(new Date('2026-08-04T00:00:00.000Z'));

      expect(TicketMapper.toDTO(ticket).scheduledFor).toBe(
        '2026-08-04'
      );
    });

    it('leaves absent timestamps null', () => {
      const dto = TicketMapper.toDTO(makeTicket());

      expect(dto.assignedAt).toBeNull();
      expect(dto.startedAt).toBeNull();
      expect(dto.resolvedAt).toBeNull();
      expect(dto.cancelledAt).toBeNull();
      expect(dto.scheduledFor).toBeNull();
    });

    it('flattens the address snapshot', () => {
      const address = ServiceAddress.create({
        street: 'Calle 5',
        municipality: 'Popayán',
        neighborhood: 'Centro',
        latitude: 2.4448,
        longitude: -76.6147
      }).value;
      const ticket = makeTicket({ address });

      const dto = TicketMapper.toDTO(ticket);

      expect(dto.address).toEqual({
        street: 'Calle 5',
        municipality: 'Popayán',
        neighborhood: 'Centro',
        reference: null,
        latitude: 2.4448,
        longitude: -76.6147
      });
    });

    it('renders a null address as null', () => {
      expect(TicketMapper.toDTO(makeTicket()).address).toBeNull();
    });

    it('renders the technician id once the ticket is assigned', () => {
      const ticket = makeTicket();
      const technicianId = TechnicianId.create();
      ticket.assign(technicianId);

      const dto = TicketMapper.toDTO(ticket);

      expect(dto.technicianId).toBe(technicianId.toString());
      expect(dto.assignedAt).not.toBeNull();
    });
  });

  describe('toDetailDTO()', () => {
    it('folds the collaborators onto the flat ticket', () => {
      const contact = {
        id: 'c1',
        fullName: 'Marta',
        phone: '3001',
        email: null
      };

      const dto = TicketMapper.toDetailDTO(
        makeTicket(),
        contact,
        null,
        null
      );

      expect(dto.customer).toBe(contact);
      expect(dto.device).toBeNull();
      expect(dto.technician).toBeNull();
      expect(dto.title).toBe('No internet');
    });
  });

  describe('toListDTO()', () => {
    it('reports hasMore when the page does not reach the total', () => {
      const dto = TicketMapper.toListDTO(
        [makeTicket(), makeTicket()],
        10,
        2,
        0
      );

      expect(dto.tickets).toHaveLength(2);
      expect(dto.total).toBe(10);
      expect(dto.hasMore).toBe(true);
    });

    it('reports hasMore false on the last page', () => {
      const dto = TicketMapper.toListDTO([makeTicket()], 3, 2, 2);

      expect(dto.hasMore).toBe(false);
    });

    it('handles an empty page', () => {
      const dto = TicketMapper.toListDTO([], 0, 20, 0);

      expect(dto.tickets).toEqual([]);
      expect(dto.hasMore).toBe(false);
    });
  });

  describe('toDateOnlyString()', () => {
    it('returns null for a null date', () => {
      expect(TicketMapper.toDateOnlyString(null)).toBeNull();
    });

    it('drops the time component', () => {
      expect(
        TicketMapper.toDateOnlyString(
          new Date('2026-08-04T23:59:59.000Z')
        )
      ).toBe('2026-08-04');
    });
  });
});
