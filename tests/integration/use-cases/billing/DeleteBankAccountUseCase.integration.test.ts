// Source: src/application/billing/use-cases/DeleteBankAccountUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { DeleteBankAccountUseCase } from 'application/billing/use-cases';
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

describe('DeleteBankAccountUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: DeleteBankAccountUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    useCase = new DeleteBankAccountUseCase(
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

  it('removes the account', async () => {
    const id = await seedBankAccount(prisma);

    const result = await useCase.execute({ id });

    expect(result.isSuccess).toBe(true);
    expect(await prisma.bankAccount.count()).toBe(0);
  });

  it('fails when the account does not exist', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Bank account not found/);
  });

  it('fails on a malformed id', async () => {
    const result = await useCase.execute({ id: INVALID_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Invalid bank account ID/);
  });
});
