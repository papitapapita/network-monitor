// Source: src/application/tickets/use-cases/UpdateTicketUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { UpdateTicketUseCase } from '../../../../src/application/tickets/use-cases';
import { Ticket } from '../../../../src/domain/tickets';
import { Result } from '../../../../src/domain/shared/core';
import { GHOST_ID, INVALID_ID } from './constants';
import {
  makeLogger,
  makeTicketRepo,
  makeCustomerDirectory,
  makeDeviceDirectory,
  makeTicket,
  makeTechnician,
  customerContact,
  deviceSummary
} from './mocks';

describe('UpdateTicketUseCase', () => {
  let ticketRepo: ReturnType<typeof makeTicketRepo>;
  let customerDirectory: ReturnType<typeof makeCustomerDirectory>;
  let deviceDirectory: ReturnType<typeof makeDeviceDirectory>;
  let useCase: UpdateTicketUseCase;
  let ticket: Ticket;

  beforeEach(() => {
    ticketRepo = makeTicketRepo();
    customerDirectory = makeCustomerDirectory();
    deviceDirectory = makeDeviceDirectory();
    useCase = new UpdateTicketUseCase(
      ticketRepo,
      customerDirectory,
      deviceDirectory,
      makeLogger()
    );

    ticket = makeTicket();

    (ticketRepo.findById as any).mockResolvedValue(Result.ok(ticket));
    (ticketRepo.save as any).mockImplementation(async (t: Ticket) =>
      Result.ok(t)
    );
    (customerDirectory.exists as any).mockResolvedValue(
      Result.ok(true)
    );
    (deviceDirectory.exists as any).mockResolvedValue(
      Result.ok(true)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('updates the title, priority and category', async () => {
    const result = await useCase.execute({
      id: ticket.id.toString(),
      title: 'Updated',
      priority: 'URGENT',
      category: 'HARDWARE_FAILURE'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.title).toBe('Updated');
    expect(result.value.priority).toBe('URGENT');
    expect(result.value.category).toBe('HARDWARE_FAILURE');
  });

  it('leaves unsupplied fields alone', async () => {
    const original = ticket.description;

    const result = await useCase.execute({
      id: ticket.id.toString(),
      title: 'Only the title'
    });

    expect(result.value.description).toBe(original);
  });

  it('does not consult the directories when no links change', async () => {
    await useCase.execute({
      id: ticket.id.toString(),
      title: 'Updated'
    });

    expect(customerDirectory.exists).not.toHaveBeenCalled();
    expect(deviceDirectory.exists).not.toHaveBeenCalled();
  });

  it('validates a replacement device against the directory', async () => {
    await useCase.execute({
      id: ticket.id.toString(),
      deviceId: deviceSummary.id
    });

    expect(deviceDirectory.exists).toHaveBeenCalledWith(
      deviceSummary.id
    );
  });

  it('fails when the replacement customer does not exist', async () => {
    (customerDirectory.exists as any).mockResolvedValue(
      Result.ok(false)
    );

    const result = await useCase.execute({
      id: ticket.id.toString(),
      customerId: customerContact.id
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Customer not found');
  });

  it('[TKT-004] refuses to drop both links', async () => {
    const result = await useCase.execute({
      id: ticket.id.toString(),
      customerId: null,
      deviceId: null
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('customer or a device');
  });

  it('rejects an unknown priority', async () => {
    const result = await useCase.execute({
      id: ticket.id.toString(),
      priority: 'CATASTROPHIC'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid ticket priority');
  });

  it('[TKT-009] surfaces the aggregate refusal for a resolved ticket', async () => {
    const resolved = makeTicket();
    resolved.assign(makeTechnician().id);
    resolved.resolve('Done');
    (ticketRepo.findById as any).mockResolvedValue(
      Result.ok(resolved)
    );

    const result = await useCase.execute({
      id: GHOST_ID,
      title: 'New'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('resolved');
  });

  it('fails when the ticket does not exist', async () => {
    (ticketRepo.findById as any).mockResolvedValue(Result.ok(null));

    const result = await useCase.execute({
      id: GHOST_ID,
      title: 'Ghost'
    });

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
});
