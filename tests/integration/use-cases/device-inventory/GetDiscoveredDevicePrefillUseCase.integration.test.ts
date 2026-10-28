// Source: src/application/device-inventory/use-cases/GetDiscoveredDevicePrefillUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  createTestPrisma,
  cleanDatabase,
  GHOST_ID,
  INVALID_ID,
  seedAgent,
  seedDevice,
  seedWirelessDeviceModel
} from '../../helpers/db';
import { seedDiscoveredDevice } from '../../helpers/discoveredDevices';
import {
  GetDiscoveredDevicePrefillUseCase,
  DISCOVERED_DEVICE_NOT_FOUND
} from 'application/device-inventory/use-cases';
import {
  PrismaDiscoveredDeviceRepository,
  PrismaDiscoveryPrefillQuery
} from 'infrastructure/persistence';

describe('GetDiscoveredDevicePrefillUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: GetDiscoveredDevicePrefillUseCase;
  let modelId: string;

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new GetDiscoveredDevicePrefillUseCase(
      new PrismaDiscoveredDeviceRepository(prisma),
      new PrismaDiscoveryPrefillQuery(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    modelId = await seedWirelessDeviceModel(prisma);
  });

  async function seedModel(model: string): Promise<string> {
    const vendor = await prisma.vendor.findUniqueOrThrow({
      where: { slug: 'ubiquiti' }
    });
    const row = await prisma.deviceModel.upsert({
      where: { vendorId_model: { vendorId: vendor.id, model } },
      update: {},
      create: {
        vendorId: vendor.id,
        model,
        deviceType: 'ANTENNA',
        isWireless: true
      }
    });
    return row.id;
  }

  // A radio on file whose latest reading names its model as AirOS does.
  async function seedConfirmedRadio(
    deviceModelId: string,
    reportedModel: string,
    mac: string
  ): Promise<void> {
    const device = await prisma.device.create({
      data: {
        name: `Radio ${mac}`,
        status: 'INVENTORY',
        deviceModelId,
        macAddress: mac
      }
    });
    await prisma.wirelessSnapshot.create({
      data: {
        deviceId: device.id,
        deviceType: 'STATION',
        collectedAt: new Date(),
        collectionMethod: 'http_api',
        macAddress: mac.toLowerCase(),
        deviceModel: reportedModel
      }
    });
  }

  describe('[DEV-209] a station seen on an AP', () => {
    it('fills name, addresses, model, category and the AP', async () => {
      const apId = await seedDevice(prisma, modelId, {
        name: 'AP Norte'
      });
      const id = await seedDiscoveredDevice(prisma, {
        accessPointId: apId,
        hostname: 'Cliente Perez',
        model: 'litebeam 5ac'
      });

      const result = await useCase.execute({ id });

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({
        name: 'Cliente Perez',
        macAddress: 'AA:BB:CC:DD:EE:01',
        ipAddress: '192.168.1.20',
        deviceModelId: modelId,
        deviceModelName: 'LiteBeam 5AC',
        category: 'WIRELESS_CPE',
        upstreamDeviceId: apId,
        agentId: null
      });
    });

    it('takes the agent that reads the AP', async () => {
      const agent = await seedAgent(prisma, { status: 'ACTIVE' });
      const apId = await seedDevice(prisma, modelId);
      await prisma.device.update({
        where: { id: apId },
        data: { agentId: agent.id }
      });
      const id = await seedDiscoveredDevice(prisma, {
        accessPointId: apId
      });

      const result = await useCase.execute({ id });

      expect(result.value.agentId).toBe(agent.id);
    });

    it('leaves the upstream and agent out once the AP is deleted', async () => {
      const apId = await seedDevice(prisma, modelId);
      await prisma.device.update({
        where: { id: apId },
        data: { deletedAt: new Date() }
      });
      const id = await seedDiscoveredDevice(prisma, {
        accessPointId: apId
      });

      const result = await useCase.execute({ id });

      expect(result.value.upstreamDeviceId).toBeNull();
      expect(result.value).not.toHaveProperty('agentId');
      expect(result.value.category).toBe('WIRELESS_CPE');
    });
  });

  describe('[DEV-209] the model guess', () => {
    it('falls back to the one model radios reporting that name are on file as', async () => {
      const gen2 = await seedModel('LBE-5AC-Gen2');
      await seedConfirmedRadio(
        gen2,
        'LiteBeam 5AC Gen2',
        'AA:00:00:00:00:01'
      );
      await seedConfirmedRadio(
        gen2,
        'LiteBeam 5AC Gen2',
        'AA:00:00:00:00:02'
      );
      const id = await seedDiscoveredDevice(prisma, {
        model: 'LiteBeam 5AC Gen2'
      });

      const result = await useCase.execute({ id });

      expect(result.value.deviceModelId).toBe(gen2);
      expect(result.value.deviceModelName).toBe('LBE-5AC-Gen2');
    });

    it('ignores a radio whose MAC does not match its reading', async () => {
      const gen2 = await seedModel('LBE-5AC-Gen2');
      const device = await prisma.device.create({
        data: {
          name: 'Swapped',
          status: 'INVENTORY',
          deviceModelId: gen2,
          macAddress: 'AA:00:00:00:00:01'
        }
      });
      await prisma.wirelessSnapshot.create({
        data: {
          deviceId: device.id,
          deviceType: 'STATION',
          collectedAt: new Date(),
          collectionMethod: 'http_api',
          macAddress: 'BB:00:00:00:00:09',
          deviceModel: 'LiteBeam 5AC Gen2'
        }
      });
      const id = await seedDiscoveredDevice(prisma, {
        model: 'LiteBeam 5AC Gen2'
      });

      const result = await useCase.execute({ id });

      expect(result.value.deviceModelId).toBeNull();
    });

    it('guesses nothing when radios with that name are on file as several models', async () => {
      const gen2 = await seedModel('LBE-5AC-Gen2');
      const other = await seedModel('LBE-5AC-23');
      await seedConfirmedRadio(
        gen2,
        'LiteBeam 5AC Gen2',
        'AA:00:00:00:00:01'
      );
      await seedConfirmedRadio(
        other,
        'LiteBeam 5AC Gen2',
        'AA:00:00:00:00:02'
      );
      const id = await seedDiscoveredDevice(prisma, {
        model: 'LiteBeam 5AC Gen2'
      });

      const result = await useCase.execute({ id });

      expect(result.value.deviceModelId).toBeNull();
      expect(result.value.deviceModelName).toBeNull();
    });
  });

  it('[DEV-209] a scan sighting fills only what the scan saw', async () => {
    const id = await seedDiscoveredDevice(prisma);

    const result = await useCase.execute({ id });

    expect(result.value).toEqual({
      name: null,
      macAddress: 'AA:BB:CC:DD:EE:01',
      ipAddress: '192.168.1.20',
      deviceModelId: null,
      deviceModelName: null,
      category: null,
      upstreamDeviceId: null
    });
  });

  it('fails for an unknown id', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(DISCOVERED_DEVICE_NOT_FOUND);
  });

  it('fails for a malformed id', async () => {
    const result = await useCase.execute({ id: INVALID_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^Invalid discovered device ID/);
  });
});
