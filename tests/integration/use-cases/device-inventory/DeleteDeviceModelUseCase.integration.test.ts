// Source: src/application/device-inventory/use-cases/DeleteDeviceModelUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { DeleteDeviceModelUseCase } from 'application/device-inventory/use-cases/DeleteDeviceModelUseCase';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanCatalog,
  seedVendor,
  seedMonitoredDevice,
  GHOST_ID
} from '../../helpers/db';

describe('DeleteDeviceModelUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: DeleteDeviceModelUseCase;
  let vendorId: string;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    const deviceModelRepo = new PrismaDeviceModelRepository(prisma);
    const deviceRepo = new PrismaDeviceRepository(prisma);
    const logger = new WinstonLogger();
    useCase = new DeleteDeviceModelUseCase(
      deviceModelRepo,
      deviceRepo,
      logger
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCatalog(prisma);
    vendorId = await seedVendor(prisma, {
      name: 'Ubiquiti',
      slug: 'ubiquiti'
    });

    const model = await prisma.deviceModel.create({
      data: {
        vendorId,
        model: 'UniFi AP',
        deviceType: 'RADIO'
      }
    });
    deviceModelId = model.id;
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('deletes a device model successfully and it is no longer found in the DB', async () => {
    const result = await useCase.execute({ id: deviceModelId });

    expect(result.isSuccess).toBe(true);

    const row = await prisma.deviceModel.findUnique({
      where: { id: deviceModelId }
    });
    expect(row).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────
  // Not found
  // ──────────────────────────────────────────────────────────────

  it('[DEV-029] fails with a not-found error when the device model does not exist (GHOST_ID)', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  // ──────────────────────────────────────────────────────────────
  // Guard: device model has associated devices
  // ──────────────────────────────────────────────────────────────

  it('[DEV-026] fails with a "Cannot delete" error when the device model has associated devices', async () => {
    await seedMonitoredDevice(prisma, deviceModelId, '192.168.50.1');

    const result = await useCase.execute({ id: deviceModelId });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Cannot delete/i);
  });

  // ──────────────────────────────────────────────────────────────
  // [DEV-030] Guard: the model's only devices are in the recycle bin
  // ──────────────────────────────────────────────────────────────

  async function binDevice(ip: string): Promise<string> {
    const { deviceId } = await seedMonitoredDevice(
      prisma,
      deviceModelId,
      ip
    );
    await prisma.device.update({
      where: { id: deviceId },
      data: { deletedAt: new Date(), monitoringEnabled: false }
    });
    return deviceId;
  }

  // Without the guard this is the regression: DEV-026 sees no live devices, so
  // the model delete reaches Postgres and dies on the RESTRICT foreign key.
  it('[DEV-030] refuses a model whose only devices are in the recycle bin', async () => {
    await binDevice('192.168.50.2');

    const result = await useCase.execute({ id: deviceModelId });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/recycle bin/i);
    expect(result.error).toMatch(/purgeBinnedDevices=true/);
    expect(result.error).not.toMatch(/foreign key/i);

    const row = await prisma.deviceModel.findUnique({
      where: { id: deviceModelId }
    });
    expect(row).not.toBeNull();
  });

  it('[DEV-030] purges the binned devices and the model once confirmed', async () => {
    const a = await binDevice('192.168.50.3');
    const b = await binDevice('192.168.50.4');

    const result = await useCase.execute({
      id: deviceModelId,
      purgeBinnedDevices: true
    });

    expect(result.isSuccess).toBe(true);
    expect(
      await prisma.device.count({ where: { id: { in: [a, b] } } })
    ).toBe(0);
    expect(
      await prisma.deviceModel.findUnique({
        where: { id: deviceModelId }
      })
    ).toBeNull();
  });

  it('[DEV-030] takes the binned devices history with it', async () => {
    const id = await binDevice('192.168.50.5');
    await prisma.pingResult.create({
      data: { deviceId: id, isReachable: true, latencyMs: 12 }
    });

    await useCase.execute({
      id: deviceModelId,
      purgeBinnedDevices: true
    });

    expect(
      await prisma.pingResult.count({ where: { deviceId: id } })
    ).toBe(0);
  });

  it('[DEV-030] confirmation does not override the live-device guard', async () => {
    await binDevice('192.168.50.6');
    const { deviceId: live } = await seedMonitoredDevice(
      prisma,
      deviceModelId,
      '192.168.50.7'
    );

    const result = await useCase.execute({
      id: deviceModelId,
      purgeBinnedDevices: true
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Reassign or remove/);
    expect(
      await prisma.device.findUnique({ where: { id: live } })
    ).not.toBeNull();
    // The bin is untouched too — nothing is purged on a refused request.
    expect(await prisma.device.count()).toBe(2);
  });
});
