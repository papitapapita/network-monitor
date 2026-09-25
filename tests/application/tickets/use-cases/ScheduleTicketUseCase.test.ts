// Source: src/application/tickets/use-cases/ScheduleTicketUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { ScheduleTicketUseCase } from '../../../../src/application/tickets/use-cases';
import { Ticket } from '../../../../src/domain/tickets';
import { Result } from '../../../../src/domain/shared/core';
import { GHOST_ID, INVALID_ID } from './constants';
import {
  makeLogger,
  makeTicketRepo,
  makeTicket,
  makeTechnician
} from './mocks';

describe('ScheduleTicketUseCase', () => {
  let ticketRepo: ReturnType<typeof makeTicketRepo>;
  let useCase: ScheduleTicketUseCase;
  let ticket: Ticket;

  beforeEach(() => {
    ticketRepo = makeTicketRepo();
    useCase = new ScheduleTicketUseCase(ticketRepo, makeLogger());

    ticket = makeTicket();

    (ticketRepo.findById as any).mockResolvedValue(Result.ok(ticket));
    (ticketRepo.save as any).mockImplementation(async (t: Ticket) =>
      Result.ok(t)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sets the visit day', async () => {
    const result = await useCase.execute({
      id: ticket.id.toString(),
      scheduledFor: '2026-09-01'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.scheduledFor).toBe('2026-09-01');
  });

  it('sets a time block on the visit day', async () => {
    const result = await useCase.execute({
      id: ticket.id.toString(),
      scheduledFor: '2026-09-01',
      startTime: '10:00',
      endTime: '11:30'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.startTime).toBe('10:00');
    expect(result.value.endTime).toBe('11:30');
  });

  it('[TKT-081] leaves no block when only the day is sent', async () => {
    await useCase.execute({
      id: ticket.id.toString(),
      scheduledFor: '2026-09-01',
      startTime: '10:00',
      endTime: '11:30'
    });

    const result = await useCase.execute({
      id: ticket.id.toString(),
      scheduledFor: '2026-09-02'
    });

    expect(result.value.startTime).toBeNull();
    expect(result.value.endTime).toBeNull();
  });

  it('[TKT-080] rejects a start time without an end time', async () => {
    const result = await useCase.execute({
      id: ticket.id.toString(),
      scheduledFor: '2026-09-01',
      startTime: '10:00'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(
      'startTime and endTime must be provided together'
    );
    expect(ticketRepo.save).not.toHaveBeenCalled();
  });

  it('[TKT-078] rejects a block that ends before it starts', async () => {
    const result = await useCase.execute({
      id: ticket.id.toString(),
      scheduledFor: '2026-09-01',
      startTime: '11:00',
      endTime: '10:00'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('must be later than its start');
  });

  it('rejects a malformed time', async () => {
    const result = await useCase.execute({
      id: ticket.id.toString(),
      scheduledFor: '2026-09-01',
      startTime: '9:00',
      endTime: '10:00'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid start time');
  });

  it('[TKT-079] rejects a block when the schedule is cleared', async () => {
    const result = await useCase.execute({
      id: ticket.id.toString(),
      scheduledFor: null,
      startTime: '10:00',
      endTime: '11:00'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(
      'A scheduled date is required for a time block'
    );
  });

  it('[TKT-075] accepts a past date', async () => {
    const result = await useCase.execute({
      id: ticket.id.toString(),
      scheduledFor: '2020-01-01'
    });

    expect(result.isSuccess).toBe(true);
  });

  it('clears the schedule when null is supplied', async () => {
    const result = await useCase.execute({
      id: ticket.id.toString(),
      scheduledFor: null
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.scheduledFor).toBeNull();
  });

  it('requires scheduledFor to be present in the request', async () => {
    const result = await useCase.execute({
      id: ticket.id.toString()
    } as never);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('scheduledFor is required');
  });

  it('rejects a malformed date', async () => {
    const result = await useCase.execute({
      id: ticket.id.toString(),
      scheduledFor: '01/09/2026'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('YYYY-MM-DD');
  });

  it('rejects a date that is not a real calendar day', async () => {
    const result = await useCase.execute({
      id: ticket.id.toString(),
      scheduledFor: '2026-02-30'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('not a real date');
  });

  it('[TKT-074] surfaces the aggregate refusal for a resolved ticket', async () => {
    const resolved = makeTicket();
    resolved.assign(makeTechnician().id);
    resolved.resolve('Done');
    (ticketRepo.findById as any).mockResolvedValue(
      Result.ok(resolved)
    );

    const result = await useCase.execute({
      id: GHOST_ID,
      scheduledFor: '2026-09-01'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('resolved');
  });

  it('fails when the ticket does not exist', async () => {
    (ticketRepo.findById as any).mockResolvedValue(Result.ok(null));

    const result = await useCase.execute({
      id: GHOST_ID,
      scheduledFor: '2026-09-01'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Ticket not found');
  });

  it('rejects a malformed id', async () => {
    const result = await useCase.execute({
      id: INVALID_ID,
      scheduledFor: '2026-09-01'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid ticket ID');
  });
});
