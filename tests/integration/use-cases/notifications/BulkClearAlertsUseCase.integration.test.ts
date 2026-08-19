import { PrismaClient } from '../../../../src/generated/prisma/client';
import { BulkClearAlertsUseCase } from 'application/notifications/use-cases/BulkClearAlertsUseCase';
import { PrismaAlertRepository } from 'infrastructure/persistence/PrismaAlertRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  cleanDatabase,
  createTestPrisma,
  seedDeviceModel,
  seedMonitoredDevice,
  GHOST_ID
} from '../../helpers/db';

describe('BulkClearAlertsUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: BulkClearAlertsUseCase;
  let deviceModelId: string;
  let deviceId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();
    deviceModelId = await seedDeviceModel(prisma);
    useCase = new BulkClearAlertsUseCase(
      new PrismaAlertRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const seeded = await seedMonitoredDevice(prisma, deviceModelId);
    deviceId = seeded.deviceId;
  });

  it('[NOT-038] clears every open alert for a device', async () => {
    await prisma.alertEvent.create({
      data: { deviceId, severity: 'CRITICAL' }
    });
    await prisma.alertEvent.create({
      data: { deviceId, severity: 'WARNING' }
    });

    const result = await useCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.cleared).toHaveLength(2);

    const stillOpen = await prisma.alertEvent.count({
      where: { deviceId, resolvedAt: null }
    });
    expect(stillOpen).toBe(0);
  });

  it('[NOT-038] clears by explicit ids and buckets a ghost id as failed', async () => {
    const alert = await prisma.alertEvent.create({
      data: { deviceId, severity: 'CRITICAL' }
    });

    const result = await useCase.execute({
      ids: [alert.id, GHOST_ID]
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.cleared).toHaveLength(1);
    expect(result.value.failed).toHaveLength(1);
  });

  it('[NOT-038] fails when neither ids nor deviceId is provided', async () => {
    const result = await useCase.execute({});
    expect(result.isFailure).toBe(true);
  });
});
