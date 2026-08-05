// Source: src/application/tickets/use-cases/ListTicketsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ListTicketsUseCase } from 'application/tickets/use-cases';
import { PrismaTicketRepository } from 'infrastructure/tickets/repositories';
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
  seedTicket
} from '../../helpers/db';

describe('ListTicketsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ListTicketsUseCase;
  let customerId: string;
  let deviceId: string;
  let technicianId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new ListTicketsUseCase(
      new PrismaTicketRepository(prisma),
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

  it('returns an empty page rather than failing when there are no tickets', async () => {
    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(result.value.tickets).toEqual([]);
    expect(result.value.total).toBe(0);
    expect(result.value.hasMore).toBe(false);
  });

  it('paginates and reports hasMore correctly', async () => {
    for (let i = 0; i < 3; i++) {
      await seedTicket(prisma, { customerId, title: `Ticket ${i}` });
    }

    const firstPage = await useCase.execute({ limit: 2, offset: 0 });
    expect(firstPage.value.tickets).toHaveLength(2);
    expect(firstPage.value.total).toBe(3);
    expect(firstPage.value.hasMore).toBe(true);

    const secondPage = await useCase.execute({ limit: 2, offset: 2 });
    expect(secondPage.value.tickets).toHaveLength(1);
    expect(secondPage.value.hasMore).toBe(false);
  });

  it('filters by status', async () => {
    await seedTicket(prisma, { customerId, status: 'OPEN' });
    await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'ASSIGNED'
    });

    const result = await useCase.execute({ status: 'ASSIGNED' });

    expect(result.value.total).toBe(1);
    expect(result.value.tickets[0].status).toBe('ASSIGNED');
  });

  it('filters by priority, category, customer and device', async () => {
    await seedTicket(prisma, {
      customerId,
      deviceId,
      priority: 'URGENT',
      category: 'HARDWARE_FAILURE'
    });
    await seedTicket(prisma, { customerId, priority: 'LOW' });

    expect(
      (await useCase.execute({ priority: 'URGENT' })).value.total
    ).toBe(1);
    expect(
      (await useCase.execute({ category: 'HARDWARE_FAILURE' })).value
        .total
    ).toBe(1);
    expect((await useCase.execute({ deviceId })).value.total).toBe(1);
    expect((await useCase.execute({ customerId })).value.total).toBe(
      2
    );
  });

  it('filters to unassigned tickets', async () => {
    await seedTicket(prisma, { customerId });
    await seedTicket(prisma, {
      customerId,
      technicianId,
      status: 'ASSIGNED'
    });

    const result = await useCase.execute({ unassignedOnly: true });

    expect(result.value.total).toBe(1);
    expect(result.value.tickets[0].technicianId).toBeNull();
  });

  it('filters out terminal tickets with openOnly', async () => {
    await seedTicket(prisma, { customerId, status: 'OPEN' });
    await seedTicket(prisma, { customerId, status: 'RESOLVED' });
    await seedTicket(prisma, { customerId, status: 'CANCELLED' });

    const result = await useCase.execute({ openOnly: true });

    expect(result.value.total).toBe(1);
  });

  it('filters by a scheduled date window, inclusive at both ends', async () => {
    await seedTicket(prisma, {
      customerId,
      scheduledFor: new Date('2026-08-03T00:00:00.000Z')
    });
    await seedTicket(prisma, {
      customerId,
      scheduledFor: new Date('2026-08-05T00:00:00.000Z')
    });
    await seedTicket(prisma, {
      customerId,
      scheduledFor: new Date('2026-08-09T00:00:00.000Z')
    });

    const result = await useCase.execute({
      scheduledFrom: '2026-08-03',
      scheduledTo: '2026-08-05'
    });

    expect(result.value.total).toBe(2);
  });

  it('fails when the date window is inverted', async () => {
    const result = await useCase.execute({
      scheduledFrom: '2026-08-09',
      scheduledTo: '2026-08-01'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/cannot be later than/i);
  });

  it('fails on a malformed date filter', async () => {
    const result = await useCase.execute({ scheduledFrom: 'nope' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/YYYY-MM-DD/);
  });

  it('caps the page size at 100', async () => {
    const result = await useCase.execute({ limit: 5000 });

    expect(result.value.limit).toBe(100);
  });

  it('fails on a negative offset', async () => {
    const result = await useCase.execute({ offset: -1 });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/negative/i);
  });
});
