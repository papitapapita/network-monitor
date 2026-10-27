import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ListSpeedTestsUseCase } from 'application/device-monitoring/use-cases/ListSpeedTestsUseCase';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase } from '../../helpers/db';
import {
  buildSpeedTestUseCases,
  FakeSpeedTester,
  seedSpeedTest
} from '../../helpers/speedTests';

describe('ListSpeedTestsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ListSpeedTestsUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    useCase = buildSpeedTestUseCases(
      prisma,
      new FakeSpeedTester(),
      new WinstonLogger()
    ).list;
  });

  it('lists every kept test, newest first, failed ones included', async () => {
    const older = await seedSpeedTest(prisma, {
      startedAt: new Date('2026-10-20T10:00:00Z')
    });
    const newer = await seedSpeedTest(prisma, {
      startedAt: new Date('2026-10-27T10:00:00Z'),
      downloadMbps: null,
      error: 'Download failed: the server answered 429'
    });

    const result = await useCase.execute({});

    expect(result.value.total).toBe(2);
    expect(result.value.hasMore).toBe(false);
    expect(result.value.results.map((r) => r.id)).toEqual([
      newer,
      older
    ]);
    expect(result.value.results[0]).toMatchObject({
      status: 'FAILED',
      downloadMbps: null,
      error: 'Download failed: the server answered 429',
      durationMs: 25_000
    });
  });

  it('pages without repeating or skipping a test', async () => {
    const ids: string[] = [];
    for (let day = 1; day <= 5; day++) {
      ids.unshift(
        await seedSpeedTest(prisma, {
          startedAt: new Date(`2026-10-0${day}T10:00:00Z`)
        })
      );
    }

    const first = await useCase.execute({ limit: 2, offset: 0 });
    const second = await useCase.execute({ limit: 2, offset: 2 });
    const last = await useCase.execute({ limit: 2, offset: 4 });

    expect(first.value.hasMore).toBe(true);
    expect(last.value.hasMore).toBe(false);
    expect(
      [first, second, last].flatMap((page) =>
        page.value.results.map((r) => r.id)
      )
    ).toEqual(ids);
  });

  it('is empty when no test was ever run', async () => {
    const result = await useCase.execute({});

    expect(result.value).toMatchObject({
      results: [],
      total: 0,
      hasMore: false
    });
  });

  it('rejects a limit above 100', async () => {
    const result = await useCase.execute({ limit: 101 });

    expect(result.error).toBe('limit must be between 1 and 100');
  });
});
