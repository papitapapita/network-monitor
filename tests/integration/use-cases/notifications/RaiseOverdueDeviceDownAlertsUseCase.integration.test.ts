import { PrismaClient } from '../../../../src/generated/prisma/client';
import { RaiseOverdueDeviceDownAlertsUseCase } from 'application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase';
import { SendDeviceDownAlertUseCase } from 'application/notifications/use-cases/SendDeviceDownAlertUseCase';
import { SendAlertNotificationUseCase } from 'application/notifications/use-cases/SendAlertNotificationUseCase';
import { AlertPublisher } from 'infrastructure/notifications/AlertPublisher';
import {
  PrismaAlertRepository,
  PrismaDeviceNotificationPolicyRepository
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
  let deviceModelId: string;
  let ipCounter = 0;

  beforeAll(async () => {
    prisma = createTestPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    const deviceRepo = new PrismaDeviceRepository(prisma);
    const logger = new WinstonLogger();
    fakeNotification = new FakeNotificationService();
    const sendDeviceDownAlert = new SendDeviceDownAlertUseCase(
      new PrismaAlertRepository(prisma),
      new PrismaPollingConfigurationRepository(prisma),
      deviceRepo,
      new DeviceEligibilityService(),
      new AlertPublisher(
        new SendAlertNotificationUseCase(
          deviceRepo,
          fakeNotification,
          logger
        )
      ),
      logger
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
            wirelessAlertsEnabled: true
          })
        ),
        logger,
        new PrismaAgentStatusQuery(prisma, serverOnSite)
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
    await prisma.deviceState.create({
      data: {
        deviceId,
        status: 'DOWN',
        consecutiveFailures: 3,
        lastCheckedAt: downSince,
        downSince
      }
    });
    if (agentId) {
      await prisma.device.update({
        where: { id: deviceId },
        data: { agentId }
      });
    }
    return deviceId;
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
});
