// Source: src/application/tickets/use-cases/ResolveTicketUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { ResolveTicketUseCase } from '../../../../src/application/tickets/use-cases';
import { Ticket } from '../../../../src/domain/tickets';
import { Result } from '../../../../src/domain/shared/core';
import { GHOST_ID, INVALID_ID } from './constants';
import {
  makeLogger,
  makeTicketRepo,
  makeTicket,
  makeTechnician
} from './mocks';

describe('ResolveTicketUseCase', () => {
  let ticketRepo: ReturnType<typeof makeTicketRepo>;
  let useCase: ResolveTicketUseCase;
  let ticket: Ticket;

  beforeEach(() => {
    ticketRepo = makeTicketRepo();
    useCase = new ResolveTicketUseCase(ticketRepo, makeLogger());

    ticket = makeTicket();
    ticket.assign(makeTechnician().id);
    ticket.start();

    (ticketRepo.findById as any).mockResolvedValue(Result.ok(ticket));
    (ticketRepo.save as any).mockImplementation(async (t: Ticket) =>
      Result.ok(t)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const request = (overrides: Record<string, string> = {}) => ({
    id: ticket.id.toString(),
    resolutionNotes: 'Realigned the antenna',
    ...overrides
  });

  it('resolves and stores the notes', async () => {
    const result = await useCase.execute(request());

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('RESOLVED');
    expect(result.value.resolutionNotes).toBe(
      'Realigned the antenna'
    );
  });

  it('[TKT-043] rejects blank notes before touching the repository', async () => {
    const result = await useCase.execute(
      request({ resolutionNotes: '   ' })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Resolution notes are required');
    expect(ticketRepo.findById).not.toHaveBeenCalled();
  });

  it('[TKT-042] surfaces the aggregate refusal for an unassigned ticket', async () => {
    (ticketRepo.findById as any).mockResolvedValue(
      Result.ok(makeTicket())
    );

    const result = await useCase.execute(request());

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('has not been assigned');
    expect(ticketRepo.save).not.toHaveBeenCalled();
  });

  it('fails when the ticket does not exist', async () => {
    (ticketRepo.findById as any).mockResolvedValue(Result.ok(null));

    const result = await useCase.execute(request({ id: GHOST_ID }));

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Ticket not found');
  });

  it('requires an id', async () => {
    const result = await useCase.execute(request({ id: '  ' }));

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Ticket ID is required');
  });

  it('rejects a malformed id', async () => {
    const result = await useCase.execute(request({ id: INVALID_ID }));

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid ticket ID');
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
