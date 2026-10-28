// Source: src/application/device-inventory/use-cases/IgnoreDiscoveredDeviceUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  createTestPrisma,
  cleanDatabase,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';
import { seedDiscoveredDevice } from '../../helpers/discoveredDevices';
import {
  IgnoreDiscoveredDeviceUseCase,
  DISCOVERED_DEVICE_NOT_FOUND
} from 'application/device-inventory/use-cases';
import { PrismaDiscoveredDeviceRepository } from 'infrastructure/persistence';

describe('IgnoreDiscoveredDeviceUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: IgnoreDiscoveredDeviceUseCase;

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new IgnoreDiscoveredDeviceUseCase(
      new PrismaDiscoveredDeviceRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it('[DEV-204] ignores a pending suggestion', async () => {
    const id = await seedDiscoveredDevice(prisma);

    const result = await useCase.execute({ id });

    expect(result.isSuccess).toBe(true);
    expect(result.value.ignoredAt).not.toBeNull();
    const row = await prisma.discoveredDevice.findUniqueOrThrow({
      where: { id }
    });
    expect(row.ignoredAt).not.toBeNull();
  });

  it('[DEV-204] ignoring twice keeps the first time', async () => {
    const ignoredAt = new Date('2026-10-01T00:00:00Z');
    const id = await seedDiscoveredDevice(prisma, { ignoredAt });

    const result = await useCase.execute({ id });

    expect(result.value.ignoredAt).toBe(ignoredAt.toISOString());
  });

  it('fails with not found for an unknown id', async () => {
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
