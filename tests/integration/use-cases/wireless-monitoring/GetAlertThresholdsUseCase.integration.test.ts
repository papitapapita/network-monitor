// Source: src/application/wireless-monitoring/use-cases/GetAlertThresholdsUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import { GetAlertThresholdsUseCase } from 'application/wireless-monitoring/use-cases';
import { PrismaAlertThresholdsRepository } from 'infrastructure/wireless-monitoring/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { createTestPrisma } from '../../helpers/db';

describe('[WLS-200] GetAlertThresholdsUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: GetAlertThresholdsUseCase;

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new GetAlertThresholdsUseCase(
      new PrismaAlertThresholdsRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await prisma.wirelessAlertThresholds.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.wirelessAlertThresholds.deleteMany();
  });

  it('answers the defaults when no row exists', async () => {
    const result = await useCase.execute({});

    expect(result.value.thresholds).toEqual(result.value.defaults);
  });

  it('fills a group the stored row predates from the defaults', async () => {
    await prisma.wirelessAlertThresholds.create({
      data: { id: 1, thresholds: { cpuPercent: 60 } }
    });

    const result = await useCase.execute({});

    expect(result.value.thresholds.cpuPercent).toBe(60);
    expect(result.value.thresholds.signalDbm).toEqual({
      warning: -70,
      critical: -80
    });
  });

  it('keeps a width the operator removed from a table removed', async () => {
    await prisma.wirelessAlertThresholds.create({
      data: { id: 1, thresholds: { maxDistanceKm: { '40': 12 } } }
    });

    const result = await useCase.execute({});

    expect(result.value.thresholds.maxDistanceKm).toEqual({
      '40': 12
    });
  });
});
