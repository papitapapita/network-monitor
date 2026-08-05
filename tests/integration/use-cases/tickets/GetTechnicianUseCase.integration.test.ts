// Source: src/application/tickets/use-cases/GetTechnicianUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetTechnicianUseCase } from 'application/tickets/use-cases';
import { PrismaTechnicianRepository } from 'infrastructure/tickets/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanTickets,
  seedTechnician,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('GetTechnicianUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: GetTechnicianUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new GetTechnicianUseCase(
      new PrismaTechnicianRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanTickets(prisma);
  });

  it('retrieves a technician by id', async () => {
    const id = await seedTechnician(prisma, {
      fullName: 'Andrés Muñoz',
      phone: '+573001112233',
      email: 'andres@isp.example'
    });

    const result = await useCase.execute({ id });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toMatchObject({
      id,
      fullName: 'Andrés Muñoz',
      phone: '+573001112233',
      email: 'andres@isp.example',
      isActive: true
    });
  });

  it('retrieves a deactivated technician', async () => {
    const id = await seedTechnician(prisma, {
      phone: '+573004445566',
      isActive: false
    });

    const result = await useCase.execute({ id });

    expect(result.isSuccess).toBe(true);
    expect(result.value.isActive).toBe(false);
  });

  it('fails when the technician does not exist', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  it('fails on a malformed id', async () => {
    const result = await useCase.execute({ id: INVALID_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid/i);
  });

  it('fails on an empty id', async () => {
    const result = await useCase.execute({ id: '  ' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/required/i);
  });
});
