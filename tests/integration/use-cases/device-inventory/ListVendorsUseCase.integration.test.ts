// Source: src/application/device-inventory/use-cases/ListVendorsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ListVendorsUseCase } from 'application/device-inventory/use-cases/ListVendorsUseCase';
import { PrismaVendorRepository } from 'infrastructure/persistence/PrismaVendorRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanCatalog, seedVendor } from '../../helpers/db';

describe('ListVendorsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ListVendorsUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    const repo = new PrismaVendorRepository(prisma);
    const logger = new WinstonLogger();
    useCase = new ListVendorsUseCase(repo, logger);
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

  it('returns a list that includes the seeded vendor', async () => {
    await seedVendor(prisma, { name: 'MikroTik', slug: 'mikrotik' });

    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(result.value.vendors.length).toBeGreaterThanOrEqual(1);

    const mikrotik = result.value.vendors.find((v) => v.name === 'MikroTik');
    expect(mikrotik).toBeDefined();
  });

  it('returns total count of at least 1 after seeding one vendor', async () => {
    await seedVendor(prisma);

    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(result.value.total).toBeGreaterThanOrEqual(1);
  });

  it('respects the limit parameter and returns only limit items', async () => {
    await seedVendor(prisma, { name: 'Vendor A', slug: 'vendor-a' });
    await seedVendor(prisma, { name: 'Vendor B', slug: 'vendor-b' });
    await seedVendor(prisma, { name: 'Vendor C', slug: 'vendor-c' });

    const result = await useCase.execute({ limit: 1, offset: 0 });

    expect(result.isSuccess).toBe(true);
    expect(result.value.vendors).toHaveLength(1);
    expect(result.value.limit).toBe(1);
  });

  it('includes pagination metadata (total, hasMore, limit, offset) in the response', async () => {
    await seedVendor(prisma);

    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(result.value).toHaveProperty('total');
    expect(result.value).toHaveProperty('hasMore');
    expect(result.value).toHaveProperty('limit');
    expect(result.value).toHaveProperty('offset');
  });
});
