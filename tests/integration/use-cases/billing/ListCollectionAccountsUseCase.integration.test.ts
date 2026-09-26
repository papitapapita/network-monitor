// Source: src/application/billing/use-cases/ListCollectionAccountsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ListCollectionAccountsUseCase } from 'application/billing/use-cases';
import { PrismaCollectionAccountRepository } from 'infrastructure/billing/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanCollectionAccounts,
  cleanBills,
  cleanCustomers,
  seedCollectionAccount,
  seedCustomer
} from '../../helpers/db';

describe('ListCollectionAccountsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ListCollectionAccountsUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    useCase = new ListCollectionAccountsUseCase(
      new PrismaCollectionAccountRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCollectionAccounts(prisma);
    await cleanBills(prisma);
    await cleanCustomers(prisma);
  });

  it('[BIL-240] filters by status', async () => {
    await seedCollectionAccount(prisma, { status: 'PENDING' });
    const paidId = await seedCollectionAccount(prisma, {
      status: 'PAID'
    });

    const result = await useCase.execute({ status: 'PAID' });

    expect(result.isSuccess).toBe(true);
    expect(result.value.total).toBe(1);
    expect(result.value.collectionAccounts[0].id).toBe(paidId);
  });

  it('[BIL-240] filters by customer', async () => {
    const customerId = await seedCustomer(prisma);
    const mineId = await seedCollectionAccount(prisma, {
      customerId
    });
    await seedCollectionAccount(prisma);

    const result = await useCase.execute({ customerId });

    expect(result.value.total).toBe(1);
    expect(result.value.collectionAccounts[0].id).toBe(mineId);
  });

  it('[BIL-240] pages newest first and reports hasMore', async () => {
    for (let i = 0; i < 3; i++) {
      await seedCollectionAccount(prisma, { customerName: `C${i}` });
    }

    const result = await useCase.execute({ limit: 2 });

    expect(result.value.collectionAccounts).toHaveLength(2);
    expect(result.value.collectionAccounts[0].customerName).toBe(
      'C2'
    );
    expect(result.value.total).toBe(3);
    expect(result.value.hasMore).toBe(true);
  });
});
