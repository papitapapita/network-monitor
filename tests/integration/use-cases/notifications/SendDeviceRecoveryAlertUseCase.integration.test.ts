import { PrismaClient } from '../../../../src/generated/prisma/client';
import { SendDeviceDownAlertUseCase } from 'application/notifications/use-cases/SendDeviceDownAlertUseCase';
import { SendDeviceRecoveryAlertUseCase } from 'application/notifications/use-cases/SendDeviceRecoveryAlertUseCase';
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
import { seedPushUser } from '../../helpers/pushSubscriptions';
import { InboxAlertPublisher } from 'infrastructure/notifications/InboxAlertPublisher';
import { RecordInboxNotificationUseCase } from 'application/notifications/use-cases/RecordInboxNotificationUseCase';
import { PrismaInboxNotificationRepository } from 'infrastructure/persistence/PrismaInboxNotificationRepository';
import { PrismaInboxRecipientsQuery } from 'infrastructure/persistence/PrismaInboxRecipientsQuery';
import { SseBroadcaster } from 'infrastructure/realtime/SseBroadcaster';
import { InboxStream } from 'application/notifications/shared/InboxStream';
import { QUIET_HOURS_SUPPRESSED } from 'application/shared/interfaces';
import { Result } from 'domain/shared/core';

// deleted_by is a UUID column: the id of the user who deleted the device.
const OPERATOR_USER_ID = '00000000-0000-4000-8000-0000000000aa';

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
    const rollup = new OutageRollup(
      alertRepo,
      new PrismaOutageTopologyQuery(prisma),
      logger
    );
    downUseCase = new SendDeviceDownAlertUseCase(
      alertRepo,
      pollingConfigRepo,
      deviceRepo,
      new DeviceEligibilityService(),
      alertPublisher,
      logger,
      undefined,
      rollup
    );
    recoveryUseCase = new SendDeviceRecoveryAlertUseCase(
      alertRepo,
      deviceRepo,
      alertPublisher,
      logger,
      rollup
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
    const alertStartedAt = new Date(downResult.value!.startedAt);
    const recoveredAt = new Date(
      alertStartedAt.getTime() + 300 * 1000
    );

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

    const row = await prisma.alertEvent.findFirst({
      where: { deviceId }
    });
    expect(row!.resolvedAt).not.toBeNull();
    expect(row!.recoveryNotifiedAt).not.toBeNull();
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
    const alertStartedAt = new Date(downResult.value!.startedAt);
    const recoveredAt = new Date(
      alertStartedAt.getTime() + 3600 * 1000
    );

    await recoveryUseCase.execute({
      deviceId,
      latencyMs: 45,
      occurredAt: recoveredAt
    });

    expect(fakeNotification.callCount).toBe(1);
    const msg = fakeNotification.lastMessage!;
    expect(msg.metadata.deviceId).toBe(deviceId);
    expect(msg.metadata.timestamp).toBe(recoveredAt.toISOString());
    expect(msg.body).toContain(
      'Monitored Test Device volvió a responder tras 1 hora sin conexión'
    );
    expect(msg.body).toContain('Latencia: 45 ms');
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
    expect(msg.body).toContain('(http://192.168.99.1)');
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

    const row = await prisma.alertEvent.findFirst({
      where: { deviceId }
    });
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
    // null latency renders as N/A in the body detail
    expect(msg.body).toContain('N/A');
  });

  // Only the alert-opening path is gated on device eligibility. Gating this
  // one too would strand an alert raised while the device was still live:
  // permanently OPEN on a device no read path can see.
  it('[DEV-087] still resolves an alert opened before the device was deleted', async () => {
    const downResult = await downUseCase.execute({
      deviceId,
      consecutiveFailures: 3,
      occurredAt: new Date()
    });
    expect(downResult.value).not.toBeNull();

    await prisma.device.update({
      where: { id: deviceId },
      data: { deletedAt: new Date(), deletedBy: OPERATOR_USER_ID }
    });

    const result = await recoveryUseCase.execute({
      deviceId,
      latencyMs: 12,
      occurredAt: new Date()
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('RESOLVED');

    const row = await prisma.alertEvent.findFirst({
      where: { deviceId }
    });
    expect(row!.resolvedAt).not.toBeNull();
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

  describe('[NOT-245] [NOT-246] devices behind the recovered one', () => {
    it('names who is still down and leaves them attached', async () => {
      const back = await seedDownBehind(
        'Cliente Vuelve',
        '10.0.4.2',
        deviceId
      );
      const stuck = await seedDownBehind(
        'Cliente Sigue',
        '10.0.4.3',
        deviceId
      );
      await downUseCase.execute({
        deviceId,
        consecutiveFailures: 3,
        occurredAt: new Date()
      });
      await recoveryUseCase.execute({
        deviceId: back.deviceId,
        latencyMs: 2,
        occurredAt: new Date()
      });
      fakeNotification.reset();

      await recoveryUseCase.execute({
        deviceId,
        latencyMs: 2,
        occurredAt: new Date()
      });

      const body = fakeNotification.lastMessage!.body;
      expect(body).toContain('Volvieron 1 de 2');
      expect(body).toContain('Cliente Sigue');
      const stuckAlert = await prisma.alertEvent.findUnique({
        where: { id: stuck.alertId }
      });
      expect(stuckAlert!.resolvedAt).toBeNull();
      expect(stuckAlert!.causedByAlertId).not.toBeNull();
    });

    it('resolves an affected device without telling anyone (NOT-246)', async () => {
      const child = await seedDownBehind(
        'Cliente Vuelve',
        '10.0.4.2',
        deviceId
      );
      await downUseCase.execute({
        deviceId,
        consecutiveFailures: 3,
        occurredAt: new Date()
      });
      fakeNotification.reset();

      const result = await recoveryUseCase.execute({
        deviceId: child.deviceId,
        latencyMs: 2,
        occurredAt: new Date()
      });

      expect(result.value.status).toBe('RESOLVED');
      expect(fakeNotification.callCount).toBe(0);
      const row = await prisma.alertEvent.findUnique({
        where: { id: child.alertId }
      });
      expect(row!.recoveryNotifiedAt).toBeNull();
    });
  });

  describe('[NOT-270] the inbox when the outage was held back', () => {
    let heldDown: SendDeviceDownAlertUseCase;
    let heldRecovery: SendDeviceRecoveryAlertUseCase;
    let hub: SseBroadcaster;
    let userId: string;

    beforeAll(() => {
      const alertRepo = new PrismaAlertRepository(prisma);
      const deviceRepo = new PrismaDeviceRepository(prisma);
      const logger = new WinstonLogger();
      const inboxRepo = new PrismaInboxNotificationRepository(prisma);
      hub = new SseBroadcaster(logger);
      const record = new RecordInboxNotificationUseCase(
        inboxRepo,
        new PrismaInboxRecipientsQuery(prisma),
        new InboxStream(hub, inboxRepo, logger),
        logger
      );
      // Quiet hours: every delivery is withheld.
      const quiet = new InboxAlertPublisher(
        { publish: async () => Result.fail(QUIET_HOURS_SUPPRESSED) },
        record,
        logger
      );
      const inboxOnly = new InboxAlertPublisher(
        { publish: async () => Result.ok() },
        record,
        logger
      );
      heldDown = new SendDeviceDownAlertUseCase(
        alertRepo,
        new PrismaPollingConfigurationRepository(prisma),
        deviceRepo,
        new DeviceEligibilityService(),
        quiet,
        logger
      );
      heldRecovery = new SendDeviceRecoveryAlertUseCase(
        alertRepo,
        deviceRepo,
        quiet,
        logger,
        undefined,
        inboxOnly
      );
    });

    afterAll(() => {
      hub.closeAll();
    });

    beforeEach(async () => {
      userId = await seedPushUser(prisma, 'operator@example.local');
    });

    async function inbox(): Promise<
      { resolved: boolean; alertId: string | null }[]
    > {
      return prisma.inboxNotification.findMany({
        where: { userId },
        select: { resolved: true, alertId: true },
        orderBy: { occurredAt: 'asc' }
      });
    }

    it('records the recovery next to the outage, without paging anyone', async () => {
      const down = await heldDown.execute({
        deviceId,
        consecutiveFailures: 3,
        occurredAt: new Date('2026-10-27T07:10:00Z')
      });
      expect(down.value!.notifiedAt).toBeNull();

      const result = await heldRecovery.execute({
        deviceId,
        latencyMs: 4,
        occurredAt: new Date('2026-10-27T07:40:00Z')
      });

      expect(result.value.recoveryNotifiedAt).toBeNull();
      expect(await inbox()).toEqual([
        { resolved: false, alertId: down.value!.id },
        { resolved: true, alertId: down.value!.id }
      ]);
    });

    it('records nothing for a blip that never reached the inbox', async () => {
      await prisma.alertEvent.create({
        data: { deviceId, type: 'device_unreachable' }
      });

      const result = await heldRecovery.execute({
        deviceId,
        latencyMs: 4,
        occurredAt: new Date()
      });

      expect(result.value.status).toBe('RESOLVED');
      expect(await inbox()).toEqual([]);
    });
  });
});
