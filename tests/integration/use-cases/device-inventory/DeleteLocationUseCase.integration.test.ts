// Source: src/application/device-inventory/use-cases/DeleteLocationUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { DeleteLocationUseCase } from 'application/device-inventory/use-cases/DeleteLocationUseCase';
import { PrismaLocationRepository } from 'infrastructure/persistence/PrismaLocationRepository';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  seedLocation,
  seedDeviceModel,
  GHOST_ID
} from '../../helpers/db';

describe('DeleteLocationUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: DeleteLocationUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    const locationRepo = new PrismaLocationRepository(prisma);
    const deviceRepo = new PrismaDeviceRepository(prisma);
    const logger = new WinstonLogger();
    useCase = new DeleteLocationUseCase(
      locationRepo,
      deviceRepo,
      logger
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('deletes a location successfully and the row is no longer in the DB', async () => {
    const locationId = await seedLocation(prisma);

    const result = await useCase.execute({ id: locationId });

    expect(result.isSuccess).toBe(true);

    const row = await prisma.location.findUnique({
      where: { id: locationId }
    });
    expect(row).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────
  // Not found
  // ──────────────────────────────────────────────────────────────

  it('fails with a not-found error when the location does not exist', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  // ──────────────────────────────────────────────────────────────
  // Guard: location has assigned devices
  // ──────────────────────────────────────────────────────────────

  it('[DEV-097] fails with a "Cannot delete" error when the location has assigned devices', async () => {
    const locationId = await seedLocation(prisma);
    const deviceModelId = await seedDeviceModel(prisma);

    await prisma.device.create({
      data: {
        name: 'CPE-001',
        status: 'ACTIVE',
        owner: 'COMPANY',
        monitoringEnabled: false,
        locationId,
        deviceModelId,
        ipAddress: '10.0.0.1'
      }
    });

    const result = await useCase.execute({ id: locationId });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Cannot delete/i);
  });

  it('[DEV-097] does not remove the location row when devices are assigned', async () => {
    const locationId = await seedLocation(prisma);
    const deviceModelId = await seedDeviceModel(prisma);

    await prisma.device.create({
      data: {
        name: 'CPE-002',
        status: 'ACTIVE',
        owner: 'COMPANY',
        monitoringEnabled: false,
        locationId,
        deviceModelId,
        ipAddress: '10.0.0.2'
      }
    });

    await useCase.execute({ id: locationId });

    const row = await prisma.location.findUnique({
      where: { id: locationId }
    });
    expect(row).not.toBeNull();
  });

  it('[DEV-097] succeeds once all devices are removed from the location', async () => {
    const locationId = await seedLocation(prisma);
    const deviceModelId = await seedDeviceModel(prisma);

    const device = await prisma.device.create({
      data: {
        name: 'CPE-003',
        status: 'ACTIVE',
        owner: 'COMPANY',
        monitoringEnabled: false,
        locationId,
        deviceModelId,
        ipAddress: '10.0.0.3'
      }
    });

    const blockedResult = await useCase.execute({ id: locationId });
    expect(blockedResult.isFailure).toBe(true);

    await prisma.device.delete({ where: { id: device.id } });

    const result = await useCase.execute({ id: locationId });
    expect(result.isSuccess).toBe(true);

    const row = await prisma.location.findUnique({
      where: { id: locationId }
    });
    expect(row).toBeNull();
  });
});
