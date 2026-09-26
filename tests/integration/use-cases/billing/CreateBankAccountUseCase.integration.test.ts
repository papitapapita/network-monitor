// Source: src/application/billing/use-cases/CreateBankAccountUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateBankAccountUseCase } from 'application/billing/use-cases';
import { PrismaBankAccountRepository } from 'infrastructure/billing/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanBankAccounts, seedBankAccount } from '../../helpers/db';

describe('CreateBankAccountUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: CreateBankAccountUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    useCase = new CreateBankAccountUseCase(
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

  it('persists a new account', async () => {
    const result = await useCase.execute({
      bankName: 'Bancolombia',
      accountType: 'SAVINGS',
      accountNumber: '39500002227'
    });

    expect(result.isSuccess).toBe(true);
    const row = await prisma.bankAccount.findUniqueOrThrow({
      where: { id: result.value.id }
    });
    expect(row.bankName).toBe('Bancolombia');
    expect(row.accountType).toBe('SAVINGS');
  });

  it('[BIL-261] refuses the same number at the same bank twice', async () => {
    await seedBankAccount(prisma);

    const result = await useCase.execute({
      bankName: 'Bancolombia',
      accountType: 'CHECKING',
      accountNumber: '39500002227'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/already exists/);
    expect(await prisma.bankAccount.count()).toBe(1);
  });

  it('[BIL-261] allows the same number at a different bank', async () => {
    await seedBankAccount(prisma);

    const result = await useCase.execute({
      bankName: 'Davivienda',
      accountType: 'SAVINGS',
      accountNumber: '39500002227'
    });

    expect(result.isSuccess).toBe(true);
  });
});
