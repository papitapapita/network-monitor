import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ConfigureDevicePollingUseCase } from 'application/device-monitoring/use-cases/ConfigureDevicePollingUseCase';
import { PrismaPollingConfigurationRepository } from 'infrastructure/persistence/PrismaPollingConfigurationRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
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

describe('ConfigureDevicePollingUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ConfigureDevicePollingUseCase;
  let deviceModelId: string;
  let deviceId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    const repo = new PrismaPollingConfigurationRepository(prisma);
    const logger = new WinstonLogger();
    useCase = new ConfigureDevicePollingUseCase(repo, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const seeded = await seedMonitoredDevice(prisma, deviceModelId);
    deviceId = seeded.deviceId;
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('updates the polling interval', async () => {
    const result = await useCase.execute({
      deviceId,
      intervalSeconds: 120
    });

    expect(result.isSuccess).toBe(true);

    const config = await prisma.pollingConfiguration.findFirst({
      where: { deviceId }
    });
    expect(config!.pingIntervalSecs).toBe(120);
  });

  it('updates the failure threshold', async () => {
    const result = await useCase.execute({
      deviceId,
      failuresBeforeDown: 5
    });

    expect(result.isSuccess).toBe(true);

    const config = await prisma.pollingConfiguration.findFirst({
      where: { deviceId }
    });
    expect(config!.failuresBeforeDown).toBe(5);
  });

  it('disables polling', async () => {
    const result = await useCase.execute({
      deviceId,
      enabled: false
    });

    expect(result.isSuccess).toBe(true);

    const config = await prisma.pollingConfiguration.findFirst({
      where: { deviceId }
    });
    expect(config!.enabled).toBe(false);
  });

  it('re-enables polling', async () => {
    // Disable first
    await useCase.execute({ deviceId, enabled: false });

    const result = await useCase.execute({ deviceId, enabled: true });

    expect(result.isSuccess).toBe(true);

    const config = await prisma.pollingConfiguration.findFirst({
      where: { deviceId }
    });
    expect(config!.enabled).toBe(true);
  });

  it('applies multiple updates in one call', async () => {
    const result = await useCase.execute({
      deviceId,
      intervalSeconds: 300,
      failuresBeforeDown: 10,
      enabled: false
    });

    expect(result.isSuccess).toBe(true);

    const config = await prisma.pollingConfiguration.findFirst({
      where: { deviceId }
    });
    expect(config!.pingIntervalSecs).toBe(300);
    expect(config!.failuresBeforeDown).toBe(10);
    expect(config!.enabled).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────
  // Validation failures
  // ──────────────────────────────────────────────────────────────

  it('fails when no polling configuration exists for the device', async () => {
    const result = await useCase.execute({
      deviceId: GHOST_ID,
      intervalSeconds: 60
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/no polling configuration/i);
  });

  it('fails when intervalSeconds is out of range (too low)', async () => {
    const result = await useCase.execute({
      deviceId,
      intervalSeconds: 0
    });

    expect(result.isFailure).toBe(true);
  });

  it('fails when failuresBeforeDown is out of range (too low)', async () => {
    const result = await useCase.execute({
      deviceId,
      failuresBeforeDown: 0
    });

    expect(result.isFailure).toBe(true);
  });
});
