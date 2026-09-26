// Source: src/application/billing/use-cases/MarkCollectionAccountPaidUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { MarkCollectionAccountPaidUseCase } from 'application/billing/use-cases';
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

describe('MarkCollectionAccountPaidUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: MarkCollectionAccountPaidUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    useCase = new MarkCollectionAccountPaidUseCase(
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

  it('[BIL-221] persists the PAID status and paidAt', async () => {
    const id = await seedCollectionAccount(prisma);

    const result = await useCase.execute({ id });

    expect(result.isSuccess).toBe(true);
    const row = await prisma.collectionAccount.findUniqueOrThrow({
      where: { id },
      include: { lineItems: true }
    });
    expect(row.status).toBe('PAID');
    expect(row.paidAt).not.toBeNull();
    expect(row.lineItems).toHaveLength(1);
  });

  it('[BIL-221] refuses an account that is no longer PENDING', async () => {
    const id = await seedCollectionAccount(prisma, {
      status: 'PAID'
    });

    const result = await useCase.execute({ id });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/as paid/);
    const row = await prisma.collectionAccount.findUniqueOrThrow({
      where: { id }
    });
    expect(row.status).toBe('PAID');
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
