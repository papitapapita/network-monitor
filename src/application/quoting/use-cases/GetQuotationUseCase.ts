import { IQuotationRepository } from 'domain/quoting/repository';
import { QuotationId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { QuotationMapper } from '../mappers';
import {
  GetQuotationRequestDTO,
  QuotationResponseDTO
} from '../dtos';

export class GetQuotationUseCase extends UseCase<
  GetQuotationRequestDTO,
  QuotationResponseDTO
> {
  constructor(
    private readonly quotationRepository: IQuotationRepository,
    logger: ILogger
  ) {
    super(logger, 'GetQuotationUseCase');
  }

  protected async beforeExecute(
    request: GetQuotationRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Quotation ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetQuotationRequestDTO
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

    return this.ok(QuotationMapper.toDTO(findResult.value));
  }
}
