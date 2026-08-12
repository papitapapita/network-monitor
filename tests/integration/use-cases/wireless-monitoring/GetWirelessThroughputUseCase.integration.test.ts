import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetWirelessThroughputUseCase } from 'application/wireless-monitoring/use-cases/GetWirelessThroughputUseCase';
import { PrismaWirelessSnapshotRepository } from 'infrastructure/wireless-monitoring/repositories/PrismaWirelessSnapshotRepository';
import { PrismaWirelessDeviceConfigRepository } from 'infrastructure/wireless-monitoring/repositories/PrismaWirelessDeviceConfigRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  seedWirelessDeviceModel,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('GetWirelessThroughputUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: GetWirelessThroughputUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new GetWirelessThroughputUseCase(
      new PrismaWirelessSnapshotRepository(prisma),
      new PrismaWirelessDeviceConfigRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    deviceModelId = await seedWirelessDeviceModel(prisma);
  });

  // ──────────────────────────────────────────────────────────────
  // Local seed helpers
  // ──────────────────────────────────────────────────────────────

  async function seedDevice(ip: string): Promise<string> {
    const device = await prisma.device.create({
      data: {
        name: `Station ${ip}`,
        owner: 'COMPANY',
        status: 'ACTIVE',
        monitoringEnabled: true,
        ipAddress: ip,
        deviceModelId
      }
    });
    return device.id;
  }

  async function seedConfig(
    deviceId: string,
    linkCapacityKbps: number | null,
    intervalSecs = 3600
  ): Promise<void> {
    await prisma.wirelessPollingConfiguration.create({
      data: {
        deviceId,
        ipAddress: '192.168.60.1',
        enabled: true,
        intervalSecs,
        deviceType: 'STATION',
        linkCapacityKbps
      }
    });
  }

  async function seedSnapshot(
    deviceId: string,
    txBps: number | null,
    rxBps: number | null,
    collectedAt = new Date()
  ): Promise<void> {
    await prisma.wirelessSnapshot.create({
      data: {
        deviceId,
        deviceType: 'STATION',
        collectedAt,
        collectionMethod: 'http_api',
        throughputTxBps: txBps === null ? null : BigInt(txBps),
        throughputRxBps: rxBps === null ? null : BigInt(rxBps)
      }
    });
  }

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('reads the newest snapshot and reports utilisation against the plan', async () => {
    const deviceId = await seedDevice('192.168.60.10');
    await seedConfig(deviceId, 50_000);
    await seedSnapshot(deviceId, 8_000_000, 2_000_000);

    const result = await useCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toMatchObject({
      deviceId,
      deviceType: 'STATION',
      throughputTxBps: 8_000_000,
      throughputRxBps: 2_000_000,
      throughputTotalBps: 10_000_000,
      linkCapacityKbps: 50_000,
      utilisationPercent: 20,
      stale: false
    });
  });

  // bigints round-trip through the Prisma mapper as numbers
  it('reads back a multi-gigabit reading intact', async () => {
    const deviceId = await seedDevice('192.168.60.11');
    await seedConfig(deviceId, 1_000_000);
    await seedSnapshot(deviceId, 900_000_000, 100_000_000);

    const result = await useCase.execute({ deviceId });

    expect(result.value.throughputTotalBps).toBe(1_000_000_000);
    expect(result.value.utilisationPercent).toBe(100);
  });

  it('picks the newest of several snapshots', async () => {
    const deviceId = await seedDevice('192.168.60.12');
    await seedConfig(deviceId, 10_000);
    await seedSnapshot(
      deviceId,
      1_000_000,
      0,
      new Date(Date.now() - 60_000)
    );
    await seedSnapshot(deviceId, 5_000_000, 0);

    const result = await useCase.execute({ deviceId });

    expect(result.value.throughputTxBps).toBe(5_000_000);
  });

  // ──────────────────────────────────────────────────────────────
  // [WLS-147] capacity
  // ──────────────────────────────────────────────────────────────

  it('reports null utilisation when the config carries no capacity', async () => {
    const deviceId = await seedDevice('192.168.60.13');
    await seedConfig(deviceId, null);
    await seedSnapshot(deviceId, 1_000_000, 0);

    const result = await useCase.execute({ deviceId });

    expect(result.value.linkCapacityKbps).toBeNull();
    expect(result.value.utilisationPercent).toBeNull();
  });

  it('reports null utilisation when a throughput leg was not collected', async () => {
    const deviceId = await seedDevice('192.168.60.14');
    await seedConfig(deviceId, 10_000);
    await seedSnapshot(deviceId, 1_000_000, null);

    const result = await useCase.execute({ deviceId });

    expect(result.value.throughputTotalBps).toBeNull();
    expect(result.value.utilisationPercent).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────
  // [WLS-148] staleness
  // ──────────────────────────────────────────────────────────────

  it('flags a reading older than two poll intervals as stale', async () => {
    const deviceId = await seedDevice('192.168.60.15');
    await seedConfig(deviceId, 10_000, 60);
    await seedSnapshot(
      deviceId,
      1_000_000,
      0,
      new Date(Date.now() - 300_000)
    );

    const result = await useCase.execute({ deviceId });

    expect(result.value.stale).toBe(true);
    expect(result.value.ageSeconds).toBeGreaterThanOrEqual(299);
  });

  // the config cascades away with the device, but a snapshot can be orphaned
  // by a plain config delete
  it('still reports a reading when the configuration was deleted', async () => {
    const deviceId = await seedDevice('192.168.60.16');
    await seedConfig(deviceId, 10_000);
    await seedSnapshot(deviceId, 1_000_000, 0);
    await prisma.wirelessPollingConfiguration.deleteMany({
      where: { deviceId }
    });

    const result = await useCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.stale).toBe(true);
    expect(result.value.linkCapacityKbps).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────
  // [WLS-140] not found and validation
  // ──────────────────────────────────────────────────────────────

  it('fails when the device has never been polled', async () => {
    const deviceId = await seedDevice('192.168.60.17');
    await seedConfig(deviceId, 10_000);

    const result = await useCase.execute({ deviceId });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('No wireless data found for device');
  });

  it('fails for a device that does not exist', async () => {
    const result = await useCase.execute({ deviceId: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('No wireless data found for device');
  });

  it('fails for a malformed device id', async () => {
    const result = await useCase.execute({ deviceId: INVALID_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid device ID');
  });

  // deleting the device cascades its snapshots away
  it('stops reporting once the device is deleted', async () => {
    const deviceId = await seedDevice('192.168.60.18');
    await seedConfig(deviceId, 10_000);
    await seedSnapshot(deviceId, 1_000_000, 0);
    await prisma.device.delete({ where: { id: deviceId } });

    const result = await useCase.execute({ deviceId });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('No wireless data found for device');
  });
});
