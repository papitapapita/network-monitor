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

  it('[CUS-024] moves a customer to the other payment group', async () => {
    const id = await seedCustomer(prisma);

    const result = await useCase.execute({ id, paymentDay: 15 });

    expect(result.isSuccess).toBe(true);
    const row = await prisma.customer.findUniqueOrThrow({
      where: { id }
    });
    expect(row.paymentDay).toBe(15);
  });

  it('[CUS-024] leaves the row untouched on an invalid payment day', async () => {
    const id = await seedCustomer(prisma, { paymentDay: 15 });

    const result = await useCase.execute({ id, paymentDay: 31 });

    expect(result.isFailure).toBe(true);
    const row = await prisma.customer.findUniqueOrThrow({
      where: { id }
    });
    expect(row.paymentDay).toBe(15);
  });

  it('keeps the payment day when other fields change', async () => {
    const id = await seedCustomer(prisma, { paymentDay: 15 });

    await useCase.execute({ id, fullName: 'Renamed' });

    const row = await prisma.customer.findUniqueOrThrow({
      where: { id }
    });
    expect(row.fullName).toBe('Renamed');
    expect(row.paymentDay).toBe(15);
  });

  it('fails for an unknown customer', async () => {
    const result = await useCase.execute({
      id: GHOST_ID,
      paymentDay: 15
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/);
  });

  it('fails for a malformed id', async () => {
    const result = await useCase.execute({
      id: INVALID_ID,
      paymentDay: 15
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Invalid customer ID/);
  });
});
