import { ContractedServiceId } from 'domain/shared/ids';
import { IContractedServiceRepository } from 'domain/customers/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { DeleteContractedServiceRequestDTO } from '../dtos';

export class DeleteContractedServiceUseCase extends UseCase<
  DeleteContractedServiceRequestDTO,
  void
> {
  constructor(
    private readonly contractedServiceRepository: IContractedServiceRepository,
    logger: ILogger
  ) {
    super(logger, 'DeleteContractedServiceUseCase');
  }

  protected async beforeExecute(
    request: DeleteContractedServiceRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Contracted service ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: DeleteContractedServiceRequestDTO
  ): Promise<Result<void>> {
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

    const deleteResult =
      await this.contractedServiceRepository.delete(idResult.value);
    if (deleteResult.isFailure) {
      return this.fail(deleteResult.error!);
    }

    return this.ok(undefined);
  }
}
