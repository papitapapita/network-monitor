// Source: src/application/billing/use-cases/GetCollectionAccountPdfUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetCollectionAccountPdfUseCase } from 'application/billing/use-cases';
import { PrismaCollectionAccountRepository } from 'infrastructure/billing/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { PdfKitCollectionAccountPdfRenderer } from 'infrastructure/billing/services';
import {
  cleanCollectionAccounts,
  seedCollectionAccount,
  GHOST_ID
} from '../../helpers/db';

describe('GetCollectionAccountPdfUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: GetCollectionAccountPdfUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    useCase = new GetCollectionAccountPdfUseCase(
      new PrismaCollectionAccountRepository(prisma),
      new PdfKitCollectionAccountPdfRenderer(),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCollectionAccounts(prisma);
  });

  it('[BIL-230] renders a PDF named after the stored sequence number', async () => {
    const id = await seedCollectionAccount(prisma);
    const { code } = await prisma.collectionAccount.findUniqueOrThrow(
      {
        where: { id }
      }
    );

    const result = await useCase.execute({ id });

    expect(result.isSuccess).toBe(true);
    expect(result.value.content.subarray(0, 4).toString()).toBe(
      '%PDF'
    );
    expect(result.value.fileName).toBe(
      `cuenta-de-cobro-CC-${String(code).padStart(4, '0')}.pdf`
    );
  });

  it('[BIL-231] renders a cancelled account', async () => {
    const id = await seedCollectionAccount(prisma, {
      status: 'CANCELLED'
    });

    const result = await useCase.execute({ id });

    expect(result.isSuccess).toBe(true);
  });

  it('fails when the account does not exist', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Collection account not found/);
  });
});
