// Source: src/application/device-inventory/use-cases/RestoreDeviceUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { PrismaLocationRepository } from 'infrastructure/persistence/PrismaLocationRepository';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { PrismaContractedServiceRepository } from 'infrastructure/customers';
import { PrismaTicketRepository } from 'infrastructure/tickets/repositories';
import { CreateDeviceUseCase } from 'application/device-inventory/use-cases/CreateDeviceUseCase';
import { DeleteDeviceUseCase } from 'application/device-inventory/use-cases/DeleteDeviceUseCase';
import { RestoreDeviceUseCase } from 'application/device-inventory/use-cases/RestoreDeviceUseCase';
import { GetDeviceUseCase } from 'application/device-inventory/use-cases/GetDeviceUseCase';
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
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('RestoreDeviceUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let createUseCase: CreateDeviceUseCase;
  let deleteUseCase: DeleteDeviceUseCase;
  let restoreUseCase: RestoreDeviceUseCase;
  let getUseCase: GetDeviceUseCase;
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
    restoreUseCase = new RestoreDeviceUseCase(repo, logger, 7);
    getUseCase = new GetDeviceUseCase(repo, logger);
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
      name: 'Restorable Device',
      ownerType: 'COMPANY',
      serialNumber: 'SN-RES-001',
      ...overrides
    });
    expect(result.isSuccess).toBe(true);
    return result.value.id;
  }

  /** Backdates a tombstone so the grace period can be crossed in a test. */
  async function backdateDeletion(
    id: string,
    daysAgo: number
  ): Promise<void> {
    await prisma.device.update({
      where: { id },
      data: {
        deletedAt: new Date(Date.now() - daysAgo * 86_400_000)
      }
    });
  }

  // ──────────────────────────────────────────────────────────────
  // [DEV-074] Restore inside the grace period
  // ──────────────────────────────────────────────────────────────

  // deleted_by is a UUID column — the only value that ever reaches it is the
  // authenticated user's id.
  const ACTOR_ID = '11111111-1111-4111-8111-111111111111';

  it('[DEV-074] brings a deleted device back', async () => {
    const id = await createDevice();
    await deleteUseCase.execute({ id, deletedBy: ACTOR_ID });

    const result = await restoreUseCase.execute({ id });

    expect(result.isSuccess).toBe(true);

    const row = await prisma.device.findUnique({ where: { id } });
    expect(row!.deletedAt).toBeNull();
    expect(row!.deletedBy).toBeNull();
  });

  it('[DEV-074] makes the device visible to reads again', async () => {
    const id = await createDevice();
    await deleteUseCase.execute({ id });
    expect((await getUseCase.execute({ id })).isFailure).toBe(true);

    await restoreUseCase.execute({ id });

    const read = await getUseCase.execute({ id });
    expect(read.isSuccess).toBe(true);
    expect(read.value.id).toBe(id);
  });

  it('[DEV-074] restores on the last day of the grace period', async () => {
    const id = await createDevice();
    await deleteUseCase.execute({ id });
    await backdateDeletion(id, 6);

    const result = await restoreUseCase.execute({ id });

    expect(result.isSuccess).toBe(true);
  });

  it('[DEV-074] refuses once the grace period has expired', async () => {
    const id = await createDevice();
    await deleteUseCase.execute({ id });
    await backdateDeletion(id, 8);

    const result = await restoreUseCase.execute({ id });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/grace period expired/i);

    const row = await prisma.device.findUnique({ where: { id } });
    expect(row!.deletedAt).not.toBeNull();
  });

  it('[DEV-074] refuses a device that was never deleted', async () => {
    const id = await createDevice();

    const result = await restoreUseCase.execute({ id });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not deleted/i);
  });

  // ──────────────────────────────────────────────────────────────
  // Monitoring stays off
  // ──────────────────────────────────────────────────────────────

  it('leaves monitoring off — restoring is not returning to service', async () => {
    const id = await createDevice({
      locationId,
      status: 'ACTIVE',
      ipAddress: '10.70.0.1',
      monitoringEnabled: true
    });
    await deleteUseCase.execute({ id });

    const result = await restoreUseCase.execute({ id });

    expect(result.isSuccess).toBe(true);
    expect(result.value.monitoringEnabled).toBe(false);
  });

  it('keeps the device’s history through the round trip', async () => {
    const id = await createDevice();
    await prisma.pingResult.create({
      data: { deviceId: id, isReachable: true, latencyMs: 9 }
    });

    await deleteUseCase.execute({ id });
    await restoreUseCase.execute({ id });

    const pings = await prisma.pingResult.findMany({
      where: { deviceId: id }
    });
    expect(pings).toHaveLength(1);
  });

  // ──────────────────────────────────────────────────────────────
  // Not found / validation failures
  // ──────────────────────────────────────────────────────────────

  it('fails when the device does not exist (GHOST_ID)', async () => {
    const result = await restoreUseCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  it('fails with a malformed id', async () => {
    const result = await restoreUseCase.execute({ id: INVALID_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid device id/i);
  });

  it('fails when id is empty', async () => {
    const result = await restoreUseCase.execute({ id: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/required/i);
  });
});
