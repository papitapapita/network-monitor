import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateDeviceUseCase } from 'application/device-inventory/use-cases/CreateDeviceUseCase';
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
  GHOST_ID
} from '../../helpers/db';

/**
 * Integration tests for CreateDeviceUseCase.
 *
 * These tests bypass HTTP entirely — they call useCase.execute(dto) directly
 * and assert on the returned Result<DeviceResponseDTO>.
 *
 * The container is still initialized so that cross-context event handlers
 * (DeviceProvisionedHandler) are registered on the EventDispatcher.
 */
describe('CreateDeviceUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: CreateDeviceUseCase;
  let deviceModelId: string;
  let locationId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    // Wire use case with real infrastructure
    const repo = new PrismaDeviceRepository(prisma);
    const logger = new WinstonLogger();
    useCase = new CreateDeviceUseCase(repo, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  // cleanDatabase() wipes locations, so the fixture is re-seeded per test.
  beforeEach(async () => {
    await cleanDatabase(prisma);
    locationId = await seedLocation(prisma);
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('[DEV-042] succeeds with required fields only and defaults status to INVENTORY', async () => {
    const result = await useCase.execute({
      deviceModelId,
      name: 'Core Router',
      ownerType: 'COMPANY',
      serialNumber: 'SN-001'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe('Core Router');
    expect(result.value.ownerType).toBe('COMPANY');
    expect(result.value.status).toBe('INVENTORY');
    expect(result.value.monitoringEnabled).toBe(false);
    expect(result.value.id).toBeDefined();
  });

  it('succeeds with all optional fields', async () => {
    const result = await useCase.execute({
      deviceModelId,
      locationId,
      name: 'Access Point SP',
      ownerType: 'CLIENT',
      status: 'ACTIVE',
      category: 'AP',
      serialNumber: 'SN-99001',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      ipAddress: '10.0.0.1',
      description: 'Client CPE',
      installedDate: '2025-06-01T00:00:00.000Z',
      monitoringEnabled: true
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('ACTIVE');
    expect(result.value.category).toBe('AP');
    expect(result.value.serialNumber).toBe('SN-99001');
    expect(result.value.macAddress).toBe('AA:BB:CC:DD:EE:FF');
    expect(result.value.ipAddress).toBe('10.0.0.1');
    expect(result.value.monitoringEnabled).toBe(true);
  });

  it('auto-creates a PollingConfiguration when monitoringEnabled=true', async () => {
    const result = await useCase.execute({
      deviceModelId,
      locationId,
      name: 'Monitored Switch',
      ownerType: 'COMPANY',
      status: 'ACTIVE',
      serialNumber: 'SN-001',
      ipAddress: '192.168.1.1',
      monitoringEnabled: true
    });

    expect(result.isSuccess).toBe(true);

    // DeviceProvisionedHandler is fired as a fire-and-forget Promise by
    // EventDispatcher. Poll until the row appears (up to 1 s).
    let pollingConfig = null;
    for (let i = 0; i < 10; i++) {
      pollingConfig = await prisma.pollingConfiguration.findFirst({
        where: { deviceId: result.value.id }
      });
      if (pollingConfig) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(pollingConfig).not.toBeNull();
    expect(pollingConfig!.enabled).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────
  // Validation failures
  // ──────────────────────────────────────────────────────────────

  it('[DEV-040] fails when deviceModelId is missing', async () => {
    const result = await useCase.execute({
      deviceModelId: '',
      name: 'Router',
      ownerType: 'COMPANY'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/deviceModelId/i);
  });

  it('[DEV-040] fails when name is missing', async () => {
    const result = await useCase.execute({
      deviceModelId,
      name: '',
      ownerType: 'COMPANY'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/name/i);
  });

  it('[DEV-044] fails with an invalid ownerType', async () => {
    const result = await useCase.execute({
      deviceModelId,
      name: 'Router',
      ownerType: 'PERSONAL' as any
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/ownerType/i);
  });

  it('fails with an unknown deviceModelId (FK violation)', async () => {
    const result = await useCase.execute({
      deviceModelId: GHOST_ID,
      name: 'Router',
      ownerType: 'COMPANY'
    });

    expect(result.isFailure).toBe(true);
  });

  it('[DEV-047] fails on duplicate MAC address', async () => {
    const mac = 'AA:BB:CC:DD:EE:01';

    await useCase.execute({
      deviceModelId,
      name: 'First Device',
      ownerType: 'COMPANY',
      macAddress: mac
    });

    const second = await useCase.execute({
      deviceModelId,
      name: 'Second Device',
      ownerType: 'COMPANY',
      macAddress: mac
    });

    expect(second.isFailure).toBe(true);
    expect(second.error).toMatch(/MAC address/i);
  });

  it('[DEV-049] fails on duplicate IP address', async () => {
    const ip = '10.10.0.1';

    await useCase.execute({
      deviceModelId,
      name: 'First Device',
      ownerType: 'COMPANY',
      serialNumber: 'SN-FIRST-01',
      ipAddress: ip
    });

    const second = await useCase.execute({
      deviceModelId,
      name: 'Second Device',
      ownerType: 'COMPANY',
      serialNumber: 'SN-SECOND-01',
      ipAddress: ip
    });

    expect(second.isFailure).toBe(true);
    expect(second.error).toMatch(/IP address/i);
  });

  it('[DEV-046] fails with an invalid MAC address format', async () => {
    const result = await useCase.execute({
      deviceModelId,
      name: 'Router',
      ownerType: 'COMPANY',
      macAddress: 'GG:HH:II:JJ:KK:LL'
    });

    expect(result.isFailure).toBe(true);
  });
});
