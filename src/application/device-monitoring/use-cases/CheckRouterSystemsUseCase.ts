import { Result } from 'domain/shared/core';
import { IRouterHealthThresholdsRepository } from 'domain/device-monitoring/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IPortSpeedTargetsQuery } from '../interfaces';
import {
  RouterSystemNotifier,
  RouterSystemRecorder
} from '../services';
import {
  CheckRouterSystemsRequestDTO,
  CheckRouterSystemsResultDTO,
  RouterSystemCheckSkipDTO
} from '../dtos';

// MON-161: the scheduled read of every MikroTik's identity, hardware,
// versions and health, which also judges health (MON-173) and tells of
// reboots (MON-171).
export class CheckRouterSystemsUseCase extends UseCase<
  CheckRouterSystemsRequestDTO,
  CheckRouterSystemsResultDTO
> {
  constructor(
    private readonly targets: IPortSpeedTargetsQuery,
    private readonly recorder: RouterSystemRecorder,
    private readonly thresholds: IRouterHealthThresholdsRepository,
    private readonly notifier: RouterSystemNotifier,
    logger: ILogger
  ) {
    super(logger, 'CheckRouterSystemsUseCase');
  }

  protected async executeImpl(
    request: CheckRouterSystemsRequestDTO
  ): Promise<Result<CheckRouterSystemsResultDTO>> {
    const candidates = await this.targets.listRouters();
    if (candidates.isFailure) return Result.fail(candidates.error);
    const thresholds = await this.thresholds.get();
    if (thresholds.isFailure) return Result.fail(thresholds.error);

    const recorded = await this.recorder.record(
      candidates.value,
      request.now,
      thresholds.value
    );
    if (recorded.isFailure) return Result.fail(recorded.error);

    const result: CheckRouterSystemsResultDTO = {
      routersRead: 0,
      skipped: [],
      failed: [],
      rebooted: 0,
      healthRaised: 0,
      healthRecovered: 0
    };
    for (const router of recorded.value) {
      const { candidate, state, reason, rebootedAt, health } = router;
      const who: Omit<RouterSystemCheckSkipDTO, 'why'> = {
        deviceId: candidate.deviceId,
        name: candidate.deviceName
      };
      if (reason !== null) {
        result.skipped.push({ ...who, why: reason });
        continue;
      }
      if (state?.lastError) {
        result.failed.push({ ...who, why: state.lastError });
      } else result.routersRead++;

      if (rebootedAt !== null) {
        result.rebooted++;
        await this.notifier.notifyReboot(
          candidate,
          rebootedAt,
          request.now
        );
      }
      if (state && health) {
        result.healthRaised += health.raised.length;
        result.healthRecovered += health.recovered.length;
        await this.notifier.notifyHealth(
          candidate,
          state,
          health,
          thresholds.value,
          request.now
        );
      }
    }
    return this.ok(result);
  }
}
