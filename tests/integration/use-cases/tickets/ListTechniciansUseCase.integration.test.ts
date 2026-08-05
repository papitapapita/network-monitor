// Source: src/application/tickets/use-cases/ListTechniciansUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ListTechniciansUseCase } from 'application/tickets/use-cases';
import { PrismaTechnicianRepository } from 'infrastructure/tickets/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanTickets, seedTechnician } from '../../helpers/db';

describe('ListTechniciansUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ListTechniciansUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new ListTechniciansUseCase(
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

  it('returns an empty page rather than failing when there are none', async () => {
    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(result.value.technicians).toEqual([]);
    expect(result.value.total).toBe(0);
  });

  it('lists technicians in name order', async () => {
    await seedTechnician(prisma, {
      fullName: 'Zulma Vega',
      phone: '+573001110001'
    });
    await seedTechnician(prisma, {
      fullName: 'Ana Ruiz',
      phone: '+573001110002'
    });

    const result = await useCase.execute({});

    expect(result.value.technicians.map((t) => t.fullName)).toEqual([
      'Ana Ruiz',
      'Zulma Vega'
    ]);
  });

  it('filters to active technicians and counts only those', async () => {
    await seedTechnician(prisma, {
      phone: '+573001110001',
      isActive: false
    });
    await seedTechnician(prisma, {
      phone: '+573001110002',
      isActive: true
    });

    const result = await useCase.execute({ activeOnly: true });

    expect(result.value.total).toBe(1);
    expect(result.value.technicians).toHaveLength(1);
    expect(result.value.technicians[0].isActive).toBe(true);
  });

  it('paginates and reports hasMore correctly', async () => {
    for (let i = 0; i < 3; i++) {
      await seedTechnician(prisma, {
        fullName: `Tech ${i}`,
        phone: `+57300111000${i}`
      });
    }

    const firstPage = await useCase.execute({ limit: 2, offset: 0 });
    expect(firstPage.value.technicians).toHaveLength(2);
    expect(firstPage.value.hasMore).toBe(true);

    const secondPage = await useCase.execute({ limit: 2, offset: 2 });
    expect(secondPage.value.hasMore).toBe(false);
  });

  it('caps the page size at 100', async () => {
    const result = await useCase.execute({ limit: 5000 });

    expect(result.value.limit).toBe(100);
  });

  it('fails on a negative offset', async () => {
    const result = await useCase.execute({ offset: -1 });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/negative/i);
  });
});
