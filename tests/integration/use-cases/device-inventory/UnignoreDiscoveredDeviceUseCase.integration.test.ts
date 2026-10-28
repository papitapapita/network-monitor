// Source: src/application/device-inventory/use-cases/UnignoreDiscoveredDeviceUseCase.ts

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
  UnignoreDiscoveredDeviceUseCase,
  DISCOVERED_DEVICE_NOT_FOUND
} from 'application/device-inventory/use-cases';
import { PrismaDiscoveredDeviceRepository } from 'infrastructure/persistence';

describe('UnignoreDiscoveredDeviceUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: UnignoreDiscoveredDeviceUseCase;

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new UnignoreDiscoveredDeviceUseCase(
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

  it('[DEV-204] puts an ignored suggestion back to pending', async () => {
    const id = await seedDiscoveredDevice(prisma, {
      ignoredAt: new Date('2026-10-01T00:00:00Z')
    });

    const result = await useCase.execute({ id });

    expect(result.isSuccess).toBe(true);
    expect(result.value.ignoredAt).toBeNull();
    const row = await prisma.discoveredDevice.findUniqueOrThrow({
      where: { id }
    });
    expect(row.ignoredAt).toBeNull();
  });

  it('leaves a pending suggestion pending', async () => {
    const id = await seedDiscoveredDevice(prisma);

    const result = await useCase.execute({ id });

    expect(result.value.ignoredAt).toBeNull();
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
