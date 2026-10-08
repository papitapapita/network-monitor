// Source: src/application/wireless-monitoring/use-cases/GetDeviceAlertThresholdsUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import {
  GetDeviceAlertThresholdsUseCase,
  WIRELESS_CONFIG_NOT_FOUND
} from 'application/wireless-monitoring/use-cases';
import {
  PrismaAlertThresholdsRepository,
  PrismaWirelessDeviceConfigRepository
} from 'infrastructure/wireless-monitoring/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  cleanDatabase,
  createTestPrisma,
  seedDevice,
  seedWirelessConfig,
  seedWirelessDeviceModel,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('[WLS-201] GetDeviceAlertThresholdsUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: GetDeviceAlertThresholdsUseCase;
  let deviceId: string;

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new GetDeviceAlertThresholdsUseCase(
      new PrismaWirelessDeviceConfigRepository(prisma),
      new PrismaAlertThresholdsRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const modelId = await seedWirelessDeviceModel(prisma);
    deviceId = await seedWirelessConfig(
      prisma,
      await seedDevice(prisma, modelId)
    );
  });

  it("applies the device's overrides over the saved install set", async () => {
    await prisma.wirelessAlertThresholds.create({
      data: { id: 1, thresholds: { cpuPercent: 60 } }
    });
    await prisma.wirelessAlertThresholdOverride.create({
      data: { deviceId, overrides: { cpuPercent: 90 } }
    });

    const result = await useCase.execute({ deviceId });

    expect(result.value.install.cpuPercent).toBe(60);
    expect(result.value.overrides).toEqual({ cpuPercent: 90 });
    expect(result.value.effective.cpuPercent).toBe(90);
  });

  it('answers no overrides for a device that has none', async () => {
    const result = await useCase.execute({ deviceId });

    expect(result.value.overrides).toEqual({});
    expect(result.value.effective).toEqual(result.value.install);
  });

  it('fails for a device with no wireless config', async () => {
    const result = await useCase.execute({ deviceId: GHOST_ID });
    expect(result.error).toBe(WIRELESS_CONFIG_NOT_FOUND);
  });

  it('fails for a malformed id', async () => {
    const result = await useCase.execute({ deviceId: INVALID_ID });
    expect(result.error).toMatch(/^Invalid device ID/);
  });
});
