// Source: src/application/tickets/use-cases/StartTicketUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { StartTicketUseCase } from '../../../../src/application/tickets/use-cases';
import { Ticket } from '../../../../src/domain/tickets';
import { Result } from '../../../../src/domain/shared/core';
import { GHOST_ID, INVALID_ID } from './constants';
import {
  makeLogger,
  makeTicketRepo,
  makeTicket,
  makeTechnician
} from './mocks';

describe('StartTicketUseCase', () => {
  let ticketRepo: ReturnType<typeof makeTicketRepo>;
  let useCase: StartTicketUseCase;
  let ticket: Ticket;

  beforeEach(() => {
    ticketRepo = makeTicketRepo();
    useCase = new StartTicketUseCase(ticketRepo, makeLogger());

    ticket = makeTicket();
    ticket.assign(makeTechnician().id);

    (ticketRepo.findById as any).mockResolvedValue(Result.ok(ticket));
    (ticketRepo.save as any).mockImplementation(async (t: Ticket) =>
      Result.ok(t)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('starts an assigned ticket', async () => {
    const result = await useCase.execute({
      id: ticket.id.toString()
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('IN_PROGRESS');
    expect(result.value.startedAt).not.toBeNull();
    expect(ticketRepo.save).toHaveBeenCalledTimes(1);
  });

  it('[TKT-040] surfaces the aggregate refusal for an unassigned ticket', async () => {
    (ticketRepo.findById as any).mockResolvedValue(
      Result.ok(makeTicket())
    );

    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Only an assigned ticket');
    expect(ticketRepo.save).not.toHaveBeenCalled();
  });

  it('fails when the ticket does not exist', async () => {
    (ticketRepo.findById as any).mockResolvedValue(Result.ok(null));

    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Ticket not found');
  });

  it('requires an id', async () => {
    const result = await useCase.execute({ id: '  ' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Ticket ID is required');
  });

  it('rejects a malformed id', async () => {
    const result = await useCase.execute({ id: INVALID_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid ticket ID');
  });

  it('propagates a repository read failure', async () => {
    (ticketRepo.findById as any).mockResolvedValue(
      Result.fail('Database error finding ticket')
    );

    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Database error');
  });

  it('propagates a persistence failure', async () => {
    (ticketRepo.save as any).mockResolvedValue(
      Result.fail('Database error saving ticket: boom')
    );

    const result = await useCase.execute({
      id: ticket.id.toString()
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Failed to persist ticket');
  });
});
