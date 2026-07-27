import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  IRouterQueueService,
  SUSPENSION_QUEUE_PREFIX
} from '../interfaces';
import { EnforcementRouterResolver } from '../services';
import { ListSuspensionEnforcementsResponseDTO } from '../dtos';

export class ListSuspensionEnforcementsUseCase extends UseCase<
  Record<string, never>,
  ListSuspensionEnforcementsResponseDTO
> {
  constructor(
    private readonly routerResolver: EnforcementRouterResolver,
    private readonly routerQueueService: IRouterQueueService,
    logger: ILogger
  ) {
    super(logger, 'ListSuspensionEnforcementsUseCase');
  }

  protected async executeImpl(): Promise<
    Result<ListSuspensionEnforcementsResponseDTO>
  > {
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

    return this.ok({
      checkedAt: new Date().toISOString(),
      enforcements: queuesResult.value.map((queue) => ({
        contractedServiceId: queue.name.slice(
          SUSPENSION_QUEUE_PREFIX.length
        ),
        targetIp: queue.targetIp
      }))
    });
  }
}
