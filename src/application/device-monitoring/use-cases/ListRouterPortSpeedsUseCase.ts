import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IPortSpeedTargetsQuery } from '../interfaces';
import { RouterPortInspector } from '../services';
import { PortSpeedsResponseDTO } from '../dtos';

// MON-140: every MikroTik's ports, read live and judged against the speed
// each one should link at.
export class ListRouterPortSpeedsUseCase extends UseCase<
  void,
  PortSpeedsResponseDTO
> {
  constructor(
    private readonly targets: IPortSpeedTargetsQuery,
    private readonly inspector: RouterPortInspector,
    logger: ILogger,
    private readonly clock: () => Date = () => new Date()
  ) {
    super(logger, 'ListRouterPortSpeedsUseCase');
  }

  protected async executeImpl(): Promise<
    Result<PortSpeedsResponseDTO>
  > {
    const candidates = await this.targets.listRouters();
    if (candidates.isFailure) return Result.fail(candidates.error);

    const routers = await this.inspector.inspect(candidates.value);
    if (routers.isFailure) return Result.fail(routers.error);

    return this.ok({
      checkedAt: this.clock().toISOString(),
      routers: routers.value
    });
  }
}
