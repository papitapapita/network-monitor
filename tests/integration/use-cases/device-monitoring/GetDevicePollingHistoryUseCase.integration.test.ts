import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetDevicePollingHistoryUseCase } from 'application/device-monitoring/use-cases/GetDevicePollingHistoryUseCase';
import { ExecutePollingCycleUseCase } from 'application/device-monitoring/use-cases/ExecutePollingCycleUseCase';
import { IngestPingResultsUseCase } from 'application/device-monitoring/use-cases/IngestPingResultsUseCase';
import { PingCycleProbe } from 'application/device-monitoring/services';
import { PrismaPollingConfigurationRepository } from 'infrastructure/persistence/PrismaPollingConfigurationRepository';
import { PrismaPingResultRepository } from 'infrastructure/persistence/PrismaPingResultRepository';
import { PrismaDeviceStateRepository } from 'infrastructure/persistence/PrismaDeviceStateRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { DeviceEligibilityService } from 'domain/device-inventory/services';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  seedDeviceModel,
  seedMonitoredDevice
} from '../../helpers/db';
import { FakePingService } from '../../helpers/FakePingService';

describe('GetDevicePollingHistoryUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let historyUseCase: GetDevicePollingHistoryUseCase;
  let executeUseCase: ExecutePollingCycleUseCase;
  let fakePing: FakePingService;
  let deviceModelId: string;
  let deviceId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    const pollingConfigRepo =
      new PrismaPollingConfigurationRepository(prisma);
    const pingResultRepo = new PrismaPingResultRepository(prisma);
    const deviceStateRepo = new PrismaDeviceStateRepository(prisma);
    const logger = new WinstonLogger();

    fakePing = new FakePingService();
    historyUseCase = new GetDevicePollingHistoryUseCase(
      pingResultRepo,
      logger
    );
    executeUseCase = new ExecutePollingCycleUseCase(
      pollingConfigRepo,
      new PrismaDeviceRepository(prisma),
      new DeviceEligibilityService(),
      new PingCycleProbe(fakePing),
      new IngestPingResultsUseCase(
        pollingConfigRepo,
        pingResultRepo,
        deviceStateRepo,
        logger
      ),
      logger
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const seeded = await seedMonitoredDevice(prisma, deviceModelId);
    deviceId = seeded.deviceId;
    fakePing.setResult({ isReachable: true, latencyMs: 10 });
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('returns empty history when no polling cycles have run', async () => {
    const result = await historyUseCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.results).toHaveLength(0);
    expect(result.value.totalCount).toBe(0);
  });

  it('returns all polling results after N cycles', async () => {
    for (let i = 0; i < 5; i++) {
      await executeUseCase.execute({
        deviceId,
        forceExecution: true
      });
    }

    const result = await historyUseCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.totalCount).toBe(5);
    expect(result.value.results).toHaveLength(5);
  });

  it('applies pagination via limit and offset', async () => {
    for (let i = 0; i < 6; i++) {
      await executeUseCase.execute({
        deviceId,
        forceExecution: true
      });
    }

    const page1 = await historyUseCase.execute({
      deviceId,
      limit: 3,
      offset: 0
    });
    expect(page1.isSuccess).toBe(true);
    expect(page1.value.results).toHaveLength(3);
    expect(page1.value.totalCount).toBe(6);

    const page2 = await historyUseCase.execute({
      deviceId,
      limit: 3,
      offset: 3
    });
    expect(page2.value.results).toHaveLength(3);
  });

  it('filters by SUCCESS status (reachable only)', async () => {
    fakePing.setResult({ isReachable: true, latencyMs: 10 });
    await executeUseCase.execute({ deviceId, forceExecution: true });
    await executeUseCase.execute({ deviceId, forceExecution: true });

    fakePing.setResult({ isReachable: false, latencyMs: null });
    await executeUseCase.execute({ deviceId, forceExecution: true });

    const result = await historyUseCase.execute({
      deviceId,
      status: ['SUCCESS']
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.totalCount).toBe(2);
    expect(
      result.value.results.every((r) => r.status === 'SUCCESS')
    ).toBe(true);
  });

  it('filters by FAILED status (unreachable only)', async () => {
    fakePing.setResult({ isReachable: true, latencyMs: 10 });
    await executeUseCase.execute({ deviceId, forceExecution: true });

    fakePing.setResult({ isReachable: false, latencyMs: null });
    await executeUseCase.execute({ deviceId, forceExecution: true });
    await executeUseCase.execute({ deviceId, forceExecution: true });

    const result = await historyUseCase.execute({
      deviceId,
      status: ['FAILED']
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.totalCount).toBe(2);
    expect(
      result.value.results.every((r) => r.status === 'FAILED')
    ).toBe(true);
  });

  it('filters by date range', async () => {
    const before = new Date();

    for (let i = 0; i < 3; i++) {
      await executeUseCase.execute({
        deviceId,
        forceExecution: true
      });
    }

    const after = new Date();

    const result = await historyUseCase.execute({
      deviceId,
      fromDate: before,
      toDate: after
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.totalCount).toBe(3);
  });

  // ──────────────────────────────────────────────────────────────
  // Validation failures
  // ──────────────────────────────────────────────────────────────

  describe('[MON-043] statistics cover the whole window, whatever the page', () => {
    const DAY_START = new Date('2026-10-25T00:00:00.000Z');
    const minute = (n: number) =>
      new Date(DAY_START.getTime() + n * 60_000);

    // One ping a minute for a day: the bug report's scenario.
    async function seedDay(
      isReachableAt: (i: number) => boolean,
      latencyAt: (i: number) => number
    ): Promise<void> {
      await prisma.pingResult.createMany({
        data: Array.from({ length: 1440 }, (_, i) => ({
          deviceId,
          isReachable: isReachableAt(i),
          latencyMs: isReachableAt(i) ? latencyAt(i) : null,
          checkedAt: minute(i)
        }))
      });
    }

    it('reports 100% for a device that always answered, at any limit', async () => {
      await seedDay(
        () => true,
        () => 10
      );

      for (const limit of [50, 500]) {
        const result = await historyUseCase.execute({
          deviceId,
          fromDate: DAY_START,
          limit
        });

        expect(result.value.totalCount).toBe(1440);
        expect(result.value.results).toHaveLength(limit);
        expect(result.value.statistics.successRate).toBe(100);
        expect(result.value.statistics.uptimePercentage).toBe(100);
      }
    });

    it('computes latency over the whole window, the same on every page', async () => {
      await seedDay(
        () => true,
        (i) => i + 1
      );

      const first = await historyUseCase.execute({
        deviceId,
        fromDate: DAY_START,
        limit: 50
      });
      const later = await historyUseCase.execute({
        deviceId,
        fromDate: DAY_START,
        limit: 50,
        offset: 700
      });

      const expected = {
        successRate: 100,
        averageResponseTime: 720.5,
        minResponseTime: 1,
        maxResponseTime: 1440,
        uptimePercentage: 100
      };
      expect(first.value.statistics).toEqual(expected);
      expect(later.value.statistics).toEqual(expected);
    });

    it('counts failures across the window and keeps them out of latency', async () => {
      // every fourth ping fails
      await seedDay(
        (i) => i % 4 !== 0,
        () => 20
      );

      const result = await historyUseCase.execute({
        deviceId,
        fromDate: DAY_START,
        limit: 10
      });

      expect(result.value.statistics.successRate).toBe(75);
      expect(result.value.statistics.averageResponseTime).toBe(20);
    });

    it('follows the date window but not the status filter', async () => {
      await seedDay(
        (i) => i % 4 !== 0,
        () => 20
      );

      const result = await historyUseCase.execute({
        deviceId,
        fromDate: DAY_START,
        toDate: minute(99),
        status: ['FAILED'],
        limit: 5
      });

      expect(result.value.totalCount).toBe(25);
      expect(
        result.value.results.every((r) => r.status === 'FAILED')
      ).toBe(true);
      expect(result.value.statistics.successRate).toBe(75);
      expect(result.value.statistics.averageResponseTime).toBe(20);
    });
  });

  it('fails when deviceId is empty', async () => {
    const result = await historyUseCase.execute({ deviceId: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/required/i);
  });

  it('fails when limit exceeds maximum (1000)', async () => {
    const result = await historyUseCase.execute({
      deviceId,
      limit: 1001
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/limit/i);
  });

  it('fails when fromDate is after toDate', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60_000);

    const result = await historyUseCase.execute({
      deviceId,
      fromDate: now,
      toDate: past
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/fromDate/i);
  });
});
