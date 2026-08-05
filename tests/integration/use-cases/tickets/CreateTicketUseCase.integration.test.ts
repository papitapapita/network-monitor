// Source: src/application/tickets/use-cases/CreateTicketUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateTicketUseCase } from 'application/tickets/use-cases';
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
  GHOST_ID
} from '../../helpers/db';

describe('CreateTicketUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: CreateTicketUseCase;
  let customerId: string;
  let deviceId: string;
  let technicianId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new CreateTicketUseCase(
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

    customerId = await seedCustomer(prisma, { phone: '3001234567' });
    const deviceModelId = await seedDeviceModel(prisma);
    deviceId = await seedDevice(prisma, deviceModelId);
    technicianId = await seedTechnician(prisma, {
      phone: '+573001112233'
    });
  });

  const validRequest = () => ({
    title: 'No internet',
    description: 'Link down since 7am',
    category: 'CONNECTIVITY',
    customerId,
    deviceId
  });

  it('[TKT-005] writes an OPEN, unassigned ticket with a code', async () => {
    const result = await useCase.execute(validRequest());

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('OPEN');
    expect(result.value.technicianId).toBeNull();
    expect(typeof result.value.code).toBe('number');

    const row = await prisma.ticket.findUnique({
      where: { id: result.value.id }
    });
    expect(row!.title).toBe('No internet');
    expect(row!.origin).toBe('MANUAL');
  });

  it('[TKT-006] gives consecutive tickets distinct codes', async () => {
    const first = await useCase.execute(validRequest());
    const second = await useCase.execute(validRequest());

    expect(second.value.code).not.toBe(first.value.code);
  });

  it('defaults the priority to NORMAL', async () => {
    const result = await useCase.execute(validRequest());

    expect(result.value.priority).toBe('NORMAL');
  });

  it('stores the address snapshot on the ticket row', async () => {
    const result = await useCase.execute({
      ...validRequest(),
      address: {
        street: 'Calle 5 #12-34',
        municipality: 'Popayán',
        neighborhood: 'Centro',
        latitude: 2.4448,
        longitude: -76.6147
      }
    });

    const row = await prisma.ticket.findUnique({
      where: { id: result.value.id }
    });
    expect(row!.addressStreet).toBe('Calle 5 #12-34');
    expect(row!.addressMunicipality).toBe('Popayán');
    expect(Number(row!.latitude)).toBeCloseTo(2.4448);
  });

  it('assigns at creation through the aggregate when a technician is given', async () => {
    const result = await useCase.execute({
      ...validRequest(),
      technicianId,
      scheduledFor: '2026-08-04'
    });

    expect(result.value.status).toBe('ASSIGNED');
    expect(result.value.assignedAt).not.toBeNull();
    expect(result.value.scheduledFor).toBe('2026-08-04');
  });

  it('[TKT-077] refuses to assign an inactive technician at creation', async () => {
    const inactiveId = await seedTechnician(prisma, {
      phone: '+573009990000',
      isActive: false
    });

    const result = await useCase.execute({
      ...validRequest(),
      technicianId: inactiveId
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/inactive technician/i);
    expect(await prisma.ticket.count()).toBe(0);
  });

  it('[TKT-004] accepts a device-only ticket', async () => {
    const result = await useCase.execute({
      ...validRequest(),
      customerId: null
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.customerId).toBeNull();
  });

  it('[TKT-004] refuses a ticket with neither link', async () => {
    const result = await useCase.execute({
      ...validRequest(),
      customerId: null,
      deviceId: null
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/customer or a device/i);
  });

  it('fails when the customer does not exist', async () => {
    const result = await useCase.execute({
      ...validRequest(),
      customerId: GHOST_ID
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Customer not found/i);
  });

  it('fails when the device does not exist', async () => {
    const result = await useCase.execute({
      ...validRequest(),
      deviceId: GHOST_ID
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Device not found/i);
  });

  it('[TKT-001] fails on a blank title', async () => {
    const result = await useCase.execute({
      ...validRequest(),
      title: '  '
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/title is required/i);
  });

  it('fails on an unknown category', async () => {
    const result = await useCase.execute({
      ...validRequest(),
      category: 'SPACESHIP'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Invalid ticket category/i);
  });

  it('[TKT-007] fails on a partial address', async () => {
    const result = await useCase.execute({
      ...validRequest(),
      address: { street: 'Calle 5' }
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(
      /street, municipality, and neighborhood/i
    );
  });
});
