// Source: src/application/tickets/use-cases/ListTicketsUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { ListTicketsUseCase } from '../../../../src/application/tickets/use-cases';
import { Result } from '../../../../src/domain/shared/core';
import { makeLogger, makeTicketRepo, makeTicket } from './mocks';

describe('ListTicketsUseCase', () => {
  let ticketRepo: ReturnType<typeof makeTicketRepo>;
  let useCase: ListTicketsUseCase;

  beforeEach(() => {
    ticketRepo = makeTicketRepo();
    useCase = new ListTicketsUseCase(ticketRepo, makeLogger());

    (ticketRepo.findAll as any).mockResolvedValue(
      Result.ok([makeTicket()])
    );
    (ticketRepo.countAll as any).mockResolvedValue(Result.ok(1));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('defaults to a page of 20 from offset 0', async () => {
    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(result.value.limit).toBe(20);
    expect(result.value.offset).toBe(0);
    expect(ticketRepo.findAll).toHaveBeenCalledWith({}, 20, 0);
  });

  it('caps the page size at 100', async () => {
    await useCase.execute({ limit: 5000 });

    expect(ticketRepo.findAll).toHaveBeenCalledWith({}, 100, 0);
  });

  it('normalizes enum filters to upper case', async () => {
    await useCase.execute({
      status: ' assigned ',
      priority: 'urgent',
      category: 'connectivity'
    });

    expect(ticketRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ASSIGNED',
        priority: 'URGENT',
        category: 'CONNECTIVITY'
      }),
      20,
      0
    );
  });

  it('passes the id filters through untouched', async () => {
    await useCase.execute({
      technicianId: 't1',
      customerId: 'c1',
      deviceId: 'd1'
    });

    expect(ticketRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        technicianId: 't1',
        customerId: 'c1',
        deviceId: 'd1'
      }),
      20,
      0
    );
  });

  it('parses the date window into Date objects', async () => {
    await useCase.execute({
      scheduledFrom: '2026-08-01',
      scheduledTo: '2026-08-31'
    });

    const filter = (ticketRepo.findAll as any).mock.calls[0][0];
    expect(filter.scheduledFrom).toBeInstanceOf(Date);
    expect(filter.scheduledFrom.toISOString()).toBe(
      '2026-08-01T00:00:00.000Z'
    );
  });

  it('rejects an inverted date window', async () => {
    const result = await useCase.execute({
      scheduledFrom: '2026-08-31',
      scheduledTo: '2026-08-01'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('cannot be later than');
    expect(ticketRepo.findAll).not.toHaveBeenCalled();
  });

  it('rejects a malformed date filter', async () => {
    const result = await useCase.execute({ scheduledFrom: 'nope' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('YYYY-MM-DD');
  });

  it('rejects a negative offset', async () => {
    const result = await useCase.execute({ offset: -1 });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('negative');
  });

  it('rejects a limit below one', async () => {
    const result = await useCase.execute({ limit: 0 });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('at least 1');
  });

  it('propagates a repository failure', async () => {
    (ticketRepo.findAll as any).mockResolvedValue(
      Result.fail('Database error finding tickets')
    );

    const result = await useCase.execute({});

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Database error');
  });

  it('propagates a count failure', async () => {
    (ticketRepo.countAll as any).mockResolvedValue(
      Result.fail('Database error counting tickets')
    );

    const result = await useCase.execute({});

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Database error');
  });
});
