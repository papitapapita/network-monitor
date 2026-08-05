// Source: src/application/tickets/event-handlers/TicketAssignedNotificationHandler.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { TicketAssignedNotificationHandler } from '../../../../src/application/tickets/event-handlers';
import { TicketAssignedEvent } from '../../../../src/domain/tickets/events';
import { Result } from '../../../../src/domain/shared/core';
import { TechnicianId } from '../../../../src/domain/shared/ids';
import {
  makeLogger,
  makeTicketRepo,
  makeTechnicianRepo,
  makeTechnicianNotifier,
  makeTicket,
  makeTechnician
} from '../use-cases/mocks';

describe('TicketAssignedNotificationHandler', () => {
  let ticketRepo: ReturnType<typeof makeTicketRepo>;
  let technicianRepo: ReturnType<typeof makeTechnicianRepo>;
  let notifier: ReturnType<typeof makeTechnicianNotifier>;
  let logger: ReturnType<typeof makeLogger>;
  let handler: TicketAssignedNotificationHandler;

  const ticket = makeTicket();
  const technician = makeTechnician();

  const event = (scheduledFor: Date | null = null) =>
    new TicketAssignedEvent({
      aggregateId: ticket.id,
      previousTechnicianId: null,
      newTechnicianId: technician.id,
      scheduledFor,
      dateTimeOccurred: new Date()
    });

  beforeEach(() => {
    ticketRepo = makeTicketRepo();
    technicianRepo = makeTechnicianRepo();
    notifier = makeTechnicianNotifier();
    logger = makeLogger();
    handler = new TicketAssignedNotificationHandler(
      ticketRepo,
      technicianRepo,
      notifier,
      logger
    );

    (technicianRepo.findById as any).mockResolvedValue(
      Result.ok(technician)
    );
    (ticketRepo.findById as any).mockResolvedValue(Result.ok(ticket));
    (notifier.notifyAssignment as any).mockResolvedValue(Result.ok());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('notifies the newly assigned technician', async () => {
    await handler.handle(event());

    expect(notifier.notifyAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '+573001112233',
        technicianName: 'Andrés Muñoz',
        ticketTitle: 'No internet'
      })
    );
  });

  it('renders the scheduled day as a calendar date', async () => {
    await handler.handle(event(new Date('2026-08-04T00:00:00.000Z')));

    expect(notifier.notifyAssignment).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledFor: '2026-08-04' })
    );
  });

  it('passes a null schedule through unchanged', async () => {
    await handler.handle(event());

    expect(notifier.notifyAssignment).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledFor: null })
    );
  });

  it('stays silent when the technician no longer exists', async () => {
    (technicianRepo.findById as any).mockResolvedValue(
      Result.ok(null)
    );

    await handler.handle(event());

    expect(notifier.notifyAssignment).not.toHaveBeenCalled();
  });

  it('logs and gives up when the ticket cannot be read', async () => {
    (ticketRepo.findById as any).mockResolvedValue(
      Result.fail('Database error')
    );

    await handler.handle(event());

    expect(notifier.notifyAssignment).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('logs a delivery failure without throwing', async () => {
    (notifier.notifyAssignment as any).mockResolvedValue(
      Result.fail('WhatsApp rejected the template')
    );

    await expect(handler.handle(event())).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });

  it('never throws when a dependency throws', async () => {
    (technicianRepo.findById as any).mockRejectedValue(
      new Error('connection lost')
    );

    await expect(handler.handle(event())).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });

  it('looks the technician up by the id carried on the event', async () => {
    const otherId = TechnicianId.create();
    const otherEvent = new TicketAssignedEvent({
      aggregateId: ticket.id,
      previousTechnicianId: technician.id,
      newTechnicianId: otherId,
      scheduledFor: null,
      dateTimeOccurred: new Date()
    });

    await handler.handle(otherEvent);

    expect(technicianRepo.findById).toHaveBeenCalledWith(otherId);
  });
});
