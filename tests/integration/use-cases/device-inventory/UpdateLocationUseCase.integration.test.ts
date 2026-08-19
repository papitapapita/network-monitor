import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateLocationUseCase } from 'application/device-inventory/use-cases/CreateLocationUseCase';
import { UpdateLocationUseCase } from 'application/device-inventory/use-cases/UpdateLocationUseCase';
import { PrismaLocationRepository } from 'infrastructure/persistence/PrismaLocationRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase, GHOST_ID } from '../../helpers/db';

describe('UpdateLocationUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let createUseCase: CreateLocationUseCase;
  let updateUseCase: UpdateLocationUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    const repo = new PrismaLocationRepository(prisma);
    const logger = new WinstonLogger();
    createUseCase = new CreateLocationUseCase(repo, logger);
    updateUseCase = new UpdateLocationUseCase(repo, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  async function createLocation(
    overrides: Record<string, unknown> = {}
  ): Promise<string> {
    const result = await createUseCase.execute({
      name: 'Test Location',
      type: 'TOWER',
      ...overrides
    });
    expect(result.isSuccess).toBe(true);
    return result.value.id;
  }

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('updates the location name', async () => {
    const id = await createLocation();

    const result = await updateUseCase.execute({
      id,
      name: 'Updated Tower'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe('Updated Tower');
  });

  it('updates the location type', async () => {
    const id = await createLocation();

    const result = await updateUseCase.execute({
      id,
      type: 'DATACENTER'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.type).toBe('DATACENTER');
  });

  it('[DEV-094] updates address fields', async () => {
    const id = await createLocation();

    const result = await updateUseCase.execute({
      id,
      municipality: 'Recife',
      neighborhood: 'Boa Vista',
      address: 'Rua do Sol, 100'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.municipality).toBe('Recife');
    expect(result.value.neighborhood).toBe('Boa Vista');
    expect(result.value.address).toBe('Rua do Sol, 100');
  });

  it('[DEV-093] updates coordinates', async () => {
    const id = await createLocation();

    const result = await updateUseCase.execute({
      id,
      latitude: -8.0476,
      longitude: -34.877
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.latitude).toBe(-8.0476);
    expect(result.value.longitude).toBe(-34.877);
  });

  // ──────────────────────────────────────────────────────────────
  // Validation failures
  // ──────────────────────────────────────────────────────────────

  it('[DEV-091] fails when type is an invalid enum value', async () => {
    const id = await createLocation();

    const result = await updateUseCase.execute({
      id,
      type: 'ROOFTOP' as any
    });

    expect(result.isFailure).toBe(true);
  });

  it('[DEV-092] fails when only one of latitude/longitude is provided', async () => {
    const id = await createLocation();

    const result = await updateUseCase.execute({
      id,
      latitude: -23.5
    });

    expect(result.isFailure).toBe(true);
  });

  it('fails when the location does not exist', async () => {
    const result = await updateUseCase.execute({
      id: GHOST_ID,
      name: 'Ghost Update'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });
});
