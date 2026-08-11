// Source: src/application/device-inventory/use-cases/DeleteDeviceUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { PrismaLocationRepository } from 'infrastructure/persistence/PrismaLocationRepository';
import { CreateDeviceUseCase } from 'application/device-inventory/use-cases/CreateDeviceUseCase';
import { DeleteDeviceUseCase } from 'application/device-inventory/use-cases/DeleteDeviceUseCase';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  seedDeviceModel,
  seedLocation,
  waitForPollingConfig,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('DeleteDeviceUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let createUseCase: CreateDeviceUseCase;
  let deleteUseCase: DeleteDeviceUseCase;
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
    deleteUseCase = new DeleteDeviceUseCase(repo, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  // cleanDatabase() wipes locations, so the fixture is re-seeded per test.
  beforeEach(async () => {
    await cleanDatabase(prisma);
    locationId = await seedLocation(prisma);
  });

  async function createDevice(
    overrides: Record<string, unknown> = {}
  ): Promise<string> {
    const result = await createUseCase.execute({
      deviceModelId,
      name: 'Deletable Device',
      ownerType: 'COMPANY',
      serialNumber: 'SN-DEL-001',
      ...overrides
    });
    expect(result.isSuccess).toBe(true);
    return result.value.id;
  }

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('deletes the device and the row is gone from the database', async () => {
    const id = await createDevice();

    const result = await deleteUseCase.execute({ id });

    expect(result.isSuccess).toBe(true);

    const row = await prisma.device.findUnique({ where: { id } });
    expect(row).toBeNull();
  });

  it('cascade-deletes the polling configuration of a monitored device', async () => {
    const id = await createDevice({
      locationId,
      status: 'ACTIVE',
      ipAddress: '10.50.0.1',
      monitoringEnabled: true
    });
    await waitForPollingConfig(prisma, id);

    const result = await deleteUseCase.execute({ id });

    expect(result.isSuccess).toBe(true);

    const configs = await prisma.pollingConfiguration.findMany({
      where: { deviceId: id }
    });
    expect(configs).toHaveLength(0);
  });

  it('leaves other devices untouched', async () => {
    const doomed = await createDevice({ serialNumber: 'SN-DEL-A' });
    const survivor = await createDevice({ serialNumber: 'SN-DEL-B' });

    const result = await deleteUseCase.execute({ id: doomed });

    expect(result.isSuccess).toBe(true);

    const remaining = await prisma.device.findMany();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(survivor);
  });

  it('[DEV-068] is not idempotent — deleting twice fails the second time', async () => {
    const id = await createDevice();

    expect((await deleteUseCase.execute({ id })).isSuccess).toBe(true);

    const second = await deleteUseCase.execute({ id });

    expect(second.isFailure).toBe(true);
    expect(second.error).toMatch(/not found/i);
  });

  // ──────────────────────────────────────────────────────────────
  // Not found / validation failures
  // ──────────────────────────────────────────────────────────────

  it('[DEV-068] fails when the device does not exist (GHOST_ID)', async () => {
    const result = await deleteUseCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  it('fails with a malformed id', async () => {
    const result = await deleteUseCase.execute({ id: INVALID_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid device id/i);
  });

  it('fails when id is empty', async () => {
    const result = await deleteUseCase.execute({ id: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/required/i);
  });

  it('fails when id is only whitespace', async () => {
    const result = await deleteUseCase.execute({ id: '   ' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/required/i);
  });
});
