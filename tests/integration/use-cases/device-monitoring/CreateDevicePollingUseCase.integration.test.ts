// Source: src/application/device-monitoring/use-cases/CreateDevicePollingUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateDevicePollingUseCase } from 'application/device-monitoring/use-cases/CreateDevicePollingUseCase';
import { PrismaPollingConfigurationRepository } from 'infrastructure/persistence/PrismaPollingConfigurationRepository';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
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
import { SuspendDeviceMonitoringUseCase } from 'application/device-monitoring/use-cases/SuspendDeviceMonitoringUseCase';
import { ResolveAlertUseCase } from 'application/notifications/use-cases/ResolveAlertUseCase';
import { PrismaAlertRepository } from 'infrastructure/persistence/PrismaAlertRepository';
import { PrismaDeviceStateRepository } from 'infrastructure/persistence/PrismaDeviceStateRepository';

async function seedBareDevice(
  prisma: PrismaClient,
  deviceModelId: string
): Promise<string> {
  const device = await prisma.device.create({
    data: {
      name: 'Bare Test Device',
      owner: 'COMPANY',
      status: 'ACTIVE',
      monitoringEnabled: false,
      deviceModelId
    }
  });
  return device.id;
}

describe('CreateDevicePollingUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: CreateDevicePollingUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    const pollingConfigRepo = new PrismaPollingConfigurationRepository(prisma);
    const deviceRepo = new PrismaDeviceRepository(prisma);
    const logger = new WinstonLogger();
    const suspend = new SuspendDeviceMonitoringUseCase(
      pollingConfigRepo,
      new PrismaDeviceStateRepository(prisma),
      new ResolveAlertUseCase(new PrismaAlertRepository(prisma), logger)
    );
    useCase = new CreateDevicePollingUseCase(
      pollingConfigRepo,
      deviceRepo,
      suspend,
      logger
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  // ──────────────────────────────────────────────────────────────
  // CREATE branch — no existing config
  // ──────────────────────────────────────────────────────────────

  describe('CREATE branch — no existing config', () => {
    let deviceId: string;

    beforeEach(async () => {
      deviceId = await seedBareDevice(prisma, deviceModelId);
    });

    it('creates config with all defaults when only deviceId is provided', async () => {
      const result = await useCase.execute({ deviceId });

      expect(result.isSuccess).toBe(true);

      const config = await prisma.pollingConfiguration.findFirst({
        where: { deviceId }
      });
      expect(config!.pingIntervalSecs).toBe(60);
      expect(config!.failuresBeforeDown).toBe(3);
      // polling stays off without an IP — the entity rejects enabled + no IP
      expect(config!.enabled).toBe(false);
      expect(config!.ipAddress).toBeNull();
    });

    it('creates config with provided intervalSeconds', async () => {
      const result = await useCase.execute({ deviceId, intervalSeconds: 300 });

      expect(result.isSuccess).toBe(true);

      const config = await prisma.pollingConfiguration.findFirst({
        where: { deviceId }
      });
      expect(config!.pingIntervalSecs).toBe(300);
    });

    it('creates config with provided failuresBeforeDown', async () => {
      const result = await useCase.execute({ deviceId, failuresBeforeDown: 7 });

      expect(result.isSuccess).toBe(true);

      const config = await prisma.pollingConfiguration.findFirst({
        where: { deviceId }
      });
      expect(config!.failuresBeforeDown).toBe(7);
    });

    it('creates config with provided ipAddress', async () => {
      const result = await useCase.execute({ deviceId, ipAddress: '10.0.0.5' });

      expect(result.isSuccess).toBe(true);

      const config = await prisma.pollingConfiguration.findFirst({
        where: { deviceId }
      });
      expect(config!.ipAddress).toBe('10.0.0.5');
    });

    it('creates config with enabled=false', async () => {
      const result = await useCase.execute({ deviceId, enabled: false });

      expect(result.isSuccess).toBe(true);

      const config = await prisma.pollingConfiguration.findFirst({
        where: { deviceId }
      });
      expect(config!.enabled).toBe(false);
    });

    it('creates config with all fields provided', async () => {
      const result = await useCase.execute({
        deviceId,
        ipAddress: '10.0.0.1',
        intervalSeconds: 120,
        failuresBeforeDown: 5,
        enabled: false
      });

      expect(result.isSuccess).toBe(true);

      const config = await prisma.pollingConfiguration.findFirst({
        where: { deviceId }
      });
      expect(config!.ipAddress).toBe('10.0.0.1');
      expect(config!.pingIntervalSecs).toBe(120);
      expect(config!.failuresBeforeDown).toBe(5);
      expect(config!.enabled).toBe(false);
    });

    it('returns a PollingConfigurationDTO on success', async () => {
      const result = await useCase.execute({ deviceId });

      expect(result.isSuccess).toBe(true);
      expect(result.value.id).toBeTruthy();
      expect(result.value.deviceId).toBe(deviceId);
      expect(result.value.intervalSeconds).toBe(60);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // UPDATE branch — config already exists
  // ──────────────────────────────────────────────────────────────

  describe('UPDATE branch — config already exists', () => {
    let deviceId: string;

    beforeEach(async () => {
      const seeded = await seedMonitoredDevice(prisma, deviceModelId);
      deviceId = seeded.deviceId;
    });

    it('updates the interval when intervalSeconds is provided', async () => {
      const result = await useCase.execute({ deviceId, intervalSeconds: 180 });

      expect(result.isSuccess).toBe(true);

      const config = await prisma.pollingConfiguration.findFirst({
        where: { deviceId }
      });
      expect(config!.pingIntervalSecs).toBe(180);
    });

    it('updates the failure threshold', async () => {
      const result = await useCase.execute({ deviceId, failuresBeforeDown: 8 });

      expect(result.isSuccess).toBe(true);

      const config = await prisma.pollingConfiguration.findFirst({
        where: { deviceId }
      });
      expect(config!.failuresBeforeDown).toBe(8);
    });

    it('disables polling', async () => {
      const result = await useCase.execute({ deviceId, enabled: false });

      expect(result.isSuccess).toBe(true);

      const config = await prisma.pollingConfiguration.findFirst({
        where: { deviceId }
      });
      expect(config!.enabled).toBe(false);
    });

    it('re-enables polling after disabling', async () => {
      await useCase.execute({ deviceId, enabled: false });

      const result = await useCase.execute({ deviceId, enabled: true });

      expect(result.isSuccess).toBe(true);

      const config = await prisma.pollingConfiguration.findFirst({
        where: { deviceId }
      });
      expect(config!.enabled).toBe(true);
    });

    it('updates the ipAddress', async () => {
      const result = await useCase.execute({
        deviceId,
        ipAddress: '172.16.0.1'
      });

      expect(result.isSuccess).toBe(true);

      const config = await prisma.pollingConfiguration.findFirst({
        where: { deviceId }
      });
      expect(config!.ipAddress).toBe('172.16.0.1');
    });

    it('clears the ipAddress when polling is disabled in the same call', async () => {
      // seedMonitoredDevice leaves polling enabled with an IP, so the IP can
      // only be cleared alongside disabling — the use case disables first.
      const result = await useCase.execute({
        deviceId,
        ipAddress: null,
        enabled: false
      });

      expect(result.isSuccess).toBe(true);

      const config = await prisma.pollingConfiguration.findFirst({
        where: { deviceId }
      });
      expect(config!.ipAddress).toBeNull();
      expect(config!.enabled).toBe(false);
    });

    it('rejects clearing the ipAddress while polling stays enabled', async () => {
      const result = await useCase.execute({ deviceId, ipAddress: null });

      expect(result.isFailure).toBe(true);

      const config = await prisma.pollingConfiguration.findFirst({
        where: { deviceId }
      });
      expect(config!.ipAddress).toBe('192.168.99.1');
    });

    it('does not touch fields that are absent from the request', async () => {
      const result = await useCase.execute({
        deviceId,
        intervalSeconds: 200
      });

      expect(result.isSuccess).toBe(true);

      const config = await prisma.pollingConfiguration.findFirst({
        where: { deviceId }
      });
      expect(config!.pingIntervalSecs).toBe(200);
      expect(config!.failuresBeforeDown).toBe(3);
      expect(config!.enabled).toBe(true);
    });

    it('applies multiple fields in one call', async () => {
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

    it('returns a PollingConfigurationDTO with the updated values', async () => {
      const result = await useCase.execute({
        deviceId,
        intervalSeconds: 300
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.intervalSeconds).toBe(300);
      expect(result.value.deviceId).toBe(deviceId);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Error cases
  // ──────────────────────────────────────────────────────────────

  describe('Error cases', () => {
    it('fails when deviceId does not exist in the database', async () => {
      const result = await useCase.execute({ deviceId: GHOST_ID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/not found/i);
    });

    it('fails when intervalSeconds is out of range (0)', async () => {
      const deviceId = await seedBareDevice(prisma, deviceModelId);

      const result = await useCase.execute({ deviceId, intervalSeconds: 0 });

      expect(result.isFailure).toBe(true);
    });

    it('fails when failuresBeforeDown is out of range (0)', async () => {
      const deviceId = await seedBareDevice(prisma, deviceModelId);

      const result = await useCase.execute({
        deviceId,
        failuresBeforeDown: 0
      });

      expect(result.isFailure).toBe(true);
    });

    it('fails when ipAddress is an invalid IP string', async () => {
      const deviceId = await seedBareDevice(prisma, deviceModelId);

      const result = await useCase.execute({
        deviceId,
        ipAddress: 'not-an-ip'
      });

      expect(result.isFailure).toBe(true);
    });
  });
});
