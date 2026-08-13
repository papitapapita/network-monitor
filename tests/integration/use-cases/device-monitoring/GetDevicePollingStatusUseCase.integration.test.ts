import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetDevicePollingStatusUseCase } from 'application/device-monitoring/use-cases/GetDevicePollingStatusUseCase';
import { ExecutePollingCycleUseCase } from 'application/device-monitoring/use-cases/ExecutePollingCycleUseCase';
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
  seedMonitoredDevice,
  GHOST_ID
} from '../../helpers/db';
import { FakePingService } from '../../helpers/FakePingService';

describe('GetDevicePollingStatusUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let statusUseCase: GetDevicePollingStatusUseCase;
  let executeUseCase: ExecutePollingCycleUseCase;
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

    fakePing = new FakePingService();
    statusUseCase = new GetDevicePollingStatusUseCase(
      pollingConfigRepo,
      deviceStateRepo,
      pingResultRepo,
      logger
    );
    executeUseCase = new ExecutePollingCycleUseCase(
      pollingConfigRepo,
      pingResultRepo,
      deviceStateRepo,
      fakePing,
      new PrismaDeviceRepository(prisma),
      new DeviceEligibilityService(),
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
    fakePing.setResult({ isReachable: true, latencyMs: 15 });
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('returns polling config data before any poll has run', async () => {
    const result = await statusUseCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.deviceId).toBe(deviceId);
    expect(result.value.intervalSeconds).toBeDefined();
    expect(result.value.failuresBeforeDown).toBeDefined();
    expect(result.value.pollingEnabled).toBe(true);
    // No polling cycles yet — state should be UNKNOWN, lastResult null
    expect(result.value.currentStatus).toBe('UNKNOWN');
    expect(result.value.lastResult).toBeNull();
  });

  it('returns ONLINE status and lastResult after a successful polling cycle', async () => {
    await executeUseCase.execute({ deviceId, forceExecution: true });

    const result = await statusUseCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.currentStatus).toBe('ONLINE');
    expect(result.value.lastResult).not.toBeNull();
    expect(result.value.lastResult!.status).toBe('SUCCESS');
  });

  // ──────────────────────────────────────────────────────────────
  // Failure paths
  // ──────────────────────────────────────────────────────────────

  it('fails when no polling configuration exists for the device', async () => {
    const result = await statusUseCase.execute({ deviceId: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/no polling configuration/i);
  });

  it('fails when deviceId is empty', async () => {
    const result = await statusUseCase.execute({ deviceId: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/required/i);
  });
});
