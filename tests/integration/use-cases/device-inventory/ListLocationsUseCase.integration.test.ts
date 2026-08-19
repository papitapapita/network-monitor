import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateLocationUseCase } from 'application/device-inventory/use-cases/CreateLocationUseCase';
import { ListLocationsUseCase } from 'application/device-inventory/use-cases/ListLocationsUseCase';
import { PrismaLocationRepository } from 'infrastructure/persistence/PrismaLocationRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase } from '../../helpers/db';

describe('ListLocationsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let createUseCase: CreateLocationUseCase;
  let listUseCase: ListLocationsUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    const repo = new PrismaLocationRepository(prisma);
    const logger = new WinstonLogger();
    createUseCase = new CreateLocationUseCase(repo, logger);
    listUseCase = new ListLocationsUseCase(repo, logger);
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

  it('returns empty list when no locations exist', async () => {
    const result = await listUseCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(result.value.locations).toHaveLength(0);
    expect(result.value.total).toBe(0);
    expect(result.value.hasMore).toBe(false);
  });

  it('returns all locations with pagination metadata', async () => {
    await createUseCase.execute({ name: 'Tower A', type: 'TOWER' });
    await createUseCase.execute({ name: 'Office B', type: 'OFFICE' });

    const result = await listUseCase.execute({
      limit: 20,
      offset: 0
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.locations).toHaveLength(2);
    expect(result.value.total).toBe(2);
    expect(result.value.hasMore).toBe(false);
  });

  it('filters by type', async () => {
    await createUseCase.execute({ name: 'Tower A', type: 'TOWER' });
    await createUseCase.execute({ name: 'Tower B', type: 'TOWER' });
    await createUseCase.execute({ name: 'Office C', type: 'OFFICE' });

    const result = await listUseCase.execute({ type: 'TOWER' });

    expect(result.isSuccess).toBe(true);
    expect(result.value.locations).toHaveLength(2);
    expect(
      result.value.locations.every((l) => l.type === 'TOWER')
    ).toBe(true);
  });

  it('applies pagination via limit and offset', async () => {
    for (let i = 1; i <= 4; i++) {
      await createUseCase.execute({
        name: `Location ${i}`,
        type: 'OFFICE'
      });
    }

    const page1 = await listUseCase.execute({ limit: 2, offset: 0 });
    expect(page1.isSuccess).toBe(true);
    expect(page1.value.locations).toHaveLength(2);
    expect(page1.value.hasMore).toBe(true);

    const page2 = await listUseCase.execute({ limit: 2, offset: 2 });
    expect(page2.value.locations).toHaveLength(2);
    expect(page2.value.hasMore).toBe(false);
  });
});
