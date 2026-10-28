// Source: src/application/device-monitoring/use-cases/UpdateRouterHealthThresholdsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase } from '../../helpers/db';
import { FakeRouterOsPrinter } from '../../helpers/FakeRouterOsPrinter';
import { buildRouterSystems } from '../../helpers/routerSystems';

const WANTED = {
  cpuPercent: 85,
  minFreeMemoryPercent: 15,
  minFreeDiskPercent: 8,
  maxTemperatureC: 70,
  minVoltage: 23
};

describe('UpdateRouterHealthThresholdsUseCase — integration', () => {
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

  const update = (
    body: Omit<typeof WANTED, 'minVoltage'> & {
      minVoltage: number | null;
    }
  ) =>
    buildRouterSystems(
      prisma,
      new FakeRouterOsPrinter()
    ).updateThresholds.execute(body);

  it('[MON-172] should keep one row with the thresholds saved last', async () => {
    await update(WANTED);

    const result = await update({ ...WANTED, cpuPercent: 95 });

    expect(result.value.thresholds.cpuPercent).toBe(95);
    const rows = await prisma.routerHealthThresholds.findMany();
    expect(rows).toEqual([
      expect.objectContaining({ id: 1, ...WANTED, cpuPercent: 95 })
    ]);
  });

  it('[MON-172] should switch the voltage alert off with no minimum', async () => {
    await update(WANTED);

    await update({ ...WANTED, minVoltage: null });

    const row = await prisma.routerHealthThresholds.findUnique({
      where: { id: 1 }
    });
    expect(row?.minVoltage).toBeNull();
  });

  it('[MON-172] should refuse a threshold out of range and keep the saved ones', async () => {
    await update(WANTED);

    const result = await update({ ...WANTED, minFreeDiskPercent: 0 });

    expect(result.error).toBe(
      'minFreeDiskPercent must be a whole number from 1 to 50'
    );
    const row = await prisma.routerHealthThresholds.findUnique({
      where: { id: 1 }
    });
    expect(row?.minFreeDiskPercent).toBe(8);
  });
});
