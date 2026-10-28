// Source: src/application/device-monitoring/use-cases/GetRouterHealthThresholdsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase } from '../../helpers/db';
import { FakeRouterOsPrinter } from '../../helpers/FakeRouterOsPrinter';
import { buildRouterSystems } from '../../helpers/routerSystems';

const DEFAULTS = {
  cpuPercent: 90,
  minFreeMemoryPercent: 10,
  minFreeDiskPercent: 5,
  maxTemperatureC: 75,
  minVoltage: null,
  flapLinkDowns: 3,
  minSfpRxPowerDbm: -20
};

describe('GetRouterHealthThresholdsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  const get = () =>
    buildRouterSystems(
      prisma,
      new FakeRouterOsPrinter()
    ).getThresholds.execute();

  it('[MON-172] should answer the defaults when none were saved', async () => {
    const result = await get();

    expect(result.value).toEqual({
      thresholds: DEFAULTS,
      defaults: DEFAULTS
    });
  });

  it('[MON-172] should answer the saved thresholds beside the defaults', async () => {
    await prisma.routerHealthThresholds.create({
      data: { ...DEFAULTS, cpuPercent: 80, minVoltage: 11 }
    });

    const result = await get();

    expect(result.value).toEqual({
      thresholds: { ...DEFAULTS, cpuPercent: 80, minVoltage: 11 },
      defaults: DEFAULTS
    });
  });
});
