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
  ReleaseSuspensionRequestDTO,
  ReleaseSuspensionResponseDTO
} from '../dtos';

export class ReleaseSuspensionUseCase extends UseCase<
  ReleaseSuspensionRequestDTO,
  ReleaseSuspensionResponseDTO
> {
  constructor(
    private readonly routerResolver: EnforcementRouterResolver,
    private readonly routerQueueService: IRouterQueueService,
    logger: ILogger
  ) {
    super(logger, 'ReleaseSuspensionUseCase');
  }

  protected async beforeExecute(
    request: ReleaseSuspensionRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.contractedServiceId?.trim()) {
      return Result.fail('contractedServiceId is required');
    }
    return null;
  }

  protected async executeImpl(
    request: ReleaseSuspensionRequestDTO
  ): Promise<Result<ReleaseSuspensionResponseDTO>> {
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

    const queueName = suspensionQueueName(
      request.contractedServiceId
    );

    const removeResult =
      await this.routerQueueService.removeSuspensionQueue(
        connectionResult.value,
        queueName
      );
    if (removeResult.isFailure) {
      return this.fail(
        `Failed to remove suspension queue: ${removeResult.error}`
      );
    }

    this.logger.info(
      '[ReleaseSuspensionUseCase] suspension released',
      {
        contractedServiceId: request.contractedServiceId,
        queueName
      }
    );

    return this.ok({
      contractedServiceId: request.contractedServiceId,
      queueName
    });
  }
}
