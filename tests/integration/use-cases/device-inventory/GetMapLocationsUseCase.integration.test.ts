// Source: src/application/device-inventory/use-cases/GetMapLocationsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateLocationUseCase } from 'application/device-inventory/use-cases/CreateLocationUseCase';
import { CreateDeviceUseCase } from 'application/device-inventory/use-cases/CreateDeviceUseCase';
import { GetMapLocationsUseCase } from 'application/device-inventory/use-cases/GetMapLocationsUseCase';
import { PrismaLocationRepository } from 'infrastructure/persistence/PrismaLocationRepository';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase, seedDeviceModel } from '../../helpers/db';

describe('GetMapLocationsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let createLocation: CreateLocationUseCase;
  let createDevice: CreateDeviceUseCase;
  let useCase: GetMapLocationsUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    const locationRepo = new PrismaLocationRepository(prisma);
    const deviceRepo = new PrismaDeviceRepository(prisma);
    const logger = new WinstonLogger();
    createLocation = new CreateLocationUseCase(locationRepo, logger);
    createDevice = new CreateDeviceUseCase(deviceRepo, logger);
    useCase = new GetMapLocationsUseCase(locationRepo, deviceRepo, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  async function createTower(
    name: string,
    latitude: number | null,
    longitude: number | null,
    extra: Record<string, unknown> = {}
  ): Promise<string> {
    const result = await createLocation.execute({
      name,
      type: 'TOWER',
      latitude,
      longitude,
      ...extra
    });
    expect(result.isSuccess).toBe(true);
    return result.value.id;
  }

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('returns an empty pin list when no locations exist', async () => {
    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(result.value.pins).toHaveLength(0);
    expect(result.value.total).toBe(0);
  });

  it('returns a pin with its coordinates and address fields', async () => {
    await createTower('Roof Tower', -22.9, -47.06, {
      address: 'Rua das Palmeiras 100',
      municipality: 'Campinas',
      neighborhood: 'Centro'
    });

    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(result.value.total).toBe(1);

    const pin = result.value.pins[0];
    expect(pin.name).toBe('Roof Tower');
    expect(pin.locationType).toBe('TOWER');
    expect(pin.latitude).toBe(-22.9);
    expect(pin.longitude).toBe(-47.06);
    expect(pin.municipality).toBe('Campinas');
    expect(pin.neighborhood).toBe('Centro');
    expect(pin.address).toBe('Rua das Palmeiras 100');
    expect(pin.devices).toHaveLength(0);
  });

  // ──────────────────────────────────────────────────────────────
  // The filter that defines this use case: coordinates required
  // ──────────────────────────────────────────────────────────────

  it('excludes locations that have no coordinates', async () => {
    await createTower('Mapped Tower', -22.9, -47.06);
    await createTower('Unmapped Tower', null, null);

    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(result.value.total).toBe(1);
    expect(result.value.pins[0].name).toBe('Mapped Tower');
  });

  it('reports altitude when set and null when absent', async () => {
    await createTower('High Tower', -22.9, -47.06, { altitude: 850 });
    await createTower('Flat Tower', -23.1, -47.2);

    const result = await useCase.execute({});

    const byName = new Map(result.value.pins.map((p) => [p.name, p]));
    expect(byName.get('High Tower')!.altitude).toBe(850);
    expect(byName.get('Flat Tower')!.altitude).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────
  // Device grouping across aggregates
  // ──────────────────────────────────────────────────────────────

  it('groups devices under the location they belong to', async () => {
    const towerA = await createTower('Tower A', -22.9, -47.06);
    const towerB = await createTower('Tower B', -23.1, -47.2);

    const first = await createDevice.execute({
      deviceModelId,
      locationId: towerA,
      name: 'Router A1',
      ownerType: 'COMPANY',
      status: 'ACTIVE',
      category: 'ROUTERBOARD',
      ipAddress: '10.20.0.1'
    });
    expect(first.isSuccess).toBe(true);

    const second = await createDevice.execute({
      deviceModelId,
      locationId: towerA,
      name: 'Router A2',
      ownerType: 'COMPANY',
      status: 'ACTIVE',
      ipAddress: '10.20.0.2'
    });
    expect(second.isSuccess).toBe(true);

    const third = await createDevice.execute({
      deviceModelId,
      locationId: towerB,
      name: 'Router B1',
      ownerType: 'COMPANY',
      status: 'ACTIVE',
      ipAddress: '10.20.0.3'
    });
    expect(third.isSuccess).toBe(true);

    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);

    const byName = new Map(result.value.pins.map((p) => [p.name, p]));
    expect(byName.get('Tower A')!.devices).toHaveLength(2);
    expect(byName.get('Tower B')!.devices).toHaveLength(1);
    expect(byName.get('Tower B')!.devices[0].name).toBe('Router B1');
  });

  it('exposes device summary fields on each pin', async () => {
    const tower = await createTower('Tower A', -22.9, -47.06);

    const created = await createDevice.execute({
      deviceModelId,
      locationId: tower,
      name: 'Core Router',
      ownerType: 'COMPANY',
      status: 'ACTIVE',
      category: 'ROUTERBOARD',
      ipAddress: '10.21.0.1',
      macAddress: 'AA:BB:CC:DD:EE:10'
    });
    expect(created.isSuccess).toBe(true);

    const result = await useCase.execute({});

    const device = result.value.pins[0].devices[0];
    expect(device.id).toBe(created.value.id);
    expect(device.name).toBe('Core Router');
    expect(device.status).toBe('ACTIVE');
    expect(device.category).toBe('ROUTERBOARD');
    expect(device.ipAddress).toBe('10.21.0.1');
    expect(device.macAddress).toBe('AA:BB:CC:DD:EE:10');
    expect(device.monitoringEnabled).toBe(false);
  });

  it('does not attach devices that have no location', async () => {
    await createTower('Tower A', -22.9, -47.06);

    const orphan = await createDevice.execute({
      deviceModelId,
      name: 'Warehouse Spare',
      ownerType: 'COMPANY',
      serialNumber: 'SN-SPARE-01'
    });
    expect(orphan.isSuccess).toBe(true);

    const result = await useCase.execute({});

    expect(result.value.total).toBe(1);
    expect(result.value.pins[0].devices).toHaveLength(0);
  });
});
