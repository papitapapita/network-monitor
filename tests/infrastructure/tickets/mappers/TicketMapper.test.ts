// Source: src/infrastructure/tickets/mappers/TicketMapper.ts

import { describe, it, expect } from '@jest/globals';
import { TicketMapper } from '../../../../src/infrastructure/tickets/mappers';
import {
  Ticket,
  TicketPriority,
  TicketCategory,
  TicketOrigin,
  TicketStatus,
  ServiceAddress,
  TimeBlock
} from '../../../../src/domain/tickets';
import {
  CustomerId,
  DeviceId
} from '../../../../src/domain/shared/ids';

const TICKET_UUID = 'c5228bee-15a8-420c-a5ca-39d209f944e5';
const NOW = new Date('2026-08-04T12:00:00.000Z');

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TICKET_UUID,
    code: 42,
    status: 'OPEN',
    priority: 'HIGH',
    category: 'CONNECTIVITY',
    title: 'No internet',
    description: 'Link down',
    customerId: null,
    deviceId: DeviceId.create().toString(),
    technicianId: null,
    addressStreet: null,
    addressMunicipality: null,
    addressNeighborhood: null,
    addressReference: null,
    latitude: null,
    longitude: null,
    contactName: null,
    contactPhone: null,
    scheduledFor: null,
    scheduledStartTime: null,
    scheduledEndTime: null,
    origin: 'MANUAL',
    originAlertId: null,
    resolutionNotes: null,
    cancelReason: null,
    createdBy: null,
    assignedAt: null,
    startedAt: null,
    resolvedAt: null,
    cancelledAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  } as Parameters<typeof TicketMapper.toDomain>[0];
}

describe('TicketMapper (infrastructure)', () => {
  describe('toDomain()', () => {
    it('reconstitutes a ticket from a row', () => {
      const result = TicketMapper.toDomain(makeRow());

      expect(result.isSuccess).toBe(true);
      expect(result.value.id.toString()).toBe(TICKET_UUID);
      expect(result.value.code).toBe(42);
      expect(result.value.status.value).toBe(TicketStatus.OPEN);
      expect(result.value.priority.value).toBe(TicketPriority.HIGH);
    });

    it('rebuilds the contact from its columns', () => {
      const result = TicketMapper.toDomain(
        makeRow({
          contactName: 'Luis Prospecto',
          contactPhone: '3005551234'
        })
      );

      expect(result.value.contact!.name).toBe('Luis Prospecto');
      expect(result.value.contact!.phone!.toString()).toBe(
        '3005551234'
      );
    });

    it('rebuilds a contact with no phone', () => {
      const result = TicketMapper.toDomain(
        makeRow({ contactName: 'Luis Prospecto' })
      );

      expect(result.value.contact!.phone).toBeNull();
    });

    it('leaves the contact null when there is no name', () => {
      expect(
        TicketMapper.toDomain(makeRow()).value.contact
      ).toBeNull();
    });

    it('leaves the time block null when the times are absent', () => {
      const result = TicketMapper.toDomain(makeRow());

      expect(result.value.timeBlock).toBeNull();
    });

    it('rebuilds the time block from its HH:mm columns', () => {
      const result = TicketMapper.toDomain(
        makeRow({
          scheduledFor: new Date('2026-08-04T00:00:00.000Z'),
          scheduledStartTime: '09:30',
          scheduledEndTime: '11:00'
        })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.timeBlock!.toString()).toBe('09:30-11:00');
    });

    it('fails on a corrupt time block instead of dropping it', () => {
      const result = TicketMapper.toDomain(
        makeRow({
          scheduledFor: new Date('2026-08-04T00:00:00.000Z'),
          scheduledStartTime: '11:00',
          scheduledEndTime: '09:30'
        })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid ticket time block');
    });

    it('bypasses aggregate validation so a legacy row still loads', () => {
      // Neither link set — Ticket.create would refuse this, reconstitute must not.
      const result = TicketMapper.toDomain(
        makeRow({ customerId: null, deviceId: null })
      );

      expect(result.isSuccess).toBe(true);
    });

    it('converts Decimal coordinates to numbers', () => {
      const result = TicketMapper.toDomain(
        makeRow({
          addressStreet: 'Calle 5',
          addressMunicipality: 'Popayán',
          addressNeighborhood: 'Centro',
          latitude: { toNumber: () => 2.4448 },
          longitude: { toNumber: () => -76.6147 }
        })
      );

      expect(result.value.address!.latitude).toBeCloseTo(2.4448);
      expect(result.value.address!.longitude).toBeCloseTo(-76.6147);
    });

    it('leaves the address null when the parts are absent', () => {
      expect(
        TicketMapper.toDomain(makeRow()).value.address
      ).toBeNull();
    });

    it('leaves the address null when a part is missing', () => {
      const result = TicketMapper.toDomain(
        makeRow({
          addressStreet: 'Calle 5',
          addressMunicipality: null,
          addressNeighborhood: 'Centro'
        })
      );

      expect(result.value.address).toBeNull();
    });

    it('fails on a malformed ticket id', () => {
      const result = TicketMapper.toDomain(makeRow({ id: 'nope' }));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid ticket ID');
    });

    it('fails on a malformed customer id', () => {
      const result = TicketMapper.toDomain(
        makeRow({ customerId: 'nope' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid ticket customer ID');
    });

    it('fails on a malformed technician id', () => {
      const result = TicketMapper.toDomain(
        makeRow({ technicianId: 'nope' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid ticket technician ID');
    });

    it.each([
      ['status', 'TicketStatus'],
      ['priority', 'TicketPriority'],
      ['category', 'TicketCategory'],
      ['origin', 'TicketOrigin']
    ])(
      'throws a data integrity error on an unrecognised %s',
      (column, typeName) => {
        expect(() =>
          TicketMapper.toDomain(makeRow({ [column]: 'GARBAGE' }))
        ).toThrow(
          new RegExp(
            `Data integrity violation: unrecognised ${typeName}`
          )
        );
      }
    );
  });

  describe('toPersistence()', () => {
    function makeTicket(overrides: Record<string, unknown> = {}) {
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

    it('omits the code so the database sequence owns it', () => {
      const data = TicketMapper.toPersistence(makeTicket());

      expect(data).not.toHaveProperty('code');
    });

    it('flattens ids to strings', () => {
      const ticket = makeTicket();

      const data = TicketMapper.toPersistence(ticket);

      expect(data.id).toBe(ticket.id.toString());
      expect(data.customerId).toBe(ticket.customerId!.toString());
      expect(data.technicianId).toBeNull();
    });

    it('flattens the address into its columns', () => {
      const address = ServiceAddress.create({
        street: 'Calle 5',
        municipality: 'Popayán',
        neighborhood: 'Centro',
        reference: 'Casa azul',
        latitude: 2.4448,
        longitude: -76.6147
      }).value;

      const data = TicketMapper.toPersistence(
        makeTicket({ address })
      );

      expect(data.addressStreet).toBe('Calle 5');
      expect(data.addressMunicipality).toBe('Popayán');
      expect(data.addressNeighborhood).toBe('Centro');
      expect(data.addressReference).toBe('Casa azul');
      expect(data.latitude).toBeCloseTo(2.4448);
    });

    it('nulls every address column when there is no address', () => {
      const data = TicketMapper.toPersistence(makeTicket());

      expect(data.addressStreet).toBeNull();
      expect(data.latitude).toBeNull();
      expect(data.longitude).toBeNull();
    });

    it('writes the time block as HH:mm columns', () => {
      const data = TicketMapper.toPersistence(
        makeTicket({
          scheduledFor: new Date('2026-08-04T00:00:00.000Z'),
          timeBlock: TimeBlock.fromStrings('08:00', '09:45').value
        })
      );

      expect(data.scheduledStartTime).toBe('08:00');
      expect(data.scheduledEndTime).toBe('09:45');
    });

    it('nulls both time columns when there is no block', () => {
      const data = TicketMapper.toPersistence(makeTicket());

      expect(data.scheduledStartTime).toBeNull();
      expect(data.scheduledEndTime).toBeNull();
    });

    it('round-trips through toDomain', () => {
      const original = makeTicket();
      const data = TicketMapper.toPersistence(original);

      const restored = TicketMapper.toDomain({
        ...data,
        code: 1
      } as never);

      expect(restored.isSuccess).toBe(true);
      expect(restored.value.title).toBe(original.title);
      expect(restored.value.status.value).toBe(original.status.value);
      expect(restored.value.customerId!.toString()).toBe(
        original.customerId!.toString()
      );
    });
  });
});
