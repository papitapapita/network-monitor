import { PrismaClient } from '../../../../src/generated/prisma/client';
import { SendDeviceDownAlertUseCase } from 'application/notifications/use-cases/SendDeviceDownAlertUseCase';
import { SendAlertNotificationUseCase } from 'application/notifications/use-cases/SendAlertNotificationUseCase';
import { AlertPublisher } from 'infrastructure/notifications/AlertPublisher';
import { PrismaAlertRepository } from 'infrastructure/persistence/PrismaAlertRepository';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { PrismaPollingConfigurationRepository } from 'infrastructure/persistence/PrismaPollingConfigurationRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { DeviceEligibilityService } from 'domain/device-inventory/services';
import { OutageRollup } from 'application/notifications/shared';
import { PrismaOutageTopologyQuery } from 'infrastructure/persistence';
import {
  cleanDatabase,
  createTestPrisma,
  seedDeviceModel,
  seedMonitoredDevice,
  seedNetworkDevice,
  INVALID_ID
} from '../../helpers/db';
import { FakeNotificationService } from '../../helpers/FakeNotificationService';

// deleted_by is a UUID column: the id of the user who deleted the device.
const OPERATOR_USER_ID = '00000000-0000-4000-8000-0000000000aa';

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
    const pollingConfigRepo =
      new PrismaPollingConfigurationRepository(prisma);
    const logger = new WinstonLogger();

    fakeNotification = new FakeNotificationService();
    const alertPublisher = new AlertPublisher(
      new SendAlertNotificationUseCase(
        deviceRepo,
        fakeNotification,
        logger
      )
    );
    useCase = new SendDeviceDownAlertUseCase(
      alertRepo,
      pollingConfigRepo,
      deviceRepo,
      new DeviceEligibilityService(),
      alertPublisher,
      logger,
      undefined,
      new OutageRollup(
        alertRepo,
        new PrismaOutageTopologyQuery(prisma),
        logger
      )
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
    expect(result.value!.severity).toBe('CRITICAL');
    expect(result.value!.status).toBe('OPEN');
    expect(result.value!.deviceId).toBe(deviceId);
    expect(result.value!.notifiedAt).not.toBeNull();

    const row = await prisma.alertEvent.findFirst({
      where: { deviceId }
    });
    expect(row).not.toBeNull();
    expect(row!.resolvedAt).toBeNull();
    expect(row!.notifiedAt).not.toBeNull();
  });

  it('sends a notification with correct metadata', async () => {
    const occurredAt = new Date('2025-06-01T10:00:00Z');
    await useCase.execute({
      deviceId,
      consecutiveFailures: 5,
      occurredAt
    });

    expect(fakeNotification.callCount).toBe(1);
    const msg = fakeNotification.lastMessage!;
    expect(msg.metadata.deviceId).toBe(deviceId);
    expect(msg.metadata.severity).toBe('CRITICAL');
    expect(msg.metadata.timestamp).toBe(occurredAt.toISOString());
    expect(msg.body).toContain(
      'Monitored Test Device no responde desde'
    );
  });

  it('includes device name and IP from database in the notification', async () => {
    await useCase.execute({
      deviceId,
      consecutiveFailures: 3,
      occurredAt: new Date()
    });

    const msg = fakeNotification.lastMessage!;
    expect(msg.metadata.deviceName).toBe('Monitored Test Device');
    expect(msg.metadata.ipAddress).toBe('192.168.99.1');
    expect(msg.body).toContain('(http://192.168.99.1)');
  });

  it('still creates and saves the alert when notification fails', async () => {
    fakeNotification.setShouldFail(true);

    const result = await useCase.execute({
      deviceId,
      consecutiveFailures: 3,
      occurredAt: new Date()
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value!.status).toBe('OPEN');
    // notifiedAt must be null because send failed
    expect(result.value!.notifiedAt).toBeNull();

    const row = await prisma.alertEvent.findFirst({
      where: { deviceId }
    });
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
    expect(second.value!.id).toBe(first.value!.id);
    // No second notification sent for the duplicate call
    expect(fakeNotification.callCount).toBe(0);

    const rows = await prisma.alertEvent.findMany({
      where: { deviceId }
    });
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
    expect(fakeNotification.lastMessage!.body).not.toContain('🌐');
  });

  // ──────────────────────────────────────────────────────────────
  // Device eligibility at dispatch time
  // ──────────────────────────────────────────────────────────────

  // A poll can still be in flight for a device that was deleted or retired
  // between the poll and the notification — the polling config is disabled by
  // a fire-and-forget event handler that may never have run.
  it('[DEV-087] suppresses the alert for a soft-deleted device', async () => {
    await prisma.device.update({
      where: { id: deviceId },
      data: { deletedAt: new Date(), deletedBy: OPERATOR_USER_ID }
    });

    const result = await useCase.execute({
      deviceId,
      consecutiveFailures: 3,
      occurredAt: new Date()
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toBeNull();
    expect(fakeNotification.callCount).toBe(0);

    const rows = await prisma.alertEvent.findMany({
      where: { deviceId }
    });
    expect(rows).toHaveLength(0);
  });

  it('[DEV-087] suppresses the alert for a retired device', async () => {
    await prisma.device.update({
      where: { id: deviceId },
      data: { status: 'DAMAGED', serialNumber: 'SN-RETIRED-1' }
    });

    const result = await useCase.execute({
      deviceId,
      consecutiveFailures: 3,
      occurredAt: new Date()
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toBeNull();

    const rows = await prisma.alertEvent.findMany({
      where: { deviceId }
    });
    expect(rows).toHaveLength(0);
  });

  // The flag is the stale cache this guard routes around, so it must not be
  // what the guard consults.
  it('[DEV-087] still alerts for an ACTIVE device with monitoring switched off', async () => {
    await prisma.device.update({
      where: { id: deviceId },
      data: { monitoringEnabled: false }
    });

    const result = await useCase.execute({
      deviceId,
      consecutiveFailures: 3,
      occurredAt: new Date()
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value).not.toBeNull();
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
  async function seedDownBehind(
    name: string,
    ipAddress: string,
    upstreamDeviceId: string,
    alert: { notifiedAt?: Date | null } = {}
  ): Promise<{ deviceId: string; alertId: string }> {
    const childId = await seedNetworkDevice(prisma, deviceModelId, {
      name,
      ipAddress,
      upstreamDeviceId,
      status: 'ACTIVE'
    });
    const row = await prisma.alertEvent.create({
      data: {
        deviceId: childId,
        severity: 'CRITICAL',
        source: 'Disponibilidad',
        type: 'device_unreachable',
        description: 'Sin conexión.',
        notifiedAt: alert.notifiedAt ?? null
      }
    });
    return { deviceId: childId, alertId: row.id };
  }

  describe('[NOT-243] a root alert names the devices down behind it', () => {
    it('attaches every unnotified down device in its subtree and lists them', async () => {
      const ap = await seedNetworkDevice(prisma, deviceModelId, {
        name: 'AP Norte',
        ipAddress: '10.0.3.2',
        upstreamDeviceId: deviceId,
        status: 'ACTIVE'
      });
      const viaAp = await seedDownBehind(
        'Cliente Ruiz',
        '10.0.3.21',
        ap
      );
      const direct = await seedDownBehind(
        'Cliente Perez',
        '10.0.3.22',
        deviceId
      );
      const pagedAlready = await seedDownBehind(
        'Cliente Previo',
        '10.0.3.23',
        deviceId,
        { notifiedAt: new Date() }
      );

      await useCase.execute({
        deviceId,
        consecutiveFailures: 3,
        occurredAt: new Date()
      });

      const root = await prisma.alertEvent.findFirst({
        where: { deviceId }
      });
      const caused = async (alertId: string) =>
        (await prisma.alertEvent.findUnique({
          where: { id: alertId }
        }))!.causedByAlertId;
      expect(await caused(viaAp.alertId)).toBe(root!.id);
      expect(await caused(direct.alertId)).toBe(root!.id);
      expect(await caused(pagedAlready.alertId)).toBeNull();
      const body = fakeNotification.lastMessage!.body;
      expect(body).toContain('Cliente Ruiz');
      expect(body).toContain('Cliente Perez');
      expect(body).not.toContain('Cliente Previo');
    });

    it('leaves out a down device that is not behind it', async () => {
      const elsewhere = await seedNetworkDevice(
        prisma,
        deviceModelId,
        {
          name: 'Otro Nodo',
          ipAddress: '10.0.9.1',
          status: 'ACTIVE'
        }
      );
      const unrelated = await seedDownBehind(
        'Cliente Lejano',
        '10.0.9.2',
        elsewhere
      );

      await useCase.execute({
        deviceId,
        consecutiveFailures: 3,
        occurredAt: new Date()
      });

      expect(
        (await prisma.alertEvent.findUnique({
          where: { id: unrelated.alertId }
        }))!.causedByAlertId
      ).toBeNull();
      expect(fakeNotification.lastMessage!.body).not.toContain(
        'Afectados'
      );
    });

    it("terminates on a loop closed behind the policy's back", async () => {
      const a = await seedNetworkDevice(prisma, deviceModelId, {
        name: 'Nodo A',
        ipAddress: '10.0.7.1',
        upstreamDeviceId: deviceId,
        status: 'ACTIVE'
      });
      const b = await seedDownBehind('Nodo B', '10.0.7.2', a);
      await prisma.device.update({
        where: { id: deviceId },
        data: { upstreamDeviceId: b.deviceId }
      });

      const result = await useCase.execute({
        deviceId,
        consecutiveFailures: 3,
        occurredAt: new Date()
      });

      expect(result.isSuccess).toBe(true);
      expect(fakeNotification.lastMessage!.body).toContain('Nodo B');
    });
  });
});
