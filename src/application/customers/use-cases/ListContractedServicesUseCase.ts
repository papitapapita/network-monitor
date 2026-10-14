import { CustomerId, DeviceId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  ContractedServiceDetailCriteria,
  IContractedServiceDetailQuery
} from '../interfaces';
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
    private readonly contractedServiceDetailQuery: IContractedServiceDetailQuery,
    logger: ILogger
  ) {
    super(logger, 'ListContractedServicesUseCase');
  }

  protected async executeImpl(
    request: ListContractedServicesQueryDTO
  ): Promise<Result<ContractedServiceListResponseDTO>> {
    const criteria: ContractedServiceDetailCriteria = {};

    if (request.customerId !== undefined) {
      const customerIdResult = CustomerId.parse(
        request.customerId.trim()
      );
      if (customerIdResult.isFailure) {
        return this.fail(
          `Invalid customerId: ${customerIdResult.error}`
        );
      }
      criteria.customerId = customerIdResult.value;
    }

    if (request.deviceId !== undefined) {
      const deviceIdResult = DeviceId.parse(request.deviceId.trim());
      if (deviceIdResult.isFailure) {
        return this.fail(`Invalid deviceId: ${deviceIdResult.error}`);
      }
      criteria.deviceId = deviceIdResult.value;
    }

    // Filtered by customer or device, return the full set (no paging).
    if (
      criteria.customerId !== undefined ||
      criteria.deviceId !== undefined
    ) {
      const servicesResult =
        await this.contractedServiceDetailQuery.list(criteria);
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
      await this.contractedServiceDetailQuery.list({
        limit,
        offset
      });
    if (servicesResult.isFailure) {
      return this.fail(servicesResult.error!);
    }

    const countResult = await this.contractedServiceDetailQuery.count(
      {}
    );
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
