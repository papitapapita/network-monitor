// Source: src/application/device-inventory/use-cases/DeleteDeviceModelUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { DeleteDeviceModelUseCase } from 'application/device-inventory/use-cases/DeleteDeviceModelUseCase';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanCatalog,
  seedVendor,
  seedMonitoredDevice,
  GHOST_ID
} from '../../helpers/db';

describe('DeleteDeviceModelUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: DeleteDeviceModelUseCase;
  let vendorId: string;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    const deviceModelRepo = new PrismaDeviceModelRepository(prisma);
    const deviceRepo = new PrismaDeviceRepository(prisma);
    const logger = new WinstonLogger();
    useCase = new DeleteDeviceModelUseCase(deviceModelRepo, deviceRepo, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCatalog(prisma);
    vendorId = await seedVendor(prisma, { name: 'Ubiquiti', slug: 'ubiquiti' });

    const model = await prisma.deviceModel.create({
      data: {
        vendorId,
        model: 'UniFi AP',
        deviceType: 'RADIO'
      }
    });
    deviceModelId = model.id;
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('deletes a device model successfully and it is no longer found in the DB', async () => {
    const result = await useCase.execute({ id: deviceModelId });

    expect(result.isSuccess).toBe(true);

    const row = await prisma.deviceModel.findUnique({ where: { id: deviceModelId } });
    expect(row).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────
  // Not found
  // ──────────────────────────────────────────────────────────────

  it('fails with a not-found error when the device model does not exist (GHOST_ID)', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  // ──────────────────────────────────────────────────────────────
  // Guard: device model has associated devices
  // ──────────────────────────────────────────────────────────────

  it('[DEV-026] fails with a "Cannot delete" error when the device model has associated devices', async () => {
    await seedMonitoredDevice(prisma, deviceModelId, '192.168.50.1');

    const result = await useCase.execute({ id: deviceModelId });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Cannot delete/i);
  });
});
