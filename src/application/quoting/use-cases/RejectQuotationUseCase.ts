import { IQuotationRepository } from 'domain/quoting/repository';
import { QuotationId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { QuotationMapper } from '../mappers';
import {
  RejectQuotationRequestDTO,
  QuotationResponseDTO
} from '../dtos';

export class RejectQuotationUseCase extends UseCase<
  RejectQuotationRequestDTO,
  QuotationResponseDTO
> {
  constructor(
    private readonly quotationRepository: IQuotationRepository,
    logger: ILogger
  ) {
    super(logger, 'RejectQuotationUseCase');
  }

  protected async beforeExecute(
    request: RejectQuotationRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Quotation ID is required');
    }
    if (!request.reason || request.reason.trim().length === 0) {
      return Result.fail(
        'A reason is required to reject a quotation'
      );
    }
    return null;
  }

  protected async executeImpl(
    request: RejectQuotationRequestDTO
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
    const rejectResult = quotation.reject(request.reason);
    if (rejectResult.isFailure) {
      return this.fail(rejectResult.error!);
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
