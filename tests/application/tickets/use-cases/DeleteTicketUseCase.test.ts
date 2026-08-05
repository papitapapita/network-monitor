// Source: src/application/tickets/use-cases/DeleteTicketUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { DeleteTicketUseCase } from '../../../../src/application/tickets/use-cases';
import { Result } from '../../../../src/domain/shared/core';
import { GHOST_ID, INVALID_ID } from './constants';
import { makeLogger, makeTicketRepo, makeTicket } from './mocks';

describe('DeleteTicketUseCase', () => {
  let ticketRepo: ReturnType<typeof makeTicketRepo>;
  let useCase: DeleteTicketUseCase;
  const ticket = makeTicket();

  beforeEach(() => {
    ticketRepo = makeTicketRepo();
    useCase = new DeleteTicketUseCase(ticketRepo, makeLogger());

    (ticketRepo.exists as any).mockResolvedValue(Result.ok(true));
    (ticketRepo.delete as any).mockResolvedValue(Result.ok());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deletes an existing ticket', async () => {
    const result = await useCase.execute({
      id: ticket.id.toString()
    });

    expect(result.isSuccess).toBe(true);
    expect(ticketRepo.delete).toHaveBeenCalledTimes(1);
  });

  it('checks existence before deleting', async () => {
    (ticketRepo.exists as any).mockResolvedValue(Result.ok(false));

    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Ticket not found');
    expect(ticketRepo.delete).not.toHaveBeenCalled();
  });

  it('requires an id', async () => {
    const result = await useCase.execute({ id: '  ' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Ticket ID is required');
    expect(ticketRepo.exists).not.toHaveBeenCalled();
  });

  it('rejects a malformed id', async () => {
    const result = await useCase.execute({ id: INVALID_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid ticket ID');
  });

  it('propagates a delete failure', async () => {
    (ticketRepo.delete as any).mockResolvedValue(
      Result.fail('Database error deleting ticket')
    );

    const result = await useCase.execute({
      id: ticket.id.toString()
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Database error');
  });
});
