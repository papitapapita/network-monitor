// Source: src/application/tickets/use-cases/GetTechnicianDayUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { GetTechnicianDayUseCase } from '../../../../src/application/tickets/use-cases';
import { TicketPriority } from '../../../../src/domain/tickets';
import { Result } from '../../../../src/domain/shared/core';
import { GHOST_ID, INVALID_ID } from './constants';
import {
  makeLogger,
  makeTicketRepo,
  makeTechnicianRepo,
  makeCustomerDirectory,
  makeDeviceDirectory,
  makeTicket,
  makeTechnician,
  customerContact,
  deviceSummary
} from './mocks';

describe('GetTechnicianDayUseCase', () => {
  let ticketRepo: ReturnType<typeof makeTicketRepo>;
  let technicianRepo: ReturnType<typeof makeTechnicianRepo>;
  let customerDirectory: ReturnType<typeof makeCustomerDirectory>;
  let deviceDirectory: ReturnType<typeof makeDeviceDirectory>;
  let useCase: GetTechnicianDayUseCase;
  const technician = makeTechnician();

  const priority = (value: string) =>
    TicketPriority.reconstitute(value);

  beforeEach(() => {
    ticketRepo = makeTicketRepo();
    technicianRepo = makeTechnicianRepo();
    customerDirectory = makeCustomerDirectory();
    deviceDirectory = makeDeviceDirectory();
    useCase = new GetTechnicianDayUseCase(
      ticketRepo,
      technicianRepo,
      customerDirectory,
      deviceDirectory,
      makeLogger()
    );

    (technicianRepo.findById as any).mockResolvedValue(
      Result.ok(technician)
    );
    (ticketRepo.findForTechnicianOnDate as any).mockResolvedValue(
      Result.ok([])
    );
    (customerDirectory.findContact as any).mockResolvedValue(
      Result.ok(customerContact)
    );
    (deviceDirectory.findSummary as any).mockResolvedValue(
      Result.ok(deviceSummary)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const request = (overrides: Record<string, string> = {}) => ({
    technicianId: technician.id.toString(),
    date: '2026-08-04',
    ...overrides
  });

  it('returns an empty day rather than failing', async () => {
    const result = await useCase.execute(request());

    expect(result.isSuccess).toBe(true);
    expect(result.value.tickets).toEqual([]);
    expect(result.value.total).toBe(0);
    expect(result.value.date).toBe('2026-08-04');
  });

  it('[TKT-076] orders by priority rank, then oldest first', async () => {
    const low = makeTicket({
      title: 'Low',
      priority: priority(TicketPriority.LOW)
    });
    const urgent = makeTicket({
      title: 'Urgent',
      priority: priority(TicketPriority.URGENT)
    });
    const normal = makeTicket({
      title: 'Normal',
      priority: priority(TicketPriority.NORMAL)
    });
    (ticketRepo.findForTechnicianOnDate as any).mockResolvedValue(
      Result.ok([low, normal, urgent])
    );

    const result = await useCase.execute(request());

    expect(result.value.tickets.map((t) => t.title)).toEqual([
      'Urgent',
      'Normal',
      'Low'
    ]);
  });

  it('enriches every ticket on the day sheet', async () => {
    (ticketRepo.findForTechnicianOnDate as any).mockResolvedValue(
      Result.ok([makeTicket(), makeTicket()])
    );

    const result = await useCase.execute(request());

    expect(result.value.tickets).toHaveLength(2);
    expect(customerDirectory.findContact).toHaveBeenCalledTimes(2);
    expect(deviceDirectory.findSummary).toHaveBeenCalledTimes(2);
    expect(result.value.tickets[0].customer).toEqual(customerContact);
  });

  it('stamps the same technician onto every ticket', async () => {
    (ticketRepo.findForTechnicianOnDate as any).mockResolvedValue(
      Result.ok([makeTicket()])
    );

    const result = await useCase.execute(request());

    expect(result.value.tickets[0].technician!.id).toBe(
      technician.id.toString()
    );
  });

  it('defaults to today when no date is given', async () => {
    const result = await useCase.execute({
      technicianId: technician.id.toString()
    });

    expect(result.value.date).toBe(
      new Date().toISOString().slice(0, 10)
    );
  });

  it('queries the repository with UTC midnight for the requested day', async () => {
    await useCase.execute(request());

    const dateArg = (ticketRepo.findForTechnicianOnDate as any).mock
      .calls[0][1];
    expect(dateArg.toISOString()).toBe('2026-08-04T00:00:00.000Z');
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
    expect(ticketRepo.findForTechnicianOnDate).not.toHaveBeenCalled();
  });

  it('requires a technician id', async () => {
    const result = await useCase.execute(
      request({ technicianId: '  ' })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Technician ID is required');
  });

  it('rejects a malformed technician id', async () => {
    const result = await useCase.execute(
      request({ technicianId: INVALID_ID })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid technician ID');
  });

  it('rejects a malformed date', async () => {
    const result = await useCase.execute(
      request({ date: '4 August 2026' })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('YYYY-MM-DD');
  });

  it('propagates a repository failure', async () => {
    (ticketRepo.findForTechnicianOnDate as any).mockResolvedValue(
      Result.fail('Database error finding technician day sheet')
    );

    const result = await useCase.execute(request());

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Database error');
  });
});
