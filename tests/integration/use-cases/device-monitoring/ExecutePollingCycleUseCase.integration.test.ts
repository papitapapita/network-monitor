import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ExecutePollingCycleUseCase } from 'application/device-monitoring/use-cases/ExecutePollingCycleUseCase';
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
  cleanDatabase,
  seedDeviceModel,
  seedMonitoredDevice
} from '../../helpers/db';
import { FakePingService } from '../../helpers/FakePingService';
import { SuspendDeviceMonitoringUseCase } from 'application/device-monitoring/use-cases/SuspendDeviceMonitoringUseCase';
import { ResolveAlertUseCase } from 'application/notifications/use-cases/ResolveAlertUseCase';
import { PrismaAlertRepository } from 'infrastructure/persistence/PrismaAlertRepository';

describe('ExecutePollingCycleUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ExecutePollingCycleUseCase;
  let configureUseCase: ConfigureDevicePollingUseCase;
  let fakePing: FakePingService;
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
    useCase = new ExecutePollingCycleUseCase(
      pollingConfigRepo,
      pingResultRepo,
      deviceStateRepo,
      fakePing,
      new PrismaDeviceRepository(prisma),
      new DeviceEligibilityService(),
      logger,
      0 // no delay between retries in tests
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

  it('fails when no polling configuration exists', async () => {
    // Use a device ID that has no polling config
    const ghostDeviceId = '00000000-0000-4000-8000-000000000099';
    const result = await useCase.execute({
      deviceId: ghostDeviceId,
      forceExecution: true
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/no polling configuration/i);
  });

  it('fails when deviceId is empty', async () => {
    const result = await useCase.execute({ deviceId: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/required/i);
  });
});
