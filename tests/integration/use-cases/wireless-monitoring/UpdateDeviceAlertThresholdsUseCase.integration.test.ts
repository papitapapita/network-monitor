// Source: src/application/wireless-monitoring/use-cases/UpdateDeviceAlertThresholdsUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import {
  UpdateDeviceAlertThresholdsUseCase,
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

describe('[WLS-201] UpdateDeviceAlertThresholdsUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: UpdateDeviceAlertThresholdsUseCase;
  let deviceId: string;

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new UpdateDeviceAlertThresholdsUseCase(
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

  const stored = () =>
    prisma.wirelessAlertThresholdOverride.findUnique({
      where: { deviceId }
    });

  it('replaces the overrides as a whole on each save', async () => {
    await useCase.execute({
      deviceId,
      overrides: { cpuPercent: 90, maxDistanceKm: { '40': 30 } }
    });
    await useCase.execute({
      deviceId,
      overrides: { cpuPercent: 70 }
    });

    expect((await stored())?.overrides).toEqual({ cpuPercent: 70 });
    expect(await prisma.wirelessAlertThresholdOverride.count()).toBe(
      1
    );
  });

  it('removes the row when saved empty', async () => {
    await useCase.execute({
      deviceId,
      overrides: { cpuPercent: 90 }
    });
    await useCase.execute({ deviceId, overrides: {} });

    expect(await stored()).toBeNull();
  });

  it('goes with the device when the device is deleted', async () => {
    await useCase.execute({
      deviceId,
      overrides: { cpuPercent: 90 }
    });
    await prisma.device.delete({ where: { id: deviceId } });

    expect(await prisma.wirelessAlertThresholdOverride.count()).toBe(
      0
    );
  });

  it('writes nothing for invalid overrides', async () => {
    const result = await useCase.execute({
      deviceId,
      overrides: { latencyMs: { warning: 100, critical: 100 } }
    });

    expect(result.isFailure).toBe(true);
    expect(await stored()).toBeNull();
  });

  it('fails for a device with no wireless config', async () => {
    const result = await useCase.execute({
      deviceId: GHOST_ID,
      overrides: { cpuPercent: 90 }
    });
    expect(result.error).toBe(WIRELESS_CONFIG_NOT_FOUND);
  });

  it('fails for a malformed id', async () => {
    const result = await useCase.execute({
      deviceId: INVALID_ID,
      overrides: {}
    });
    expect(result.error).toMatch(/^Invalid device ID/);
  });
});
