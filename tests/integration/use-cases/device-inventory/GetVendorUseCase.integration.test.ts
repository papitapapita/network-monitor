// Source: src/application/device-inventory/use-cases/GetVendorUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetVendorUseCase } from 'application/device-inventory/use-cases/GetVendorUseCase';
import { PrismaVendorRepository } from 'infrastructure/persistence/PrismaVendorRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanCatalog, seedVendor, GHOST_ID, INVALID_ID } from '../../helpers/db';

describe('GetVendorUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: GetVendorUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    const repo = new PrismaVendorRepository(prisma);
    const logger = new WinstonLogger();
    useCase = new GetVendorUseCase(repo, logger);
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

  it('retrieves a vendor by ID and the name matches the seeded vendor', async () => {
    const vendorId = await seedVendor(prisma, { name: 'MikroTik', slug: 'mikrotik' });

    const result = await useCase.execute({ id: vendorId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.id).toBe(vendorId);
    expect(result.value.name).toBe('MikroTik');
    expect(result.value.slug).toBe('mikrotik');
  });

  // ──────────────────────────────────────────────────────────────
  // Not found / validation failures
  // ──────────────────────────────────────────────────────────────

  it('fails with a not-found error when the vendor does not exist (GHOST_ID)', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  it('fails with a validation error when id is empty', async () => {
    const result = await useCase.execute({ id: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/required/i);
  });

  it('fails when id is not a valid UUID', async () => {
    const result = await useCase.execute({ id: INVALID_ID });

    expect(result.isFailure).toBe(true);
  });
});
