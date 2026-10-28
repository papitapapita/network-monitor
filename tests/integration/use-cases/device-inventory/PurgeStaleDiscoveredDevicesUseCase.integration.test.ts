// Source: src/application/device-inventory/use-cases/PurgeStaleDiscoveredDevicesUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { createTestPrisma, cleanDatabase } from '../../helpers/db';
import { seedDiscoveredDevice } from '../../helpers/discoveredDevices';
import { PurgeStaleDiscoveredDevicesUseCase } from 'application/device-inventory/use-cases';
import { PrismaDiscoveredDeviceRepository } from 'infrastructure/persistence';

const DAY = 86_400_000;

describe('PurgeStaleDiscoveredDevicesUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: PurgeStaleDiscoveredDevicesUseCase;

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new PurgeStaleDiscoveredDevicesUseCase(
      new PrismaDiscoveredDeviceRepository(prisma)
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it('[DEV-205] removes a pending suggestion unseen for over 30 days', async () => {
    await seedDiscoveredDevice(prisma, {
      lastSeenAt: new Date(Date.now() - 31 * DAY)
    });

    const result = await useCase.execute();

    expect(result.value).toBe(1);
    expect(await prisma.discoveredDevice.count()).toBe(0);
  });

  it('[DEV-205] keeps one seen within the last 30 days', async () => {
    await seedDiscoveredDevice(prisma, {
      lastSeenAt: new Date(Date.now() - 29 * DAY)
    });

    const result = await useCase.execute();

    expect(result.value).toBe(0);
    expect(await prisma.discoveredDevice.count()).toBe(1);
  });

  it('[DEV-205] keeps an ignored one however old', async () => {
    await seedDiscoveredDevice(prisma, {
      lastSeenAt: new Date(Date.now() - 365 * DAY),
      ignoredAt: new Date(Date.now() - 365 * DAY)
    });

    const result = await useCase.execute();

    expect(result.value).toBe(0);
    expect(await prisma.discoveredDevice.count()).toBe(1);
  });

  it('honours a custom window', async () => {
    await seedDiscoveredDevice(prisma, {
      lastSeenAt: new Date(Date.now() - 3 * DAY)
    });

    const result = await useCase.execute(2);

    expect(result.value).toBe(1);
  });
});
