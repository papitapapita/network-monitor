// Source: src/application/customers/use-cases/UpdateCustomerUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { UpdateCustomerUseCase } from 'application/customers/use-cases';
import { PrismaCustomerRepository } from 'infrastructure/customers/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanCustomers,
  seedCustomer,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('UpdateCustomerUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: UpdateCustomerUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    useCase = new UpdateCustomerUseCase(
      new PrismaCustomerRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCustomers(prisma);
  });

  it('renames the customer', async () => {
    const id = await seedCustomer(prisma);

    const result = await useCase.execute({ id, fullName: 'Renamed' });

    expect(result.isSuccess).toBe(true);
    const row = await prisma.customer.findUniqueOrThrow({
      where: { id }
    });
    expect(row.fullName).toBe('Renamed');
  });

  it('fails for an unknown customer', async () => {
    const result = await useCase.execute({
      id: GHOST_ID,
      fullName: 'Renamed'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/);
  });

  it('fails for a malformed id', async () => {
    const result = await useCase.execute({
      id: INVALID_ID,
      fullName: 'Renamed'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Invalid customer ID/);
  });
});
