// Source: src/application/quoting/use-cases/GetQuotationPdfUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetQuotationPdfUseCase } from 'application/quoting/use-cases';
import { PrismaQuotationRepository } from 'infrastructure/quoting/repositories';
import { PdfKitQuotationPdfRenderer } from 'infrastructure/quoting/services';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanQuotations,
  cleanBills,
  cleanCustomers,
  cleanCatalog,
  seedDeviceModel,
  seedQuotation,
  GHOST_ID
} from '../../helpers/db';
import { FakeImageFetcher } from '../../helpers/FakeImageFetcher';

describe('GetQuotationPdfUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let imageFetcher: FakeImageFetcher;
  let useCase: GetQuotationPdfUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanQuotations(prisma);
    await cleanBills(prisma);
    await cleanCustomers(prisma);
    await cleanCatalog(prisma);

    imageFetcher = new FakeImageFetcher();
    useCase = new GetQuotationPdfUseCase(
      new PrismaQuotationRepository(prisma),
      new PdfKitQuotationPdfRenderer(),
      imageFetcher,
      new WinstonLogger()
    );

    deviceModelId = await seedDeviceModel(prisma, {
      imageUrl: 'https://example.com/router.jpg'
    });
  });

  it('renders a PDF buffer for an existing quotation', async () => {
    const quotationId = await seedQuotation(prisma, deviceModelId);

    const result = await useCase.execute({ id: quotationId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.content.subarray(0, 4).toString()).toBe(
      '%PDF'
    );
    expect(result.value.fileName).toMatch(/^cotizacion-.*\.pdf$/);
  });

  it('fetches the line item image when imageUrl is present', async () => {
    const quotationId = await seedQuotation(prisma, deviceModelId);

    await useCase.execute({ id: quotationId });

    expect(imageFetcher.callCount).toBe(1);
    expect(imageFetcher.lastUrl).toBe(
      'https://example.com/router.jpg'
    );
  });

  it('still renders a PDF when the image fetch fails', async () => {
    imageFetcher.setShouldFail(true);
    const quotationId = await seedQuotation(prisma, deviceModelId);

    const result = await useCase.execute({ id: quotationId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.content.length).toBeGreaterThan(0);
  });

  it('fails when the quotation does not exist', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Quotation not found/i);
  });
});
