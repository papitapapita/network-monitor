// Source: src/application/tickets/use-cases/OpenTicketFromAlertUseCase.ts
//
// This use case has no HTTP surface — it is reached only from the alert
// pipeline — so this suite is the only coverage it has.

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { OpenTicketFromAlertUseCase } from 'application/tickets/use-cases';
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
  seedServicePlan,
  seedDevice,
  seedDeviceModel,
  seedActiveContractedService,
  GHOST_ID
} from '../../helpers/db';

const ALERT_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const ALERT_B = 'bbbbbbbb-0000-4000-8000-000000000002';

describe('OpenTicketFromAlertUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: OpenTicketFromAlertUseCase;
  let deviceId: string;
  let customerId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new OpenTicketFromAlertUseCase(
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

    const deviceModelId = await seedDeviceModel(prisma);
    deviceId = await seedDevice(prisma, deviceModelId, {
      name: 'AP-Tower-3'
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

  const request = (overrides: Record<string, string> = {}) => ({
    origin: 'WIRELESS_ALERT',
    alertId: ALERT_A,
    deviceId,
    severity: 'CRITICAL',
    message: 'SNR below threshold (8 dB)',
    ...overrides
  });

  it('opens a ticket carrying the alert id, the device and the message', async () => {
    const result = await useCase.execute(request());

    expect(result.isSuccess).toBe(true);
    expect(result.value).toMatchObject({
      status: 'OPEN',
      origin: 'WIRELESS_ALERT',
      originAlertId: ALERT_A,
      deviceId,
      description: 'SNR below threshold (8 dB)'
    });

    const rows = await prisma.ticket.findMany();
    expect(rows).toHaveLength(1);
  });

  it('resolves the customer from the device via its contracted service', async () => {
    const result = await useCase.execute(request());

    expect(result.value.customerId).toBe(customerId);
  });

  it('prefixes the title with the device name', async () => {
    const result = await useCase.execute(request());

    expect(result.value.title).toContain('AP-Tower-3');
  });

  it('[TKT-114] maps CRITICAL to URGENT', async () => {
    const result = await useCase.execute(
      request({ severity: 'CRITICAL' })
    );

    expect(result.value.priority).toBe('URGENT');
  });

  it('[TKT-114] maps WARNING to HIGH', async () => {
    const result = await useCase.execute(
      request({ severity: 'WARNING' })
    );

    expect(result.value.priority).toBe('HIGH');
  });

  it('[TKT-113] does not open a second ticket when the same alert re-fires', async () => {
    const first = await useCase.execute(request());
    const second = await useCase.execute(request());

    expect(second.isSuccess).toBe(true);
    expect(second.value.id).toBe(first.value.id);

    const rows = await prisma.ticket.findMany();
    expect(rows).toHaveLength(1);
  });

  it('[TKT-113] folds a second alert on the same device into the existing ticket', async () => {
    const first = await useCase.execute(request());
    const second = await useCase.execute(
      request({
        alertId: ALERT_B,
        message: 'CCQ below threshold (41%)'
      })
    );

    expect(second.value.id).toBe(first.value.id);

    const rows = await prisma.ticket.findMany();
    expect(rows).toHaveLength(1);
  });

  it('[TKT-113] opens a new ticket once the earlier one is resolved', async () => {
    const first = await useCase.execute(request());
    await prisma.ticket.update({
      where: { id: first.value.id },
      data: { status: 'RESOLVED', resolvedAt: new Date() }
    });

    const second = await useCase.execute(
      request({ alertId: ALERT_B })
    );

    expect(second.value.id).not.toBe(first.value.id);
    expect(await prisma.ticket.count()).toBe(2);
  });

  it('opens a ticket for a device with no contracted service, with no customer', async () => {
    const deviceModelId = await seedDeviceModel(prisma);
    const orphanDeviceId = await seedDevice(prisma, deviceModelId, {
      name: 'Tower-Backhaul',
      serialNumber: 'SN-ORPHAN'
    });

    const result = await useCase.execute(
      request({ deviceId: orphanDeviceId })
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value.customerId).toBeNull();
  });

  it('fails when the device does not exist', async () => {
    const result = await useCase.execute(
      request({ deviceId: GHOST_ID })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  it('[TKT-112] refuses a MANUAL origin', async () => {
    const result = await useCase.execute(
      request({ origin: 'MANUAL' })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/cannot have origin MANUAL/i);
  });

  it('fails on a malformed alert id', async () => {
    const result = await useCase.execute(
      request({ alertId: 'not-a-uuid' })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/must be a valid UUID/i);
  });

  it('fails on an empty alert id', async () => {
    const result = await useCase.execute(request({ alertId: '' }));

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/required/i);
  });
});
