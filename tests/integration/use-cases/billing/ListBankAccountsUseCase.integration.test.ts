// Source: src/application/billing/use-cases/ListBankAccountsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ListBankAccountsUseCase } from 'application/billing/use-cases';
import { PrismaBankAccountRepository } from 'infrastructure/billing/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanBankAccounts, seedBankAccount } from '../../helpers/db';

describe('ListBankAccountsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ListBankAccountsUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    useCase = new ListBankAccountsUseCase(
      new PrismaBankAccountRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanBankAccounts(prisma);
  });

  it('[BIL-264] lists accounts oldest first with labels', async () => {
    await seedBankAccount(prisma);
    await seedBankAccount(prisma, {
      bankName: 'Davivienda',
      accountType: 'CHECKING',
      accountNumber: '4567-8901'
    });

    const result = await useCase.execute();

    expect(result.isSuccess).toBe(true);
    expect(result.value.bankAccounts.map((a) => a.label)).toEqual([
      'Bancolombia · Ahorros · 39500002227',
      'Davivienda · Corriente · 4567-8901'
    ]);
  });

  it('returns an empty list when none exist', async () => {
    const result = await useCase.execute();

    expect(result.value.bankAccounts).toEqual([]);
  });
});
