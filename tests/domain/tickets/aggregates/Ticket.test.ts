// Source: src/domain/tickets/aggregates/Ticket.ts

import { describe, it, expect } from '@jest/globals';
import {
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketOrigin,
  ServiceAddress,
  TicketOpenedEvent,
  TicketAssignedEvent,
  TicketStatusChangedEvent,
  TicketResolvedEvent,
  TicketCancelledEvent
} from '../../../../src/domain/tickets';
import {
  CustomerId,
  DeviceId,
  TechnicianId,
  TicketId
} from '../../../../src/domain/shared/ids';

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    title: 'No internet since this morning',
    description: 'Customer reports the link has been down since 7am.',
    priority: TicketPriority.reconstitute(TicketPriority.NORMAL),
    category: TicketCategory.reconstitute(
      TicketCategory.CONNECTIVITY
    ),
    origin: TicketOrigin.reconstitute(TicketOrigin.MANUAL),
    originAlertId: null,
    customerId: CustomerId.create(),
    deviceId: null,
    address: null,
    scheduledFor: null,
    createdBy: null,
    ...overrides
  } as Parameters<typeof Ticket.create>[0];
}

function makeTicket(overrides: Record<string, unknown> = {}): Ticket {
  const result = Ticket.create(makeProps(overrides));
  if (result.isFailure) {
    throw new Error(`fixture failed: ${result.error}`);
  }
  return result.value;
}

function makeAssignedTicket(): Ticket {
  const ticket = makeTicket();
  ticket.assign(TechnicianId.create());
  ticket.clearEvents();
  return ticket;
}

function makeInProgressTicket(): Ticket {
  const ticket = makeTicket();
  ticket.assign(TechnicianId.create());
  ticket.start();
  ticket.clearEvents();
  return ticket;
}

describe('Ticket', () => {
  describe('create()', () => {
    it('[TKT-005] should open a new ticket in OPEN status with no technician', () => {
      const ticket = makeTicket();

      expect(ticket.status.value).toBe(TicketStatus.OPEN);
      expect(ticket.technicianId).toBeNull();
      expect(ticket.assignedAt).toBeNull();
      expect(ticket.startedAt).toBeNull();
      expect(ticket.resolvedAt).toBeNull();
      expect(ticket.cancelledAt).toBeNull();
    });

    it('[TKT-005] should leave the code unset until the ticket is persisted', () => {
      expect(makeTicket().code).toBeNull();
    });

    it('should emit a TicketOpenedEvent', () => {
      const ticket = makeTicket();

      expect(ticket.domainEvents[0]).toBeInstanceOf(
        TicketOpenedEvent
      );
    });

    it('should trim the title and description', () => {
      const ticket = makeTicket({
        title: '  Padded title  ',
        description: '  Padded description  '
      });

      expect(ticket.title).toBe('Padded title');
      expect(ticket.description).toBe('Padded description');
    });

    it('[TKT-001] should reject a ticket with an empty title', () => {
      const result = Ticket.create(makeProps({ title: '   ' }));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('title cannot be empty');
    });

    it('[TKT-002] should reject a title longer than 150 characters', () => {
      const result = Ticket.create(
        makeProps({ title: 'x'.repeat(151) })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('cannot exceed 150 characters');
    });

    it('[TKT-003] should reject a ticket with an empty description', () => {
      const result = Ticket.create(makeProps({ description: '  ' }));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('description cannot be empty');
    });

    it('[TKT-004] should reject a ticket that references neither a customer nor a device', () => {
      const result = Ticket.create(
        makeProps({ customerId: null, deviceId: null })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'must reference a customer or a device'
      );
    });

    it('[TKT-004] should accept a ticket that references only a device', () => {
      const result = Ticket.create(
        makeProps({ customerId: null, deviceId: DeviceId.create() })
      );

      expect(result.isSuccess).toBe(true);
    });

    it('[TKT-110] should reject an alert-opened ticket with no originating alert id', () => {
      const result = Ticket.create(
        makeProps({
          origin: TicketOrigin.reconstitute(
            TicketOrigin.WIRELESS_ALERT
          ),
          originAlertId: null,
          deviceId: DeviceId.create()
        })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'must reference the originating alert'
      );
    });

    it('[TKT-111] should reject an alert-opened ticket with no device', () => {
      const result = Ticket.create(
        makeProps({
          origin: TicketOrigin.reconstitute(
            TicketOrigin.DEVICE_ALERT
          ),
          originAlertId: TicketId.create().toString(),
          customerId: CustomerId.create(),
          deviceId: null
        })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('must reference a device');
    });

    it('[TKT-112] should reject a manual ticket that references an alert', () => {
      const result = Ticket.create(
        makeProps({ originAlertId: TicketId.create().toString() })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'manually created ticket cannot reference an originating alert'
      );
    });

    it('[TKT-110] should reject a malformed originating alert id', () => {
      const result = Ticket.create(
        makeProps({
          origin: TicketOrigin.reconstitute(
            TicketOrigin.WIRELESS_ALERT
          ),
          originAlertId: 'not-a-uuid',
          deviceId: DeviceId.create()
        })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid originating alert id');
    });

    it('should accept a well formed alert-opened ticket', () => {
      const result = Ticket.create(
        makeProps({
          origin: TicketOrigin.reconstitute(
            TicketOrigin.WIRELESS_ALERT
          ),
          originAlertId: TicketId.create().toString(),
          deviceId: DeviceId.create()
        })
      );

      expect(result.isSuccess).toBe(true);
    });
  });

  describe('assign()', () => {
    it('[TKT-070] should move the ticket to ASSIGNED and stamp assignedAt', () => {
      const ticket = makeTicket();
      ticket.clearEvents();
      const technicianId = TechnicianId.create();
      const now = new Date('2026-08-04T09:00:00Z');

      const result = ticket.assign(technicianId, null, now);

      expect(result.isSuccess).toBe(true);
      expect(ticket.status.value).toBe(TicketStatus.ASSIGNED);
      expect(ticket.technicianId!.equals(technicianId)).toBe(true);
      expect(ticket.assignedAt).toEqual(now);
    });

    it('[TKT-070] should emit an assignment and a status change event', () => {
      const ticket = makeTicket();
      ticket.clearEvents();

      ticket.assign(TechnicianId.create());

      expect(ticket.domainEvents[0]).toBeInstanceOf(
        TicketAssignedEvent
      );
      expect(ticket.domainEvents[1]).toBeInstanceOf(
        TicketStatusChangedEvent
      );
    });

    it('[TKT-075] should carry a schedule date when one is supplied', () => {
      const ticket = makeTicket();
      const scheduledFor = new Date('2026-08-05T00:00:00Z');

      ticket.assign(TechnicianId.create(), scheduledFor);

      expect(ticket.scheduledFor).toEqual(scheduledFor);
    });

    it('[TKT-071] should allow reassigning a ticket that has not been started', () => {
      const ticket = makeAssignedTicket();
      const newTechnicianId = TechnicianId.create();

      const result = ticket.assign(newTechnicianId);

      expect(result.isSuccess).toBe(true);
      expect(ticket.technicianId!.equals(newTechnicianId)).toBe(true);
    });

    it('[TKT-071] should not emit a status change when reassigning an already assigned ticket', () => {
      const ticket = makeAssignedTicket();

      ticket.assign(TechnicianId.create());

      expect(
        ticket.domainEvents.some(
          (e) => e instanceof TicketStatusChangedEvent
        )
      ).toBe(false);
    });

    it('[TKT-072] should refuse to reassign a ticket that is in progress', () => {
      const ticket = makeInProgressTicket();

      const result = ticket.assign(TechnicianId.create());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Cannot reassign a ticket that is already in progress'
      );
    });

    it('[TKT-073] should refuse to assign a resolved ticket', () => {
      const ticket = makeInProgressTicket();
      ticket.resolve('Replaced the antenna');

      const result = ticket.assign(TechnicianId.create());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Cannot modify a resolved ticket'
      );
    });

    it('[TKT-073] should refuse to assign a cancelled ticket', () => {
      const ticket = makeTicket();
      ticket.cancel('Customer cancelled the visit');

      const result = ticket.assign(TechnicianId.create());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Cannot modify a cancelled ticket'
      );
    });
  });

  describe('start()', () => {
    it('should move an assigned ticket to IN_PROGRESS and stamp startedAt', () => {
      const ticket = makeAssignedTicket();
      const now = new Date('2026-08-04T10:00:00Z');

      const result = ticket.start(now);

      expect(result.isSuccess).toBe(true);
      expect(ticket.status.value).toBe(TicketStatus.IN_PROGRESS);
      expect(ticket.startedAt).toEqual(now);
    });

    it('[TKT-040] should refuse to start an unassigned ticket', () => {
      const ticket = makeTicket();

      const result = ticket.start();

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Only an assigned ticket can be started'
      );
    });

    it('[TKT-041] should refuse to start a ticket twice', () => {
      const ticket = makeInProgressTicket();

      const result = ticket.start();

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already in progress');
    });

    it('[TKT-047] should emit a status change event', () => {
      const ticket = makeAssignedTicket();

      ticket.start();

      expect(ticket.domainEvents[0]).toBeInstanceOf(
        TicketStatusChangedEvent
      );
    });
  });

  describe('resolve()', () => {
    it('should move the ticket to RESOLVED and record the notes', () => {
      const ticket = makeInProgressTicket();
      const now = new Date('2026-08-04T12:00:00Z');

      const result = ticket.resolve('Realigned the antenna', now);

      expect(result.isSuccess).toBe(true);
      expect(ticket.status.value).toBe(TicketStatus.RESOLVED);
      expect(ticket.resolutionNotes).toBe('Realigned the antenna');
      expect(ticket.resolvedAt).toEqual(now);
    });

    it('should allow resolving straight from ASSIGNED', () => {
      const ticket = makeAssignedTicket();

      expect(ticket.resolve('Fixed remotely').isSuccess).toBe(true);
    });

    it('[TKT-042] should refuse to resolve a ticket that was never assigned', () => {
      const ticket = makeTicket();

      const result = ticket.resolve('Fixed it');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Cannot resolve a ticket that has not been assigned'
      );
    });

    it('[TKT-043] should require resolution notes', () => {
      const ticket = makeInProgressTicket();

      const result = ticket.resolve('   ');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Resolution notes are required');
    });

    it('[TKT-009] should refuse to resolve an already resolved ticket', () => {
      const ticket = makeInProgressTicket();
      ticket.resolve('Done');

      const result = ticket.resolve('Done again');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Cannot modify a resolved ticket'
      );
    });

    it('should emit a resolved event and a status change event', () => {
      const ticket = makeInProgressTicket();

      ticket.resolve('Swapped the radio');

      expect(
        ticket.domainEvents.some(
          (e) => e instanceof TicketResolvedEvent
        )
      ).toBe(true);
      expect(
        ticket.domainEvents.some(
          (e) => e instanceof TicketStatusChangedEvent
        )
      ).toBe(true);
    });
  });

  describe('cancel()', () => {
    it('should move the ticket to CANCELLED and record the reason', () => {
      const ticket = makeTicket();
      const now = new Date('2026-08-04T13:00:00Z');

      const result = ticket.cancel('Duplicate report', now);

      expect(result.isSuccess).toBe(true);
      expect(ticket.status.value).toBe(TicketStatus.CANCELLED);
      expect(ticket.cancelReason).toBe('Duplicate report');
      expect(ticket.cancelledAt).toEqual(now);
    });

    it('should cancel a ticket that is already in progress', () => {
      const ticket = makeInProgressTicket();

      expect(ticket.cancel('Customer not home').isSuccess).toBe(true);
    });

    it('[TKT-044] should require a cancellation reason', () => {
      const ticket = makeTicket();

      const result = ticket.cancel('  ');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'A reason is required to cancel a ticket'
      );
    });

    it('[TKT-044] should reject a reason longer than 255 characters', () => {
      const ticket = makeTicket();

      const result = ticket.cancel('x'.repeat(256));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('cannot exceed 255 characters');
    });

    it('[TKT-045] should refuse to cancel a resolved ticket', () => {
      const ticket = makeInProgressTicket();
      ticket.resolve('Done');

      const result = ticket.cancel('Changed my mind');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Cannot cancel a resolved ticket'
      );
    });

    it('[TKT-046] should refuse to cancel a ticket twice', () => {
      const ticket = makeTicket();
      ticket.cancel('First reason');

      const result = ticket.cancel('Second reason');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already cancelled');
    });

    it('should emit a cancelled event', () => {
      const ticket = makeTicket();
      ticket.clearEvents();

      ticket.cancel('Duplicate');

      expect(
        ticket.domainEvents.some(
          (e) => e instanceof TicketCancelledEvent
        )
      ).toBe(true);
    });
  });

  describe('schedule()', () => {
    it('should set the scheduled date', () => {
      const ticket = makeTicket();
      const scheduledFor = new Date('2026-08-10T00:00:00Z');

      const result = ticket.schedule(scheduledFor);

      expect(result.isSuccess).toBe(true);
      expect(ticket.scheduledFor).toEqual(scheduledFor);
    });

    it('[TKT-075] should allow scheduling for a date in the past', () => {
      const ticket = makeTicket();

      const result = ticket.schedule(
        new Date('2020-01-01T00:00:00Z')
      );

      expect(result.isSuccess).toBe(true);
    });

    it('should be a no-op when the date is unchanged', () => {
      const ticket = makeTicket();
      const scheduledFor = new Date('2026-08-10T00:00:00Z');
      ticket.schedule(scheduledFor);
      const updatedAt = ticket.updatedAt;

      ticket.schedule(new Date('2026-08-10T00:00:00Z'));

      expect(ticket.updatedAt).toEqual(updatedAt);
    });

    it('should allow clearing the schedule', () => {
      const ticket = makeTicket();
      ticket.schedule(new Date('2026-08-10T00:00:00Z'));

      ticket.schedule(null);

      expect(ticket.scheduledFor).toBeNull();
    });

    it('[TKT-074] should refuse to schedule a resolved ticket', () => {
      const ticket = makeInProgressTicket();
      ticket.resolve('Done');

      const result = ticket.schedule(new Date());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Cannot modify a resolved ticket'
      );
    });

    it('[TKT-074] should refuse to schedule a cancelled ticket', () => {
      const ticket = makeTicket();
      ticket.cancel('Duplicate');

      const result = ticket.schedule(new Date());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Cannot modify a cancelled ticket'
      );
    });
  });

  describe('updateDetails()', () => {
    it('should update the title, description, priority and category', () => {
      const ticket = makeTicket();

      const result = ticket.updateDetails({
        title: 'Updated title',
        description: 'Updated description',
        priority: TicketPriority.reconstitute(TicketPriority.URGENT),
        category: TicketCategory.reconstitute(
          TicketCategory.HARDWARE_FAILURE
        )
      });

      expect(result.isSuccess).toBe(true);
      expect(ticket.title).toBe('Updated title');
      expect(ticket.description).toBe('Updated description');
      expect(ticket.priority.value).toBe(TicketPriority.URGENT);
      expect(ticket.category.value).toBe(
        TicketCategory.HARDWARE_FAILURE
      );
    });

    it('should leave untouched fields alone', () => {
      const ticket = makeTicket();
      const originalDescription = ticket.description;

      ticket.updateDetails({ title: 'Only the title' });

      expect(ticket.description).toBe(originalDescription);
    });

    it('[TKT-001] should reject an empty title', () => {
      const ticket = makeTicket();

      const result = ticket.updateDetails({ title: '   ' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('title cannot be empty');
    });

    it('[TKT-009] should refuse to update a resolved ticket', () => {
      const ticket = makeInProgressTicket();
      ticket.resolve('Done');

      const result = ticket.updateDetails({ title: 'New title' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Cannot modify a resolved ticket'
      );
    });

    it('[TKT-010] should refuse to update a cancelled ticket', () => {
      const ticket = makeTicket();
      ticket.cancel('Duplicate');

      const result = ticket.updateDetails({ title: 'New title' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Cannot modify a cancelled ticket'
      );
    });
  });

  describe('updateLinks()', () => {
    it('should replace the customer and device references', () => {
      const ticket = makeTicket();
      const customerId = CustomerId.create();
      const deviceId = DeviceId.create();

      const result = ticket.updateLinks(customerId, deviceId);

      expect(result.isSuccess).toBe(true);
      expect(ticket.customerId!.equals(customerId)).toBe(true);
      expect(ticket.deviceId!.equals(deviceId)).toBe(true);
    });

    it('[TKT-004] should refuse to drop both references', () => {
      const ticket = makeTicket();

      const result = ticket.updateLinks(null, null);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'must reference a customer or a device'
      );
    });

    it('[TKT-010] should refuse to relink a cancelled ticket', () => {
      const ticket = makeTicket();
      ticket.cancel('Duplicate');

      const result = ticket.updateLinks(CustomerId.create(), null);

      expect(result.isFailure).toBe(true);
    });
  });

  describe('changeAddress()', () => {
    it('should attach an address snapshot', () => {
      const ticket = makeTicket();
      const address = ServiceAddress.create({
        street: 'Calle 5 #12-34',
        municipality: 'Popayán',
        neighborhood: 'Centro'
      }).value;

      const result = ticket.changeAddress(address);

      expect(result.isSuccess).toBe(true);
      expect(ticket.address!.street).toBe('Calle 5 #12-34');
    });

    it('[TKT-009] should refuse to change the address of a resolved ticket', () => {
      const ticket = makeInProgressTicket();
      ticket.resolve('Done');

      const result = ticket.changeAddress(null);

      expect(result.isFailure).toBe(true);
    });
  });

  describe('isTerminal()', () => {
    it('should be false for an open ticket', () => {
      expect(makeTicket().isTerminal()).toBe(false);
    });

    it('[TKT-009] should be true for a resolved ticket', () => {
      const ticket = makeInProgressTicket();
      ticket.resolve('Done');

      expect(ticket.isTerminal()).toBe(true);
    });

    it('[TKT-010] should be true for a cancelled ticket', () => {
      const ticket = makeTicket();
      ticket.cancel('Duplicate');

      expect(ticket.isTerminal()).toBe(true);
    });
  });
});
