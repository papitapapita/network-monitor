import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IRouterTrafficMonitor } from '../interfaces';
import { RouterTrafficSnapshotDTO } from '../dtos';

// Opening the live traffic page: starts reading the main routers if nobody
// was watching yet (MON-062) and answers what is known right now.
export class WatchRouterTrafficUseCase extends UseCase<
  void,
  RouterTrafficSnapshotDTO
> {
  constructor(
    private readonly monitor: IRouterTrafficMonitor,
    logger: ILogger
  ) {
    super(logger, 'WatchRouterTrafficUseCase');
  }

  protected async executeImpl(): Promise<
    Result<RouterTrafficSnapshotDTO>
  > {
    return this.monitor.watch();
  }
}
