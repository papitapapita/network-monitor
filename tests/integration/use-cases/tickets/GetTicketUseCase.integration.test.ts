// Source: src/application/tickets/use-cases/GetTicketUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetTicketUseCase } from 'application/tickets/use-cases';
import {
  PrismaTicketRepository,
  PrismaTechnicianRepository
} from 'infrastructure/tickets/repositories';
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
  seedTechnician,
  seedTicket,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('GetTicketUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: GetTicketUseCase;
  let customerId: string;
  let deviceId: string;
  let technicianId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new GetTicketUseCase(
      new PrismaTicketRepository(prisma),
      new PrismaTechnicianRepository(prisma),
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

    customerId = await seedCustomer(prisma, {
      fullName: 'Marta Ríos',
      phone: '3001234567',
      email: 'marta@example.com'
    });
    const deviceModelId = await seedDeviceModel(prisma);
    deviceId = await seedDevice(prisma, deviceModelId, {
      name: 'CPE-Marta'
    });
    technicianId = await seedTechnician(prisma, {
      fullName: 'Andrés Muñoz',
      phone: '+573001112233'
    });
  });

  it('returns the ticket with contact, device and technician attached', async () => {
    const id = await seedTicket(prisma, {
      customerId,
      deviceId,
      technicianId,
      status: 'ASSIGNED'
    });

    const result = await useCase.execute({ id });

    expect(result.isSuccess).toBe(true);
    expect(result.value.id).toBe(id);
    expect(result.value.customer).toMatchObject({
      fullName: 'Marta Ríos',
      phone: '3001234567',
      email: 'marta@example.com'
    });
    expect(result.value.device).toMatchObject({ name: 'CPE-Marta' });
    expect(result.value.technician).toMatchObject({
      fullName: 'Andrés Muñoz'
    });
  });

  it('reads Decimal coordinates back as numbers', async () => {
    const created = await prisma.ticket.create({
      data: {
        title: 'Located job',
        description: 'Has coordinates',
        category: 'CONNECTIVITY',
        customerId,
        addressStreet: 'Calle 5',
        addressMunicipality: 'Popayán',
        addressNeighborhood: 'Centro',
        latitude: 2.4448,
        longitude: -76.6147
      }
    });

    const result = await useCase.execute({ id: created.id });

    expect(result.isSuccess).toBe(true);
    expect(result.value.address!.latitude).toBeCloseTo(2.4448);
    expect(result.value.address!.longitude).toBeCloseTo(-76.6147);
  });

  it('leaves collaborators null when the ticket has no links to them', async () => {
    const id = await seedTicket(prisma, { customerId });

    const result = await useCase.execute({ id });

    expect(result.value.customer).not.toBeNull();
    expect(result.value.device).toBeNull();
    expect(result.value.technician).toBeNull();
  });

  it('fails when the ticket does not exist', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  it('fails on a malformed id', async () => {
    const result = await useCase.execute({ id: INVALID_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid/i);
  });

  it('fails on an empty id', async () => {
    const result = await useCase.execute({ id: '  ' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/required/i);
  });
});
