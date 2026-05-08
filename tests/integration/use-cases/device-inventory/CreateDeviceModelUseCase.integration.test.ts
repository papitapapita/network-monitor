// Source: src/application/device-inventory/use-cases/CreateDeviceModelUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateDeviceModelUseCase } from 'application/device-inventory/use-cases/CreateDeviceModelUseCase';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { PrismaVendorRepository } from 'infrastructure/persistence/PrismaVendorRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanCatalog, seedVendor, GHOST_ID, INVALID_ID } from '../../helpers/db';

describe('CreateDeviceModelUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: CreateDeviceModelUseCase;
  let vendorId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    const deviceModelRepo = new PrismaDeviceModelRepository(prisma);
    const vendorRepo = new PrismaVendorRepository(prisma);
    const logger = new WinstonLogger();
    useCase = new CreateDeviceModelUseCase(deviceModelRepo, vendorRepo, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCatalog(prisma);
    vendorId = await seedVendor(prisma, { name: 'MikroTik', slug: 'mikrotik' });
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('creates a device model successfully and returns vendorName', async () => {
    const result = await useCase.execute({
      vendorId,
      model: 'RB4011iGS+',
      deviceType: 'ROUTERBOARD'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.id).toBeDefined();
    expect(result.value.vendorId).toBe(vendorId);
    expect(result.value.vendorName).toBe('MikroTik');
    expect(result.value.model).toBe('RB4011iGS+');
    expect(result.value.deviceType).toBe('ROUTERBOARD');
  });

  // ──────────────────────────────────────────────────────────────
  // Duplicate
  // ──────────────────────────────────────────────────────────────

  it('fails when the same vendorId and model already exist', async () => {
    await useCase.execute({ vendorId, model: 'hAP ac3', deviceType: 'ROUTER' });

    const second = await useCase.execute({ vendorId, model: 'hAP ac3', deviceType: 'ROUTER' });

    expect(second.isFailure).toBe(true);
    expect(second.error).toMatch(/already exists/i);
  });

  // ──────────────────────────────────────────────────────────────
  // Validation failures
  // ──────────────────────────────────────────────────────────────

  it('fails when vendorId is not a valid UUID', async () => {
    const result = await useCase.execute({
      vendorId: INVALID_ID,
      model: 'SomeModel',
      deviceType: 'ROUTER'
    });

    expect(result.isFailure).toBe(true);
  });

  it('fails when the vendor does not exist (GHOST_ID as vendorId)', async () => {
    const result = await useCase.execute({
      vendorId: GHOST_ID,
      model: 'GhostModel',
      deviceType: 'SWITCH'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });
});
