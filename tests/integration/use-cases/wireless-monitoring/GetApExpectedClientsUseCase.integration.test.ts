import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetApExpectedClientsUseCase } from 'application/wireless-monitoring/use-cases/GetApExpectedClientsUseCase';
import { PrismaWirelessDeviceConfigRepository } from 'infrastructure/wireless-monitoring/repositories/PrismaWirelessDeviceConfigRepository';
import { PrismaWirelessSnapshotRepository } from 'infrastructure/wireless-monitoring/repositories/PrismaWirelessSnapshotRepository';
import { WirelessDeviceRepositoryAdapter } from 'infrastructure/wireless-monitoring/adapters/WirelessDeviceRepositoryAdapter';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { DeviceEligibilityService } from 'domain/device-inventory/services';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  cleanDatabase,
  createTestPrisma,
  seedWirelessDeviceModel,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

async function seedDevice(
  prisma: PrismaClient,
  deviceModelId: string,
  overrides: { name?: string; macAddress?: string | null } = {}
): Promise<string> {
  const device = await prisma.device.create({
    data: {
      name: overrides.name ?? 'Wireless Expected-Clients Test Device',
      owner: 'COMPANY',
      status: 'ACTIVE',
      monitoringEnabled: true,
      macAddress: overrides.macAddress ?? null,
      deviceModelId
    }
  });
  return device.id;
}

async function seedConfig(
  prisma: PrismaClient,
  deviceId: string,
  deviceType: 'STATION' | 'ACCESS_POINT',
  parentApDeviceId: string | null = null
): Promise<void> {
  await prisma.wirelessPollingConfiguration.create({
    data: {
      deviceId,
      deviceType,
      enabled: true,
      intervalSecs: 3600,
      parentApDeviceId
    }
  });
}

async function seedSnapshot(
  prisma: PrismaClient,
  apDeviceId: string,
  clients: { macAddress: string }[]
): Promise<void> {
  await prisma.wirelessSnapshot.create({
    data: {
      deviceId: apDeviceId,
      deviceType: 'ACCESS_POINT',
      collectedAt: new Date('2024-01-01T00:00:00Z'),
      collectionMethod: 'http_api',
      clientsJson: clients.length > 0 ? clients : undefined
    }
  });
}

describe('GetApExpectedClientsUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: GetApExpectedClientsUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();
    deviceModelId = await seedWirelessDeviceModel(prisma);
    const deviceRepo = new WirelessDeviceRepositoryAdapter(
      new PrismaDeviceRepository(prisma),
      new DeviceEligibilityService()
    );
    useCase = new GetApExpectedClientsUseCase(
      new PrismaWirelessDeviceConfigRepository(prisma),
      new PrismaWirelessSnapshotRepository(prisma),
      deviceRepo,
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it('fails when the device has no wireless config', async () => {
    const deviceId = await seedDevice(prisma, deviceModelId);

    const result = await useCase.execute({ deviceId });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(
      'No wireless polling configuration found for device'
    );
  });

  it('fails with NOT_AP when queried on a STATION device', async () => {
    const deviceId = await seedDevice(prisma, deviceModelId);
    await seedConfig(prisma, deviceId, 'STATION');

    const result = await useCase.execute({ deviceId });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('NOT_AP');
  });

  it('fails for a ghost device id', async () => {
    const result = await useCase.execute({ deviceId: GHOST_ID });

    expect(result.isFailure).toBe(true);
  });

  it('fails for a malformed device id', async () => {
    const result = await useCase.execute({ deviceId: INVALID_ID });

    expect(result.isFailure).toBe(true);
  });

  it('returns collectedAt null and every expected CPE as missing when the AP has never been polled', async () => {
    const apId = await seedDevice(prisma, deviceModelId, {
      name: 'AP — never polled'
    });
    await seedConfig(prisma, apId, 'ACCESS_POINT');
    const cpeId = await seedDevice(prisma, deviceModelId, {
      name: 'CPE A',
      macAddress: 'AA:BB:CC:DD:EE:01'
    });
    await seedConfig(prisma, cpeId, 'STATION', apId);

    const result = await useCase.execute({ deviceId: apId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.collectedAt).toBeNull();
    expect(result.value.expected).toHaveLength(1);
    expect(result.value.expected[0].deviceId).toBe(cpeId);
    expect(result.value.expected[0].connected).toBe(false);
    expect(result.value.missingCount).toBe(1);
    expect(result.value.unexpectedConnected).toHaveLength(0);
  });

  it('marks a declared CPE as connected when its MAC appears in the latest snapshot', async () => {
    const apId = await seedDevice(prisma, deviceModelId, {
      name: 'AP — with client'
    });
    await seedConfig(prisma, apId, 'ACCESS_POINT');
    const cpeId = await seedDevice(prisma, deviceModelId, {
      name: 'CPE A',
      macAddress: 'AA:BB:CC:DD:EE:01'
    });
    await seedConfig(prisma, cpeId, 'STATION', apId);
    await seedSnapshot(prisma, apId, [
      { macAddress: 'AA:BB:CC:DD:EE:01' }
    ]);

    const result = await useCase.execute({ deviceId: apId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.collectedAt).toBe(
      new Date('2024-01-01T00:00:00Z').toISOString()
    );
    expect(result.value.expected[0].connected).toBe(true);
    expect(result.value.expected[0].client?.macAddress).toBe(
      'AA:BB:CC:DD:EE:01'
    );
    expect(result.value.missingCount).toBe(0);
  });

  it('reports a declared CPE as missing when its MAC is absent from the latest snapshot', async () => {
    const apId = await seedDevice(prisma, deviceModelId, {
      name: 'AP — missing client'
    });
    await seedConfig(prisma, apId, 'ACCESS_POINT');
    const cpeId = await seedDevice(prisma, deviceModelId, {
      name: 'CPE A',
      macAddress: 'AA:BB:CC:DD:EE:01'
    });
    await seedConfig(prisma, cpeId, 'STATION', apId);
    await seedSnapshot(prisma, apId, []);

    const result = await useCase.execute({ deviceId: apId });

    expect(result.value.expected[0].connected).toBe(false);
    expect(result.value.expected[0].client).toBeNull();
    expect(result.value.missingCount).toBe(1);
  });

  it('lists a connected client with no matching declared CPE as unexpectedConnected', async () => {
    const apId = await seedDevice(prisma, deviceModelId, {
      name: 'AP — rogue client'
    });
    await seedConfig(prisma, apId, 'ACCESS_POINT');
    await seedSnapshot(prisma, apId, [
      { macAddress: '11:22:33:44:55:66' }
    ]);

    const result = await useCase.execute({ deviceId: apId });

    expect(result.value.expected).toHaveLength(0);
    expect(result.value.unexpectedConnected).toHaveLength(1);
    expect(result.value.unexpectedConnected[0].macAddress).toBe(
      '11:22:33:44:55:66'
    );
  });

  it('does not include a STATION config declaring a different AP as its parent', async () => {
    const apId = await seedDevice(prisma, deviceModelId, {
      name: 'AP — target'
    });
    await seedConfig(prisma, apId, 'ACCESS_POINT');
    const otherApId = await seedDevice(prisma, deviceModelId, {
      name: 'AP — other'
    });
    await seedConfig(prisma, otherApId, 'ACCESS_POINT');
    const cpeId = await seedDevice(prisma, deviceModelId, {
      name: 'CPE elsewhere',
      macAddress: 'AA:BB:CC:DD:EE:02'
    });
    await seedConfig(prisma, cpeId, 'STATION', otherApId);

    const result = await useCase.execute({ deviceId: apId });

    expect(result.value.expected).toHaveLength(0);
  });
});
