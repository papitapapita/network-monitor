import { CustomerId } from 'domain/shared/ids';
import { IContractedServiceRepository } from 'domain/customers/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { ContractedServiceMapper } from '../mappers';
import {
  ListContractedServicesQueryDTO,
  ContractedServiceListResponseDTO
} from '../dtos';

export class ListContractedServicesUseCase extends UseCase<
  ListContractedServicesQueryDTO,
  ContractedServiceListResponseDTO
> {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;

  constructor(
    private readonly contractedServiceRepository: IContractedServiceRepository,
    logger: ILogger
  ) {
    super(logger, 'ListContractedServicesUseCase');
  }

  protected async executeImpl(
    request: ListContractedServicesQueryDTO
  ): Promise<Result<ContractedServiceListResponseDTO>> {
    // When filtered by customer, return that customer's full set (no paging).
    if (request.customerId !== undefined) {
      const customerIdResult = CustomerId.parse(
        request.customerId.trim()
      );
      if (customerIdResult.isFailure) {
        return this.fail(
          `Invalid customerId: ${customerIdResult.error}`
        );
      }

      const servicesResult =
        await this.contractedServiceRepository.findByCustomerId(
          customerIdResult.value
        );
      if (servicesResult.isFailure) {
        return this.fail(servicesResult.error!);
      }

      const services = servicesResult.value;
      return this.ok(
        ContractedServiceMapper.toListDTO(
          services,
          services.length,
          services.length,
          0
        )
      );
    }

    const limit = Math.min(
      request.limit ?? ListContractedServicesUseCase.DEFAULT_LIMIT,
      ListContractedServicesUseCase.MAX_LIMIT
    );
    const offset = request.offset ?? 0;

    const servicesResult =
      await this.contractedServiceRepository.findAll(limit, offset);
    if (servicesResult.isFailure) {
      return this.fail(servicesResult.error!);
    }

    const countResult =
      await this.contractedServiceRepository.count();
    if (countResult.isFailure) {
      return this.fail(countResult.error!);
    }

    return this.ok(
      ContractedServiceMapper.toListDTO(
        servicesResult.value,
        countResult.value,
        limit,
        offset
      )
    );
  }
}
