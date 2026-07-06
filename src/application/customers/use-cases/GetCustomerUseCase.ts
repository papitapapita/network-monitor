import { CustomerId } from 'domain/shared/ids';
import { ICustomerRepository } from 'domain/customers/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { CustomerMapper } from '../mappers';
import { GetCustomerRequestDTO, CustomerResponseDTO } from '../dtos';

export class GetCustomerUseCase extends UseCase<
  GetCustomerRequestDTO,
  CustomerResponseDTO
> {
  constructor(
    private readonly customerRepository: ICustomerRepository,
    logger: ILogger
  ) {
    super(logger, 'GetCustomerUseCase');
  }

  protected async beforeExecute(
    request: GetCustomerRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Customer ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetCustomerRequestDTO
  ): Promise<Result<CustomerResponseDTO>> {
    const idResult = CustomerId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid customer ID: ${idResult.error}`);
    }

    const findResult = await this.customerRepository.findById(
      idResult.value
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Customer not found: ${request.id}`);
    }

    return this.ok(CustomerMapper.toDTO(findResult.value));
  }
}
