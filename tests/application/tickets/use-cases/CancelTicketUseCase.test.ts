// Source: src/application/tickets/use-cases/CancelTicketUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { CancelTicketUseCase } from '../../../../src/application/tickets/use-cases';
import { Ticket } from '../../../../src/domain/tickets';
import { Result } from '../../../../src/domain/shared/core';
import { GHOST_ID, INVALID_ID } from './constants';
import {
  makeLogger,
  makeTicketRepo,
  makeTicket,
  makeTechnician
} from './mocks';

describe('CancelTicketUseCase', () => {
  let ticketRepo: ReturnType<typeof makeTicketRepo>;
  let useCase: CancelTicketUseCase;
  let ticket: Ticket;

  beforeEach(() => {
    ticketRepo = makeTicketRepo();
    useCase = new CancelTicketUseCase(ticketRepo, makeLogger());

    ticket = makeTicket();

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
    reason: 'Duplicate report',
    ...overrides
  });

  it('cancels and stores the reason', async () => {
    const result = await useCase.execute(request());

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('CANCELLED');
    expect(result.value.cancelReason).toBe('Duplicate report');
  });

  it('[TKT-044] rejects a blank reason before touching the repository', async () => {
    const result = await useCase.execute(request({ reason: '  ' }));

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('reason is required');
    expect(ticketRepo.findById).not.toHaveBeenCalled();
  });

  it('[TKT-045] surfaces the aggregate refusal for a resolved ticket', async () => {
    const resolved = makeTicket();
    resolved.assign(makeTechnician().id);
    resolved.resolve('Done');
    (ticketRepo.findById as any).mockResolvedValue(
      Result.ok(resolved)
    );

    const result = await useCase.execute(request());

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Cannot cancel a resolved ticket');
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
