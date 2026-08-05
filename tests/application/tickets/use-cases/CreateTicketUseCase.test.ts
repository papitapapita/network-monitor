// Source: src/application/tickets/use-cases/CreateTicketUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { CreateTicketUseCase } from '../../../../src/application/tickets/use-cases';
import { Ticket } from '../../../../src/domain/tickets';
import { Result } from '../../../../src/domain/shared/core';
import {
  makeLogger,
  makeTicketRepo,
  makeTechnicianRepo,
  makeCustomerDirectory,
  makeDeviceDirectory,
  makeTechnician,
  customerContact,
  deviceSummary
} from './mocks';

describe('CreateTicketUseCase', () => {
  let ticketRepo: ReturnType<typeof makeTicketRepo>;
  let technicianRepo: ReturnType<typeof makeTechnicianRepo>;
  let customerDirectory: ReturnType<typeof makeCustomerDirectory>;
  let deviceDirectory: ReturnType<typeof makeDeviceDirectory>;
  let useCase: CreateTicketUseCase;

  const validRequest = () => ({
    title: 'No internet',
    description: 'Link down since 7am',
    category: 'CONNECTIVITY',
    customerId: customerContact.id,
    deviceId: deviceSummary.id
  });

  beforeEach(() => {
    ticketRepo = makeTicketRepo();
    technicianRepo = makeTechnicianRepo();
    customerDirectory = makeCustomerDirectory();
    deviceDirectory = makeDeviceDirectory();
    useCase = new CreateTicketUseCase(
      ticketRepo,
      technicianRepo,
      customerDirectory,
      deviceDirectory,
      makeLogger()
    );

    (customerDirectory.exists as any).mockResolvedValue(
      Result.ok(true)
    );
    (deviceDirectory.exists as any).mockResolvedValue(
      Result.ok(true)
    );
    (ticketRepo.save as any).mockImplementation(async (t: Ticket) =>
      Result.ok(t)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('[TKT-005] creates an OPEN, unassigned ticket', async () => {
    const result = await useCase.execute(validRequest());

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('OPEN');
    expect(result.value.technicianId).toBeNull();
    expect(ticketRepo.save).toHaveBeenCalledTimes(1);
  });

  it('defaults the priority to NORMAL', async () => {
    const result = await useCase.execute(validRequest());

    expect(result.value.priority).toBe('NORMAL');
  });

  it('always records the origin as MANUAL', async () => {
    const result = await useCase.execute(validRequest());

    expect(result.value.origin).toBe('MANUAL');
    expect(result.value.originAlertId).toBeNull();
  });

  it('[TKT-077] refuses an inactive technician and never saves', async () => {
    const inactive = makeTechnician();
    inactive.deactivate();
    (technicianRepo.findById as any).mockResolvedValue(
      Result.ok(inactive)
    );

    const result = await useCase.execute({
      ...validRequest(),
      technicianId: inactive.id.toString()
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('inactive technician');
    expect(ticketRepo.save).not.toHaveBeenCalled();
  });

  it('assigns through the aggregate when an active technician is given', async () => {
    const technician = makeTechnician();
    (technicianRepo.findById as any).mockResolvedValue(
      Result.ok(technician)
    );

    const result = await useCase.execute({
      ...validRequest(),
      technicianId: technician.id.toString()
    });

    expect(result.value.status).toBe('ASSIGNED');
    expect(result.value.assignedAt).not.toBeNull();
  });

  it('fails when the technician does not exist', async () => {
    (technicianRepo.findById as any).mockResolvedValue(
      Result.ok(null)
    );

    const result = await useCase.execute({
      ...validRequest(),
      technicianId: makeTechnician().id.toString()
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Technician not found');
  });

  it('fails when the customer does not exist', async () => {
    (customerDirectory.exists as any).mockResolvedValue(
      Result.ok(false)
    );

    const result = await useCase.execute(validRequest());

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Customer not found');
    expect(ticketRepo.save).not.toHaveBeenCalled();
  });

  it('fails when the device does not exist', async () => {
    (deviceDirectory.exists as any).mockResolvedValue(
      Result.ok(false)
    );

    const result = await useCase.execute(validRequest());

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Device not found');
  });

  it('skips the directory lookup for a null link', async () => {
    await useCase.execute({ ...validRequest(), deviceId: null });

    expect(deviceDirectory.exists).not.toHaveBeenCalled();
  });

  it('[TKT-001] requires a title', async () => {
    const result = await useCase.execute({
      ...validRequest(),
      title: '  '
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('title is required');
  });

  it('[TKT-003] requires a description', async () => {
    const result = await useCase.execute({
      ...validRequest(),
      description: ''
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('description is required');
  });

  it('requires a category', async () => {
    const result = await useCase.execute({
      ...validRequest(),
      category: ''
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('category is required');
  });

  it('rejects an unknown category', async () => {
    const result = await useCase.execute({
      ...validRequest(),
      category: 'SPACESHIP'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid ticket category');
  });

  it('rejects a malformed schedule date', async () => {
    const result = await useCase.execute({
      ...validRequest(),
      scheduledFor: 'next tuesday'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('YYYY-MM-DD');
  });

  it('propagates a persistence failure', async () => {
    (ticketRepo.save as any).mockResolvedValue(
      Result.fail('Database error saving ticket: boom')
    );

    const result = await useCase.execute(validRequest());

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Failed to persist ticket');
  });

  it('propagates a directory failure', async () => {
    (customerDirectory.exists as any).mockResolvedValue(
      Result.fail('Database error checking customer existence')
    );

    const result = await useCase.execute(validRequest());

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Database error');
  });
});
