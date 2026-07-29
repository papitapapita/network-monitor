// Source: src/application/device-inventory/use-cases/UpdateDeviceModelUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { UpdateDeviceModelUseCase } from 'application/device-inventory/use-cases/UpdateDeviceModelUseCase';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { PrismaVendorRepository } from 'infrastructure/persistence/PrismaVendorRepository';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { PrismaWirelessDeviceConfigRepository } from 'infrastructure/wireless-monitoring/repositories/PrismaWirelessDeviceConfigRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanCatalog, seedVendor, GHOST_ID } from '../../helpers/db';

describe('UpdateDeviceModelUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: UpdateDeviceModelUseCase;
  let vendorId: string;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    const deviceModelRepo = new PrismaDeviceModelRepository(prisma);
    const vendorRepo = new PrismaVendorRepository(prisma);
    const deviceRepo = new PrismaDeviceRepository(prisma);
    const wirelessConfigRepo = new PrismaWirelessDeviceConfigRepository(prisma);
    const logger = new WinstonLogger();
    useCase = new UpdateDeviceModelUseCase(
      deviceModelRepo,
      vendorRepo,
      deviceRepo,
      wirelessConfigRepo,
      logger
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCatalog(prisma);
    vendorId = await seedVendor(prisma, { name: 'MikroTik', slug: 'mikrotik' });

    const model = await prisma.deviceModel.create({
      data: {
        vendorId,
        model: 'RB4011iGS+',
        deviceType: 'ROUTERBOARD'
      }
    });
    deviceModelId = model.id;
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('updates the model name and result.value.model matches the new name', async () => {
    const result = await useCase.execute({ id: deviceModelId, model: 'hAP ac3' });

    expect(result.isSuccess).toBe(true);
    expect(result.value.model).toBe('hAP ac3');
    expect(result.value.deviceType).toBe('ROUTERBOARD');
  });

  it('[DEV-024] updates the deviceType and result.value.deviceType matches the new type', async () => {
    const result = await useCase.execute({ id: deviceModelId, deviceType: 'ROUTER' });

    expect(result.isSuccess).toBe(true);
    expect(result.value.deviceType).toBe('ROUTER');
    expect(result.value.model).toBe('RB4011iGS+');
  });

  // ──────────────────────────────────────────────────────────────
  // Not found
  // ──────────────────────────────────────────────────────────────

  it('fails with a not-found error when the device model does not exist (GHOST_ID)', async () => {
    const result = await useCase.execute({ id: GHOST_ID, model: 'GhostModel' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });
});
