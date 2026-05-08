// Source: src/application/device-inventory/use-cases/UpdateVendorUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { UpdateVendorUseCase } from 'application/device-inventory/use-cases/UpdateVendorUseCase';
import { PrismaVendorRepository } from 'infrastructure/persistence/PrismaVendorRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanCatalog, seedVendor, GHOST_ID } from '../../helpers/db';

describe('UpdateVendorUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: UpdateVendorUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    const repo = new PrismaVendorRepository(prisma);
    const logger = new WinstonLogger();
    useCase = new UpdateVendorUseCase(repo, logger);
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

  it('updates the vendor name only, leaving slug unchanged', async () => {
    const vendorId = await seedVendor(prisma, { name: 'Old Name', slug: 'old-name' });

    const result = await useCase.execute({ id: vendorId, name: 'New Name' });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe('New Name');
    expect(result.value.slug).toBe('old-name');
  });

  it('updates the vendor slug only, leaving name unchanged', async () => {
    const vendorId = await seedVendor(prisma, { name: 'Stable Name', slug: 'old-slug' });

    const result = await useCase.execute({ id: vendorId, slug: 'new-slug' });

    expect(result.isSuccess).toBe(true);
    expect(result.value.slug).toBe('new-slug');
    expect(result.value.name).toBe('Stable Name');
  });

  it('updates description to null', async () => {
    const vendorId = await seedVendor(prisma, {
      name: 'Has Desc',
      slug: 'has-desc',
      description: 'Old description'
    });

    const result = await useCase.execute({ id: vendorId, description: null });

    expect(result.isSuccess).toBe(true);
    expect(result.value.description).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────
  // Slug conflict
  // ──────────────────────────────────────────────────────────────

  it('fails when the new slug is already taken by another vendor', async () => {
    await seedVendor(prisma, { name: 'Alpha', slug: 'alpha-vendor' });
    const betaId = await seedVendor(prisma, { name: 'Beta', slug: 'beta-vendor' });

    const result = await useCase.execute({ id: betaId, slug: 'alpha-vendor' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/already exists/i);
  });

  // ──────────────────────────────────────────────────────────────
  // Not found
  // ──────────────────────────────────────────────────────────────

  it('fails with a not-found error when the vendor does not exist (GHOST_ID)', async () => {
    const result = await useCase.execute({ id: GHOST_ID, name: 'Ghost' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });
});
