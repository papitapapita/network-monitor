import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateDeviceUseCase } from 'application/device-inventory/use-cases/CreateDeviceUseCase';
import { ListDevicesUseCase } from 'application/device-inventory/use-cases/ListDevicesUseCase';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase, seedDeviceModel } from '../../helpers/db';

describe('ListDevicesUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let createUseCase: CreateDeviceUseCase;
  let listUseCase: ListDevicesUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    const repo = new PrismaDeviceRepository(prisma);
    const logger = new WinstonLogger();
    createUseCase = new CreateDeviceUseCase(repo, logger);
    listUseCase = new ListDevicesUseCase(repo, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path — no filters
  // ──────────────────────────────────────────────────────────────

  it('returns empty list when no devices exist', async () => {
    const result = await listUseCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(result.value.devices).toHaveLength(0);
    expect(result.value.total).toBe(0);
    expect(result.value.hasMore).toBe(false);
  });

  it('returns all devices with pagination metadata', async () => {
    await createUseCase.execute({
      deviceModelId,
      name: 'Router A',
      ownerType: 'COMPANY',
      serialNumber: 'SN-A-001'
    });
    await createUseCase.execute({
      deviceModelId,
      name: 'Router B',
      ownerType: 'COMPANY',
      serialNumber: 'SN-B-001'
    });

    const result = await listUseCase.execute({ limit: 20, offset: 0 });

    expect(result.isSuccess).toBe(true);
    expect(result.value.devices).toHaveLength(2);
    expect(result.value.total).toBe(2);
    expect(result.value.limit).toBe(20);
    expect(result.value.offset).toBe(0);
    expect(result.value.hasMore).toBe(false);
  });

  it('applies limit and offset for pagination', async () => {
    for (let i = 1; i <= 5; i++) {
      await createUseCase.execute({
        deviceModelId,
        name: `Device ${i}`,
        ownerType: 'COMPANY',
        serialNumber: `SN-${i.toString().padStart(3, '0')}`
      });
    }

    const page1 = await listUseCase.execute({ limit: 2, offset: 0 });
    expect(page1.isSuccess).toBe(true);
    expect(page1.value.devices).toHaveLength(2);
    expect(page1.value.total).toBe(5);
    expect(page1.value.hasMore).toBe(true);

    const page2 = await listUseCase.execute({ limit: 2, offset: 2 });
    expect(page2.value.devices).toHaveLength(2);
    expect(page2.value.hasMore).toBe(true);

    const page3 = await listUseCase.execute({ limit: 2, offset: 4 });
    expect(page3.value.devices).toHaveLength(1);
    expect(page3.value.hasMore).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path — filters
  // ──────────────────────────────────────────────────────────────

  it('filters by status', async () => {
    await createUseCase.execute({
      deviceModelId,
      name: 'Active Device',
      ownerType: 'COMPANY',
      status: 'ACTIVE',
      ipAddress: '10.0.0.1'
    });
    await createUseCase.execute({
      deviceModelId,
      name: 'Inventory Device',
      ownerType: 'COMPANY',
      serialNumber: 'SN-INV-01'
      // defaults to INVENTORY
    });

    const result = await listUseCase.execute({ status: 'ACTIVE' });

    expect(result.isSuccess).toBe(true);
    expect(result.value.devices).toHaveLength(1);
    expect(result.value.devices[0].name).toBe('Active Device');
  });

  it('filters by category', async () => {
    await createUseCase.execute({
      deviceModelId,
      name: 'Core Switch',
      ownerType: 'COMPANY',
      status: 'ACTIVE',
      category: 'ROUTERBOARD',
      ipAddress: '10.0.0.1'
    });
    await createUseCase.execute({
      deviceModelId,
      name: 'Access Point',
      ownerType: 'COMPANY',
      status: 'ACTIVE',
      category: 'AP',
      ipAddress: '10.0.0.2'
    });

    const result = await listUseCase.execute({ category: 'ROUTERBOARD' });

    expect(result.isSuccess).toBe(true);
    expect(result.value.devices).toHaveLength(1);
    expect(result.value.devices[0].name).toBe('Core Switch');
  });

  it('filters by owner type', async () => {
    await createUseCase.execute({
      deviceModelId,
      name: 'Company Device',
      ownerType: 'COMPANY',
      serialNumber: 'SN-CO-001'
    });
    await createUseCase.execute({
      deviceModelId,
      name: 'Client Device',
      ownerType: 'CLIENT',
      serialNumber: 'SN-CL-001'
    });

    const result = await listUseCase.execute({ owner: 'CLIENT' });

    expect(result.isSuccess).toBe(true);
    expect(result.value.devices).toHaveLength(1);
    expect(result.value.devices[0].name).toBe('Client Device');
  });

  it('filters by search (name substring)', async () => {
    await createUseCase.execute({
      deviceModelId,
      name: 'MikroTik Core',
      ownerType: 'COMPANY',
      serialNumber: 'SN-MK-001'
    });
    await createUseCase.execute({
      deviceModelId,
      name: 'Ubiquiti AP',
      ownerType: 'COMPANY',
      serialNumber: 'SN-UB-001'
    });

    const result = await listUseCase.execute({ search: 'MikroTik' });

    expect(result.isSuccess).toBe(true);
    expect(result.value.devices).toHaveLength(1);
    expect(result.value.devices[0].name).toBe('MikroTik Core');
  });

  // ──────────────────────────────────────────────────────────────
  // Validation failures
  // ──────────────────────────────────────────────────────────────

  it('fails when status filter is an invalid enum value', async () => {
    const result = await listUseCase.execute({ status: 'BROKEN' as any });

    expect(result.isFailure).toBe(true);
  });

  it('fails when category filter is an invalid enum value', async () => {
    const result = await listUseCase.execute({ category: 'SUPERCORE' as any });

    expect(result.isFailure).toBe(true);
  });
});
