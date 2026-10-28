// Source: src/application/device-inventory/use-cases/ListDiscoveredDevicesUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  createTestPrisma,
  cleanDatabase,
  seedDeviceModel
} from '../../helpers/db';
import {
  seedDiscoveredDevice,
  seedOwnedDevice
} from '../../helpers/discoveredDevices';
import { ListDiscoveredDevicesUseCase } from 'application/device-inventory/use-cases';
import { PrismaDiscoveredDeviceListQuery } from 'infrastructure/persistence';

describe('ListDiscoveredDevicesUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: ListDiscoveredDevicesUseCase;

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new ListDiscoveredDevicesUseCase(
      new PrismaDiscoveredDeviceListQuery(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it('lists pending suggestions, most recently seen first', async () => {
    const older = await seedDiscoveredDevice(prisma, {
      macAddress: 'AA:BB:CC:DD:EE:01',
      ipAddress: '10.0.0.1',
      lastSeenAt: new Date('2026-11-01T08:00:00Z')
    });
    const newer = await seedDiscoveredDevice(prisma, {
      macAddress: 'AA:BB:CC:DD:EE:02',
      ipAddress: '10.0.0.2',
      lastSeenAt: new Date('2026-11-01T09:00:00Z')
    });

    const result = await useCase.execute({ ignored: false });

    expect(result.value.map((d) => d.id)).toEqual([newer, older]);
    expect(result.value[0]).toEqual({
      id: newer,
      macAddress: 'AA:BB:CC:DD:EE:02',
      ipAddress: '10.0.0.2',
      manufacturer: 'Ubiquiti Inc',
      source: 'SCAN',
      segment: '192.168.1.0/24',
      firstSeenAt: '2026-11-01T09:00:00.000Z',
      lastSeenAt: '2026-11-01T09:00:00.000Z',
      ignoredAt: null
    });
  });

  it('[DEV-204] keeps ignored suggestions to their own list', async () => {
    await seedDiscoveredDevice(prisma, {
      macAddress: 'AA:BB:CC:DD:EE:01'
    });
    const ignored = await seedDiscoveredDevice(prisma, {
      macAddress: 'AA:BB:CC:DD:EE:02',
      ipAddress: '10.0.0.2',
      ignoredAt: new Date('2026-11-01T09:00:00Z')
    });

    const pending = await useCase.execute({ ignored: false });
    const ignoredList = await useCase.execute({ ignored: true });

    expect(pending.value).toHaveLength(1);
    expect(ignoredList.value.map((d) => d.id)).toEqual([ignored]);
    expect(ignoredList.value[0].ignoredAt).toBe(
      '2026-11-01T09:00:00.000Z'
    );
  });

  it('[DEV-203] leaves out a suggestion whose MAC a live device now owns', async () => {
    await seedDiscoveredDevice(prisma, {
      macAddress: 'AA:BB:CC:DD:EE:01'
    });
    const modelId = await seedDeviceModel(prisma);
    await seedOwnedDevice(prisma, modelId, {
      macAddress: 'AA:BB:CC:DD:EE:01'
    });

    const result = await useCase.execute({ ignored: false });

    expect(result.value).toEqual([]);
  });

  it('[DEV-203] leaves out a suggestion whose IP a live device now owns', async () => {
    await seedDiscoveredDevice(prisma, { ipAddress: '10.0.0.9' });
    const modelId = await seedDeviceModel(prisma);
    await seedOwnedDevice(prisma, modelId, { ipAddress: '10.0.0.9' });

    const result = await useCase.execute({ ignored: false });

    expect(result.value).toEqual([]);
  });

  it('[DEV-203] still lists it when the owner is in the recycle bin', async () => {
    await seedDiscoveredDevice(prisma, {
      macAddress: 'AA:BB:CC:DD:EE:01'
    });
    const modelId = await seedDeviceModel(prisma);
    await seedOwnedDevice(prisma, modelId, {
      macAddress: 'AA:BB:CC:DD:EE:01',
      deleted: true
    });

    const result = await useCase.execute({ ignored: false });

    expect(result.value).toHaveLength(1);
  });

  it('returns an empty list when nothing was discovered', async () => {
    const result = await useCase.execute({ ignored: false });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual([]);
  });
});
