import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  AGENT_READ_FAILURES,
  PollWirelessDeviceUseCase
} from 'application/wireless-monitoring/use-cases';
import { OUT_OF_SERVER_REACH } from 'application/wireless-monitoring/interfaces';
import { DeviceEligibilityService } from 'domain/device-inventory/services';
import { WirelessAlertEvaluator } from 'domain/wireless-monitoring/services';
import { IAlertRule } from 'domain/wireless-monitoring/services/rules/IAlertRule';
import { DistanceRule } from 'domain/wireless-monitoring/services/rules/DistanceRule';
import { SignalStrengthRule } from 'domain/wireless-monitoring/services/rules/SignalStrengthRule';
import {
  PrismaWirelessAlertRecordRepository,
  PrismaWirelessDeviceConfigRepository,
  PrismaAlertThresholdsRepository,
  PrismaWirelessSnapshotRepository
} from 'infrastructure/wireless-monitoring/repositories';
import { WirelessDeviceRepositoryAdapter } from 'infrastructure/wireless-monitoring/adapters/WirelessDeviceRepositoryAdapter';
import { DeviceReachAdapter } from 'infrastructure/wireless-monitoring/adapters/DeviceReachAdapter';
import { DeviceVendorAdapter } from 'infrastructure/wireless-monitoring/adapters/DeviceVendorAdapter';
import { ContractedCapacityAdapter } from 'infrastructure/wireless-monitoring/adapters/ContractedCapacityAdapter';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { PrismaVendorRepository } from 'infrastructure/persistence/PrismaVendorRepository';
import { PrismaDeviceCredentialsRepository } from 'infrastructure/persistence/PrismaDeviceCredentialsRepository';
import {
  PrismaContractedServiceRepository,
  PrismaServicePlanRepository
} from 'infrastructure/customers';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  cleanDatabase,
  seedAgent,
  seedWirelessDeviceModel
} from '../../helpers/db';
import { FakeWirelessCollector } from '../../helpers/FakeWirelessCollector';
import { FakeAgentRadioReader } from '../../helpers/FakeAgentRadioReader';
import { seedDiagnosableDevice } from '../../helpers/linkDiagnosis';

// Covers where this server's reach decides what it polls and who reads the
// radio (WLS-029): the scheduler's due query and the manual poll, against the
// real device rows. The radio and the agent are fakes.
describe('PollWirelessDeviceUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let deviceModelId: string;
  const collector = new FakeWirelessCollector();
  let agent: FakeAgentRadioReader;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    collector.reset();
    agent = new FakeAgentRadioReader();
    await cleanDatabase(prisma);
    deviceModelId = await seedWirelessDeviceModel(prisma);
  });

  const build = (
    serverOnSite: boolean,
    rules: IAlertRule[] = [],
    confirmation = { samples: 3, intervalMs: 0, cooldownMs: 600_000 }
  ) => {
    const deviceRepo = new PrismaDeviceRepository(prisma);
    const configRepo = new PrismaWirelessDeviceConfigRepository(
      prisma,
      serverOnSite
    );
    const useCase = new PollWirelessDeviceUseCase(
      configRepo,
      new PrismaWirelessSnapshotRepository(prisma),
      new PrismaWirelessAlertRecordRepository(prisma),
      new PrismaDeviceCredentialsRepository(prisma),
      collector,
      new DeviceVendorAdapter(
        deviceRepo,
        new PrismaDeviceModelRepository(prisma),
        new PrismaVendorRepository(prisma)
      ),
      new WirelessAlertEvaluator(rules),
      new WirelessDeviceRepositoryAdapter(
        deviceRepo,
        new DeviceEligibilityService()
      ),
      new DeviceReachAdapter(serverOnSite, deviceRepo),
      new ContractedCapacityAdapter(
        new PrismaContractedServiceRepository(prisma),
        new PrismaServicePlanRepository(prisma)
      ),
      new PrismaAlertThresholdsRepository(prisma),
      null,
      new WinstonLogger(),
      agent,
      confirmation
    );
    return { useCase, configRepo };
  };

  const seedRadio = (ip: string) =>
    seedDiagnosableDevice(prisma, deviceModelId, { ip });

  const seedRadioBehindAgent = async (ip: string) => {
    const deviceId = await seedRadio(ip);
    const seeded = await seedAgent(prisma, { status: 'ACTIVE' });
    await prisma.device.update({
      where: { id: deviceId },
      data: { agentId: seeded.id }
    });
    return { deviceId, agentId: seeded.id };
  };

  const dueIds = async (
    configRepo: PrismaWirelessDeviceConfigRepository
  ) => {
    const due = await configRepo.findAllDue(new Date());
    return due.value.map((c) => c.deviceId.toString());
  };

  describe('[WLS-029] a server hosted off site', () => {
    it('schedules only the devices behind an agent', async () => {
      const { deviceId: behindAgent } =
        await seedRadioBehindAgent('192.168.90.10');
      await seedRadio('192.168.90.11');
      const { configRepo } = build(false);

      expect(await dueIds(configRepo)).toEqual([behindAgent]);
    });

    it('reads a device behind an agent through that agent and stores the reading', async () => {
      const { deviceId, agentId } =
        await seedRadioBehindAgent('192.168.90.12');
      const measuredAt = new Date(Date.now() - 2_000);
      agent.answer = {
        kind: 'measured',
        reading: FakeWirelessCollector.reading(),
        measuredAt
      };
      const { useCase } = build(false);

      const result = await useCase.execute({
        deviceId,
        forceExecution: true
      });

      expect(result.isSuccess).toBe(true);
      expect(agent.calls).toEqual([
        {
          agentId,
          request: expect.objectContaining({
            ipAddress: '192.168.90.12',
            deviceType: 'STATION'
          })
        }
      ]);
      expect(collector.calls).toHaveLength(0);
      const snapshot = await prisma.wirelessSnapshot.findFirst({
        where: { deviceId }
      });
      expect(snapshot?.collectedAt).toEqual(measuredAt);
    });

    it('refuses a manual poll while the agent is not connected', async () => {
      const { deviceId } =
        await seedRadioBehindAgent('192.168.90.14');
      const { useCase } = build(false);

      const result = await useCase.execute({
        deviceId,
        forceExecution: true
      });

      expect(result.error).toBe(
        `Cannot poll device — ${AGENT_READ_FAILURES.AGENT_OFFLINE}`
      );
    });

    it('skips a scheduled poll while the agent is not connected', async () => {
      const { deviceId } =
        await seedRadioBehindAgent('192.168.90.15');
      const { useCase, configRepo } = build(false);

      const result = await useCase.execute({ deviceId });

      expect(result.value.skipped).toBe(true);
      expect(await dueIds(configRepo)).toEqual([deviceId]);
    });

    it('refuses a manual poll of a device with no agent', async () => {
      const deviceId = await seedRadio('192.168.90.13');
      const { useCase } = build(false);

      const result = await useCase.execute({
        deviceId,
        forceExecution: true
      });

      expect(result.error).toBe(
        `Cannot poll device — ${OUT_OF_SERVER_REACH}`
      );
      expect(collector.calls).toHaveLength(0);
      expect(agent.calls).toHaveLength(0);
    });
  });

  describe('[WLS-029] a server on the monitored network', () => {
    it('keeps every device in the scheduled polling, with or without an agent', async () => {
      const { deviceId: behindAgent } =
        await seedRadioBehindAgent('192.168.90.20');
      const direct = await seedRadio('192.168.90.22');
      const { configRepo } = build(true);

      const due = await dueIds(configRepo);

      expect(due).toContain(behindAgent);
      expect(due).toContain(direct);
    });

    it('polls a device behind an agent itself, without asking the agent', async () => {
      const { deviceId } =
        await seedRadioBehindAgent('192.168.90.21');
      const { useCase } = build(true);

      const result = await useCase.execute({
        deviceId,
        forceExecution: true
      });

      expect(result.isSuccess).toBe(true);
      expect(collector.calls).toHaveLength(1);
      expect(agent.calls).toHaveLength(0);
    });
  });

  describe('[WLS-012] the parent AP declared from a poll', () => {
    const AP_WLAN_MAC = 'F4:92:BF:00:00:01';

    const seedApWithMac = async (ip: string) => {
      const apId = await seedDiagnosableDevice(
        prisma,
        deviceModelId,
        {
          ip,
          deviceType: 'ACCESS_POINT'
        }
      );
      await prisma.device.update({
        where: { id: apId },
        data: { macAddress: AP_WLAN_MAC }
      });
      return apId;
    };

    const parentOf = async (deviceId: string) =>
      (
        await prisma.wirelessPollingConfiguration.findUnique({
          where: { deviceId }
        })
      )?.parentApDeviceId;

    it('declares the AP whose MAC the radio reports', async () => {
      const apId = await seedApWithMac('192.168.90.30');
      const cpe = await seedRadio('192.168.90.31');
      collector.setResult({ remoteApMac: AP_WLAN_MAC });
      const { useCase } = build(true);

      await useCase.execute({ deviceId: cpe, forceExecution: true });

      expect(await parentOf(cpe)).toBe(apId);
    });

    it('keeps an AP already declared by the operator', async () => {
      await seedApWithMac('192.168.90.32');
      const declared = await seedDiagnosableDevice(
        prisma,
        deviceModelId,
        {
          ip: '192.168.90.33',
          deviceType: 'ACCESS_POINT'
        }
      );
      const cpe = await seedDiagnosableDevice(prisma, deviceModelId, {
        ip: '192.168.90.34',
        parentApDeviceId: declared
      });
      collector.setResult({ remoteApMac: AP_WLAN_MAC });
      const { useCase } = build(true);

      await useCase.execute({ deviceId: cpe, forceExecution: true });

      expect(await parentOf(cpe)).toBe(declared);
    });
  });

  describe('[WLS-013] parent AP drift', () => {
    const REPORTED_AP_MAC = 'F4:92:BF:00:00:02';

    const seedAp = (ip: string) =>
      seedDiagnosableDevice(prisma, deviceModelId, {
        ip,
        deviceType: 'ACCESS_POINT'
      });

    const seedDriftedCpe = async () => {
      const declared = await seedAp('192.168.90.40');
      const reported = await seedAp('192.168.90.41');
      await prisma.device.update({
        where: { id: reported },
        data: { macAddress: REPORTED_AP_MAC }
      });
      const cpe = await seedDiagnosableDevice(prisma, deviceModelId, {
        ip: '192.168.90.42',
        parentApDeviceId: declared
      });
      collector.setResult({ remoteApMac: REPORTED_AP_MAC });
      return { declared, reported, cpe };
    };

    const driftAlert = (deviceId: string) =>
      prisma.wirelessAlertRecord.findFirst({
        where: { deviceId, metric: 'parent_ap_mismatch' },
        orderBy: { triggeredAt: 'desc' }
      });

    const pollTimes = async (
      useCase: PollWirelessDeviceUseCase,
      deviceId: string,
      times: number
    ) => {
      for (let i = 0; i < times; i++) {
        await useCase.execute({ deviceId, forceExecution: true });
      }
    };

    it('counts each poll that reports another AP, keeping the declaration', async () => {
      const { declared, cpe } = await seedDriftedCpe();
      const { useCase } = build(true);

      await pollTimes(useCase, cpe, 2);

      const row =
        await prisma.wirelessPollingConfiguration.findUnique({
          where: { deviceId: cpe }
        });
      expect(row?.parentApMismatchPolls).toBe(2);
      expect(row?.parentApDeviceId).toBe(declared);
      expect(await driftAlert(cpe)).toBeNull();
    });

    // The shared alert and any ticket are written by fire-and-forget
    // handlers of the snapshot's event.
    const waitForSharedAlert = async (deviceId: string) => {
      for (let i = 0; i < 20; i++) {
        const row = await prisma.alertEvent.findFirst({
          where: {
            deviceId,
            type: 'wireless:parent_ap_mismatch:WARNING'
          }
        });
        if (row) return row;
        await new Promise((r) => setTimeout(r, 100));
      }
      return null;
    };

    it('opens the alert on the third poll, without a ticket', async () => {
      const { cpe } = await seedDriftedCpe();
      const { useCase } = build(true);

      await pollTimes(useCase, cpe, 3);

      const alert = await driftAlert(cpe);
      expect(alert?.isActive).toBe(true);
      expect(alert?.severity).toBe('WARNING');
      expect(await waitForSharedAlert(cpe)).not.toBeNull();
      await new Promise((r) => setTimeout(r, 300));
      expect(
        await prisma.ticket.count({ where: { deviceId: cpe } })
      ).toBe(0);
    });

    it('clears once the operator declares the reported AP', async () => {
      const { reported, cpe } = await seedDriftedCpe();
      const { useCase } = build(true);
      await pollTimes(useCase, cpe, 3);

      await prisma.wirelessPollingConfiguration.update({
        where: { deviceId: cpe },
        data: { parentApDeviceId: reported, parentApMismatchPolls: 0 }
      });
      await pollTimes(useCase, cpe, 1);

      expect((await driftAlert(cpe))?.isActive).toBe(false);
    });
  });

  describe('[WLS-201] alert thresholds', () => {
    // A 15 km link at 40 MHz: past the 10 km default.
    const longLink = () =>
      collector.setResult({ channelWidthMhz: 40, distanceM: 15_000 });

    const distanceAlerts = (deviceId: string) =>
      prisma.wirelessAlertRecord.count({
        where: { deviceId, metric: 'distance_m', isActive: true }
      });

    it('opens at the install threshold', async () => {
      const deviceId = await seedRadio('192.168.90.30');
      longLink();
      const { useCase } = build(true, [new DistanceRule()]);

      await useCase.execute({ deviceId, forceExecution: true });

      expect(await distanceAlerts(deviceId)).toBe(1);
    });

    it("stays quiet within the device's own override", async () => {
      const deviceId = await seedRadio('192.168.90.31');
      await prisma.wirelessAlertThresholdOverride.create({
        data: { deviceId, overrides: { maxDistanceKm: { '40': 20 } } }
      });
      longLink();
      const { useCase } = build(true, [new DistanceRule()]);

      const result = await useCase.execute({
        deviceId,
        forceExecution: true
      });

      expect(result.isSuccess).toBe(true);
      expect(await distanceAlerts(deviceId)).toBe(0);
    });
  });

  describe('[WLS-203] confirming an alert before it opens', () => {
    const weak = { signalRxDbm: -75 };

    const signalAlerts = (deviceId: string) =>
      prisma.wirelessAlertRecord.count({
        where: { deviceId, metric: 'signal_rx_dbm', isActive: true }
      });

    it('opens once the fresh readings show the same weak signal', async () => {
      const deviceId = await seedRadio('192.168.90.40');
      collector.setResult(weak);
      const { useCase } = build(true, [new SignalStrengthRule()]);

      await useCase.execute({ deviceId, forceExecution: true });

      expect(collector.calls).toHaveLength(4);
      expect(await signalAlerts(deviceId)).toBe(1);
    });

    it('stays quiet when only the first reading was weak', async () => {
      const deviceId = await seedRadio('192.168.90.41');
      collector.queue(weak);
      const { useCase } = build(true, [new SignalStrengthRule()]);

      const result = await useCase.execute({
        deviceId,
        forceExecution: true
      });

      expect(result.value.alertsTriggered).toBe(0);
      expect(await signalAlerts(deviceId)).toBe(0);
      const snapshot = await prisma.wirelessSnapshot.findFirst({
        where: { deviceId }
      });
      expect(snapshot?.signalRxDbm).toBe(-75);
    });

    it('opens on the first reading when the install turned it off', async () => {
      const deviceId = await seedRadio('192.168.90.42');
      await prisma.wirelessAlertThresholds.create({
        data: { id: 1, thresholds: { confirmBeforeAlerting: false } }
      });
      collector.queue(weak);
      const { useCase } = build(true, [new SignalStrengthRule()]);

      await useCase.execute({ deviceId, forceExecution: true });

      expect(collector.calls).toHaveLength(1);
      expect(await signalAlerts(deviceId)).toBe(1);
    });

    it('follows a device that turned it off over the install', async () => {
      const deviceId = await seedRadio('192.168.90.43');
      await prisma.wirelessAlertThresholdOverride.create({
        data: {
          deviceId,
          overrides: { confirmBeforeAlerting: false }
        }
      });
      collector.queue(weak);
      const { useCase } = build(true, [new SignalStrengthRule()]);

      await useCase.execute({ deviceId, forceExecution: true });

      expect(await signalAlerts(deviceId)).toBe(1);
    });
  });
});
