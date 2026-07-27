import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateLocationUseCase } from 'application/device-inventory/use-cases/CreateLocationUseCase';
import { GetLocationUseCase } from 'application/device-inventory/use-cases/GetLocationUseCase';
import { PrismaLocationRepository } from 'infrastructure/persistence/PrismaLocationRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('GetLocationUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let createUseCase: CreateLocationUseCase;
  let getUseCase: GetLocationUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    const repo = new PrismaLocationRepository(prisma);
    const logger = new WinstonLogger();
    createUseCase = new CreateLocationUseCase(repo, logger);
    getUseCase = new GetLocationUseCase(repo, logger);
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

  it('retrieves a location by ID with all fields matching', async () => {
    const created = await createUseCase.execute({
      name: 'Roof Tower',
      type: 'TOWER',
      address: 'Rua das Palmeiras 100',
      municipality: 'Campinas',
      neighborhood: 'Centro'
    });

    expect(created.isSuccess).toBe(true);
    const { id } = created.value;

    const result = await getUseCase.execute({ id });

    expect(result.isSuccess).toBe(true);
    expect(result.value.id).toBe(id);
    expect(result.value.name).toBe('Roof Tower');
    expect(result.value.type).toBe('TOWER');
    expect(result.value.address).toBe('Rua das Palmeiras 100');
    expect(result.value.municipality).toBe('Campinas');
    expect(result.value.neighborhood).toBe('Centro');
  });

  it('fails when an address is given without a street and neighborhood', async () => {
    const result = await createUseCase.execute({
      name: 'Partial Address Tower',
      type: 'TOWER',
      municipality: 'Campinas'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(
      /address requires a street, municipality, and neighborhood/i
    );
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

  it('fails when the location does not exist', async () => {
    const result = await getUseCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });
});
