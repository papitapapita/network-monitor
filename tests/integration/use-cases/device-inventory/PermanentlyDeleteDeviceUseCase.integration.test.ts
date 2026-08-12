// Source: src/application/device-inventory/use-cases/PermanentlyDeleteDeviceUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { PrismaLocationRepository } from 'infrastructure/persistence/PrismaLocationRepository';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { PrismaContractedServiceRepository } from 'infrastructure/customers';
import { PrismaTicketRepository } from 'infrastructure/tickets/repositories';
import { CreateDeviceUseCase } from 'application/device-inventory/use-cases/CreateDeviceUseCase';
import { DeleteDeviceUseCase } from 'application/device-inventory/use-cases/DeleteDeviceUseCase';
import { PermanentlyDeleteDeviceUseCase } from 'application/device-inventory/use-cases/PermanentlyDeleteDeviceUseCase';
import { ListDevicesUseCase } from 'application/device-inventory/use-cases/ListDevicesUseCase';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  cleanBills,
  cleanCustomers,
  cleanTickets,
  seedDeviceModel,
  seedLocation,
  seedTicket,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('PermanentlyDeleteDeviceUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let createUseCase: CreateDeviceUseCase;
  let deleteUseCase: DeleteDeviceUseCase;
  let purgeOneUseCase: PermanentlyDeleteDeviceUseCase;
  let listUseCase: ListDevicesUseCase;
  let deviceModelId: string;
  let locationId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    const repo = new PrismaDeviceRepository(prisma);
    const logger = new WinstonLogger();
    createUseCase = new CreateDeviceUseCase(
      repo,
      new PrismaDeviceModelRepository(prisma),
      new PrismaLocationRepository(prisma),
      logger
    );
    deleteUseCase = new DeleteDeviceUseCase(
      repo,
      new PrismaContractedServiceRepository(prisma),
      new PrismaTicketRepository(prisma),
      logger
    );
    purgeOneUseCase = new PermanentlyDeleteDeviceUseCase(
      repo,
      logger
    );
    listUseCase = new ListDevicesUseCase(repo, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanBills(prisma);
    await cleanTickets(prisma);
    await cleanCustomers(prisma);
    await cleanDatabase(prisma);
    locationId = await seedLocation(prisma);
  });

  async function createDevice(
    overrides: Record<string, unknown> = {}
  ): Promise<string> {
    const result = await createUseCase.execute({
      deviceModelId,
      name: 'Binnable Device',
      ownerType: 'COMPANY',
      serialNumber: `SN-BIN-${Math.random().toString(36).slice(2, 9)}`,
      ...overrides
    });
    expect(result.isSuccess).toBe(true);
    return result.value.id;
  }

  // ──────────────────────────────────────────────────────────────
  // [DEV-085] Emptying the bin
  // ──────────────────────────────────────────────────────────────

  it('[DEV-085] removes a device that is in the bin, without waiting out the grace period', async () => {
    const id = await createDevice();
    await deleteUseCase.execute({ id });

    const result = await purgeOneUseCase.execute({ id });

    expect(result.isSuccess).toBe(true);
    const row = await prisma.device.findUnique({ where: { id } });
    expect(row).toBeNull();
  });

  // This is the whole reason the guard exists: DeleteDeviceUseCase refuses a
  // device with open tickets, and this endpoint must not be a way around it.
  it('[DEV-085] refuses a live device, so it cannot bypass the delete guards', async () => {
    const id = await createDevice();
    await seedTicket(prisma, { deviceId: id, status: 'OPEN' });

    // The ordinary delete is refused...
    const softDelete = await deleteUseCase.execute({ id });
    expect(softDelete.isFailure).toBe(true);

    // ...and the permanent one cannot be used instead.
    const result = await purgeOneUseCase.execute({ id });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not in the recycle bin/i);

    const row = await prisma.device.findUnique({ where: { id } });
    expect(row).not.toBeNull();
  });

  it('[DEV-085] takes the device history with it', async () => {
    const id = await createDevice({
      locationId,
      status: 'ACTIVE',
      ipAddress: '10.85.0.1',
      monitoringEnabled: true
    });
    await prisma.pingResult.create({
      data: { deviceId: id, isReachable: true, latencyMs: 7 }
    });
    await deleteUseCase.execute({ id });

    await purgeOneUseCase.execute({ id });

    expect(
      await prisma.pingResult.findMany({ where: { deviceId: id } })
    ).toHaveLength(0);
  });

  it('[DEV-084] empties the bin one device at a time', async () => {
    const a = await createDevice();
    const b = await createDevice();
    await deleteUseCase.execute({ id: a });
    await deleteUseCase.execute({ id: b });

    const before = await listUseCase.execute({ deleted: 'only' });
    expect(before.value.total).toBe(2);

    await purgeOneUseCase.execute({ id: a });
    await purgeOneUseCase.execute({ id: b });

    const after = await listUseCase.execute({ deleted: 'only' });
    expect(after.value.total).toBe(0);
    expect(await prisma.device.count()).toBe(0);
  });

  it('fails when the device does not exist (GHOST_ID)', async () => {
    const result = await purgeOneUseCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  it('fails with a malformed id', async () => {
    const result = await purgeOneUseCase.execute({ id: INVALID_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid device id/i);
  });
});
