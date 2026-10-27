import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetDeviceIdentitySuggestionsUseCase } from 'application/wireless-monitoring/use-cases/GetDeviceIdentitySuggestionsUseCase';
import { PrismaWirelessSnapshotRepository } from 'infrastructure/wireless-monitoring/repositories/PrismaWirelessSnapshotRepository';
import { PrismaWirelessDeviceConfigRepository } from 'infrastructure/wireless-monitoring/repositories/PrismaWirelessDeviceConfigRepository';
import { WirelessDeviceRepositoryAdapter } from 'infrastructure/wireless-monitoring/adapters/WirelessDeviceRepositoryAdapter';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { DeviceHardwareAdapter } from 'infrastructure/wireless-monitoring/adapters/DeviceHardwareAdapter';
import { DeviceEligibilityService } from 'domain/device-inventory/services';
import { UpstreamAssignment } from 'application/device-inventory/services';
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
  overrides: {
    name?: string;
    macAddress?: string | null;
    ipAddress?: string | null;
    status?: 'ACTIVE' | 'INVENTORY';
  } = {}
): Promise<string> {
  const device = await prisma.device.create({
    data: {
      name: overrides.name ?? 'Identity Suggestions Test Device',
      owner: 'COMPANY',
      status: overrides.status ?? 'ACTIVE',
      monitoringEnabled: true,
      macAddress: overrides.macAddress ?? null,
      ipAddress: overrides.ipAddress ?? null,
      deviceModelId
    }
  });
  return device.id;
}

async function seedSnapshot(
  prisma: PrismaClient,
  deviceId: string,
  overrides: {
    deviceName?: string | null;
    macAddress?: string | null;
    deviceModel?: string | null;
    deviceType?: 'ACCESS_POINT' | 'STATION';
    remoteApIp?: string | null;
    remoteApDeviceId?: string | null;
  }
): Promise<void> {
  await prisma.wirelessSnapshot.create({
    data: {
      deviceId,
      deviceType: overrides.deviceType ?? 'ACCESS_POINT',
      remoteApIp: overrides.remoteApIp ?? null,
      remoteApDeviceId: overrides.remoteApDeviceId ?? null,
      collectedAt: new Date('2024-01-01T00:00:00Z'),
      collectionMethod: 'http_api',
      deviceName: overrides.deviceName ?? null,
      macAddress: overrides.macAddress ?? null,
      deviceModel: overrides.deviceModel ?? null
    }
  });
}

async function seedUbiquitiModel(
  prisma: PrismaClient,
  model: string
): Promise<string> {
  const vendor = await prisma.vendor.findUniqueOrThrow({
    where: { slug: 'ubiquiti' }
  });
  const created = await prisma.deviceModel.upsert({
    where: { vendorId_model: { vendorId: vendor.id, model } },
    update: {},
    create: {
      vendorId: vendor.id,
      model,
      deviceType: 'ANTENNA',
      isWireless: true
    }
  });
  return created.id;
}

async function seedStationConfig(
  prisma: PrismaClient,
  deviceId: string,
  upstreamDeviceId: string | null
): Promise<void> {
  await prisma.wirelessPollingConfiguration.create({
    data: { deviceId, deviceType: 'STATION' }
  });
  if (upstreamDeviceId) {
    await prisma.device.update({
      where: { id: deviceId },
      data: { upstreamDeviceId: upstreamDeviceId }
    });
  }
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
      new DeviceEligibilityService(),
      new UpstreamAssignment(new PrismaDeviceRepository(prisma))
    );
    useCase = new GetDeviceIdentitySuggestionsUseCase(
      new PrismaWirelessSnapshotRepository(prisma),
      new PrismaWirelessDeviceConfigRepository(prisma),
      deviceRepo,
      new DeviceHardwareAdapter(
        new PrismaDeviceRepository(prisma),
        new PrismaDeviceModelRepository(prisma)
      ),
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
      suggestedValue: 'AP Roof2',
      currentLabel: null,
      suggestedLabel: null,
      actions: ['UPDATE'],
      swapWith: null
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
      suggestedValue: 'AA:BB:CC:DD:EE:99',
      currentLabel: null,
      suggestedLabel: null,
      actions: ['REPLACE', 'UPDATE'],
      swapWith: null
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
      suggestedValue: 'AA:BB:CC:DD:EE:01',
      currentLabel: null,
      suggestedLabel: null,
      actions: ['UPDATE'],
      swapWith: null
    });
  });

  describe('hardware model (WLS-152)', () => {
    it('suggests nothing when the reported model matches the inventory model', async () => {
      const deviceId = await seedDevice(prisma, deviceModelId, {
        name: 'AP Roof1'
      });
      await seedSnapshot(prisma, deviceId, {
        deviceName: 'AP Roof1',
        deviceModel: 'litebeam-5ac'
      });

      const result = await useCase.execute({ deviceId });

      expect(result.value.suggestions).toHaveLength(0);
    });

    it('suggests replacing an in-service unit with the matching catalog model', async () => {
      const powerBeamId = await seedUbiquitiModel(
        prisma,
        'PowerBeam 5AC ISO'
      );
      const deviceId = await seedDevice(prisma, deviceModelId, {
        name: 'AP Roof1'
      });
      await seedSnapshot(prisma, deviceId, {
        deviceName: 'AP Roof1',
        deviceModel: 'PowerBeam 5AC ISO'
      });

      const result = await useCase.execute({ deviceId });

      expect(result.value.suggestions).toEqual([
        {
          field: 'deviceModel',
          currentValue: deviceModelId,
          suggestedValue: powerBeamId,
          currentLabel: 'LiteBeam 5AC',
          suggestedLabel: 'PowerBeam 5AC ISO',
          actions: ['REPLACE'],
          swapWith: null
        }
      ]);
    });

    it('suggests an in-place update while the unit is in INVENTORY', async () => {
      await seedUbiquitiModel(prisma, 'PowerBeam 5AC ISO');
      const deviceId = await seedDevice(prisma, deviceModelId, {
        name: 'AP Roof1',
        status: 'INVENTORY'
      });
      await seedSnapshot(prisma, deviceId, {
        deviceName: 'AP Roof1',
        deviceModel: 'PowerBeam 5AC ISO'
      });

      const result = await useCase.execute({ deviceId });

      expect(result.value.suggestions[0].actions).toEqual(['UPDATE']);
    });

    it('returns the reported name with no catalog id when the catalog lacks it', async () => {
      const deviceId = await seedDevice(prisma, deviceModelId, {
        name: 'AP Roof1'
      });
      await seedSnapshot(prisma, deviceId, {
        deviceName: 'AP Roof1',
        deviceModel: 'Rocket Prism 5AC'
      });

      const result = await useCase.execute({ deviceId });

      expect(result.value.suggestions[0]).toMatchObject({
        field: 'deviceModel',
        suggestedValue: null,
        suggestedLabel: 'Rocket Prism 5AC'
      });
    });
  });

  describe('swapped units (WLS-153)', () => {
    it('suggests a swap when the reported MAC is on another inventory record', async () => {
      const other = await seedDevice(prisma, deviceModelId, {
        name: 'AP Torre Norte',
        macAddress: 'AA:BB:CC:DD:EE:99'
      });
      const deviceId = await seedDevice(prisma, deviceModelId, {
        name: 'AP Roof1',
        macAddress: 'AA:BB:CC:DD:EE:01'
      });
      await seedSnapshot(prisma, deviceId, {
        deviceName: 'AP Roof1',
        macAddress: 'aa:bb:cc:dd:ee:99'
      });

      const result = await useCase.execute({ deviceId });

      expect(result.value.suggestions).toEqual([
        {
          field: 'macAddress',
          currentValue: 'AA:BB:CC:DD:EE:01',
          suggestedValue: 'AA:BB:CC:DD:EE:99',
          currentLabel: null,
          suggestedLabel: null,
          actions: ['SWAP'],
          swapWith: { deviceId: other, name: 'AP Torre Norte' }
        }
      ]);
    });
  });

  describe('parent AP (WLS-151)', () => {
    it('suggests the AP the radio reports when it differs from the declared one', async () => {
      const declaredAp = await seedDevice(prisma, deviceModelId, {
        name: 'AP Torre Norte'
      });
      const reportedAp = await seedDevice(prisma, deviceModelId, {
        name: 'AP Torre Sur'
      });
      const cpe = await seedDevice(prisma, deviceModelId, {
        name: 'CPE Juan'
      });
      await seedStationConfig(prisma, cpe, declaredAp);
      await seedSnapshot(prisma, cpe, {
        deviceName: 'CPE Juan',
        deviceType: 'STATION',
        remoteApDeviceId: reportedAp
      });

      const result = await useCase.execute({ deviceId: cpe });

      expect(result.value.suggestions).toEqual([
        {
          field: 'upstreamDeviceId',
          currentValue: declaredAp,
          suggestedValue: reportedAp,
          currentLabel: 'AP Torre Norte',
          suggestedLabel: 'AP Torre Sur',
          actions: ['UPDATE'],
          swapWith: null
        }
      ]);
    });

    it('suggests an AP matched only by the IP the radio reports', async () => {
      const ap = await seedDevice(prisma, deviceModelId, {
        name: 'AP Torre Norte',
        ipAddress: '10.20.0.2'
      });
      const cpe = await seedDevice(prisma, deviceModelId, {
        name: 'CPE Juan'
      });
      await seedStationConfig(prisma, cpe, null);
      await seedSnapshot(prisma, cpe, {
        deviceName: 'CPE Juan',
        deviceType: 'STATION',
        remoteApIp: '10.20.0.2'
      });

      const result = await useCase.execute({ deviceId: cpe });

      expect(result.value.suggestions).toEqual([
        {
          field: 'upstreamDeviceId',
          currentValue: null,
          suggestedValue: ap,
          currentLabel: null,
          suggestedLabel: 'AP Torre Norte',
          actions: ['UPDATE'],
          swapWith: null
        }
      ]);
    });

    it('suggests nothing when the reported AP is already declared', async () => {
      const ap = await seedDevice(prisma, deviceModelId, {
        name: 'AP Torre Norte'
      });
      const cpe = await seedDevice(prisma, deviceModelId, {
        name: 'CPE Juan'
      });
      await seedStationConfig(prisma, cpe, ap);
      await seedSnapshot(prisma, cpe, {
        deviceName: 'CPE Juan',
        deviceType: 'STATION',
        remoteApDeviceId: ap
      });

      const result = await useCase.execute({ deviceId: cpe });

      expect(result.value.suggestions).toHaveLength(0);
    });
  });
});
