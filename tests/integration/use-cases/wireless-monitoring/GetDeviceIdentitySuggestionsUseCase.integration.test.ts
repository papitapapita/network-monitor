import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetDeviceIdentitySuggestionsUseCase } from 'application/wireless-monitoring/use-cases/GetDeviceIdentitySuggestionsUseCase';
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
      name: overrides.name ?? 'Identity Suggestions Test Device',
      owner: 'COMPANY',
      status: 'ACTIVE',
      monitoringEnabled: true,
      macAddress: overrides.macAddress ?? null,
      deviceModelId
    }
  });
  return device.id;
}

async function seedSnapshot(
  prisma: PrismaClient,
  deviceId: string,
  overrides: { deviceName?: string | null; macAddress?: string | null }
): Promise<void> {
  await prisma.wirelessSnapshot.create({
    data: {
      deviceId,
      deviceType: 'ACCESS_POINT',
      collectedAt: new Date('2024-01-01T00:00:00Z'),
      collectionMethod: 'http_api',
      deviceName: overrides.deviceName ?? null,
      macAddress: overrides.macAddress ?? null
    }
  });
}

describe('GetDeviceIdentitySuggestionsUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: GetDeviceIdentitySuggestionsUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();
    deviceModelId = await seedWirelessDeviceModel(prisma);
    const deviceRepo = new WirelessDeviceRepositoryAdapter(
      new PrismaDeviceRepository(prisma),
      new DeviceEligibilityService()
    );
    useCase = new GetDeviceIdentitySuggestionsUseCase(
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

  it('fails for a ghost device id', async () => {
    const result = await useCase.execute({ deviceId: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Device not found');
  });

  it('fails for a malformed device id', async () => {
    const result = await useCase.execute({ deviceId: INVALID_ID });

    expect(result.isFailure).toBe(true);
  });

  it('returns polled: false with no suggestions when the device has never been polled', async () => {
    const deviceId = await seedDevice(prisma, deviceModelId, {
      name: 'Never Polled'
    });

    const result = await useCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.polled).toBe(false);
    expect(result.value.collectedAt).toBeNull();
    expect(result.value.suggestions).toHaveLength(0);
  });

  it('returns no suggestions when the polled name and MAC match inventory', async () => {
    const deviceId = await seedDevice(prisma, deviceModelId, {
      name: 'AP Roof1',
      macAddress: 'AA:BB:CC:DD:EE:01'
    });
    await seedSnapshot(prisma, deviceId, {
      deviceName: 'AP Roof1',
      macAddress: 'AA:BB:CC:DD:EE:01'
    });

    const result = await useCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.polled).toBe(true);
    expect(result.value.suggestions).toHaveLength(0);
  });

  it('suggests the polled name when it differs from inventory', async () => {
    const deviceId = await seedDevice(prisma, deviceModelId, {
      name: 'AP Roof1',
      macAddress: 'AA:BB:CC:DD:EE:01'
    });
    await seedSnapshot(prisma, deviceId, {
      deviceName: 'AP Roof2',
      macAddress: 'AA:BB:CC:DD:EE:01'
    });

    const result = await useCase.execute({ deviceId });

    const suggestion = result.value.suggestions.find(
      (s) => s.field === 'name'
    );
    expect(suggestion).toEqual({
      field: 'name',
      currentValue: 'AP Roof1',
      suggestedValue: 'AP Roof2'
    });
  });

  it('suggests the polled MAC when it differs from inventory', async () => {
    const deviceId = await seedDevice(prisma, deviceModelId, {
      name: 'AP Roof1',
      macAddress: 'AA:BB:CC:DD:EE:01'
    });
    await seedSnapshot(prisma, deviceId, {
      deviceName: 'AP Roof1',
      macAddress: 'AA:BB:CC:DD:EE:99'
    });

    const result = await useCase.execute({ deviceId });

    const suggestion = result.value.suggestions.find(
      (s) => s.field === 'macAddress'
    );
    expect(suggestion).toEqual({
      field: 'macAddress',
      currentValue: 'AA:BB:CC:DD:EE:01',
      suggestedValue: 'AA:BB:CC:DD:EE:99'
    });
  });

  it('suggests the polled MAC when inventory has none on file', async () => {
    const deviceId = await seedDevice(prisma, deviceModelId, {
      name: 'AP Roof1',
      macAddress: null
    });
    await seedSnapshot(prisma, deviceId, {
      deviceName: 'AP Roof1',
      macAddress: 'AA:BB:CC:DD:EE:01'
    });

    const result = await useCase.execute({ deviceId });

    const suggestion = result.value.suggestions.find(
      (s) => s.field === 'macAddress'
    );
    expect(suggestion).toEqual({
      field: 'macAddress',
      currentValue: null,
      suggestedValue: 'AA:BB:CC:DD:EE:01'
    });
  });
});
