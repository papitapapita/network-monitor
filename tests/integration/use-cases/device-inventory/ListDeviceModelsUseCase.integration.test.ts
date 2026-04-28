import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ListDeviceModelsUseCase } from 'application/device-inventory/use-cases/ListDeviceModelsUseCase';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase, seedDeviceModel } from '../../helpers/db';

describe('ListDeviceModelsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ListDeviceModelsUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    // Ensure at least one model exists
    await seedDeviceModel(prisma);

    const repo = new PrismaDeviceModelRepository(prisma);
    const logger = new WinstonLogger();
    useCase = new ListDeviceModelsUseCase(repo, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    // Device models are not cleaned — they are shared read-only catalog data
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('returns the seeded device model with pagination metadata', async () => {
    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(result.value.deviceModels.length).toBeGreaterThanOrEqual(1);
    expect(result.value.total).toBeGreaterThanOrEqual(1);
    expect(result.value.limit).toBeDefined();
    expect(result.value.offset).toBeDefined();
    expect(result.value.hasMore).toBeDefined();

    const mikrotik = result.value.deviceModels.find((m) => m.manufacturer === 'MIKROTIK');
    expect(mikrotik).toBeDefined();
    expect(mikrotik!.model).toBe('RB4011iGS+');
  });

  it('respects the limit parameter', async () => {
    const result = await useCase.execute({ limit: 1, offset: 0 });

    expect(result.isSuccess).toBe(true);
    expect(result.value.deviceModels).toHaveLength(1);
    expect(result.value.limit).toBe(1);
  });

  it('respects the offset parameter', async () => {
    const all = await useCase.execute({ limit: 100, offset: 0 });
    const total = all.value.total;

    if (total >= 2) {
      const withOffset = await useCase.execute({ limit: 100, offset: 1 });
      expect(withOffset.value.deviceModels).toHaveLength(total - 1);
    }
  });
});
