// Source: src/application/device-inventory/use-cases/PurgeDeletedDevicesUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { PrismaLocationRepository } from 'infrastructure/persistence/PrismaLocationRepository';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { PrismaContractedServiceRepository } from 'infrastructure/customers';
import { PrismaTicketRepository } from 'infrastructure/tickets/repositories';
import { CreateDeviceUseCase } from 'application/device-inventory/use-cases/CreateDeviceUseCase';
import { DeleteDeviceUseCase } from 'application/device-inventory/use-cases/DeleteDeviceUseCase';
import { ReplaceDeviceUseCase } from 'application/device-inventory/use-cases/ReplaceDeviceUseCase';
import { PurgeDeletedDevicesUseCase } from 'application/device-inventory/use-cases/PurgeDeletedDevicesUseCase';
import { PrismaDeviceCredentialsRepository } from 'infrastructure/persistence';
import { PrismaWirelessDeviceConfigRepository } from 'infrastructure/wireless-monitoring';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  cleanBills,
  cleanCustomers,
  cleanTickets,
  seedDeviceModel,
  seedWirelessDeviceModel,
  seedLocation
} from '../../helpers/db';

// No HTTP surface reaches this use case at all — the retention orchestrator is
// its only caller — so this suite is the only thing that exercises it.
describe('PurgeDeletedDevicesUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let createUseCase: CreateDeviceUseCase;
  let deleteUseCase: DeleteDeviceUseCase;
  let replaceUseCase: ReplaceDeviceUseCase;
  let purgeUseCase: PurgeDeletedDevicesUseCase;
  let deviceModelId: string;
  let wirelessModelId: string;
  let locationId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);
    wirelessModelId = await seedWirelessDeviceModel(prisma);

    const repo = new PrismaDeviceRepository(prisma);
    const logger = new WinstonLogger();
    createUseCase = new CreateDeviceUseCase(
      repo,
      new PrismaDeviceModelRepository(prisma),
      new PrismaLocationRepository(prisma),
      logger
    );
    deleteUseCase = new DeleteDeviceUseCase(
      repo,
      new PrismaContractedServiceRepository(prisma),
      new PrismaTicketRepository(prisma),
      logger
    );
    replaceUseCase = new ReplaceDeviceUseCase(
      repo,
      new PrismaDeviceModelRepository(prisma),
      new PrismaDeviceCredentialsRepository(prisma),
      new PrismaContractedServiceRepository(prisma),
      new PrismaWirelessDeviceConfigRepository(prisma),
      logger
    );
    purgeUseCase = new PurgeDeletedDevicesUseCase(repo, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanBills(prisma);
    await cleanTickets(prisma);
    await cleanCustomers(prisma);
    await cleanDatabase(prisma);
    locationId = await seedLocation(prisma);
  });

  async function createDevice(
    overrides: Record<string, unknown> = {}
  ): Promise<string> {
    const result = await createUseCase.execute({
      deviceModelId,
      name: 'Purgeable Device',
      ownerType: 'COMPANY',
      serialNumber: `SN-PUR-${Math.random().toString(36).slice(2, 9)}`,
      ...overrides
    });
    expect(result.isSuccess).toBe(true);
    return result.value.id;
  }

  async function backdateDeletion(
    id: string,
    daysAgo: number
  ): Promise<void> {
    await prisma.device.update({
      where: { id },
      data: {
        deletedAt: new Date(Date.now() - daysAgo * 86_400_000)
      }
    });
  }

  // ──────────────────────────────────────────────────────────────
  // [DEV-077] Hard removal past the grace period
  // ──────────────────────────────────────────────────────────────

  it('[DEV-077] removes a device whose grace period has expired', async () => {
    const id = await createDevice();
    await deleteUseCase.execute({ id });
    await backdateDeletion(id, 8);

    const result = await purgeUseCase.execute(7);

    expect(result.isSuccess).toBe(true);
    expect(result.value).toBe(1);

    const row = await prisma.device.findUnique({ where: { id } });
    expect(row).toBeNull();
  });

  it('[DEV-077] leaves a device still inside its grace period alone', async () => {
    const id = await createDevice();
    await deleteUseCase.execute({ id });
    await backdateDeletion(id, 3);

    const result = await purgeUseCase.execute(7);

    expect(result.isSuccess).toBe(true);
    expect(result.value).toBe(0);

    const row = await prisma.device.findUnique({ where: { id } });
    expect(row).not.toBeNull();
  });

  it('[DEV-077] never touches a live device', async () => {
    const live = await createDevice();
    const doomed = await createDevice();
    await deleteUseCase.execute({ id: doomed });
    await backdateDeletion(doomed, 10);

    const result = await purgeUseCase.execute(7);

    expect(result.value).toBe(1);
    expect(
      await prisma.device.findUnique({ where: { id: live } })
    ).not.toBeNull();
  });

  it('[DEV-077] returns zero when nothing is due', async () => {
    await createDevice();

    const result = await purgeUseCase.execute(7);

    expect(result.isSuccess).toBe(true);
    expect(result.value).toBe(0);
  });

  // ──────────────────────────────────────────────────────────────
  // Cascades — the point of the grace period
  // ──────────────────────────────────────────────────────────────

  it('[DEV-077] takes the device’s collected history with it', async () => {
    const id = await createDevice({
      locationId,
      status: 'ACTIVE',
      ipAddress: '10.80.0.1',
      monitoringEnabled: true
    });
    await prisma.pingResult.create({
      data: { deviceId: id, isReachable: true, latencyMs: 11 }
    });
    await prisma.alertEvent.create({
      data: {
        deviceId: id,
        source: 'PING',
        type: 'device_unreachable',
        description: 'down',
        startedAt: new Date()
      }
    });

    await deleteUseCase.execute({ id });
    await backdateDeletion(id, 8);

    await purgeUseCase.execute(7);

    expect(
      await prisma.pingResult.findMany({ where: { deviceId: id } })
    ).toHaveLength(0);
    expect(
      await prisma.alertEvent.findMany({ where: { deviceId: id } })
    ).toHaveLength(0);
    expect(
      await prisma.pollingConfiguration.findMany({
        where: { deviceId: id }
      })
    ).toHaveLength(0);
  });

  // The self-relation is ON DELETE SET NULL, so purging an ancestor must break
  // the chain rather than the delete.
  it('[DEV-077] purging a retired unit nulls the successor’s lineage link', async () => {
    const oldId = await createUseCase
      .execute({
        deviceModelId: wirelessModelId,
        name: 'CPE-Old',
        ownerType: 'CLIENT',
        category: 'WIRELESS_CPE',
        serialNumber: 'SN-LIN-OLD',
        locationId,
        status: 'ACTIVE',
        ipAddress: '10.80.0.9'
      })
      .then((r) => {
        expect(r.isSuccess).toBe(true);
        return r.value.id;
      });

    const replaced = await replaceUseCase.execute({
      id: oldId,
      deviceModelId: wirelessModelId,
      retiredStatus: 'DAMAGED',
      serialNumber: 'SN-LIN-NEW'
    });
    expect(replaced.isSuccess).toBe(true);
    const newId = replaced.value.newDevice.id;

    await deleteUseCase.execute({ id: oldId });
    await backdateDeletion(oldId, 8);

    const result = await purgeUseCase.execute(7);

    expect(result.value).toBe(1);
    const successor = await prisma.device.findUnique({
      where: { id: newId }
    });
    expect(successor).not.toBeNull();
    expect(successor!.replacesDeviceId).toBeNull();
  });

  it('[DEV-077] purges several due devices in one run', async () => {
    for (let i = 0; i < 3; i += 1) {
      const id = await createDevice();
      await deleteUseCase.execute({ id });
      await backdateDeletion(id, 9);
    }

    const result = await purgeUseCase.execute(7);

    expect(result.value).toBe(3);
    expect(await prisma.device.count()).toBe(0);
  });
});
