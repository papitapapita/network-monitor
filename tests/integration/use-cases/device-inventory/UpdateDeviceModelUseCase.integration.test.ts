// Source: src/application/device-inventory/use-cases/UpdateDeviceModelUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { UpdateDeviceModelUseCase } from 'application/device-inventory/use-cases/UpdateDeviceModelUseCase';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { PrismaVendorRepository } from 'infrastructure/persistence/PrismaVendorRepository';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { PrismaWirelessDeviceConfigRepository } from 'infrastructure/wireless-monitoring/repositories/PrismaWirelessDeviceConfigRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanCatalog,
  seedVendor,
  seedDevice,
  seedWirelessDeviceModel,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('UpdateDeviceModelUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: UpdateDeviceModelUseCase;
  let vendorId: string;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    const deviceModelRepo = new PrismaDeviceModelRepository(prisma);
    const vendorRepo = new PrismaVendorRepository(prisma);
    const deviceRepo = new PrismaDeviceRepository(prisma);
    const wirelessConfigRepo =
      new PrismaWirelessDeviceConfigRepository(prisma);
    const logger = new WinstonLogger();
    useCase = new UpdateDeviceModelUseCase(
      deviceModelRepo,
      vendorRepo,
      deviceRepo,
      wirelessConfigRepo,
      logger
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCatalog(prisma);
    vendorId = await seedVendor(prisma, {
      name: 'MikroTik',
      slug: 'mikrotik'
    });

    const model = await prisma.deviceModel.create({
      data: {
        vendorId,
        model: 'RB4011iGS+',
        deviceType: 'ROUTERBOARD'
      }
    });
    deviceModelId = model.id;
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('updates the model name and result.value.model matches the new name', async () => {
    const result = await useCase.execute({
      id: deviceModelId,
      model: 'hAP ac3'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.model).toBe('hAP ac3');
    expect(result.value.deviceType).toBe('ROUTERBOARD');
  });

  it('[DEV-024] updates the deviceType and result.value.deviceType matches the new type', async () => {
    const result = await useCase.execute({
      id: deviceModelId,
      deviceType: 'ROUTER'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.deviceType).toBe('ROUTER');
    expect(result.value.model).toBe('RB4011iGS+');
  });

  // ──────────────────────────────────────────────────────────────
  // DEV-028 — the vendor name and slug reported on the model
  // ──────────────────────────────────────────────────────────────

  it('[DEV-028] reports the new vendor name and slug when the vendor changes', async () => {
    const otherVendorId = await seedVendor(prisma, {
      name: 'Ubiquiti',
      slug: 'ubiquiti'
    });

    const result = await useCase.execute({
      id: deviceModelId,
      vendorId: otherVendorId
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.vendorName).toBe('Ubiquiti');
    expect(result.value.vendorSlug).toBe('ubiquiti');

    const row = await prisma.deviceModel.findUnique({
      where: { id: deviceModelId },
      include: { vendor: true }
    });
    expect(row!.vendorId).toBe(otherVendorId);
    expect(row!.vendor.slug).toBe('ubiquiti');
  });

  it('[DEV-021] fails when the new vendor does not exist', async () => {
    const result = await useCase.execute({
      id: deviceModelId,
      vendorId: GHOST_ID
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/vendor not found/i);
  });

  // ──────────────────────────────────────────────────────────────
  // DEV-027 — isWireless is frozen while configs exist
  // ──────────────────────────────────────────────────────────────

  /** Creates `count` devices on the model, each with a STATION wireless config. */
  async function seedConfiguredDevices(
    modelId: string,
    count: number
  ): Promise<string[]> {
    const deviceIds: string[] = [];
    for (let i = 0; i < count; i++) {
      const deviceId = await seedDevice(prisma, modelId, {
        name: `Wireless CPE ${i}`,
        serialNumber: `SN-${modelId.slice(0, 8)}-${i}`
      });
      await prisma.wirelessPollingConfiguration.create({
        data: { deviceId, deviceType: 'STATION' }
      });
      deviceIds.push(deviceId);
    }
    return deviceIds;
  }

  it('[DEV-027] refuses isWireless true → false while a device on the model has a wireless config', async () => {
    const modelId = await seedWirelessDeviceModel(prisma);
    await seedConfiguredDevices(modelId, 2);

    const result = await useCase.execute({
      id: modelId,
      isWireless: false
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(
      /Cannot mark device model as non-wireless/
    );
    expect(result.error).toContain('2 device(s)');
  });

  it('[DEV-027] leaves the model wireless and every config in place when refused', async () => {
    const modelId = await seedWirelessDeviceModel(prisma);
    await seedConfiguredDevices(modelId, 2);

    await useCase.execute({ id: modelId, isWireless: false });

    const stored = await prisma.deviceModel.findUnique({
      where: { id: modelId }
    });
    expect(stored!.isWireless).toBe(true);
    await expect(
      prisma.wirelessPollingConfiguration.count()
    ).resolves.toBe(2);
  });

  it('[DEV-027] applies no other field of the same request when refused', async () => {
    const modelId = await seedWirelessDeviceModel(prisma);
    await seedConfiguredDevices(modelId, 1);

    const result = await useCase.execute({
      id: modelId,
      model: 'PowerBeam 5AC',
      isWireless: false
    });

    expect(result.isFailure).toBe(true);
    const stored = await prisma.deviceModel.findUnique({
      where: { id: modelId }
    });
    expect(stored!.model).not.toBe('PowerBeam 5AC');
  });

  it('[DEV-027] allows isWireless true → false once the configs are deleted', async () => {
    const modelId = await seedWirelessDeviceModel(prisma);
    await seedConfiguredDevices(modelId, 2);
    await prisma.wirelessPollingConfiguration.deleteMany();

    const result = await useCase.execute({
      id: modelId,
      isWireless: false
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.isWireless).toBe(false);
    const stored = await prisma.deviceModel.findUnique({
      where: { id: modelId }
    });
    expect(stored!.isWireless).toBe(false);
  });

  it('[DEV-027] allows isWireless true → false when the model has devices but none is configured', async () => {
    const modelId = await seedWirelessDeviceModel(prisma);
    await seedDevice(prisma, modelId, {
      name: 'Unconfigured CPE',
      serialNumber: 'SN-UNCONFIGURED'
    });

    const result = await useCase.execute({
      id: modelId,
      isWireless: false
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.isWireless).toBe(false);
  });

  it('[DEV-027] ignores configs of devices on other models', async () => {
    const modelId = await seedWirelessDeviceModel(prisma);
    const otherModel = await prisma.deviceModel.create({
      data: {
        vendorId,
        model: 'NanoStation 5AC',
        deviceType: 'ANTENNA',
        isWireless: true
      }
    });
    await seedConfiguredDevices(otherModel.id, 1);

    const result = await useCase.execute({
      id: modelId,
      isWireless: false
    });

    expect(result.isSuccess).toBe(true);
    await expect(
      prisma.wirelessPollingConfiguration.count()
    ).resolves.toBe(1);
  });

  it('[DEV-027] does not check configs when isWireless flips false → true', async () => {
    await seedConfiguredDevices(deviceModelId, 1);

    const result = await useCase.execute({
      id: deviceModelId,
      isWireless: true
    });

    expect(result.isSuccess).toBe(true);
    await expect(
      prisma.wirelessPollingConfiguration.count()
    ).resolves.toBe(1);
  });

  // ──────────────────────────────────────────────────────────────
  // Not found & malformed input
  // ──────────────────────────────────────────────────────────────

  it('fails with a not-found error when the device model does not exist (GHOST_ID)', async () => {
    const result = await useCase.execute({
      id: GHOST_ID,
      model: 'GhostModel'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  it('fails with an invalid-id error when the id is malformed (INVALID_ID)', async () => {
    const result = await useCase.execute({
      id: INVALID_ID,
      model: 'Whatever'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid device model id/i);
  });

  it('fails when the id is empty', async () => {
    const result = await useCase.execute({
      id: '   ',
      model: 'Whatever'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/required/i);
  });
});
