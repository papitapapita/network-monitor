import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetFleetWirelessThroughputUseCase } from 'application/wireless-monitoring/use-cases/GetFleetWirelessThroughputUseCase';
import { PrismaWirelessSnapshotRepository } from 'infrastructure/wireless-monitoring/repositories/PrismaWirelessSnapshotRepository';
import { PrismaWirelessDeviceConfigRepository } from 'infrastructure/wireless-monitoring/repositories/PrismaWirelessDeviceConfigRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  seedWirelessDeviceModel
} from '../../helpers/db';
import { WirelessThroughputDTO } from 'application/wireless-monitoring/dtos';

describe('GetFleetWirelessThroughputUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: GetFleetWirelessThroughputUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new GetFleetWirelessThroughputUseCase(
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
        ipAddress: '192.168.70.1',
        enabled: true,
        intervalSecs,
        deviceType: 'STATION',
        linkCapacityKbps
      }
    });
  }

  async function seedSnapshot(
    deviceId: string,
    txBps: number,
    collectedAt = new Date()
  ): Promise<void> {
    await prisma.wirelessSnapshot.create({
      data: {
        deviceId,
        deviceType: 'STATION',
        collectedAt,
        collectionMethod: 'http_api',
        throughputTxBps: BigInt(txBps),
        throughputRxBps: BigInt(0)
      }
    });
  }

  function byDevice(
    devices: WirelessThroughputDTO[]
  ): Map<string, WirelessThroughputDTO> {
    return new Map(devices.map((d) => [d.deviceId, d]));
  }

  // ──────────────────────────────────────────────────────────────
  // Cross-device query
  // ──────────────────────────────────────────────────────────────

  it('returns one row per device, each against its own capacity', async () => {
    const a = await seedDevice('192.168.70.10');
    const b = await seedDevice('192.168.70.11');
    await seedConfig(a, 10_000);
    await seedConfig(b, 50_000);
    await seedSnapshot(a, 5_000_000);
    await seedSnapshot(b, 5_000_000);

    const result = await useCase.execute();

    expect(result.isSuccess).toBe(true);
    expect(result.value.total).toBe(2);

    const rows = byDevice(result.value.devices);
    expect(rows.get(a)!.utilisationPercent).toBe(50);
    expect(rows.get(b)!.utilisationPercent).toBe(10);
  });

  // this is the DISTINCT ON behaviour the fleet query depends on
  it('collapses a device history to its newest snapshot only', async () => {
    const a = await seedDevice('192.168.70.12');
    await seedConfig(a, 10_000);
    await seedSnapshot(a, 1_000_000, new Date(Date.now() - 120_000));
    await seedSnapshot(a, 2_000_000, new Date(Date.now() - 60_000));
    await seedSnapshot(a, 9_000_000);

    const result = await useCase.execute();

    expect(result.value.total).toBe(1);
    expect(result.value.devices[0].throughputTxBps).toBe(9_000_000);
  });

  it('keeps each device on its own newest snapshot', async () => {
    const a = await seedDevice('192.168.70.13');
    const b = await seedDevice('192.168.70.14');
    await seedConfig(a, 10_000);
    await seedConfig(b, 10_000);
    await seedSnapshot(a, 1_000_000, new Date(Date.now() - 120_000));
    await seedSnapshot(a, 3_000_000);
    await seedSnapshot(b, 2_000_000, new Date(Date.now() - 120_000));
    await seedSnapshot(b, 4_000_000);

    const result = await useCase.execute();

    const rows = byDevice(result.value.devices);
    expect(rows.get(a)!.throughputTxBps).toBe(3_000_000);
    expect(rows.get(b)!.throughputTxBps).toBe(4_000_000);
  });

  // ──────────────────────────────────────────────────────────────
  // Partial data
  // ──────────────────────────────────────────────────────────────

  it('omits a configured device that has never been polled', async () => {
    const polled = await seedDevice('192.168.70.15');
    const unpolled = await seedDevice('192.168.70.16');
    await seedConfig(polled, 10_000);
    await seedConfig(unpolled, 10_000);
    await seedSnapshot(polled, 1_000_000);

    const result = await useCase.execute();

    expect(result.value.total).toBe(1);
    expect(result.value.devices[0].deviceId).toBe(polled);
  });

  it('includes a device whose configuration was deleted, marked stale', async () => {
    const a = await seedDevice('192.168.70.17');
    await seedConfig(a, 10_000);
    await seedSnapshot(a, 1_000_000);
    await prisma.wirelessPollingConfiguration.deleteMany({
      where: { deviceId: a }
    });

    const result = await useCase.execute();

    expect(result.value.total).toBe(1);
    expect(result.value.devices[0].linkCapacityKbps).toBeNull();
    expect(result.value.devices[0].utilisationPercent).toBeNull();
    expect(result.value.devices[0].stale).toBe(true);
  });

  it('reports a device with no configured capacity without utilisation', async () => {
    const a = await seedDevice('192.168.70.18');
    await seedConfig(a, null);
    await seedSnapshot(a, 1_000_000);

    const result = await useCase.execute();

    expect(result.value.devices[0].utilisationPercent).toBeNull();
    expect(result.value.devices[0].stale).toBe(false);
  });

  it('mixes fresh and stale devices in one response', async () => {
    const fresh = await seedDevice('192.168.70.19');
    const old = await seedDevice('192.168.70.20');
    await seedConfig(fresh, 10_000, 60);
    await seedConfig(old, 10_000, 60);
    await seedSnapshot(fresh, 1_000_000);
    await seedSnapshot(
      old,
      1_000_000,
      new Date(Date.now() - 600_000)
    );

    const result = await useCase.execute();

    const rows = byDevice(result.value.devices);
    expect(rows.get(fresh)!.stale).toBe(false);
    expect(rows.get(old)!.stale).toBe(true);
  });

  it('returns an empty fleet rather than failing', async () => {
    const result = await useCase.execute();

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({ devices: [], total: 0 });
  });

  it('drops a device from the fleet once it is deleted', async () => {
    const a = await seedDevice('192.168.70.21');
    await seedConfig(a, 10_000);
    await seedSnapshot(a, 1_000_000);
    await prisma.device.delete({ where: { id: a } });

    const result = await useCase.execute();

    expect(result.value.total).toBe(0);
  });
});
