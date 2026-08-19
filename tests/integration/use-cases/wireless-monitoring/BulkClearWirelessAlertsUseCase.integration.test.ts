import { PrismaClient } from '../../../../src/generated/prisma/client';
import { BulkClearWirelessAlertsUseCase } from 'application/wireless-monitoring/use-cases/BulkClearWirelessAlertsUseCase';
import { PrismaWirelessAlertRecordRepository } from 'infrastructure/wireless-monitoring/repositories/PrismaWirelessAlertRecordRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  cleanDatabase,
  createTestPrisma,
  seedWirelessDeviceModel,
  GHOST_ID
} from '../../helpers/db';

async function seedDevice(
  prisma: PrismaClient,
  deviceModelId: string,
  ipAddress = '192.168.51.1'
): Promise<string> {
  const device = await prisma.device.create({
    data: {
      name: 'Bulk Clear Wireless Test Device',
      owner: 'COMPANY',
      status: 'ACTIVE',
      monitoringEnabled: true,
      ipAddress,
      deviceModelId
    }
  });
  return device.id;
}

async function seedAlert(
  prisma: PrismaClient,
  deviceId: string,
  metric = 'signal_rx_dbm'
): Promise<string> {
  const record = await prisma.wirelessAlertRecord.create({
    data: {
      deviceId,
      metric,
      severity: 'CRITICAL',
      threshold: -75,
      triggeredAt: new Date(),
      isActive: true,
      lastValue: -80,
      message: 'Signal below threshold'
    }
  });
  return record.id;
}

describe('BulkClearWirelessAlertsUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: BulkClearWirelessAlertsUseCase;
  let deviceModelId: string;
  let deviceId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();
    deviceModelId = await seedWirelessDeviceModel(prisma);
    useCase = new BulkClearWirelessAlertsUseCase(
      new PrismaWirelessAlertRecordRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    deviceId = await seedDevice(prisma, deviceModelId);
  });

  it('[WLS-128] clears every active alert for the device when ids is omitted', async () => {
    await seedAlert(prisma, deviceId, 'signal_rx_dbm');
    await seedAlert(prisma, deviceId, 'snr_db');

    const result = await useCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.cleared).toHaveLength(2);

    const stillActive = await prisma.wirelessAlertRecord.count({
      where: { deviceId, isActive: true }
    });
    expect(stillActive).toBe(0);
  });

  it('[WLS-128] clears by explicit ids and buckets a ghost id as failed', async () => {
    const alertId = await seedAlert(prisma, deviceId);

    const result = await useCase.execute({
      deviceId,
      ids: [alertId, GHOST_ID]
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.cleared).toHaveLength(1);
    expect(result.value.failed).toHaveLength(1);
  });

  it('[WLS-128] buckets an alert belonging to another device as failed', async () => {
    const otherDeviceId = await seedDevice(
      prisma,
      deviceModelId,
      '192.168.51.2'
    );
    const foreignAlertId = await seedAlert(prisma, otherDeviceId);

    const result = await useCase.execute({
      deviceId,
      ids: [foreignAlertId]
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.failed).toHaveLength(1);
    expect(result.value.cleared).toHaveLength(0);
  });
});
