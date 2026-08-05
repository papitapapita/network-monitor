// Source: src/application/tickets/use-cases/GetTicketUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { GetTicketUseCase } from '../../../../src/application/tickets/use-cases';
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

describe('GetTicketUseCase', () => {
  let ticketRepo: ReturnType<typeof makeTicketRepo>;
  let technicianRepo: ReturnType<typeof makeTechnicianRepo>;
  let customerDirectory: ReturnType<typeof makeCustomerDirectory>;
  let deviceDirectory: ReturnType<typeof makeDeviceDirectory>;
  let useCase: GetTicketUseCase;
  const ticket = makeTicket();

  beforeEach(() => {
    ticketRepo = makeTicketRepo();
    technicianRepo = makeTechnicianRepo();
    customerDirectory = makeCustomerDirectory();
    deviceDirectory = makeDeviceDirectory();
    useCase = new GetTicketUseCase(
      ticketRepo,
      technicianRepo,
      customerDirectory,
      deviceDirectory,
      makeLogger()
    );

    (ticketRepo.findById as any).mockResolvedValue(Result.ok(ticket));
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

  it('returns the ticket enriched with contact and device', async () => {
    const result = await useCase.execute({
      id: ticket.id.toString()
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.customer).toEqual(customerContact);
    expect(result.value.device).toEqual(deviceSummary);
  });

  it('leaves the technician null on an unassigned ticket', async () => {
    const result = await useCase.execute({
      id: ticket.id.toString()
    });

    expect(result.value.technician).toBeNull();
    expect(technicianRepo.findById).not.toHaveBeenCalled();
  });

  it('attaches the technician summary once assigned', async () => {
    const assigned = makeTicket();
    const technician = makeTechnician();
    assigned.assign(technician.id);
    (ticketRepo.findById as any).mockResolvedValue(
      Result.ok(assigned)
    );
    (technicianRepo.findById as any).mockResolvedValue(
      Result.ok(technician)
    );

    const result = await useCase.execute({
      id: assigned.id.toString()
    });

    expect(result.value.technician!.fullName).toBe('Andrés Muñoz');
  });

  it('does not look up a customer the ticket does not reference', async () => {
    const deviceOnly = makeTicket({ customerId: null });
    (ticketRepo.findById as any).mockResolvedValue(
      Result.ok(deviceOnly)
    );

    const result = await useCase.execute({
      id: deviceOnly.id.toString()
    });

    expect(result.value.customer).toBeNull();
    expect(customerDirectory.findContact).not.toHaveBeenCalled();
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

  it('propagates a directory failure', async () => {
    (deviceDirectory.findSummary as any).mockResolvedValue(
      Result.fail('Database error finding device summary')
    );

    const result = await useCase.execute({
      id: ticket.id.toString()
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Database error');
  });
});
