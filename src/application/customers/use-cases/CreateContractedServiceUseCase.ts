import {
  CustomerId,
  ServicePlanId,
  DeviceId
} from 'domain/shared/ids';
import { ContractedService } from 'domain/customers';
import {
  ICustomerRepository,
  IServicePlanRepository,
  IContractedServiceRepository
} from 'domain/customers/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { ContractedServiceMapper } from '../mappers';
import {
  CreateContractedServiceRequestDTO,
  ContractedServiceResponseDTO
} from '../dtos';

export class CreateContractedServiceUseCase extends UseCase<
  CreateContractedServiceRequestDTO,
  ContractedServiceResponseDTO
> {
  constructor(
    private readonly contractedServiceRepository: IContractedServiceRepository,
    private readonly customerRepository: ICustomerRepository,
    private readonly servicePlanRepository: IServicePlanRepository,
    logger: ILogger
  ) {
    super(logger, 'CreateContractedServiceUseCase');
  }

  protected async beforeExecute(
    request: CreateContractedServiceRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.customerId || request.customerId.trim().length === 0) {
      return Result.fail('customerId is required');
    }
    if (
      !request.servicePlanId ||
      request.servicePlanId.trim().length === 0
    ) {
      return Result.fail('servicePlanId is required');
    }
    return null;
  }

  protected async executeImpl(
    request: CreateContractedServiceRequestDTO
  ): Promise<Result<ContractedServiceResponseDTO>> {
    const customerIdResult = CustomerId.parse(
      request.customerId.trim()
    );
    if (customerIdResult.isFailure) {
      return this.fail(`Invalid customerId: ${customerIdResult.error}`);
    }

    const servicePlanIdResult = ServicePlanId.parse(
      request.servicePlanId.trim()
    );
    if (servicePlanIdResult.isFailure) {
      return this.fail(
        `Invalid servicePlanId: ${servicePlanIdResult.error}`
      );
    }

    const startDateResult = this.parseStartDate(request.startDate);
    if (startDateResult.isFailure) {
      return this.fail(startDateResult.error!);
    }

    const customerExists = await this.customerRepository.exists(
      customerIdResult.value
    );
    if (customerExists.isFailure) {
      return this.fail(customerExists.error!);
    }
    if (!customerExists.value) {
      return this.fail(`Customer not found: ${request.customerId}`);
    }

    const planExists = await this.servicePlanRepository.exists(
      servicePlanIdResult.value
    );
    if (planExists.isFailure) {
      return this.fail(planExists.error!);
    }
    if (!planExists.value) {
      return this.fail(
        `Service plan not found: ${request.servicePlanId}`
      );
    }

    let deviceId: DeviceId | null = null;
    if (request.deviceId !== undefined && request.deviceId !== null) {
      const deviceIdResult = DeviceId.parse(request.deviceId.trim());
      if (deviceIdResult.isFailure) {
        return this.fail(`Invalid deviceId: ${deviceIdResult.error}`);
      }
      deviceId = deviceIdResult.value;

      const deviceTaken = await this.ensureDeviceFree(deviceId);
      if (deviceTaken.isFailure) {
        return this.fail(deviceTaken.error!);
      }
    }

    const serviceResult = ContractedService.create({
      customerId: customerIdResult.value,
      servicePlanId: servicePlanIdResult.value,
      deviceId,
      startDate: startDateResult.value
    });
    if (serviceResult.isFailure) {
      return this.fail(serviceResult.error!);
    }

    const saveResult = await this.contractedServiceRepository.save(
      serviceResult.value
    );
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist contracted service: ${saveResult.error}`
      );
    }

    return this.ok(ContractedServiceMapper.toDTO(saveResult.value));
  }

  private parseStartDate(value?: string): Result<Date> {
    if (value === undefined) {
      return Result.ok(new Date());
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return Result.fail('startDate is not a valid date');
    }
    return Result.ok(date);
  }

  private async ensureDeviceFree(
    deviceId: DeviceId
  ): Promise<Result<void>> {
    const existing =
      await this.contractedServiceRepository.findByDeviceId(deviceId);
    if (existing.isFailure) return Result.fail(existing.error!);
    if (existing.value !== null) {
      return Result.fail(
        'This device is already assigned to another contracted service'
      );
    }
    return Result.ok();
  }
}
