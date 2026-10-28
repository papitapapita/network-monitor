import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IPortSpeedTargetsQuery } from '../interfaces';
import { RouterSystemRecorder, toRouterSystemDTO } from '../services';
import { RouterSystemsResponseDTO } from '../dtos';

// MON-162: every MikroTik with what it last said about itself, from the
// scheduled check's readings; nothing is read live.
export class ListRouterSystemsUseCase extends UseCase<
  void,
  RouterSystemsResponseDTO
> {
  constructor(
    private readonly targets: IPortSpeedTargetsQuery,
    private readonly recorder: RouterSystemRecorder,
    logger: ILogger
  ) {
    super(logger, 'ListRouterSystemsUseCase');
  }

  protected async executeImpl(): Promise<
    Result<RouterSystemsResponseDTO>
  > {
    const candidates = await this.targets.listRouters();
    if (candidates.isFailure) return Result.fail(candidates.error);

    const states = await this.recorder.statesOf(candidates.value);
    if (states.isFailure) return Result.fail(states.error);

    return this.ok({
      routers: candidates.value.map((c) =>
        toRouterSystemDTO(c, states.value.get(c.deviceId) ?? null)
      )
    });
  }
}
