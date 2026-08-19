import { PrismaClient } from '../../../../src/generated/prisma/client';
import { BulkDeleteAlertsUseCase } from 'application/notifications/use-cases/BulkDeleteAlertsUseCase';
import { PrismaAlertRepository } from 'infrastructure/persistence/PrismaAlertRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  cleanDatabase,
  createTestPrisma,
  seedDeviceModel,
  seedMonitoredDevice,
  GHOST_ID
} from '../../helpers/db';

describe('BulkDeleteAlertsUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: BulkDeleteAlertsUseCase;
  let deviceModelId: string;
  let deviceId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();
    deviceModelId = await seedDeviceModel(prisma);
    useCase = new BulkDeleteAlertsUseCase(
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

  it('[NOT-039] deletes resolved alerts and skips an open one in the same batch', async () => {
    const open = await prisma.alertEvent.create({
      data: { deviceId, severity: 'CRITICAL' }
    });
    const resolved = await prisma.alertEvent.create({
      data: { deviceId, severity: 'WARNING', resolvedAt: new Date() }
    });

    const result = await useCase.execute({
      ids: [open.id, resolved.id]
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.deleted).toEqual([resolved.id]);
    expect(result.value.skipped).toHaveLength(1);

    const remaining = await prisma.alertEvent.findMany({
      where: { deviceId }
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(open.id);
  });

  it('[NOT-039] buckets a ghost id as failed', async () => {
    const result = await useCase.execute({ ids: [GHOST_ID] });
    expect(result.isSuccess).toBe(true);
    expect(result.value.failed).toHaveLength(1);
  });

  it('[NOT-039] fails when ids is empty', async () => {
    const result = await useCase.execute({ ids: [] });
    expect(result.isFailure).toBe(true);
  });
});
