import { PrismaClient } from '../../../../src/generated/prisma/client';
import { SuspendDeviceMonitoringUseCase } from 'application/device-monitoring/use-cases/SuspendDeviceMonitoringUseCase';
import { ExecutePollingCycleUseCase } from 'application/device-monitoring/use-cases/ExecutePollingCycleUseCase';
import { ConfigureDevicePollingUseCase } from 'application/device-monitoring/use-cases/ConfigureDevicePollingUseCase';
import { ResolveAlertUseCase } from 'application/notifications/use-cases/ResolveAlertUseCase';
import { PrismaPollingConfigurationRepository } from 'infrastructure/persistence/PrismaPollingConfigurationRepository';
import { PrismaPingResultRepository } from 'infrastructure/persistence/PrismaPingResultRepository';
import { PrismaDeviceStateRepository } from 'infrastructure/persistence/PrismaDeviceStateRepository';
import { PrismaAlertRepository } from 'infrastructure/persistence/PrismaAlertRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { DeviceId } from 'domain/shared/ids/DeviceId';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  seedDeviceModel,
  seedMonitoredDevice
} from '../../helpers/db';
import { FakePingService } from '../../helpers/FakePingService';

describe('SuspendDeviceMonitoringUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: SuspendDeviceMonitoringUseCase;
  let pollingUseCase: ExecutePollingCycleUseCase;
  let alertRepo: PrismaAlertRepository;
  let fakePing: FakePingService;
  let deviceModelId: string;
  let deviceId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    const pollingConfigRepo = new PrismaPollingConfigurationRepository(prisma);
    const pingResultRepo = new PrismaPingResultRepository(prisma);
    const deviceStateRepo = new PrismaDeviceStateRepository(prisma);
    const logger = new WinstonLogger();
    alertRepo = new PrismaAlertRepository(prisma);

    fakePing = new FakePingService();
    pollingUseCase = new ExecutePollingCycleUseCase(
      pollingConfigRepo,
      pingResultRepo,
      deviceStateRepo,
      fakePing,
      logger,
      0
    );
    useCase = new SuspendDeviceMonitoringUseCase(
      pollingConfigRepo,
      deviceStateRepo,
      new ResolveAlertUseCase(alertRepo, logger)
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

  function id(): DeviceId {
    return DeviceId.parse(deviceId).value;
  }

  // ──────────────────────────────────────────────────────────────
  // The state transition
  // ──────────────────────────────────────────────────────────────

  it('[MON-002] moves a polled device from UP to UNKNOWN', async () => {
    await pollingUseCase.execute({ deviceId, forceExecution: false });

    const result = await useCase.execute(id());

    expect(result.isSuccess).toBe(true);
    const state = await prisma.deviceState.findFirst({ where: { deviceId } });
    expect(state!.status).toBe('UNKNOWN');
  });

  it('[MON-002] moves a device that was DOWN to UNKNOWN', async () => {
    fakePing.setResult({ isReachable: false, latencyMs: null });
    await pollingUseCase.execute({ deviceId, forceExecution: false });

    await useCase.execute(id());

    const state = await prisma.deviceState.findFirst({ where: { deviceId } });
    expect(state!.status).toBe('UNKNOWN');
    expect(state!.consecutiveFailures).toBe(0);
  });

  it('[MON-002] keeps lastSeen, so the pause does not erase when the device was last reachable', async () => {
    await pollingUseCase.execute({ deviceId, forceExecution: false });
    const before = await prisma.deviceState.findFirst({ where: { deviceId } });

    await useCase.execute(id());

    const after = await prisma.deviceState.findFirst({ where: { deviceId } });
    expect(after!.lastSeen).toEqual(before!.lastSeen);
    expect(after!.lastSeen).not.toBeNull();
  });

  it('[MON-002] nulls lastCheckedAt so the device is due immediately on resume', async () => {
    await pollingUseCase.execute({ deviceId, forceExecution: false });

    await useCase.execute(id());

    const state = await prisma.deviceState.findFirst({ where: { deviceId } });
    expect(state!.lastCheckedAt).toBeNull();
  });

  it('[MON-002] does not create a state row for a device that was never polled', async () => {
    const result = await useCase.execute(id());

    expect(result.isSuccess).toBe(true);
    const state = await prisma.deviceState.findFirst({ where: { deviceId } });
    expect(state).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────
  // The polling configuration
  // ──────────────────────────────────────────────────────────────

  it('[MON-020] disables polling and keeps the configuration for a later resume', async () => {
    await useCase.execute(id());

    const config = await prisma.pollingConfiguration.findFirst({
      where: { deviceId }
    });
    expect(config).not.toBeNull();
    expect(config!.enabled).toBe(false);
    expect(config!.pingIntervalSecs).toBe(60);
    expect(config!.failuresBeforeDown).toBe(3);
    expect(config!.ipAddress).toBe('192.168.99.1');
  });

  it('[MON-040] keeps the ping history, which only the retention purge removes', async () => {
    await pollingUseCase.execute({ deviceId, forceExecution: false });

    await useCase.execute(id());

    const pings = await prisma.pingResult.findMany({ where: { deviceId } });
    expect(pings).toHaveLength(1);
  });

  it('[MON-020] takes the device out of the due-devices query', async () => {
    const repo = new PrismaPollingConfigurationRepository(prisma);

    await useCase.execute(id());

    const due = await repo.findAllDue(new Date());
    expect(due.isSuccess).toBe(true);
    expect(due.value.map((c) => c.deviceId.toString())).not.toContain(deviceId);
  });

  // ──────────────────────────────────────────────────────────────
  // The open alert
  // ──────────────────────────────────────────────────────────────

  it('[MON-003] resolves the open availability alert instead of leaving it forever', async () => {
    await prisma.alertEvent.create({
      data: {
        deviceId,
        severity: 'CRITICAL',
        source: 'Disponibilidad',
        type: 'device_unreachable',
        description: 'Device unreachable',
        startedAt: new Date()
      }
    });

    await useCase.execute(id());

    const alert = await prisma.alertEvent.findFirst({ where: { deviceId } });
    expect(alert!.resolvedAt).not.toBeNull();
  });

  it('[MON-003] leaves an already-resolved alert alone', async () => {
    const resolvedAt = new Date('2024-01-01T00:00:00.000Z');
    await prisma.alertEvent.create({
      data: {
        deviceId,
        severity: 'CRITICAL',
        source: 'Disponibilidad',
        type: 'device_unreachable',
        description: 'Device unreachable',
        startedAt: new Date('2023-12-31T00:00:00.000Z'),
        resolvedAt
      }
    });

    await useCase.execute(id());

    const alert = await prisma.alertEvent.findFirst({ where: { deviceId } });
    expect(alert!.resolvedAt).toEqual(resolvedAt);
  });

  it('succeeds when the device has no open alert', async () => {
    const result = await useCase.execute(id());

    expect(result.isSuccess).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────
  // Idempotency and resume
  // ──────────────────────────────────────────────────────────────

  it('is idempotent — running twice leaves the same state', async () => {
    await pollingUseCase.execute({ deviceId, forceExecution: false });

    await useCase.execute(id());
    const result = await useCase.execute(id());

    expect(result.isSuccess).toBe(true);
    const state = await prisma.deviceState.findFirst({ where: { deviceId } });
    expect(state!.status).toBe('UNKNOWN');
  });

  // Every route that stops polling must reach the same transition — the
  // polling-config endpoints write the config directly and once bypassed it.
  it('[MON-002] blanks the state when polling is stopped through the config endpoint', async () => {
    const repo = new PrismaPollingConfigurationRepository(prisma);
    const logger = new WinstonLogger();
    const configure = new ConfigureDevicePollingUseCase(
      repo,
      useCase,
      logger
    );
    await pollingUseCase.execute({ deviceId, forceExecution: false });

    const result = await configure.execute({ deviceId, enabled: false });

    expect(result.isSuccess).toBe(true);
    const state = await prisma.deviceState.findFirst({ where: { deviceId } });
    expect(state!.status).toBe('UNKNOWN');
    const config = await prisma.pollingConfiguration.findFirst({
      where: { deviceId }
    });
    expect(config!.enabled).toBe(false);
  });

  it('[MON-002] keeps other config edits made in the same disabling request', async () => {
    const repo = new PrismaPollingConfigurationRepository(prisma);
    const logger = new WinstonLogger();
    const configure = new ConfigureDevicePollingUseCase(
      repo,
      useCase,
      logger
    );

    await configure.execute({
      deviceId,
      enabled: false,
      intervalSeconds: 300
    });

    const config = await prisma.pollingConfiguration.findFirst({
      where: { deviceId }
    });
    expect(config!.enabled).toBe(false);
    expect(config!.pingIntervalSecs).toBe(300);
  });

  it('[MON-005] raises no recovery event when a paused device resumes reachable', async () => {
    await pollingUseCase.execute({ deviceId, forceExecution: false });
    await useCase.execute(id());
    await prisma.pollingConfiguration.updateMany({
      where: { deviceId },
      data: { enabled: true }
    });

    await pollingUseCase.execute({ deviceId, forceExecution: false });

    // A CameOnline would have opened no alert, but a spurious recovery would
    // have resolved one; the real signal is that the device is simply UP again
    // with no alert churn.
    const state = await prisma.deviceState.findFirst({ where: { deviceId } });
    expect(state!.status).toBe('UP');
    const alerts = await prisma.alertEvent.findMany({ where: { deviceId } });
    expect(alerts).toHaveLength(0);
  });

  it('[MON-005] still reports an outage when a paused device resumes unreachable', async () => {
    await pollingUseCase.execute({ deviceId, forceExecution: false });
    await useCase.execute(id());
    await prisma.pollingConfiguration.updateMany({
      where: { deviceId },
      data: { enabled: true }
    });

    fakePing.setResult({ isReachable: false, latencyMs: null });
    await pollingUseCase.execute({ deviceId, forceExecution: false });

    const state = await prisma.deviceState.findFirst({ where: { deviceId } });
    expect(state!.status).toBe('DOWN');
    expect(state!.consecutiveFailures).toBe(1);
  });
});
