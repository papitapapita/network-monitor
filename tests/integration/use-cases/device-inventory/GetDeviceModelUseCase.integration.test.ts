import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetDeviceModelUseCase } from 'application/device-inventory/use-cases/GetDeviceModelUseCase';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
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

describe('GetDeviceModelUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: GetDeviceModelUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    const repo = new PrismaDeviceModelRepository(prisma);
    const logger = new WinstonLogger();
    useCase = new GetDeviceModelUseCase(repo, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    // Device models are not cleaned — seedDeviceModel upserts so it persists
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('retrieves a device model by ID', async () => {
    const result = await useCase.execute({ id: deviceModelId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.id).toBe(deviceModelId);
    expect(result.value.manufacturer).toBe('MIKROTIK');
    expect(result.value.model).toBe('RB4011iGS+');
    expect(result.value.deviceType).toBeDefined();
  });

  // ──────────────────────────────────────────────────────────────
  // Validation failures
  // ──────────────────────────────────────────────────────────────

  it('fails when id is empty', async () => {
    const result = await useCase.execute({ id: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/required/i);
  });

  it('fails when id is not a valid UUID', async () => {
    const result = await useCase.execute({ id: INVALID_ID });

    expect(result.isFailure).toBe(true);
  });

  it('fails when the device model does not exist', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });
});
