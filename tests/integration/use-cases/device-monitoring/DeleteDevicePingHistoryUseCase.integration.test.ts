import { PrismaClient } from '../../../../src/generated/prisma/client';
import { DeleteDevicePingHistoryUseCase } from 'application/device-monitoring/use-cases/DeleteDevicePingHistoryUseCase';
import { PrismaPingResultRepository } from 'infrastructure/persistence/PrismaPingResultRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  cleanDatabase,
  createTestPrisma,
  seedDeviceModel,
  seedMonitoredDevice,
  INVALID_ID
} from '../../helpers/db';

async function seedPingResult(
  prisma: PrismaClient,
  deviceId: string,
  checkedAt: Date
): Promise<void> {
  await prisma.pingResult.create({
    data: { deviceId, isReachable: true, checkedAt }
  });
}

describe('DeleteDevicePingHistoryUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: DeleteDevicePingHistoryUseCase;
  let deviceModelId: string;
  let deviceId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();
    deviceModelId = await seedDeviceModel(prisma);
    useCase = new DeleteDevicePingHistoryUseCase(
      new PrismaPingResultRepository(prisma),
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

  it('[MON-041] deletes all ping history for a device when no date range is given', async () => {
    await seedPingResult(
      prisma,
      deviceId,
      new Date('2024-01-01T00:00:00Z')
    );
    await seedPingResult(
      prisma,
      deviceId,
      new Date('2024-01-02T00:00:00Z')
    );

    const result = await useCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.deletedCount).toBe(2);

    const remaining = await prisma.pingResult.count({
      where: { deviceId }
    });
    expect(remaining).toBe(0);
  });

  it('[MON-041] scopes deletion to the given date range, leaving the rest', async () => {
    await seedPingResult(
      prisma,
      deviceId,
      new Date('2024-01-01T00:00:00Z')
    );
    await seedPingResult(
      prisma,
      deviceId,
      new Date('2024-02-01T00:00:00Z')
    );

    const result = await useCase.execute({
      deviceId,
      fromDate: new Date('2024-01-01T00:00:00Z'),
      toDate: new Date('2024-01-31T00:00:00Z')
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.deletedCount).toBe(1);

    const remaining = await prisma.pingResult.count({
      where: { deviceId }
    });
    expect(remaining).toBe(1);
  });

  it("[MON-041] does not touch another device's history", async () => {
    const other = await seedMonitoredDevice(
      prisma,
      deviceModelId,
      '10.0.0.9'
    );
    await seedPingResult(prisma, deviceId, new Date());
    await seedPingResult(prisma, other.deviceId, new Date());

    const result = await useCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.deletedCount).toBe(1);

    const otherRemaining = await prisma.pingResult.count({
      where: { deviceId: other.deviceId }
    });
    expect(otherRemaining).toBe(1);
  });

  it('[MON-041] fails for a malformed device id', async () => {
    const result = await useCase.execute({ deviceId: INVALID_ID });
    expect(result.isFailure).toBe(true);
  });
});
