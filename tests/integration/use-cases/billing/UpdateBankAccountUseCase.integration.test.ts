// Source: src/application/billing/use-cases/UpdateBankAccountUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { UpdateBankAccountUseCase } from 'application/billing/use-cases';
import { PrismaBankAccountRepository } from 'infrastructure/billing/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanBankAccounts,
  seedBankAccount,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('UpdateBankAccountUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: UpdateBankAccountUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    useCase = new UpdateBankAccountUseCase(
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

  it('persists the changed fields', async () => {
    const id = await seedBankAccount(prisma);

    const result = await useCase.execute({
      id,
      accountType: 'CHECKING',
      accountNumber: '11122233344'
    });

    expect(result.isSuccess).toBe(true);
    const row = await prisma.bankAccount.findUniqueOrThrow({
      where: { id }
    });
    expect(row.accountType).toBe('CHECKING');
    expect(row.accountNumber).toBe('11122233344');
    expect(row.bankName).toBe('Bancolombia');
  });

  it('[BIL-261] refuses to collide with another account', async () => {
    await seedBankAccount(prisma);
    const id = await seedBankAccount(prisma, {
      accountNumber: '222222'
    });

    const result = await useCase.execute({
      id,
      accountNumber: '39500002227'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/already exists/);
  });

  it('fails when the account does not exist', async () => {
    const result = await useCase.execute({
      id: GHOST_ID,
      bankName: 'Davivienda'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Bank account not found/);
  });

  it('fails on a malformed id', async () => {
    const result = await useCase.execute({ id: INVALID_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Invalid bank account ID/);
  });
});
