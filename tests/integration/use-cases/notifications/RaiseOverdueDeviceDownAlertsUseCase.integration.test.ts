import { PrismaClient } from '../../../../src/generated/prisma/client';
import { RaiseOverdueDeviceDownAlertsUseCase } from 'application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase';
import { SendDeviceDownAlertUseCase } from 'application/notifications/use-cases/SendDeviceDownAlertUseCase';
import { SendAlertNotificationUseCase } from 'application/notifications/use-cases/SendAlertNotificationUseCase';
import { SendDeviceRecoveryAlertUseCase } from 'application/notifications/use-cases/SendDeviceRecoveryAlertUseCase';
import { OutageRollup } from 'application/notifications/shared';
import { AlertPublisher } from 'infrastructure/notifications/AlertPublisher';
import {
  PrismaAlertRepository,
  PrismaDeviceNotificationPolicyRepository,
  PrismaOutageTopologyQuery
} from 'infrastructure/persistence';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { PrismaDeviceStateRepository } from 'infrastructure/persistence/PrismaDeviceStateRepository';
import { PrismaPollingConfigurationRepository } from 'infrastructure/persistence/PrismaPollingConfigurationRepository';
import { PrismaAgentStatusQuery } from 'infrastructure/probe-agents/queries';
import { PrismaNotificationSettingsRepository } from 'infrastructure/persistence/PrismaNotificationSettingsRepository';
import { NotificationSettings } from 'domain/notifications/value-objects';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { DeviceEligibilityService } from 'domain/device-inventory/services';
import {
  cleanAgents,
  cleanDatabase,
  createTestPrisma,
  seedAgent,
  seedDeviceModel,
  seedMonitoredDevice
} from '../../helpers/db';
import { FakeNotificationService } from '../../helpers/FakeNotificationService';

const ALERT_DELAY_MS = 5 * 60_000;
const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000);

describe('RaiseOverdueDeviceDownAlertsUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: RaiseOverdueDeviceDownAlertsUseCase;
  let buildUseCase: (
    serverOnSite: boolean
  ) => RaiseOverdueDeviceDownAlertsUseCase;
  let fakeNotification: FakeNotificationService;
  let recovery: SendDeviceRecoveryAlertUseCase;
  let deviceModelId: string;
  let ipCounter = 0;

  beforeAll(async () => {
    prisma = createTestPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    const deviceRepo = new PrismaDeviceRepository(prisma);
    const logger = new WinstonLogger();
    fakeNotification = new FakeNotificationService();
    const alertRepo = new PrismaAlertRepository(prisma);
    const topology = new PrismaOutageTopologyQuery(prisma);
    const rollup = new OutageRollup(alertRepo, topology, logger);
    const publisher = new AlertPublisher(
      new SendAlertNotificationUseCase(
        deviceRepo,
        fakeNotification,
        logger
      )
    );
    recovery = new SendDeviceRecoveryAlertUseCase(
      alertRepo,
      deviceRepo,
      publisher,
      logger,
      rollup
    );
    const sendDeviceDownAlert = new SendDeviceDownAlertUseCase(
      alertRepo,
      new PrismaPollingConfigurationRepository(prisma),
      deviceRepo,
      new DeviceEligibilityService(),
      publisher,
      logger,
      undefined,
      rollup
    );
    buildUseCase = (serverOnSite) =>
      new RaiseOverdueDeviceDownAlertsUseCase(
        new PrismaDeviceStateRepository(prisma),
        new PrismaDeviceNotificationPolicyRepository(prisma),
        sendDeviceDownAlert,
        new PrismaNotificationSettingsRepository(
          prisma,
          NotificationSettings.reconstitute({
            telegramChatId: null,
            downAlertDelayMinutes: ALERT_DELAY_MS / 60_000,
            wirelessAlertsEnabled: true,
            alertTicketMode: 'SUGGEST',
            quietHours: null
          })
        ),
        logger,
        new PrismaAgentStatusQuery(prisma, serverOnSite),
        alertRepo,
        topology
      );
    useCase = buildUseCase(true);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.alertEvent.deleteMany();
    await cleanAgents(prisma);
    await cleanDatabase(prisma);
    fakeNotification.reset();
  });

  async function seedDownDevice(
    downSince: Date,
    agentId: string | null = null
  ): Promise<string> {
    ipCounter++;
    const { deviceId } = await seedMonitoredDevice(
      prisma,
      deviceModelId,
      `192.168.98.${ipCounter}`
    );
    await setDown(deviceId, downSince);
    if (agentId) {
      await prisma.device.update({
        where: { id: deviceId },
        data: { agentId }
      });
    }
    return deviceId;
  }

  async function setDown(
    deviceId: string,
    downSince: Date
  ): Promise<void> {
    await prisma.deviceState.upsert({
      where: { deviceId },
      create: {
        deviceId,
        status: 'DOWN',
        consecutiveFailures: 3,
        lastCheckedAt: downSince,
        downSince
      },
      update: { status: 'DOWN', downSince }
    });
  }

  async function setUp(deviceId: string): Promise<void> {
    await prisma.deviceState.update({
      where: { deviceId },
      data: {
        status: 'UP',
        downSince: null,
        lastSeen: new Date(),
        consecutiveFailures: 0
      }
    });
  }

  async function openAlerts(deviceId: string): Promise<number> {
    return prisma.alertEvent.count({ where: { deviceId } });
  }

  it('raises the alert for a device down past its delay', async () => {
    const deviceId = await seedDownDevice(minutesAgo(10));

    const result = await useCase.execute();

    expect(result.value).toBe(1);
    expect(await openAlerts(deviceId)).toBe(1);
    expect(fakeNotification.callCount).toBe(1);
  });

  it('waits while the device is still inside its delay', async () => {
    await seedDownDevice(minutesAgo(2));

    const result = await useCase.execute();

    expect(result.value).toBe(0);
    expect(fakeNotification.callCount).toBe(0);
  });

  it('does not notify the same outage twice', async () => {
    const deviceId = await seedDownDevice(minutesAgo(10));
    await useCase.execute();

    await useCase.execute();

    expect(await openAlerts(deviceId)).toBe(1);
    expect(fakeNotification.callCount).toBe(1);
  });

  describe('[NOT-201] the delay saved from the dashboard', () => {
    afterEach(async () => {
      await prisma.notificationSettings.deleteMany();
    });

    it('takes over from the default on the next scan, no restart', async () => {
      const deviceId = await seedDownDevice(minutesAgo(10));
      await prisma.notificationSettings.create({
        data: {
          id: 1,
          downAlertDelayMinutes: 30,
          wirelessAlertsEnabled: true
        }
      });

      const result = await useCase.execute();

      expect(result.value).toBe(0);
      expect(await openAlerts(deviceId)).toBe(0);
    });
  });

  describe('[NOT-101] a server hosted off site', () => {
    it('raises nothing for a device with no agent, which nobody measures', async () => {
      const deviceId = await seedDownDevice(minutesAgo(10));

      const result = await buildUseCase(false).execute();

      expect(result.value).toBe(0);
      expect(await openAlerts(deviceId)).toBe(0);
      expect(fakeNotification.callCount).toBe(0);
    });

    it('alerts normally for a device behind an agent that is reporting', async () => {
      const { id: agentId } = await seedAgent(prisma, {
        status: 'ACTIVE'
      });
      const deviceId = await seedDownDevice(minutesAgo(10), agentId);

      const result = await buildUseCase(false).execute();

      expect(result.value).toBe(1);
      expect(await openAlerts(deviceId)).toBe(1);
    });
  });

  describe('[NOT-101] devices behind an agent that is not reporting', () => {
    async function agentWith(
      status: 'PENDING' | 'ACTIVE' | 'REVOKED',
      offlineSince: Date | null = null
    ): Promise<string> {
      const { id } = await seedAgent(prisma, { status });
      if (offlineSince) {
        await prisma.probeAgent.update({
          where: { id },
          data: { offlineSince }
        });
      }
      return id;
    }

    it('raises nothing for a device behind an offline agent', async () => {
      const agentId = await agentWith('ACTIVE', minutesAgo(8));
      const deviceId = await seedDownDevice(minutesAgo(10), agentId);

      const result = await useCase.execute();

      expect(result.value).toBe(0);
      expect(await openAlerts(deviceId)).toBe(0);
      expect(fakeNotification.callCount).toBe(0);
    });

    it('raises nothing for devices behind a pending or revoked agent', async () => {
      await seedDownDevice(
        minutesAgo(10),
        await agentWith('PENDING')
      );
      await seedDownDevice(
        minutesAgo(10),
        await agentWith('REVOKED')
      );

      const result = await useCase.execute();

      expect(result.value).toBe(0);
    });

    it('alerts normally for a device behind an agent that is reporting', async () => {
      const deviceId = await seedDownDevice(
        minutesAgo(10),
        await agentWith('ACTIVE')
      );

      const result = await useCase.execute();

      expect(result.value).toBe(1);
      expect(await openAlerts(deviceId)).toBe(1);
    });

    it('alerts once the agent is back and the device is still down', async () => {
      const agentId = await agentWith('ACTIVE', minutesAgo(8));
      const deviceId = await seedDownDevice(minutesAgo(10), agentId);
      await useCase.execute();
      await prisma.probeAgent.update({
        where: { id: agentId },
        data: { offlineSince: null }
      });

      const result = await useCase.execute();

      expect(result.value).toBe(1);
      expect(await openAlerts(deviceId)).toBe(1);
    });

    it('leaves the stored state alone', async () => {
      const agentId = await agentWith('ACTIVE', minutesAgo(8));
      const deviceId = await seedDownDevice(minutesAgo(10), agentId);

      await useCase.execute();

      const state = await prisma.deviceState.findUnique({
        where: { deviceId }
      });
      expect(state!.status).toBe('DOWN');
      expect(state!.downSince).toEqual(expect.any(Date));
    });
  });
  describe('[NOT-240..245] an outage behind an upstream device', () => {
    // The record opens on the transition, as DeviceWentOfflineAlertRecordHandler
    // does (NOT-097); only the page waits for the delay.
    async function seedNamedDown(
      name: string,
      downSince: Date,
      upstreamDeviceId: string | null = null
    ): Promise<string> {
      const deviceId = await seedDownDevice(downSince);
      await prisma.device.update({
        where: { id: deviceId },
        data: { name, upstreamDeviceId }
      });
      await prisma.alertEvent.create({
        data: {
          deviceId,
          severity: 'CRITICAL',
          source: 'Disponibilidad',
          type: 'device_unreachable',
          description: 'Sin conexión.',
          startedAt: downSince
        }
      });
      return deviceId;
    }

    async function alertOf(deviceId: string) {
      return prisma.alertEvent.findFirst({
        where: { deviceId },
        orderBy: { startedAt: 'desc' }
      });
    }

    async function withDelay(
      deviceId: string,
      alertDelayMinutes: number
    ): Promise<void> {
      await prisma.deviceNotificationPolicy.create({
        data: { deviceId, alertDelayMinutes }
      });
    }

    it('pages once for the AP and names the client behind it, even when the client went down first', async () => {
      const ap = await seedNamedDown(
        'AP Torre Norte',
        minutesAgo(10)
      );
      const client = await seedNamedDown(
        'Cliente Perez',
        minutesAgo(12),
        ap
      );

      const result = await useCase.execute();

      expect(result.value).toBe(1);
      expect(fakeNotification.callCount).toBe(1);
      expect(fakeNotification.lastMessage!.body).toContain(
        'Cliente Perez'
      );
      const rootAlert = await alertOf(ap);
      const clientAlert = await alertOf(client);
      expect(rootAlert!.notifiedAt).not.toBeNull();
      expect(clientAlert!.causedByAlertId).toBe(rootAlert!.id);
      expect(clientAlert!.notifiedAt).toBeNull();
    });

    it('names a client whose own delay has not run out yet', async () => {
      const ap = await seedNamedDown(
        'AP Torre Norte',
        minutesAgo(10)
      );
      const client = await seedNamedDown(
        'Cliente Gomez',
        minutesAgo(1),
        ap
      );

      await useCase.execute();

      expect(fakeNotification.lastMessage!.body).toContain(
        'Cliente Gomez'
      );
      expect((await alertOf(client))!.causedByAlertId).toBe(
        (await alertOf(ap))!.id
      );
    });

    it('keeps the client quiet while the AP waits out a longer delay (NOT-242)', async () => {
      const ap = await seedNamedDown(
        'AP Torre Norte',
        minutesAgo(10)
      );
      await withDelay(ap, 30);
      const client = await seedNamedDown(
        'Cliente Ruiz',
        minutesAgo(10),
        ap
      );

      const result = await useCase.execute();

      expect(result.value).toBe(0);
      expect(fakeNotification.callCount).toBe(0);
      expect((await alertOf(client))!.causedByAlertId).toBe(
        (await alertOf(ap))!.id
      );
    });

    it('blames the switch, not the AP, along a switch → AP → client chain', async () => {
      const sw = await seedNamedDown(
        'Switch Barrio Sur',
        minutesAgo(10)
      );
      const ap = await seedNamedDown(
        'AP Barrio Sur',
        minutesAgo(10),
        sw
      );
      const client = await seedNamedDown(
        'Cliente Diaz',
        minutesAgo(10),
        ap
      );

      const result = await useCase.execute();

      expect(result.value).toBe(1);
      const root = await alertOf(sw);
      expect(root!.notifiedAt).not.toBeNull();
      expect((await alertOf(ap))!.causedByAlertId).toBe(root!.id);
      expect((await alertOf(client))!.causedByAlertId).toBe(root!.id);
      expect(fakeNotification.lastMessage!.body).toContain(
        'AP Barrio Sur'
      );
      expect(fakeNotification.lastMessage!.body).toContain(
        'Cliente Diaz'
      );
    });

    it('[NOT-244] attaches a client that goes down after the page, without paging again', async () => {
      const ap = await seedNamedDown(
        'AP Torre Norte',
        minutesAgo(10)
      );
      await useCase.execute();
      const late = await seedNamedDown(
        'Cliente Tarde',
        minutesAgo(6),
        ap
      );

      await useCase.execute();

      expect(fakeNotification.callCount).toBe(1);
      expect((await alertOf(late))!.causedByAlertId).toBe(
        (await alertOf(ap))!.id
      );
    });

    it('splits the recovery into back and still down, then lets a straggler page on its own (NOT-245)', async () => {
      const ap = await seedNamedDown(
        'AP Torre Norte',
        minutesAgo(30)
      );
      const back = await seedNamedDown(
        'Cliente Vuelve',
        minutesAgo(30),
        ap
      );
      const stuck = await seedNamedDown(
        'Cliente Sigue',
        minutesAgo(30),
        ap
      );
      await useCase.execute();

      await setUp(back);
      await recovery.execute({
        deviceId: back,
        latencyMs: 3,
        occurredAt: new Date()
      });
      expect(fakeNotification.callCount).toBe(1);

      await setUp(ap);
      await recovery.execute({
        deviceId: ap,
        latencyMs: 3,
        occurredAt: new Date()
      });
      expect(fakeNotification.callCount).toBe(2);
      expect(fakeNotification.lastMessage!.body).toContain(
        'Volvieron 1 de 2'
      );
      expect(fakeNotification.lastMessage!.body).toContain(
        'Cliente Sigue'
      );

      await useCase.execute();
      expect(fakeNotification.callCount).toBe(2);

      await prisma.alertEvent.update({
        where: { id: (await alertOf(ap))!.id },
        data: { resolvedAt: minutesAgo(ALERT_DELAY_MS / 60_000) }
      });
      await useCase.execute();

      expect(fakeNotification.callCount).toBe(3);
      const stuckAlert = await alertOf(stuck);
      expect(stuckAlert!.causedByAlertId).toBeNull();
      expect(stuckAlert!.notifiedAt).not.toBeNull();
    });
  });
});
