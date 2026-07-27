import { Result } from 'domain/shared/core';
import { ContractedServiceId } from 'domain/shared/ids';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  IRouterQueueService,
  suspensionQueueName
} from '../interfaces';
import { EnforcementRouterResolver } from '../services';
import {
  GetServiceEnforcementRequestDTO,
  GetServiceEnforcementResponseDTO
} from '../dtos';

export class GetServiceEnforcementStatusUseCase extends UseCase<
  GetServiceEnforcementRequestDTO,
  GetServiceEnforcementResponseDTO
> {
  constructor(
    private readonly routerResolver: EnforcementRouterResolver,
    private readonly routerQueueService: IRouterQueueService,
    logger: ILogger
  ) {
    super(logger, 'GetServiceEnforcementStatusUseCase');
  }

  protected async beforeExecute(
    request: GetServiceEnforcementRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.contractedServiceId?.trim()) {
      return Result.fail('contractedServiceId is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetServiceEnforcementRequestDTO
  ): Promise<Result<GetServiceEnforcementResponseDTO>> {
    const serviceIdResult = ContractedServiceId.parse(
      request.contractedServiceId
    );
    if (serviceIdResult.isFailure) {
      return this.fail(
        `Invalid contracted service ID: ${serviceIdResult.error}`
      );
    }

    const connectionResult = await this.routerResolver.resolve();
    if (connectionResult.isFailure) {
      return this.fail(connectionResult.error!);
    }

    const queuesResult =
      await this.routerQueueService.listSuspensionQueues(
        connectionResult.value
      );
    if (queuesResult.isFailure) {
      return this.fail(queuesResult.error!);
    }

    const queueName = suspensionQueueName(
      request.contractedServiceId
    );
    const queue = queuesResult.value.find(
      (q) => q.name === queueName
    );

    return this.ok({
      contractedServiceId: request.contractedServiceId,
      enforced: queue !== undefined,
      targetIp: queue?.targetIp ?? null,
      checkedAt: new Date().toISOString()
    });
  }
}
