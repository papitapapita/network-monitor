// Source: src/application/billing/use-cases/GetBankAccountUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetBankAccountUseCase } from 'application/billing/use-cases';
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

describe('GetBankAccountUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: GetBankAccountUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    useCase = new GetBankAccountUseCase(
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

  it('returns a stored account', async () => {
    const id = await seedBankAccount(prisma);

    const result = await useCase.execute({ id });

    expect(result.isSuccess).toBe(true);
    expect(result.value.accountNumber).toBe('39500002227');
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
