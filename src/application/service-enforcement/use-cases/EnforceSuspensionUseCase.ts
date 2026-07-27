import { Result } from 'domain/shared/core';
import { ContractedServiceId } from 'domain/shared/ids';
import { IContractedServiceRepository } from 'domain/customers/repository';
import { ContractedServiceStatus } from 'domain/customers/enums';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  IRouterQueueService,
  suspensionQueueName
} from '../interfaces';
import { EnforcementRouterResolver } from '../services';
import {
  EnforceSuspensionRequestDTO,
  EnforceSuspensionResponseDTO
} from '../dtos';

export class EnforceSuspensionUseCase extends UseCase<
  EnforceSuspensionRequestDTO,
  EnforceSuspensionResponseDTO
> {
  constructor(
    private readonly contractedServiceRepo: IContractedServiceRepository,
    private readonly deviceRepo: IDeviceRepository,
    private readonly routerResolver: EnforcementRouterResolver,
    private readonly routerQueueService: IRouterQueueService,
    logger: ILogger
  ) {
    super(logger, 'EnforceSuspensionUseCase');
  }

  protected async beforeExecute(
    request: EnforceSuspensionRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.contractedServiceId?.trim()) {
      return Result.fail('contractedServiceId is required');
    }
    return null;
  }

  protected async executeImpl(
    request: EnforceSuspensionRequestDTO
  ): Promise<Result<EnforceSuspensionResponseDTO>> {
    const serviceIdResult = ContractedServiceId.parse(
      request.contractedServiceId
    );
    if (serviceIdResult.isFailure) {
      return this.fail(
        `Invalid contracted service ID: ${serviceIdResult.error}`
      );
    }

    const serviceResult = await this.contractedServiceRepo.findById(
      serviceIdResult.value
    );
    if (serviceResult.isFailure) {
      return this.fail(
        `Failed to load contracted service: ${serviceResult.error}`
      );
    }
    const service = serviceResult.value;
    if (!service) {
      return this.fail('Contracted service not found');
    }

    if (service.status !== ContractedServiceStatus.SUSPENDED) {
      return this.fail(
        'Contracted service is not suspended — nothing to enforce'
      );
    }

    if (!service.deviceId) {
      return this.fail(
        'Contracted service has no device assigned — cannot resolve customer IP'
      );
    }

    const deviceResult = await this.deviceRepo.findById(
      service.deviceId
    );
    if (deviceResult.isFailure) {
      return this.fail(
        `Failed to load customer device: ${deviceResult.error}`
      );
    }
    const device = deviceResult.value;
    if (!device) {
      return this.fail('Customer device not found');
    }
    if (!device.ipAddress) {
      return this.fail('Customer device has no IP address');
    }

    const connectionResult = await this.routerResolver.resolve();
    if (connectionResult.isFailure) {
      return this.fail(connectionResult.error!);
    }

    const queueName = suspensionQueueName(
      request.contractedServiceId
    );
    const targetIp = device.ipAddress.value;

    const addResult =
      await this.routerQueueService.addSuspensionQueue(
        connectionResult.value,
        { name: queueName, targetIp }
      );
    if (addResult.isFailure) {
      return this.fail(
        `Failed to add suspension queue: ${addResult.error}`
      );
    }

    this.logger.info(
      '[EnforceSuspensionUseCase] suspension enforced',
      {
        contractedServiceId: request.contractedServiceId,
        queueName,
        targetIp
      }
    );

    return this.ok({
      contractedServiceId: request.contractedServiceId,
      queueName,
      targetIp
    });
  }
}
