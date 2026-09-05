import { QuotationId } from 'domain/shared/ids';
import { IQuotationRepository } from 'domain/quoting/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  IQuotationPdfRenderer,
  IImageFetcher,
  QuotationPdfLineItem
} from '../interfaces';
import {
  GetQuotationPdfRequestDTO,
  QuotationPdfResponseDTO
} from '../dtos';

export class GetQuotationPdfUseCase extends UseCase<
  GetQuotationPdfRequestDTO,
  QuotationPdfResponseDTO
> {
  constructor(
    private readonly quotationRepository: IQuotationRepository,
    private readonly pdfRenderer: IQuotationPdfRenderer,
    private readonly imageFetcher: IImageFetcher,
    logger: ILogger
  ) {
    super(logger, 'GetQuotationPdfUseCase');
  }

  protected async beforeExecute(
    request: GetQuotationPdfRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Quotation ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetQuotationPdfRequestDTO
  ): Promise<Result<QuotationPdfResponseDTO>> {
    const idResult = QuotationId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid quotation ID: ${idResult.error}`);
    }

    const findResult = await this.quotationRepository.findById(
      idResult.value
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Quotation not found: ${request.id}`);
    }
    const quotation = findResult.value;

    const lineItems: QuotationPdfLineItem[] = [];
    for (const item of quotation.lineItems) {
      lineItems.push({
        imageBuffer: await this.fetchImage(item.imageUrl),
        description: item.description,
        vendorName: item.vendorName,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toNumber(),
        lineTotal: item.lineTotal.toNumber()
      });
    }

    const renderResult = await this.pdfRenderer.render({
      quoteNumber: this.formatQuoteNumber(quotation.code),
      status: quotation.status,
      issueDate: quotation.createdAt,
      validUntil: quotation.validUntil,
      notes: quotation.notes,
      customer: {
        name: quotation.customerName,
        phone: quotation.customerPhone,
        email: quotation.customerEmail,
        address: quotation.customerAddress
      },
      lineItems,
      subtotal: quotation.subtotal.toNumber(),
      total: quotation.total.toNumber()
    });
    if (renderResult.isFailure) {
      return this.fail(renderResult.error!);
    }

    return this.ok({
      fileName: `cotizacion-${this.formatQuoteNumber(quotation.code)}.pdf`,
      content: renderResult.value
    });
  }

  private async fetchImage(
    imageUrl: string | null
  ): Promise<Buffer | null> {
    if (imageUrl === null) return null;

    const fetchResult = await this.imageFetcher.fetch(imageUrl);
    if (fetchResult.isFailure) {
      this.logger.warn('Failed to fetch quotation line item image', {
        imageUrl,
        error: fetchResult.error
      });
      return null;
    }

    return fetchResult.value;
  }

  private formatQuoteNumber(code: number | null): string {
    if (code === null) return 'DRAFT';
    return `COT-${String(code).padStart(4, '0')}`;
  }
}
