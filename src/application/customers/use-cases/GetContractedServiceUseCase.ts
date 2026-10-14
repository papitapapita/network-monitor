import { ContractedServiceId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IContractedServiceDetailQuery } from '../interfaces';
import {
  GetContractedServiceRequestDTO,
  ContractedServiceDetailDTO
} from '../dtos';

export class GetContractedServiceUseCase extends UseCase<
  GetContractedServiceRequestDTO,
  ContractedServiceDetailDTO
> {
  constructor(
    private readonly contractedServiceDetailQuery: IContractedServiceDetailQuery,
    logger: ILogger
  ) {
    super(logger, 'GetContractedServiceUseCase');
  }

  protected async beforeExecute(
    request: GetContractedServiceRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Contracted service ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetContractedServiceRequestDTO
  ): Promise<Result<ContractedServiceDetailDTO>> {
    const idResult = ContractedServiceId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(
        `Invalid contracted service ID: ${idResult.error}`
      );
    }

    const findResult =
      await this.contractedServiceDetailQuery.findById(
        idResult.value
      );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Contracted service not found: ${request.id}`);
    }

    return this.ok(findResult.value);
  }
}
