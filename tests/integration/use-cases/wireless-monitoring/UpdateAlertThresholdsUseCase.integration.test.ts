// Source: src/application/wireless-monitoring/use-cases/UpdateAlertThresholdsUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import { UpdateAlertThresholdsUseCase } from 'application/wireless-monitoring/use-cases';
import { AlertThresholdsMapper } from 'application/wireless-monitoring/mappers';
import { AlertThresholds } from 'domain/wireless-monitoring';
import { PrismaAlertThresholdsRepository } from 'infrastructure/wireless-monitoring/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { createTestPrisma } from '../../helpers/db';

const DEFAULTS = AlertThresholdsMapper.toDTO(
  AlertThresholds.defaults()
);

describe('[WLS-200] UpdateAlertThresholdsUseCase — integration', () => {
  let prisma: PrismaClient;
  let repo: PrismaAlertThresholdsRepository;
  let useCase: UpdateAlertThresholdsUseCase;

  beforeAll(() => {
    prisma = createTestPrisma();
    repo = new PrismaAlertThresholdsRepository(prisma);
    useCase = new UpdateAlertThresholdsUseCase(
      repo,
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    // The row would change every later suite's alerts.
    await prisma.wirelessAlertThresholds.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.wirelessAlertThresholds.deleteMany();
  });

  it('stores one row and the next read answers it', async () => {
    await useCase.execute({ ...DEFAULTS, cpuPercent: 60 });
    await useCase.execute({ ...DEFAULTS, cpuPercent: 70 });

    expect(await prisma.wirelessAlertThresholds.count()).toBe(1);
    const read = await repo.getGlobal();
    expect(read.value.cpuPercent).toBe(70);
  });

  it('a fractional distance survives the round trip', async () => {
    await useCase.execute({
      ...DEFAULTS,
      maxDistanceKm: { '40': 2.5 }
    });

    const read = await repo.getGlobal();
    expect(read.value.maxDistanceMFor(40)).toBe(2500);
  });

  it('writes nothing for an invalid set', async () => {
    const result = await useCase.execute({
      ...DEFAULTS,
      cpuPercent: 5
    });

    expect(result.isFailure).toBe(true);
    expect(await prisma.wirelessAlertThresholds.count()).toBe(0);
  });
});
