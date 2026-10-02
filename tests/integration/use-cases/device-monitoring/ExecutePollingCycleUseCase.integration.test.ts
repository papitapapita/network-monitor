import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  AGENT_POLL_FAILURES,
  ExecutePollingCycleUseCase,
  NOT_ON_MONITORED_NETWORK
} from 'application/device-monitoring/use-cases/ExecutePollingCycleUseCase';
import { IngestPingResultsUseCase } from 'application/device-monitoring/use-cases/IngestPingResultsUseCase';
import { PingCycleProbe } from 'application/device-monitoring/services';
import { ConfigureDevicePollingUseCase } from 'application/device-monitoring/use-cases/ConfigureDevicePollingUseCase';
import { PrismaPollingConfigurationRepository } from 'infrastructure/persistence/PrismaPollingConfigurationRepository';
import { PrismaPingResultRepository } from 'infrastructure/persistence/PrismaPingResultRepository';
import { PrismaDeviceStateRepository } from 'infrastructure/persistence/PrismaDeviceStateRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { DeviceEligibilityService } from 'domain/device-inventory/services';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanAgents,
  cleanDatabase,
  seedAgent,
  seedDeviceModel,
  seedMonitoredDevice
} from '../../helpers/db';
import { PrismaPollingConfigurationRepository as DueRepo } from 'infrastructure/persistence/PrismaPollingConfigurationRepository';
import { FakePingService } from '../../helpers/FakePingService';
import { FakeAgentPingProbe } from '../../helpers/FakeAgentPingProbe';
import { SuspendDeviceMonitoringUseCase } from 'application/device-monitoring/use-cases/SuspendDeviceMonitoringUseCase';
import { ResolveAlertUseCase } from 'application/notifications/use-cases/ResolveAlertUseCase';
import { PrismaAlertRepository } from 'infrastructure/persistence/PrismaAlertRepository';

describe('ExecutePollingCycleUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ExecutePollingCycleUseCase;
  let configureUseCase: ConfigureDevicePollingUseCase;
  let fakePing: FakePingService;
  let fakeAgent: FakeAgentPingProbe;
  let deviceModelId: string;
  let deviceId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    const pollingConfigRepo =
      new PrismaPollingConfigurationRepository(prisma);
    const pingResultRepo = new PrismaPingResultRepository(prisma);
    const deviceStateRepo = new PrismaDeviceStateRepository(prisma);
    const logger = new WinstonLogger();

    fakePing = new FakePingService();
    fakeAgent = new FakeAgentPingProbe();
    useCase = new ExecutePollingCycleUseCase(
      pollingConfigRepo,
      new PrismaDeviceRepository(prisma),
      new DeviceEligibilityService(),
      new PingCycleProbe(fakePing, 0),
      new IngestPingResultsUseCase(
        pollingConfigRepo,
        pingResultRepo,
        deviceStateRepo,
        logger
      ),
      logger,
      undefined,
      true,
      fakeAgent
    );
    const suspend = new SuspendDeviceMonitoringUseCase(
      pollingConfigRepo,
      deviceStateRepo,
      new ResolveAlertUseCase(
        new PrismaAlertRepository(prisma),
        logger
      )
    );
    configureUseCase = new ConfigureDevicePollingUseCase(
      pollingConfigRepo,
      suspend,
      logger
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const seeded = await seedMonitoredDevice(prisma, deviceModelId);
    deviceId = seeded.deviceId;
    fakePing.setResult({ isReachable: true, latencyMs: 10 });
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('saves a ping result and marks device ONLINE when reachable', async () => {
    const result = await useCase.execute({
      deviceId,
      forceExecution: true
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('SUCCESS');
    expect(result.value.deviceStatus).toBe('ONLINE');

    const pingResults = await prisma.pingResult.findMany({
      where: { deviceId }
    });
    expect(pingResults).toHaveLength(1);
    expect(pingResults[0].isReachable).toBe(true);

    const state = await prisma.deviceState.findFirst({
      where: { deviceId }
    });
    expect(state).not.toBeNull();
    expect(state!.status).toBe('UP');
  });

  it('marks device OFFLINE in a single poll after all retries (failuresBeforeDown) fail', async () => {
    // First, establish an ONLINE state with a successful ping
    await useCase.execute({ deviceId, forceExecution: true });

    // One poll with all retries failing immediately marks the device offline
    fakePing.setResult({ isReachable: false, latencyMs: null });
    const result = await useCase.execute({
      deviceId,
      forceExecution: true
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('FAILED');
    expect(result.value.deviceStatus).toBe('OFFLINE');

    const state = await prisma.deviceState.findFirst({
      where: { deviceId }
    });
    expect(state!.status).toBe('DOWN');
    expect(state!.consecutiveFailures).toBe(1);
  });

  it('resets failures and marks device ONLINE after recovery', async () => {
    // Drive it offline with one failing poll (retries exhausted within the poll)
    fakePing.setResult({ isReachable: false, latencyMs: null });
    await useCase.execute({ deviceId, forceExecution: true });

    // Now recover
    fakePing.setResult({ isReachable: true, latencyMs: 5 });
    const result = await useCase.execute({
      deviceId,
      forceExecution: true
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.deviceStatus).toBe('ONLINE');

    const state = await prisma.deviceState.findFirst({
      where: { deviceId }
    });
    expect(state!.status).toBe('UP');
    expect(state!.consecutiveFailures).toBe(0);
  });

  it('skips execution when polling is disabled and forceExecution is false', async () => {
    await configureUseCase.execute({ deviceId, enabled: false });

    const result = await useCase.execute({
      deviceId,
      forceExecution: false
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('SKIPPED');

    // No ping results should be created
    const pingResults = await prisma.pingResult.findMany({
      where: { deviceId }
    });
    expect(pingResults).toHaveLength(0);
  });

  it('[MON-004] refuses to execute when disabled, even with forceExecution', async () => {
    await configureUseCase.execute({ deviceId, enabled: false });

    const result = await useCase.execute({
      deviceId,
      forceExecution: true
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Monitoring is disabled');

    const pingResults = await prisma.pingResult.findMany({
      where: { deviceId }
    });
    expect(pingResults).toHaveLength(0);
  });

  // ──────────────────────────────────────────────────────────────
  // Failure paths
  // ──────────────────────────────────────────────────────────────

  it('fails when an eligible device has no polling configuration', async () => {
    const device = await prisma.device.create({
      data: {
        name: 'Unconfigured Device',
        owner: 'COMPANY',
        status: 'ACTIVE',
        monitoringEnabled: true,
        ipAddress: '192.168.99.50',
        deviceModelId
      }
    });

    const result = await useCase.execute({
      deviceId: device.id,
      forceExecution: true
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/no polling configuration/i);
  });

  it('[DEV-086] fails before looking for a config when the device does not exist', async () => {
    const ghostDeviceId = '00000000-0000-4000-8000-000000000099';
    const result = await useCase.execute({
      deviceId: ghostDeviceId,
      forceExecution: true
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/no longer exists/i);
  });

  it('fails when deviceId is empty', async () => {
    const result = await useCase.execute({ deviceId: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/required/i);
  });

  // ──────────────────────────────────────────────────────────────
  // One writer per device (ADR 0002)
  // ──────────────────────────────────────────────────────────────

  describe('[MON-022] a device behind an on-site agent', () => {
    let agentId: string;

    beforeEach(async () => {
      ({ id: agentId } = await seedAgent(prisma, {
        status: 'ACTIVE'
      }));
      await prisma.device.update({
        where: { id: deviceId },
        data: { agentId }
      });
      fakeAgent.calls.length = 0;
    });

    afterEach(async () => {
      await cleanAgents(prisma);
    });

    it('leaves the due-devices query', async () => {
      const due = await new DueRepo(prisma).findAllDue(new Date());

      expect(
        due.value.map((c) => c.deviceId.toString())
      ).not.toContain(deviceId);
    });

    it('asks the agent on a manual poll and stores its reading as live', async () => {
      const measuredAt = new Date(Date.now() - 1_000);
      fakeAgent.answer = {
        kind: 'measured',
        outcome: {
          kind: 'measured',
          isReachable: true,
          latencyMs: 6,
          attempts: 1
        },
        measuredAt
      };

      const result = await useCase.execute({
        deviceId,
        forceExecution: true
      });

      expect(result.value.status).toBe('SUCCESS');
      expect(fakeAgent.calls).toEqual([
        { agentId, ipAddress: expect.any(String), attempts: 3 }
      ]);
      const stored = await prisma.pingResult.findMany({
        where: { deviceId }
      });
      expect(stored).toHaveLength(1);
      expect(stored[0].checkedAt).toEqual(measuredAt);
      const state = await prisma.deviceState.findUnique({
        where: { deviceId }
      });
      expect(state!.lastCheckedAt).toEqual(measuredAt);
    });

    it('refuses a manual poll while the agent is offline and writes nothing', async () => {
      fakeAgent.answer = {
        kind: 'refused',
        reason: 'AGENT_OFFLINE',
        error: 'The agent is not connected'
      };

      const result = await useCase.execute({
        deviceId,
        forceExecution: true
      });

      expect(result.error).toContain(
        AGENT_POLL_FAILURES.AGENT_OFFLINE
      );
      expect(
        await prisma.pingResult.count({ where: { deviceId } })
      ).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // A server hosted off site pings nothing
  // ──────────────────────────────────────────────────────────────

  describe('[MON-023] a server hosted off site', () => {
    it('leaves a device with no agent out of the due-devices query', async () => {
      const onSite = await new DueRepo(prisma).findAllDue(new Date());
      const offSite = await new DueRepo(prisma, false).findAllDue(
        new Date()
      );

      expect(
        onSite.value.map((c) => c.deviceId.toString())
      ).toContain(deviceId);
      expect(offSite.value).toEqual([]);
    });

    it('refuses a manual poll of a device with no agent and writes nothing', async () => {
      const pollingConfigRepo =
        new PrismaPollingConfigurationRepository(prisma, false);
      const logger = new WinstonLogger();
      const offSite = new ExecutePollingCycleUseCase(
        pollingConfigRepo,
        new PrismaDeviceRepository(prisma),
        new DeviceEligibilityService(),
        new PingCycleProbe(fakePing, 0),
        new IngestPingResultsUseCase(
          pollingConfigRepo,
          new PrismaPingResultRepository(prisma),
          new PrismaDeviceStateRepository(prisma),
          logger
        ),
        logger,
        undefined,
        false
      );

      const result = await offSite.execute({
        deviceId,
        forceExecution: true
      });

      expect(result.error).toBe(
        `Cannot poll device ${deviceId} — ${NOT_ON_MONITORED_NETWORK}`
      );
      expect(
        await prisma.pingResult.count({ where: { deviceId } })
      ).toBe(0);
    });
  });
});
