// Source: src/application/tickets/use-cases/CreateTicketFromAlertUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  CreateTicketFromAlertUseCase,
  OpenTicketFromAlertUseCase
} from 'application/tickets/use-cases';
import { PrismaTicketRepository } from 'infrastructure/tickets/repositories';
import {
  AlertDirectoryAdapter,
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
  seedServicePlan,
  seedDevice,
  seedDeviceModel,
  seedActiveContractedService,
  seedTicket,
  GHOST_ID
} from '../../helpers/db';

describe('[TKT-115] CreateTicketFromAlertUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: CreateTicketFromAlertUseCase;
  let deviceId: string;
  let customerId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    const logger = new WinstonLogger();
    const ticketRepository = new PrismaTicketRepository(prisma);
    useCase = new CreateTicketFromAlertUseCase(
      new AlertDirectoryAdapter(prisma),
      ticketRepository,
      new OpenTicketFromAlertUseCase(
        ticketRepository,
        new CustomerDirectoryAdapter(prisma),
        new DeviceDirectoryAdapter(prisma),
        logger
      ),
      logger
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

    const deviceModelId = await seedDeviceModel(prisma);
    deviceId = await seedDevice(prisma, deviceModelId, {
      name: 'CPE-Marta'
    });
    customerId = await seedCustomer(prisma, {
      fullName: 'Marta Ríos',
      phone: '3001234567'
    });
    const servicePlanId = await seedServicePlan(prisma);
    await seedActiveContractedService(
      prisma,
      customerId,
      servicePlanId,
      { deviceId }
    );
  });

  const seedAlert = (
    data: {
      type?: string;
      severity?: 'WARNING' | 'CRITICAL';
      resolvedAt?: Date;
    } = {}
  ) =>
    prisma.alertEvent.create({
      data: {
        deviceId,
        severity: data.severity ?? 'WARNING',
        type: data.type ?? 'wireless:ccq_percent:WARNING',
        description: 'CCQ bajo',
        resolvedAt: data.resolvedAt ?? null
      }
    });

  it('opens a ticket built from the stored alert', async () => {
    const alert = await seedAlert();

    const result = await useCase.execute({ alertId: alert.id });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toMatchObject({
      status: 'OPEN',
      origin: 'WIRELESS_ALERT',
      originAlertId: alert.id,
      deviceId,
      customerId,
      description: 'CCQ bajo',
      priority: 'HIGH'
    });
    expect(result.value.title).toContain('CPE-Marta');
  });

  it('gives each alert on a device its own ticket', async () => {
    const performance = await seedAlert();
    const lan = await seedAlert({
      type: 'lan_disconnected',
      severity: 'CRITICAL'
    });

    await useCase.execute({ alertId: performance.id });
    const second = await useCase.execute({ alertId: lan.id });

    expect(second.isSuccess).toBe(true);
    expect(second.value.origin).toBe('DEVICE_ALERT');
    expect(second.value.priority).toBe('URGENT');
    expect(await prisma.ticket.count({ where: { deviceId } })).toBe(
      2
    );
  });

  it('opens a ticket even when an automatic one already covers the device', async () => {
    const alert = await seedAlert();
    await seedTicket(prisma, {
      deviceId,
      origin: 'WIRELESS_ALERT',
      originAlertId: '11111111-0000-4000-8000-000000000001'
    });

    const result = await useCase.execute({ alertId: alert.id });

    expect(result.isSuccess).toBe(true);
    expect(result.value.originAlertId).toBe(alert.id);
  });

  it('accepts a resolved alert', async () => {
    const alert = await seedAlert({ resolvedAt: new Date() });

    const result = await useCase.execute({ alertId: alert.id });

    expect(result.isSuccess).toBe(true);
  });

  it('refuses a second live ticket for the same alert', async () => {
    const alert = await seedAlert();
    await useCase.execute({ alertId: alert.id });

    const result = await useCase.execute({ alertId: alert.id });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('already exists');
    expect(await prisma.ticket.count()).toBe(1);
  });

  it('allows a new ticket once the previous one is resolved', async () => {
    const alert = await seedAlert();
    await seedTicket(prisma, {
      deviceId,
      origin: 'WIRELESS_ALERT',
      originAlertId: alert.id,
      status: 'RESOLVED'
    });

    const result = await useCase.execute({ alertId: alert.id });

    expect(result.isSuccess).toBe(true);
  });

  it('reports an unknown alert as not found', async () => {
    const result = await useCase.execute({ alertId: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('not found');
  });

  it('refuses a malformed alert id', async () => {
    const result = await useCase.execute({ alertId: 'nope' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid alert ID');
  });
});
