import { ICollectionAccountRepository } from 'domain/billing/repository';
import { CollectionAccountId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { CollectionAccountMapper } from '../mappers';
import { ICollectionAccountPdfRenderer } from '../interfaces';
import {
  GetCollectionAccountPdfRequestDTO,
  CollectionAccountPdfResponseDTO
} from '../dtos';

export class GetCollectionAccountPdfUseCase extends UseCase<
  GetCollectionAccountPdfRequestDTO,
  CollectionAccountPdfResponseDTO
> {
  constructor(
    private readonly collectionAccountRepository: ICollectionAccountRepository,
    private readonly pdfRenderer: ICollectionAccountPdfRenderer,
    logger: ILogger
  ) {
    super(logger, 'GetCollectionAccountPdfUseCase');
  }

  protected async beforeExecute(
    request: GetCollectionAccountPdfRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Collection account ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetCollectionAccountPdfRequestDTO
  ): Promise<Result<CollectionAccountPdfResponseDTO>> {
    const idResult = CollectionAccountId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(
        `Invalid collection account ID: ${idResult.error}`
      );
    }

    const findResult =
      await this.collectionAccountRepository.findById(idResult.value);
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Collection account not found: ${request.id}`);
    }
    const collectionAccount = findResult.value;

    // Only unsaved aggregates lack a code, and this one came from the store.
    const number = CollectionAccountMapper.formatNumber(
      collectionAccount.code
    )!;

    const renderResult = await this.pdfRenderer.render({
      number,
      status: collectionAccount.status,
      issueDate: collectionAccount.issueDate,
      dueDate: collectionAccount.dueDate,
      notes: collectionAccount.notes,
      customer: {
        name: collectionAccount.customerName,
        document: collectionAccount.customerDocument,
        phone: collectionAccount.customerPhone,
        email: collectionAccount.customerEmail,
        address: collectionAccount.customerAddress
      },
      lineItems: collectionAccount.lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toNumber(),
        lineTotal: item.lineTotal.toNumber()
      })),
      total: collectionAccount.total.toNumber()
    });
    if (renderResult.isFailure) {
      return this.fail(renderResult.error!);
    }

    return this.ok({
      fileName: `cuenta-de-cobro-${number}.pdf`,
      content: renderResult.value
    });
  }
}
