import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  RunSpeedTestUseCase,
  SPEED_TEST_NEEDS_SERVER_ON_SITE
} from 'application/device-monitoring/use-cases/RunSpeedTestUseCase';
import { RunSpeedTestDTO } from 'application/device-monitoring/dtos';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase } from '../../helpers/db';
import { seedUser } from '../../helpers/auth';
import {
  buildSpeedTestUseCases,
  FakeSpeedTester
} from '../../helpers/speedTests';

describe('RunSpeedTestUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let tester: FakeSpeedTester;
  let useCase: RunSpeedTestUseCase;
  let userId: string;

  function request(
    overrides: Partial<RunSpeedTestDTO> = {}
  ): RunSpeedTestDTO {
    return {
      startedBy: { userId, email: 'operator@example.local' },
      onStart: () => undefined,
      onProgress: () => undefined,
      ...overrides
    };
  }

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
    await seedUser(
      prisma,
      'operator@example.local',
      'x-pass-123',
      'OPERATOR'
    );
    userId = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'operator@example.local' }
      })
    ).id;
    tester = new FakeSpeedTester();
    useCase = buildSpeedTestUseCases(
      prisma,
      tester,
      new WinstonLogger()
    ).run;
  });

  it('keeps a completed test with who started it', async () => {
    const result = await useCase.execute(request());

    const rows = await prisma.speedTestResult.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: result.value.result!.id,
      status: 'COMPLETED',
      downloadMbps: 95.4,
      uploadMbps: 42.1,
      latencyMs: 8.2,
      jitterMs: 1.3,
      serverLocation: 'BOG',
      error: null,
      startedById: userId,
      startedByEmail: 'operator@example.local'
    });
    expect(rows[0].finishedAt.getTime()).toBeGreaterThanOrEqual(
      rows[0].startedAt.getTime()
    );
  });

  it('keeps a failed test with what it measured', async () => {
    tester.measurement = {
      ...tester.measurement,
      uploadMbps: null,
      error: 'Upload failed: the server answered 503'
    };

    await useCase.execute(request());

    const row = await prisma.speedTestResult.findFirstOrThrow();
    expect(row).toMatchObject({
      status: 'FAILED',
      downloadMbps: 95.4,
      uploadMbps: null,
      error: 'Upload failed: the server answered 503'
    });
  });

  it('keeps nothing for a test the caller stopped', async () => {
    tester.gated = true;
    const abort = new AbortController();

    const running = useCase.execute(
      request({ signal: abort.signal })
    );
    abort.abort();
    const result = await running;

    expect(result.value.cancelled).toBe(true);
    expect(await prisma.speedTestResult.count()).toBe(0);
  });

  it('keeps the result after the user who started it is deleted', async () => {
    await useCase.execute(request());

    await prisma.user.delete({ where: { id: userId } });

    const row = await prisma.speedTestResult.findFirstOrThrow();
    expect(row.startedById).toBeNull();
    expect(row.startedByEmail).toBe('operator@example.local');
  });

  it('measures nothing and keeps nothing off site', async () => {
    const offSite = buildSpeedTestUseCases(
      prisma,
      tester,
      new WinstonLogger(),
      false
    ).run;

    const result = await offSite.execute(request());

    expect(result.error).toBe(SPEED_TEST_NEEDS_SERVER_ON_SITE);
    expect(await prisma.speedTestResult.count()).toBe(0);
  });
});
