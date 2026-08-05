// Source: src/application/tickets/use-cases/UpdateTicketUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { UpdateTicketUseCase } from 'application/tickets/use-cases';
import { PrismaTicketRepository } from 'infrastructure/tickets/repositories';
import {
  CustomerDirectoryAdapter,
  DeviceDirectoryAdapter
} from 'infrastructure/tickets/adapters';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanTickets,
  cleanBills,
  cleanCustomers,
  cleanCatalog,
  seedCustomer,
  seedDevice,
  seedDeviceModel,
  seedTicket,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('UpdateTicketUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: UpdateTicketUseCase;
  let customerId: string;
  let deviceId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new UpdateTicketUseCase(
      new PrismaTicketRepository(prisma),
      new CustomerDirectoryAdapter(prisma),
      new DeviceDirectoryAdapter(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanTickets(prisma);
    await cleanBills(prisma);
    await cleanCustomers(prisma);
    await cleanCatalog(prisma);

    customerId = await seedCustomer(prisma, { phone: '3001234567' });
    const deviceModelId = await seedDeviceModel(prisma);
    deviceId = await seedDevice(prisma, deviceModelId);
  });

  it('updates the title, priority and category through to the row', async () => {
    const id = await seedTicket(prisma, { customerId });

    const result = await useCase.execute({
      id,
      title: 'Updated title',
      priority: 'URGENT',
      category: 'HARDWARE_FAILURE'
    });

    expect(result.isSuccess).toBe(true);

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row!.title).toBe('Updated title');
    expect(row!.priority).toBe('URGENT');
    expect(row!.category).toBe('HARDWARE_FAILURE');
  });

  it('leaves fields that were not supplied alone', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      description: 'Original description'
    });

    await useCase.execute({ id, title: 'Only the title' });

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row!.description).toBe('Original description');
  });

  it('attaches a device to a ticket that had none', async () => {
    const id = await seedTicket(prisma, { customerId });

    const result = await useCase.execute({ id, deviceId });

    expect(result.isSuccess).toBe(true);

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row!.deviceId).toBe(deviceId);
  });

  it('replaces the address snapshot', async () => {
    const id = await seedTicket(prisma, { customerId });

    await useCase.execute({
      id,
      address: {
        street: 'Carrera 9 #1-11',
        municipality: 'Popayán',
        neighborhood: 'La Paz'
      }
    });

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row!.addressStreet).toBe('Carrera 9 #1-11');
  });

  it('clears the address when null is supplied', async () => {
    const id = await seedTicket(prisma, { customerId });
    await useCase.execute({
      id,
      address: {
        street: 'Calle 5',
        municipality: 'Popayán',
        neighborhood: 'Centro'
      }
    });

    await useCase.execute({ id, address: null });

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row!.addressStreet).toBeNull();
  });

  it('[TKT-004] refuses to drop both the customer and the device', async () => {
    const id = await seedTicket(prisma, { customerId, deviceId });

    const result = await useCase.execute({
      id,
      customerId: null,
      deviceId: null
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/customer or a device/i);
  });

  it('[TKT-009] refuses to update a resolved ticket', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      status: 'RESOLVED'
    });

    const result = await useCase.execute({ id, title: 'New title' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/resolved/i);
  });

  it('[TKT-010] refuses to update a cancelled ticket', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      status: 'CANCELLED'
    });

    const result = await useCase.execute({ id, title: 'New title' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/cancelled/i);
  });

  it('fails when the replacement device does not exist', async () => {
    const id = await seedTicket(prisma, { customerId });

    const result = await useCase.execute({ id, deviceId: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Device not found/i);
  });

  it('fails when the ticket does not exist', async () => {
    const result = await useCase.execute({
      id: GHOST_ID,
      title: 'Ghost'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Ticket not found/i);
  });

  it('fails on a malformed id', async () => {
    const result = await useCase.execute({
      id: INVALID_ID,
      title: 'Bad'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid/i);
  });
});
