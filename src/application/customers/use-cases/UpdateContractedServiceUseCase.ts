import {
  ContractedServiceId,
  ServicePlanId,
  DeviceId
} from 'domain/shared/ids';
import {
  ContractedService,
  ContractedServiceStatus
} from 'domain/customers';
import {
  IServicePlanRepository,
  IContractedServiceRepository
} from 'domain/customers/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { ContractedServiceMapper } from '../mappers';
import {
  UpdateContractedServiceRequestDTO,
  ContractedServiceResponseDTO
} from '../dtos';

export class UpdateContractedServiceUseCase extends UseCase<
  UpdateContractedServiceRequestDTO,
  ContractedServiceResponseDTO
> {
  constructor(
    private readonly contractedServiceRepository: IContractedServiceRepository,
    private readonly servicePlanRepository: IServicePlanRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateContractedServiceUseCase');
  }

  protected async beforeExecute(
    request: UpdateContractedServiceRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Contracted service ID is required');
    }
    if (request.status !== undefined) {
      const target = request.status.toUpperCase();
      const allowed = ['ACTIVE', 'SUSPENDED', 'CANCELLED'];
      if (!allowed.includes(target)) {
        return Result.fail(
          `Invalid target status "${request.status}". Allowed: ${allowed.join(', ')}`
        );
      }
    }
    return null;
  }

  protected async executeImpl(
    request: UpdateContractedServiceRequestDTO
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

    const service = findResult.value;
    const targetStatus = request.status?.toUpperCase() as
      | ContractedServiceStatus
      | undefined;

    // 1. Change plan
    if (request.servicePlanId !== undefined) {
      const applied = await this.applyPlanChange(
        service,
        request.servicePlanId
      );
      if (applied.isFailure) return this.fail(applied.error!);
    }

    // 2. Deactivating transition before a device change, so the device of an
    //    active service can be released after suspending it.
    if (targetStatus === ContractedServiceStatus.SUSPENDED) {
      const suspended = service.suspend();
      if (suspended.isFailure) return this.fail(suspended.error!);
    }

    // 3. Device assignment (string) or release (null)
    if (request.deviceId !== undefined) {
      const applied = await this.applyDeviceChange(
        service,
        request.deviceId
      );
      if (applied.isFailure) return this.fail(applied.error!);
    }

    // 4. Activating transition after the device is in place
    if (targetStatus === ContractedServiceStatus.ACTIVE) {
      const activated = service.activate();
      if (activated.isFailure) return this.fail(activated.error!);
    }

    // 5. Cancellation last — it is terminal
    if (targetStatus === ContractedServiceStatus.CANCELLED) {
      const cancelled = service.cancel();
      if (cancelled.isFailure) return this.fail(cancelled.error!);
    }

    const saveResult =
      await this.contractedServiceRepository.save(service);
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist contracted service: ${saveResult.error}`
      );
    }

    return this.ok(ContractedServiceMapper.toDTO(saveResult.value));
  }

  private async applyPlanChange(
    service: ContractedService,
    rawServicePlanId: string
  ): Promise<Result<void>> {
    const planIdResult = ServicePlanId.parse(rawServicePlanId.trim());
    if (planIdResult.isFailure) {
      return Result.fail(
        `Invalid servicePlanId: ${planIdResult.error}`
      );
    }

    const planExists = await this.servicePlanRepository.exists(
      planIdResult.value
    );
    if (planExists.isFailure) return Result.fail(planExists.error!);
    if (!planExists.value) {
      return Result.fail(
        `Service plan not found: ${rawServicePlanId}`
      );
    }

    return service.changePlan(planIdResult.value);
  }

  private async applyDeviceChange(
    service: ContractedService,
    rawDeviceId: string | null
  ): Promise<Result<void>> {
    if (rawDeviceId === null) {
      return service.releaseDevice();
    }

    const deviceIdResult = DeviceId.parse(rawDeviceId.trim());
    if (deviceIdResult.isFailure) {
      return Result.fail(`Invalid deviceId: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const existing =
      await this.contractedServiceRepository.findByDeviceId(deviceId);
    if (existing.isFailure) return Result.fail(existing.error!);
    if (
      existing.value !== null &&
      !existing.value.id.equals(service.id)
    ) {
      return Result.fail(
        'This device is already assigned to another contracted service'
      );
    }

    return service.assignDevice(deviceId);
  }
}
