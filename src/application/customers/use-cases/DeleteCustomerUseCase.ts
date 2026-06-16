import { CustomerId } from 'domain/shared/ids';
import {
  ICustomerRepository,
  IContractedServiceRepository
} from 'domain/customers/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { DeleteCustomerRequestDTO } from '../dtos';

export class DeleteCustomerUseCase extends UseCase<
  DeleteCustomerRequestDTO,
  void
> {
  constructor(
    private readonly customerRepository: ICustomerRepository,
    private readonly contractedServiceRepository: IContractedServiceRepository,
    logger: ILogger
  ) {
    super(logger, 'DeleteCustomerUseCase');
  }

  protected async beforeExecute(
    request: DeleteCustomerRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Customer ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: DeleteCustomerRequestDTO
  ): Promise<Result<void>> {
    const idResult = CustomerId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid customer ID: ${idResult.error}`);
    }

    const customerId = idResult.value;

    const findResult =
      await this.customerRepository.findById(customerId);
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Customer not found: ${request.id}`);
    }

    // Guard: cannot delete a customer that still has contracted services
    const servicesResult =
      await this.contractedServiceRepository.findByCustomerId(
        customerId
      );
    if (servicesResult.isFailure) {
      return this.fail(servicesResult.error!);
    }
    if (servicesResult.value.length > 0) {
      return this.fail(
        `Cannot delete customer: they have ${servicesResult.value.length} contracted service(s). Remove all contracted services first.`
      );
    }

    const deleteResult =
      await this.customerRepository.delete(customerId);
    if (deleteResult.isFailure) {
      return this.fail(deleteResult.error!);
    }

    return this.ok(undefined);
  }
}
