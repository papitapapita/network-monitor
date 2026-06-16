import { ICustomerRepository } from 'domain/customers/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { CustomerMapper } from '../mappers';
import { ListCustomersQueryDTO, CustomerListResponseDTO } from '../dtos';

export class ListCustomersUseCase extends UseCase<
  ListCustomersQueryDTO,
  CustomerListResponseDTO
> {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;

  constructor(
    private readonly customerRepository: ICustomerRepository,
    logger: ILogger
  ) {
    super(logger, 'ListCustomersUseCase');
  }

  protected async executeImpl(
    request: ListCustomersQueryDTO
  ): Promise<Result<CustomerListResponseDTO>> {
    const limit = Math.min(
      request.limit ?? ListCustomersUseCase.DEFAULT_LIMIT,
      ListCustomersUseCase.MAX_LIMIT
    );
    const offset = request.offset ?? 0;

    const customersResult = await this.customerRepository.findAll(
      limit,
      offset
    );
    if (customersResult.isFailure) {
      return this.fail(customersResult.error!);
    }

    const countResult = await this.customerRepository.count();
    if (countResult.isFailure) {
      return this.fail(countResult.error!);
    }

    return this.ok(
      CustomerMapper.toListDTO(
        customersResult.value,
        countResult.value,
        limit,
        offset
      )
    );
  }
}
