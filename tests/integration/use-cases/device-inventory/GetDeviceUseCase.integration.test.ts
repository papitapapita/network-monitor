import { PrismaClient } from '../../../../src/generated/prisma/client';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { PrismaLocationRepository } from 'infrastructure/persistence/PrismaLocationRepository';
import { CreateDeviceUseCase } from 'application/device-inventory/use-cases/CreateDeviceUseCase';
import { GetDeviceUseCase } from 'application/device-inventory/use-cases/GetDeviceUseCase';
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
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('GetDeviceUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let createUseCase: CreateDeviceUseCase;
  let getUseCase: GetDeviceUseCase;
  let deviceModelId: string;
  let locationId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    const repo = new PrismaDeviceRepository(prisma);
    const logger = new WinstonLogger();
    createUseCase = new CreateDeviceUseCase(
      repo,
      new PrismaDeviceModelRepository(prisma),
      new PrismaLocationRepository(prisma),
      logger
    );
    getUseCase = new GetDeviceUseCase(repo, logger);
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

  it('retrieves a device by ID with all fields matching', async () => {
    const created = await createUseCase.execute({
      deviceModelId,
      locationId,
      name: 'Core Router',
      ownerType: 'COMPANY',
      status: 'ACTIVE',
      category: 'GATEWAY',
      ipAddress: '10.0.0.1',
      macAddress: 'AA:BB:CC:DD:EE:01'
    });

    expect(created.isSuccess).toBe(true);
    const { id } = created.value;

    const result = await getUseCase.execute({ id });

    expect(result.isSuccess).toBe(true);
    expect(result.value.id).toBe(id);
    expect(result.value.name).toBe('Core Router');
    expect(result.value.ownerType).toBe('COMPANY');
    expect(result.value.status).toBe('ACTIVE');
    expect(result.value.category).toBe('GATEWAY');
    expect(result.value.ipAddress).toBe('10.0.0.1');
    expect(result.value.macAddress).toBe('AA:BB:CC:DD:EE:01');
  });

  // ──────────────────────────────────────────────────────────────
  // Validation failures
  // ──────────────────────────────────────────────────────────────

  it('fails when id is empty', async () => {
    const result = await getUseCase.execute({ id: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/required/i);
  });

  it('fails when id is not a valid UUID', async () => {
    const result = await getUseCase.execute({ id: INVALID_ID });

    expect(result.isFailure).toBe(true);
  });

  it('fails when the device does not exist', async () => {
    const result = await getUseCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });
});
