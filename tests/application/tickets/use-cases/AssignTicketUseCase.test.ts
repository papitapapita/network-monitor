// Source: src/application/tickets/use-cases/AssignTicketUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { AssignTicketUseCase } from '../../../../src/application/tickets/use-cases';
import { Ticket } from '../../../../src/domain/tickets';
import { Result } from '../../../../src/domain/shared/core';
import { GHOST_ID } from './constants';
import {
  makeLogger,
  makeTicketRepo,
  makeTechnicianRepo,
  makeTicket,
  makeTechnician
} from './mocks';

describe('AssignTicketUseCase', () => {
  let ticketRepo: ReturnType<typeof makeTicketRepo>;
  let technicianRepo: ReturnType<typeof makeTechnicianRepo>;
  let useCase: AssignTicketUseCase;
  let ticket: Ticket;
  let technician: ReturnType<typeof makeTechnician>;

  beforeEach(() => {
    ticketRepo = makeTicketRepo();
    technicianRepo = makeTechnicianRepo();
    useCase = new AssignTicketUseCase(
      ticketRepo,
      technicianRepo,
      makeLogger()
    );

    ticket = makeTicket();
    technician = makeTechnician();

    (ticketRepo.findById as any).mockResolvedValue(Result.ok(ticket));
    (technicianRepo.findById as any).mockResolvedValue(
      Result.ok(technician)
    );
    (ticketRepo.save as any).mockImplementation(async (t: Ticket) =>
      Result.ok(t)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const request = (overrides: Record<string, unknown> = {}) => ({
    id: ticket.id.toString(),
    technicianId: technician.id.toString(),
    ...overrides
  });

  it('[TKT-070] assigns and saves', async () => {
    const result = await useCase.execute(request());

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('ASSIGNED');
    expect(ticketRepo.save).toHaveBeenCalledTimes(1);
  });

  it('carries a schedule date onto the ticket', async () => {
    const result = await useCase.execute(
      request({ scheduledFor: '2026-08-04' })
    );

    expect(result.value.scheduledFor).toBe('2026-08-04');
  });

  it('[TKT-077] refuses an inactive technician and never saves', async () => {
    technician.deactivate();

    const result = await useCase.execute(request());

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('inactive technician');
    expect(ticketRepo.save).not.toHaveBeenCalled();
  });

  it('[TKT-072] surfaces the aggregate refusal for a ticket in progress', async () => {
    ticket.assign(technician.id);
    ticket.start();

    const result = await useCase.execute(request());

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('already in progress');
    expect(ticketRepo.save).not.toHaveBeenCalled();
  });

  it('fails when the ticket does not exist', async () => {
    (ticketRepo.findById as any).mockResolvedValue(Result.ok(null));

    const result = await useCase.execute(request({ id: GHOST_ID }));

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Ticket not found');
  });

  it('fails when the technician does not exist', async () => {
    (technicianRepo.findById as any).mockResolvedValue(
      Result.ok(null)
    );

    const result = await useCase.execute(
      request({ technicianId: GHOST_ID })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Technician not found');
  });

  it('requires a ticket id', async () => {
    const result = await useCase.execute(request({ id: '  ' }));

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Ticket ID is required');
  });

  it('requires a technician id', async () => {
    const result = await useCase.execute(
      request({ technicianId: '' })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Technician ID is required');
  });

  it('rejects a malformed ticket id', async () => {
    const result = await useCase.execute(request({ id: 'nope' }));

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid ticket ID');
  });

  it('rejects a malformed schedule date', async () => {
    const result = await useCase.execute(
      request({ scheduledFor: '04-08-2026' })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('YYYY-MM-DD');
  });

  it('propagates a persistence failure', async () => {
    (ticketRepo.save as any).mockResolvedValue(
      Result.fail('Database error saving ticket: boom')
    );

    const result = await useCase.execute(request());

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Failed to persist ticket');
  });
});
