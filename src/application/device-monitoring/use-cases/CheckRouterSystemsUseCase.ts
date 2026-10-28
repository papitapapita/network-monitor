import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IPortSpeedTargetsQuery } from '../interfaces';
import { RouterSystemRecorder } from '../services';
import {
  CheckRouterSystemsRequestDTO,
  CheckRouterSystemsResultDTO,
  RouterSystemCheckSkipDTO
} from '../dtos';

// MON-161: the scheduled read of every MikroTik's identity, hardware,
// versions and health.
export class CheckRouterSystemsUseCase extends UseCase<
  CheckRouterSystemsRequestDTO,
  CheckRouterSystemsResultDTO
> {
  constructor(
    private readonly targets: IPortSpeedTargetsQuery,
    private readonly recorder: RouterSystemRecorder,
    logger: ILogger
  ) {
    super(logger, 'CheckRouterSystemsUseCase');
  }

  protected async executeImpl(
    request: CheckRouterSystemsRequestDTO
  ): Promise<Result<CheckRouterSystemsResultDTO>> {
    const candidates = await this.targets.listRouters();
    if (candidates.isFailure) return Result.fail(candidates.error);

    const recorded = await this.recorder.record(
      candidates.value,
      request.now
    );
    if (recorded.isFailure) return Result.fail(recorded.error);

    const skipped: RouterSystemCheckSkipDTO[] = [];
    const failed: RouterSystemCheckSkipDTO[] = [];
    let routersRead = 0;
    for (const { candidate, state, reason } of recorded.value) {
      const who = {
        deviceId: candidate.deviceId,
        name: candidate.deviceName
      };
      if (reason !== null) skipped.push({ ...who, why: reason });
      else if (state?.lastError) {
        failed.push({ ...who, why: state.lastError });
      } else routersRead++;
    }
    return this.ok({ routersRead, skipped, failed });
  }
}
