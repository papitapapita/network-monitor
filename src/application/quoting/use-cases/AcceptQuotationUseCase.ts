import { IQuotationRepository } from 'domain/quoting/repository';
import { QuotationId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { QuotationMapper } from '../mappers';
import {
  AcceptQuotationRequestDTO,
  QuotationResponseDTO
} from '../dtos';

export class AcceptQuotationUseCase extends UseCase<
  AcceptQuotationRequestDTO,
  QuotationResponseDTO
> {
  constructor(
    private readonly quotationRepository: IQuotationRepository,
    logger: ILogger
  ) {
    super(logger, 'AcceptQuotationUseCase');
  }

  protected async beforeExecute(
    request: AcceptQuotationRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Quotation ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: AcceptQuotationRequestDTO
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
    const acceptResult = quotation.accept();
    if (acceptResult.isFailure) {
      return this.fail(acceptResult.error!);
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
