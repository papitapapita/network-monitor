// Source: src/application/billing/use-cases/GetCollectionAccountUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetCollectionAccountUseCase } from 'application/billing/use-cases';
import { PrismaCollectionAccountRepository } from 'infrastructure/billing/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanCollectionAccounts,
  seedCollectionAccount,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('GetCollectionAccountUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: GetCollectionAccountUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    useCase = new GetCollectionAccountUseCase(
      new PrismaCollectionAccountRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCollectionAccounts(prisma);
  });

  it('returns a stored account with its line items', async () => {
    const id = await seedCollectionAccount(prisma, { quantity: 2 });

    const result = await useCase.execute({ id });

    expect(result.isSuccess).toBe(true);
    expect(result.value.id).toBe(id);
    expect(result.value.lineItems).toHaveLength(1);
    expect(result.value.total).toBe(700000);
  });

  it('fails when the account does not exist', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Collection account not found/);
  });

  it('fails on a malformed id', async () => {
    const result = await useCase.execute({ id: INVALID_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Invalid collection account ID/);
  });
});
