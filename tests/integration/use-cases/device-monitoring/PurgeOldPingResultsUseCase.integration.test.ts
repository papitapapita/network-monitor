// Source: src/application/device-monitoring/use-cases/PurgeOldPingResultsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { PurgeOldPingResultsUseCase } from 'application/device-monitoring/use-cases/PurgeOldPingResultsUseCase';
import { PrismaPingResultRepository } from 'infrastructure/persistence/PrismaPingResultRepository';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  seedDeviceModel,
  seedMonitoredDevice
} from '../../helpers/db';

const DAY_MS = 86_400_000;

describe('PurgeOldPingResultsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: PurgeOldPingResultsUseCase;
  let deviceModelId: string;
  let deviceId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    useCase = new PurgeOldPingResultsUseCase(
      new PrismaPingResultRepository(prisma)
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const seeded = await seedMonitoredDevice(prisma, deviceModelId);
    deviceId = seeded.deviceId;
  });

  // ──────────────────────────────────────────────────────────────
  // Fixtures
  // ──────────────────────────────────────────────────────────────

  async function seedPingResultAgeDays(
    ageDays: number
  ): Promise<void> {
    await prisma.pingResult.create({
      data: {
        deviceId,
        isReachable: true,
        latencyMs: 10,
        checkedAt: new Date(Date.now() - ageDays * DAY_MS)
      }
    });
  }

  function countPingResults(): Promise<number> {
    return prisma.pingResult.count();
  }

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('deletes results older than the retention window and keeps the rest', async () => {
    await seedPingResultAgeDays(40); // stale
    await seedPingResultAgeDays(35); // stale
    await seedPingResultAgeDays(10); // fresh
    await seedPingResultAgeDays(1); // fresh

    const result = await useCase.execute(30);

    expect(result.isSuccess).toBe(true);
    expect(result.value).toBe(2);
    expect(await countPingResults()).toBe(2);
  });

  it('returns the number of rows deleted', async () => {
    await seedPingResultAgeDays(100);
    await seedPingResultAgeDays(90);
    await seedPingResultAgeDays(80);

    const result = await useCase.execute(30);

    expect(result.isSuccess).toBe(true);
    expect(result.value).toBe(3);
    expect(await countPingResults()).toBe(0);
  });

  it('deletes nothing when every result is inside the window', async () => {
    await seedPingResultAgeDays(5);
    await seedPingResultAgeDays(2);

    const result = await useCase.execute(30);

    expect(result.isSuccess).toBe(true);
    expect(result.value).toBe(0);
    expect(await countPingResults()).toBe(2);
  });

  it('returns 0 when there are no ping results at all', async () => {
    const result = await useCase.execute(30);

    expect(result.isSuccess).toBe(true);
    expect(result.value).toBe(0);
  });

  // ──────────────────────────────────────────────────────────────
  // Cutoff boundary — deleteOlderThan uses a strict `<` comparison
  // ──────────────────────────────────────────────────────────────

  it('keeps a result sitting just inside the cutoff', async () => {
    // 30 days minus an hour old — newer than the 30-day cutoff.
    await prisma.pingResult.create({
      data: {
        deviceId,
        isReachable: true,
        latencyMs: 10,
        checkedAt: new Date(Date.now() - 30 * DAY_MS + 3_600_000)
      }
    });

    const result = await useCase.execute(30);

    expect(result.value).toBe(0);
    expect(await countPingResults()).toBe(1);
  });

  it('deletes a result sitting just outside the cutoff', async () => {
    // 30 days plus an hour old — older than the 30-day cutoff.
    await prisma.pingResult.create({
      data: {
        deviceId,
        isReachable: true,
        latencyMs: 10,
        checkedAt: new Date(Date.now() - 30 * DAY_MS - 3_600_000)
      }
    });

    const result = await useCase.execute(30);

    expect(result.value).toBe(1);
    expect(await countPingResults()).toBe(0);
  });

  // ──────────────────────────────────────────────────────────────
  // Retention window extremes
  // ──────────────────────────────────────────────────────────────

  it('purges everything before now when retention is 0 days', async () => {
    await seedPingResultAgeDays(2);
    await seedPingResultAgeDays(0.5);

    const result = await useCase.execute(0);

    expect(result.isSuccess).toBe(true);
    expect(result.value).toBe(2);
    expect(await countPingResults()).toBe(0);
  });

  it('keeps everything when the retention window is very large', async () => {
    await seedPingResultAgeDays(400);
    await seedPingResultAgeDays(200);

    const result = await useCase.execute(3650);

    expect(result.isSuccess).toBe(true);
    expect(result.value).toBe(0);
    expect(await countPingResults()).toBe(2);
  });

  // ──────────────────────────────────────────────────────────────
  // Isolation — the purge only touches ping results
  // ──────────────────────────────────────────────────────────────

  it('leaves the device and its polling config intact', async () => {
    await seedPingResultAgeDays(90);

    const result = await useCase.execute(30);

    expect(result.isSuccess).toBe(true);

    const device = await prisma.device.findUnique({
      where: { id: deviceId }
    });
    const pollingConfig = await prisma.pollingConfiguration.findFirst(
      {
        where: { deviceId }
      }
    );
    expect(device).not.toBeNull();
    expect(pollingConfig).not.toBeNull();
  });

  it('spans devices — purges by age, not per device', async () => {
    const other = await seedMonitoredDevice(
      prisma,
      deviceModelId,
      '192.168.99.2'
    );
    await seedPingResultAgeDays(90);
    await prisma.pingResult.create({
      data: {
        deviceId: other.deviceId,
        isReachable: false,
        latencyMs: null,
        checkedAt: new Date(Date.now() - 90 * DAY_MS)
      }
    });

    const result = await useCase.execute(30);

    expect(result.value).toBe(2);
    expect(await countPingResults()).toBe(0);
  });
});
