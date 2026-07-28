import { PrismaClient } from '../../../../src/generated/prisma/client';
import { SendDeviceDownAlertUseCase } from 'application/notifications/use-cases/SendDeviceDownAlertUseCase';
import { SendAlertNotificationUseCase } from 'application/notifications/use-cases/SendAlertNotificationUseCase';
import { AlertPublisher } from 'infrastructure/notifications/AlertPublisher';
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

describe('SendDeviceDownAlertUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: SendDeviceDownAlertUseCase;
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
    const alertPublisher = new AlertPublisher(
      new SendAlertNotificationUseCase(deviceRepo, fakeNotification, logger)
    );
    useCase = new SendDeviceDownAlertUseCase(
      alertRepo,
      pollingConfigRepo,
      alertPublisher,
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

  it('creates a CRITICAL alert and persists it when notification succeeds', async () => {
    const occurredAt = new Date();
    const result = await useCase.execute({
      deviceId,
      consecutiveFailures: 3,
      occurredAt
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.severity).toBe('CRITICAL');
    expect(result.value.status).toBe('OPEN');
    expect(result.value.deviceId).toBe(deviceId);
    expect(result.value.notifiedAt).not.toBeNull();

    const row = await prisma.alertEvent.findFirst({ where: { deviceId } });
    expect(row).not.toBeNull();
    expect(row!.resolvedAt).toBeNull();
    expect(row!.notifiedAt).not.toBeNull();
  });

  it('sends a notification with correct metadata', async () => {
    const occurredAt = new Date('2025-06-01T10:00:00Z');
    await useCase.execute({ deviceId, consecutiveFailures: 5, occurredAt });

    expect(fakeNotification.callCount).toBe(1);
    const msg = fakeNotification.lastMessage!;
    expect(msg.metadata.deviceId).toBe(deviceId);
    expect(msg.metadata.severity).toBe('CRITICAL');
    expect(msg.metadata.timestamp).toBe(occurredAt.toISOString());
    // consecutive failures now live in the rendered body detail
    expect(msg.body).toContain('5');
  });

  it('includes device name and IP from database in the notification', async () => {
    await useCase.execute({
      deviceId,
      consecutiveFailures: 3,
      occurredAt: new Date()
    });

    const msg = fakeNotification.lastMessage!;
    expect(msg.metadata.deviceName).toBe('Monitored Test Device');
    // IP now lives in the rendered body detail (MarkdownV2-escaped), not metadata
    expect(msg.body.replace(/\\/g, '')).toContain('192.168.99.1');
  });

  it('still creates and saves the alert when notification fails', async () => {
    fakeNotification.setShouldFail(true);

    const result = await useCase.execute({
      deviceId,
      consecutiveFailures: 3,
      occurredAt: new Date()
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('OPEN');
    // notifiedAt must be null because send failed
    expect(result.value.notifiedAt).toBeNull();

    const row = await prisma.alertEvent.findFirst({ where: { deviceId } });
    expect(row).not.toBeNull();
    expect(row!.notifiedAt).toBeNull();
  });

  it('is idempotent — returns existing open alert without creating a duplicate', async () => {
    const first = await useCase.execute({
      deviceId,
      consecutiveFailures: 3,
      occurredAt: new Date()
    });

    fakeNotification.reset();
    const second = await useCase.execute({
      deviceId,
      consecutiveFailures: 5,
      occurredAt: new Date()
    });

    expect(second.isSuccess).toBe(true);
    expect(second.value.id).toBe(first.value.id);
    // No second notification sent for the duplicate call
    expect(fakeNotification.callCount).toBe(0);

    const rows = await prisma.alertEvent.findMany({ where: { deviceId } });
    expect(rows).toHaveLength(1);
  });

  it('uses null ipAddress when device has no polling configuration', async () => {
    // Seed a device without a polling configuration so IP resolves to null
    const bareDevice = await prisma.device.create({
      data: {
        name: 'No-Config Device',
        owner: 'COMPANY',
        status: 'ACTIVE',
        monitoringEnabled: false,
        deviceModelId
      }
    });

    const result = await useCase.execute({
      deviceId: bareDevice.id,
      consecutiveFailures: 1,
      occurredAt: new Date()
    });

    expect(result.isSuccess).toBe(true);
    // No polling config → no IP folded into the body detail
    expect(fakeNotification.lastMessage!.body).not.toContain('IP:');
  });

  // ──────────────────────────────────────────────────────────────
  // Validation failures
  // ──────────────────────────────────────────────────────────────

  it('fails when deviceId is empty', async () => {
    const result = await useCase.execute({
      deviceId: '',
      consecutiveFailures: 3,
      occurredAt: new Date()
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/required/i);
  });

  it('fails when deviceId is not a valid UUID', async () => {
    const result = await useCase.execute({
      deviceId: INVALID_ID,
      consecutiveFailures: 3,
      occurredAt: new Date()
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid device id/i);
  });

  it('fails when consecutiveFailures is negative', async () => {
    const result = await useCase.execute({
      deviceId,
      consecutiveFailures: -1,
      occurredAt: new Date()
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/consecutiveFailures/i);
  });
});
