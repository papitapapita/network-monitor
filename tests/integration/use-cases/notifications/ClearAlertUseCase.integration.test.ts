import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ClearAlertUseCase } from 'application/notifications/use-cases/ClearAlertUseCase';
import { PrismaAlertRepository } from 'infrastructure/persistence/PrismaAlertRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  cleanDatabase,
  createTestPrisma,
  seedDeviceModel,
  seedMonitoredDevice,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('ClearAlertUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: ClearAlertUseCase;
  let deviceModelId: string;
  let deviceId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();
    deviceModelId = await seedDeviceModel(prisma);
    useCase = new ClearAlertUseCase(
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

  it('[NOT-037] clears an open alert and persists resolvedAt', async () => {
    const alert = await prisma.alertEvent.create({
      data: { deviceId, severity: 'CRITICAL' }
    });

    const result = await useCase.execute({ id: alert.id });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('RESOLVED');

    const stored = await prisma.alertEvent.findUnique({
      where: { id: alert.id }
    });
    expect(stored?.resolvedAt).not.toBeNull();
  });

  it('[NOT-037] is idempotent on an already-resolved alert', async () => {
    const alert = await prisma.alertEvent.create({
      data: { deviceId, severity: 'CRITICAL', resolvedAt: new Date() }
    });

    const result = await useCase.execute({ id: alert.id });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('RESOLVED');
  });

  it('[NOT-037] fails for a ghost id', async () => {
    const result = await useCase.execute({ id: GHOST_ID });
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('Alert not found');
  });

  it('[NOT-037] fails for a malformed id', async () => {
    const result = await useCase.execute({ id: INVALID_ID });
    expect(result.isFailure).toBe(true);
  });
});
