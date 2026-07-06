import { ContractedServiceId } from 'domain/shared/ids';
import { IContractedServiceRepository } from 'domain/customers/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { ContractedServiceMapper } from '../mappers';
import {
  GetContractedServiceRequestDTO,
  ContractedServiceResponseDTO
} from '../dtos';

export class GetContractedServiceUseCase extends UseCase<
  GetContractedServiceRequestDTO,
  ContractedServiceResponseDTO
> {
  constructor(
    private readonly contractedServiceRepository: IContractedServiceRepository,
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
  ): Promise<Result<ContractedServiceResponseDTO>> {
    const idResult = ContractedServiceId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(
        `Invalid contracted service ID: ${idResult.error}`
      );
    }

    const findResult =
      await this.contractedServiceRepository.findById(idResult.value);
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Contracted service not found: ${request.id}`);
    }

    return this.ok(ContractedServiceMapper.toDTO(findResult.value));
  }
}
