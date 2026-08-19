import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ClearWirelessAlertUseCase } from 'application/wireless-monitoring/use-cases/ClearWirelessAlertUseCase';
import { PrismaWirelessAlertRecordRepository } from 'infrastructure/wireless-monitoring/repositories/PrismaWirelessAlertRecordRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  cleanDatabase,
  createTestPrisma,
  seedWirelessDeviceModel,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

async function seedDevice(
  prisma: PrismaClient,
  deviceModelId: string,
  ipAddress = '192.168.50.1'
): Promise<string> {
  const device = await prisma.device.create({
    data: {
      name: 'Wireless Alert Test Device',
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
  deviceId: string
): Promise<string> {
  const record = await prisma.wirelessAlertRecord.create({
    data: {
      deviceId,
      metric: 'signal_rx_dbm',
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

describe('ClearWirelessAlertUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: ClearWirelessAlertUseCase;
  let deviceModelId: string;
  let deviceId: string;
  let alertId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();
    deviceModelId = await seedWirelessDeviceModel(prisma);
    useCase = new ClearWirelessAlertUseCase(
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
    alertId = await seedAlert(prisma, deviceId);
  });

  it('[WLS-127] clears an active alert and persists clearedAt', async () => {
    const result = await useCase.execute({ deviceId, alertId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.isActive).toBe(false);

    const stored = await prisma.wirelessAlertRecord.findUnique({
      where: { id: alertId }
    });
    expect(stored?.isActive).toBe(false);
    expect(stored?.clearedAt).not.toBeNull();
  });

  it('[WLS-127] is idempotent on an already-cleared alert', async () => {
    await useCase.execute({ deviceId, alertId });
    const result = await useCase.execute({ deviceId, alertId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.isActive).toBe(false);
  });

  it('[WLS-127] fails when the alert belongs to a different device', async () => {
    const otherDeviceId = await seedDevice(
      prisma,
      deviceModelId,
      '192.168.50.2'
    );

    const result = await useCase.execute({
      deviceId: otherDeviceId,
      alertId
    });

    expect(result.isFailure).toBe(true);
  });

  it('[WLS-127] fails for a ghost alert id', async () => {
    const result = await useCase.execute({
      deviceId,
      alertId: GHOST_ID
    });
    expect(result.isFailure).toBe(true);
  });

  it('[WLS-127] fails for a malformed alert id', async () => {
    const result = await useCase.execute({
      deviceId,
      alertId: INVALID_ID
    });
    expect(result.isFailure).toBe(true);
  });
});
