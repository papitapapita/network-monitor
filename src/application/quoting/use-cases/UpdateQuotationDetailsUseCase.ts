import { IQuotationRepository } from 'domain/quoting/repository';
import { QuotationId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { QuotationMapper } from '../mappers';
import {
  UpdateQuotationDetailsRequestDTO,
  QuotationResponseDTO
} from '../dtos';

export class UpdateQuotationDetailsUseCase extends UseCase<
  UpdateQuotationDetailsRequestDTO,
  QuotationResponseDTO
> {
  constructor(
    private readonly quotationRepository: IQuotationRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateQuotationDetailsUseCase');
  }

  protected async beforeExecute(
    request: UpdateQuotationDetailsRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Quotation ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: UpdateQuotationDetailsRequestDTO
  ): Promise<Result<QuotationResponseDTO>> {
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

    let validUntil: Date | undefined;
    if (request.validUntil !== undefined) {
      validUntil = new Date(request.validUntil);
      if (isNaN(validUntil.getTime())) {
        return this.fail('validUntil is not a valid date');
      }
    }

    const updateResult = quotation.updateDetails({
      validUntil,
      notes: request.notes,
      customerName: request.customerName,
      customerPhone: request.customerPhone,
      customerEmail: request.customerEmail,
      customerAddress: request.customerAddress
    });
    if (updateResult.isFailure) {
      return this.fail(updateResult.error!);
    }

    const saveResult = await this.quotationRepository.save(quotation);
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist quotation: ${saveResult.error}`
      );
    }

    return this.ok(QuotationMapper.toDTO(saveResult.value));
  }
}
