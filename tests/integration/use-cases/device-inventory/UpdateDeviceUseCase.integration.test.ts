import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateDeviceUseCase } from 'application/device-inventory/use-cases/CreateDeviceUseCase';
import { UpdateDeviceUseCase } from 'application/device-inventory/use-cases/UpdateDeviceUseCase';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  seedDeviceModel,
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
  let locationId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);
    locationId = await seedLocation(prisma);

    const repo = new PrismaDeviceRepository(prisma);
    const logger = new WinstonLogger();
    createUseCase = new CreateDeviceUseCase(repo, logger);
    updateUseCase = new UpdateDeviceUseCase(repo, logger);
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
    // Domain rule: cannot activate without an IP address
    const id = await createDevice({ ipAddress: '10.1.0.1' });

    const result = await updateUseCase.execute({ id, status: 'ACTIVE' });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('ACTIVE');
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
    const id = await createDevice({ ipAddress: '10.100.0.1' });

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

  it('updating MAC to its own current value does not fail', async () => {
    const mac = 'AA:BB:CC:DD:EE:01';
    const id = await createDevice({ macAddress: mac });

    const result = await updateUseCase.execute({ id, macAddress: mac });

    expect(result.isSuccess).toBe(true);
    expect(result.value.macAddress).toBe(mac);
  });

  // ──────────────────────────────────────────────────────────────
  // Uniqueness and validation failures
  // ──────────────────────────────────────────────────────────────

  it('fails when updating MAC to another device\'s MAC', async () => {
    const mac = 'AA:BB:CC:DD:EE:02';
    await createDevice({ macAddress: mac, name: 'First Device' });
    const secondId = await createDevice({ name: 'Second Device' });

    const result = await updateUseCase.execute({ id: secondId, macAddress: mac });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/MAC address/i);
  });

  it('fails when updating IP to another device\'s IP', async () => {
    const ip = '10.200.0.1';
    await createDevice({ ipAddress: ip, name: 'First Device' });
    const secondId = await createDevice({ name: 'Second Device' });

    const result = await updateUseCase.execute({ id: secondId, ipAddress: ip });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/IP address/i);
  });

  it('fails with an invalid status enum', async () => {
    const id = await createDevice();

    const result = await updateUseCase.execute({ id, status: 'EXPLODED' as any });

    expect(result.isFailure).toBe(true);
  });

  it('fails when the device does not exist', async () => {
    const result = await updateUseCase.execute({
      id: GHOST_ID,
      name: 'Ghost Update'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });
});
