import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateDeviceUseCase } from 'application/device-inventory/use-cases/CreateDeviceUseCase';
import { UpdateDeviceUseCase } from 'application/device-inventory/use-cases/UpdateDeviceUseCase';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { PrismaLocationRepository } from 'infrastructure/persistence/PrismaLocationRepository';
import { PrismaWirelessDeviceConfigRepository } from 'infrastructure/wireless-monitoring/repositories/PrismaWirelessDeviceConfigRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  seedDeviceModel,
  seedWirelessDeviceModel,
  seedLocation,
  waitForPollingConfig,
  GHOST_ID
} from '../../helpers/db';

describe('UpdateDeviceUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let createUseCase: CreateDeviceUseCase;
  let updateUseCase: UpdateDeviceUseCase;
  let deviceModelId: string;
  let otherDeviceModelId: string;
  let locationId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);
    otherDeviceModelId = await seedWirelessDeviceModel(prisma);
    locationId = await seedLocation(prisma);

    const repo = new PrismaDeviceRepository(prisma);
    const modelRepo = new PrismaDeviceModelRepository(prisma);
    const locationRepo = new PrismaLocationRepository(prisma);
    const wirelessConfigRepo = new PrismaWirelessDeviceConfigRepository(
      prisma
    );
    const logger = new WinstonLogger();
    createUseCase = new CreateDeviceUseCase(
      repo,
      new PrismaDeviceModelRepository(prisma),
      locationRepo,
      logger
    );
    updateUseCase = new UpdateDeviceUseCase(
      repo,
      modelRepo,
      locationRepo,
      wirelessConfigRepo,
      logger
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    // Re-seed location since cleanDatabase deletes locations
    locationId = await seedLocation(prisma);
  });

  async function createDevice(overrides: Record<string, unknown> = {}): Promise<string> {
    const result = await createUseCase.execute({
      deviceModelId,
      name: 'Test Device',
      ownerType: 'COMPANY',
      serialNumber: 'SN-TEST-001',
      ...overrides
    });
    expect(result.isSuccess).toBe(true);
    return result.value.id;
  }

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('updates the device name', async () => {
    const id = await createDevice();

    const result = await updateUseCase.execute({ id, name: 'Updated Router' });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe('Updated Router');
  });

  it('updates the device status from INVENTORY to ACTIVE', async () => {
    // Domain rules: activating needs both an IP address and a location
    const id = await createDevice({ ipAddress: '10.1.0.1', locationId });

    const result = await updateUseCase.execute({ id, status: 'ACTIVE' });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('ACTIVE');
  });

  it('[DEV-060] assigns a location and activates in one request', async () => {
    const id = await createDevice({ ipAddress: '10.1.0.9' });

    const result = await updateUseCase.execute({
      id,
      locationId,
      status: 'ACTIVE'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.locationId).toBe(locationId);
    expect(result.value.status).toBe('ACTIVE');

    const row = await prisma.device.findUnique({ where: { id } });
    expect(row!.status).toBe('ACTIVE');
    expect(row!.locationId).toBe(locationId);
  });

  it('[DEV-060] sets an IP and activates in one request', async () => {
    const id = await createDevice({ locationId });

    const result = await updateUseCase.execute({
      id,
      ipAddress: '10.1.0.10',
      status: 'ACTIVE'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.ipAddress).toBe('10.1.0.10');
    expect(result.value.status).toBe('ACTIVE');
  });

  it('[DEV-060] leaves the row untouched when the combined state is invalid', async () => {
    const id = await createDevice();

    // ACTIVE needs an IP and a location; only the IP is supplied.
    const result = await updateUseCase.execute({
      id,
      ipAddress: '10.1.0.11',
      status: 'ACTIVE'
    });

    expect(result.isFailure).toBe(true);

    const row = await prisma.device.findUnique({ where: { id } });
    expect(row!.status).toBe('INVENTORY');
    expect(row!.ipAddress).toBeNull();
  });

  it('[DEV-055] fails to activate a device that has no location', async () => {
    const id = await createDevice({ ipAddress: '10.1.0.2' });

    const result = await updateUseCase.execute({ id, status: 'ACTIVE' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/ACTIVE device must have a location/i);
  });

  it('assigns a location to the device', async () => {
    const id = await createDevice();

    const result = await updateUseCase.execute({ id, locationId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.locationId).toBe(locationId);
  });

  it('unassigns the location by passing null', async () => {
    const id = await createDevice({ locationId });

    const result = await updateUseCase.execute({ id, locationId: null });

    expect(result.isSuccess).toBe(true);
    expect(result.value.locationId).toBeNull();
  });

  it('enables monitoring and creates a polling configuration', async () => {
    // Domain rule: monitoring is only allowed on ACTIVE/COMMISSIONING devices
    const id = await createDevice({
      ipAddress: '10.100.0.1',
      locationId,
      status: 'ACTIVE'
    });

    const result = await updateUseCase.execute({
      id,
      monitoringEnabled: true
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.monitoringEnabled).toBe(true);

    await waitForPollingConfig(prisma, id);

    const config = await prisma.pollingConfiguration.findFirst({
      where: { deviceId: id }
    });
    expect(config).not.toBeNull();
    expect(config!.enabled).toBe(true);
  });

  it('[DEV-047] updating MAC to its own current value does not fail', async () => {
    const mac = 'AA:BB:CC:DD:EE:01';
    const id = await createDevice({ macAddress: mac });

    const result = await updateUseCase.execute({ id, macAddress: mac });

    expect(result.isSuccess).toBe(true);
    expect(result.value.macAddress).toBe(mac);
  });

  // ──────────────────────────────────────────────────────────────
  // Uniqueness and validation failures
  // ──────────────────────────────────────────────────────────────

  it('[DEV-047] fails when updating MAC to another device\'s MAC', async () => {
    const mac = 'AA:BB:CC:DD:EE:02';
    await createDevice({ macAddress: mac, name: 'First Device' });
    const secondId = await createDevice({ name: 'Second Device' });

    const result = await updateUseCase.execute({ id: secondId, macAddress: mac });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/MAC address/i);
  });

  it('[DEV-049] fails when updating IP to another device\'s IP', async () => {
    const ip = '10.200.0.1';
    await createDevice({ ipAddress: ip, name: 'First Device' });
    const secondId = await createDevice({ name: 'Second Device' });

    const result = await updateUseCase.execute({ id: secondId, ipAddress: ip });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/IP address/i);
  });

  it('[DEV-042] fails with an invalid status enum', async () => {
    const id = await createDevice();

    const result = await updateUseCase.execute({ id, status: 'EXPLODED' as any });

    expect(result.isFailure).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────
  // Device model correction
  // ──────────────────────────────────────────────────────────────

  it('[DEV-063] corrects the model of an INVENTORY device and persists it', async () => {
    const id = await createDevice();

    const result = await updateUseCase.execute({
      id,
      deviceModelId: otherDeviceModelId
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.deviceModelId).toBe(otherDeviceModelId);

    const row = await prisma.device.findUnique({ where: { id } });
    expect(row!.deviceModelId).toBe(otherDeviceModelId);
  });

  it('[DEV-063] fails to correct the model of an ACTIVE device', async () => {
    const id = await createDevice({
      ipAddress: '10.60.0.1',
      locationId,
      status: 'ACTIVE'
    });

    const result = await updateUseCase.execute({
      id,
      deviceModelId: otherDeviceModelId
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/only an INVENTORY device/i);

    const row = await prisma.device.findUnique({ where: { id } });
    expect(row!.deviceModelId).toBe(deviceModelId);
  });

  it('[DEV-063] fails when the target device model does not exist', async () => {
    const id = await createDevice();

    const result = await updateUseCase.execute({
      id,
      deviceModelId: GHOST_ID
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Device model not found/i);
  });

  it('[DEV-063] accepts the device\'s own model unchanged while ACTIVE', async () => {
    const id = await createDevice({
      ipAddress: '10.60.0.2',
      locationId,
      status: 'ACTIVE'
    });

    const result = await updateUseCase.execute({ id, deviceModelId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.deviceModelId).toBe(deviceModelId);
  });

  it('[DEV-063] fails with a malformed deviceModelId', async () => {
    const id = await createDevice();

    const result = await updateUseCase.execute({
      id,
      deviceModelId: 'not-a-uuid'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Invalid deviceModelId/i);
  });

  // ──────────────────────────────────────────────────────────────
  // DEV-065 — category is frozen while a wireless config exists
  // ──────────────────────────────────────────────────────────────

  async function createWirelessDevice(
    category: string
  ): Promise<string> {
    const id = await createDevice({
      deviceModelId: otherDeviceModelId,
      category,
      serialNumber: `SN-WL-${category}`
    });
    await prisma.wirelessPollingConfiguration.create({
      data: {
        deviceId: id,
        deviceType:
          category === 'ACCESS_POINT' ? 'ACCESS_POINT' : 'STATION',
        enabled: true,
        intervalSecs: 3600
      }
    });
    return id;
  }

  it('[DEV-065] refuses to recategorise a device that has a wireless config', async () => {
    const id = await createWirelessDevice('WIRELESS_CPE');

    const result = await updateUseCase.execute({
      id,
      category: 'ACCESS_POINT'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/wireless config/i);

    const persisted = await prisma.device.findUnique({ where: { id } });
    expect(persisted!.category).toBe('WIRELESS_CPE');
  });

  it('[DEV-065] leaves the stored radio mode untouched when the update is refused', async () => {
    const id = await createWirelessDevice('WIRELESS_CPE');

    await updateUseCase.execute({ id, category: 'ACCESS_POINT' });

    const config = await prisma.wirelessPollingConfiguration.findUnique({
      where: { deviceId: id }
    });
    expect(config!.deviceType).toBe('STATION');
  });

  it('[DEV-065] refuses to clear the category while a wireless config exists', async () => {
    const id = await createWirelessDevice('ACCESS_POINT');

    const result = await updateUseCase.execute({ id, category: null });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/wireless config/i);
  });

  it('[DEV-065] allows unrelated fields to change while a wireless config exists', async () => {
    const id = await createWirelessDevice('WIRELESS_CPE');

    const result = await updateUseCase.execute({
      id,
      name: 'Rooftop CPE 04'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe('Rooftop CPE 04');
  });

  it('[DEV-065] allows recategorising once the wireless config is deleted', async () => {
    const id = await createWirelessDevice('WIRELESS_CPE');
    await prisma.wirelessPollingConfiguration.delete({
      where: { deviceId: id }
    });

    const result = await updateUseCase.execute({
      id,
      category: 'ACCESS_POINT'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.category).toBe('ACCESS_POINT');
  });

  it('[DEV-065] allows recategorising a device that never had a wireless config', async () => {
    const id = await createDevice({ category: 'CPE' });

    const result = await updateUseCase.execute({
      id,
      category: 'GATEWAY'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.category).toBe('GATEWAY');
  });

  it('[DEV-069] fails when the device does not exist', async () => {
    const result = await updateUseCase.execute({
      id: GHOST_ID,
      name: 'Ghost Update'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });
});
