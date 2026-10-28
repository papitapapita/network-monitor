// Source: src/application/device-inventory/use-cases/GetDiscoverySettingsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { createTestPrisma, cleanDatabase } from '../../helpers/db';
import { GetDiscoverySettingsUseCase } from 'application/device-inventory/use-cases';
import { PrismaDiscoverySettingsRepository } from 'infrastructure/persistence';

describe('GetDiscoverySettingsUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: GetDiscoverySettingsUseCase;

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new GetDiscoverySettingsUseCase(
      new PrismaDiscoverySettingsRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it('[DEV-210] answers the defaults before anything is saved', async () => {
    const result = await useCase.execute({});

    expect(result.value).toEqual({
      enabled: false,
      intervalHours: 24,
      segments: [],
      lastRunAt: null
    });
  });

  it('[DEV-211] answers the saved settings with the last run', async () => {
    await prisma.discoverySettings.create({
      data: {
        enabled: true,
        intervalHours: 6,
        segments: [{ cidr: '192.168.1.0/24', agentId: null }],
        lastRunAt: new Date('2026-11-03T12:00:00Z')
      }
    });

    const result = await useCase.execute({});

    expect(result.value).toEqual({
      enabled: true,
      intervalHours: 6,
      segments: [{ cidr: '192.168.1.0/24', agentId: null }],
      lastRunAt: '2026-11-03T12:00:00.000Z'
    });
  });
});
