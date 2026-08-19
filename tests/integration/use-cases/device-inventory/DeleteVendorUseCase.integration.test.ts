// Source: src/application/device-inventory/use-cases/DeleteVendorUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { DeleteVendorUseCase } from 'application/device-inventory/use-cases/DeleteVendorUseCase';
import { PrismaVendorRepository } from 'infrastructure/persistence/PrismaVendorRepository';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanCatalog, seedVendor, GHOST_ID } from '../../helpers/db';

describe('DeleteVendorUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: DeleteVendorUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    const vendorRepo = new PrismaVendorRepository(prisma);
    const deviceModelRepo = new PrismaDeviceModelRepository(prisma);
    const logger = new WinstonLogger();
    useCase = new DeleteVendorUseCase(
      vendorRepo,
      deviceModelRepo,
      logger
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCatalog(prisma);
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('deletes a vendor successfully and the vendor is no longer found in the DB', async () => {
    const vendorId = await seedVendor(prisma);

    const result = await useCase.execute({ id: vendorId });

    expect(result.isSuccess).toBe(true);

    const row = await prisma.vendor.findUnique({
      where: { id: vendorId }
    });
    expect(row).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────
  // Not found
  // ──────────────────────────────────────────────────────────────

  it('[DEV-008] fails with a not-found error when the vendor does not exist (GHOST_ID)', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  // ──────────────────────────────────────────────────────────────
  // Guard: vendor has device models
  // ──────────────────────────────────────────────────────────────

  it('[DEV-005] fails with a "Cannot delete" error when the vendor has associated device models', async () => {
    const vendorId = await seedVendor(prisma, {
      name: 'Locked Vendor',
      slug: 'locked-vendor'
    });

    await prisma.deviceModel.create({
      data: {
        vendorId,
        model: 'LockedModel',
        deviceType: 'ROUTER'
      }
    });

    const result = await useCase.execute({ id: vendorId });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Cannot delete/i);
  });
});
