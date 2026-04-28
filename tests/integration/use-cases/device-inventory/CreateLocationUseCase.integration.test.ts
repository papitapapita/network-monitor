import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateLocationUseCase } from 'application/device-inventory/use-cases/CreateLocationUseCase';
import { PrismaLocationRepository } from 'infrastructure/persistence/PrismaLocationRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase } from '../../helpers/db';

describe('CreateLocationUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: CreateLocationUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    const repo = new PrismaLocationRepository(prisma);
    const logger = new WinstonLogger();
    useCase = new CreateLocationUseCase(repo, logger);
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

  it('creates a location with required fields only', async () => {
    const result = await useCase.execute({
      name: 'Main Tower',
      type: 'TOWER'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe('Main Tower');
    expect(result.value.type).toBe('TOWER');
    expect(result.value.id).toBeDefined();
  });

  it('creates a location with all optional fields', async () => {
    const result = await useCase.execute({
      name: 'Downtown Office',
      type: 'OFFICE',
      municipality: 'São Paulo',
      neighborhood: 'Centro',
      address: 'Av. Paulista, 1000',
      latitude: -23.5505,
      longitude: -46.6333,
      altitude: 760
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.name).toBe('Downtown Office');
    expect(result.value.type).toBe('OFFICE');
    expect(result.value.municipality).toBe('São Paulo');
    expect(result.value.neighborhood).toBe('Centro');
    expect(result.value.address).toBe('Av. Paulista, 1000');
    expect(result.value.latitude).toBe(-23.5505);
    expect(result.value.longitude).toBe(-46.6333);
    expect(result.value.altitude).toBe(760);
  });

  // ──────────────────────────────────────────────────────────────
  // Validation failures
  // ──────────────────────────────────────────────────────────────

  it('fails when name is empty', async () => {
    const result = await useCase.execute({
      name: '',
      type: 'TOWER'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/name/i);
  });

  it('fails when type is an invalid enum value', async () => {
    const result = await useCase.execute({
      name: 'Bad Location',
      type: 'CLOUD' as any
    });

    expect(result.isFailure).toBe(true);
  });
});
