import { PrismaClient } from '../../../../src/generated/prisma/client';
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
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('GetDeviceUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let createUseCase: CreateDeviceUseCase;
  let getUseCase: GetDeviceUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    const repo = new PrismaDeviceRepository(prisma);
    const logger = new WinstonLogger();
    createUseCase = new CreateDeviceUseCase(repo, logger);
    getUseCase = new GetDeviceUseCase(repo, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('retrieves a device by ID with all fields matching', async () => {
    const created = await createUseCase.execute({
      deviceModelId,
      name: 'Core Router',
      ownerType: 'COMPANY',
      status: 'ACTIVE',
      category: 'CORE',
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
    expect(result.value.category).toBe('CORE');
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
