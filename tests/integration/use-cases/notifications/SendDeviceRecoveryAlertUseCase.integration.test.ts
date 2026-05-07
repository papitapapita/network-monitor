import { PrismaClient } from '../../../../src/generated/prisma/client';
import { SendDeviceDownAlertUseCase } from 'application/notifications/use-cases/SendDeviceDownAlertUseCase';
import { SendDeviceRecoveryAlertUseCase } from 'application/notifications/use-cases/SendDeviceRecoveryAlertUseCase';
import { PrismaAlertRepository } from 'infrastructure/persistence/PrismaAlertRepository';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { PrismaPollingConfigurationRepository } from 'infrastructure/persistence/PrismaPollingConfigurationRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  cleanDatabase,
  createTestPrisma,
  seedDeviceModel,
  seedMonitoredDevice,
  INVALID_ID
} from '../../helpers/db';
import { FakeNotificationService } from '../../helpers/FakeNotificationService';

describe('SendDeviceRecoveryAlertUseCase — integration', () => {
  let prisma: PrismaClient;
  let downUseCase: SendDeviceDownAlertUseCase;
  let recoveryUseCase: SendDeviceRecoveryAlertUseCase;
  let fakeNotification: FakeNotificationService;
  let deviceModelId: string;
  let deviceId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    const alertRepo = new PrismaAlertRepository(prisma);
    const deviceRepo = new PrismaDeviceRepository(prisma);
    const pollingConfigRepo = new PrismaPollingConfigurationRepository(prisma);
    const logger = new WinstonLogger();

    fakeNotification = new FakeNotificationService();
    downUseCase = new SendDeviceDownAlertUseCase(
      alertRepo,
      deviceRepo,
      pollingConfigRepo,
      fakeNotification,
      logger
    );
    recoveryUseCase = new SendDeviceRecoveryAlertUseCase(
      alertRepo,
      deviceRepo,
      pollingConfigRepo,
      fakeNotification,
      logger
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const seeded = await seedMonitoredDevice(prisma, deviceModelId);
    deviceId = seeded.deviceId;
    fakeNotification.reset();
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('resolves open alert, sets durationSecs, and marks recoveryNotifiedAt', async () => {
    const downResult = await downUseCase.execute({
      deviceId,
      consecutiveFailures: 3,
      occurredAt: new Date()
    });
    expect(downResult.isSuccess).toBe(true);
    fakeNotification.reset();

    // Resolve 5 minutes after the alert's actual startedAt
    const alertStartedAt = new Date(downResult.value.startedAt);
    const recoveredAt = new Date(alertStartedAt.getTime() + 300 * 1000);

    const result = await recoveryUseCase.execute({
      deviceId,
      latencyMs: 12,
      occurredAt: recoveredAt
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('RESOLVED');
    expect(result.value.resolvedAt).not.toBeNull();
    expect(result.value.recoveryNotifiedAt).not.toBeNull();
    expect(result.value.durationSecs).toBe(300);

    const row = await prisma.alertEvent.findFirst({ where: { deviceId } });
    expect(row!.resolvedAt).not.toBeNull();
    expect(row!.recoveryNotifiedAt).not.toBeNull();
    expect(row!.durationSecs).toBe(300);
  });

  it('sends recovery notification with correct metadata', async () => {
    const downResult = await downUseCase.execute({
      deviceId,
      consecutiveFailures: 3,
      occurredAt: new Date()
    });
    expect(downResult.isSuccess).toBe(true);
    fakeNotification.reset();

    // Resolve 1 hour after the alert's actual startedAt
    const alertStartedAt = new Date(downResult.value.startedAt);
    const recoveredAt = new Date(alertStartedAt.getTime() + 3600 * 1000);

    await recoveryUseCase.execute({
      deviceId,
      latencyMs: 45,
      occurredAt: recoveredAt
    });

    expect(fakeNotification.callCount).toBe(1);
    const msg = fakeNotification.lastMessage!;
    expect(msg.metadata.deviceId).toBe(deviceId);
    expect(msg.metadata.latencyMs).toBe(45);
    expect(msg.metadata.durationSecs).toBe(3600);
    expect(msg.metadata.timestamp).toBe(recoveredAt.toISOString());
  });

  it('includes device name and IP in the recovery notification', async () => {
    await downUseCase.execute({
      deviceId,
      consecutiveFailures: 3,
      occurredAt: new Date('2025-06-01T10:00:00Z')
    });
    fakeNotification.reset();

    await recoveryUseCase.execute({
      deviceId,
      latencyMs: null,
      occurredAt: new Date()
    });

    const msg = fakeNotification.lastMessage!;
    expect(msg.metadata.deviceName).toBe('Monitored Test Device');
    expect(msg.metadata.ipAddress).toBe('192.168.99.1');
  });

  it('resolves and saves the alert even when recovery notification fails', async () => {
    await downUseCase.execute({
      deviceId,
      consecutiveFailures: 3,
      occurredAt: new Date('2025-06-01T10:00:00Z')
    });

    fakeNotification.reset();
    fakeNotification.setShouldFail(true);

    const result = await recoveryUseCase.execute({
      deviceId,
      latencyMs: null,
      occurredAt: new Date()
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('RESOLVED');
    // recoveryNotifiedAt must be null because send failed
    expect(result.value.recoveryNotifiedAt).toBeNull();

    const row = await prisma.alertEvent.findFirst({ where: { deviceId } });
    expect(row!.resolvedAt).not.toBeNull();
    expect(row!.recoveryNotifiedAt).toBeNull();
  });

  it('handles latencyMs=null without error', async () => {
    await downUseCase.execute({
      deviceId,
      consecutiveFailures: 3,
      occurredAt: new Date('2025-06-01T10:00:00Z')
    });
    fakeNotification.reset();

    const result = await recoveryUseCase.execute({
      deviceId,
      latencyMs: null,
      occurredAt: new Date('2025-06-01T10:10:00Z')
    });

    expect(result.isSuccess).toBe(true);
    const msg = fakeNotification.lastMessage!;
    expect(msg.metadata.latencyMs).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────
  // Failure paths
  // ──────────────────────────────────────────────────────────────

  it('fails when no open alert exists for the device', async () => {
    const result = await recoveryUseCase.execute({
      deviceId,
      latencyMs: 10,
      occurredAt: new Date()
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/no open alert/i);
  });

  it('fails when deviceId is empty', async () => {
    const result = await recoveryUseCase.execute({
      deviceId: '',
      latencyMs: 10,
      occurredAt: new Date()
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/required/i);
  });

  it('fails when deviceId is not a valid UUID', async () => {
    const result = await recoveryUseCase.execute({
      deviceId: INVALID_ID,
      latencyMs: 10,
      occurredAt: new Date()
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid device id/i);
  });
});
