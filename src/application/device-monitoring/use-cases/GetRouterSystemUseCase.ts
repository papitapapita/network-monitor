import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IPortSpeedTargetsQuery } from '../interfaces';
import { RouterSystemRecorder, toRouterSystemDTO } from '../services';
import {
  GetRouterSystemRequestDTO,
  RouterSystemResponseDTO
} from '../dtos';
import { PORT_SPEED_ROUTER_NOT_FOUND } from './SetPortExpectedSpeedUseCase';

// MON-163: one router read now. What it says is kept like a scheduled
// reading, so the list shows it too.
export class GetRouterSystemUseCase extends UseCase<
  GetRouterSystemRequestDTO,
  RouterSystemResponseDTO
> {
  constructor(
    private readonly targets: IPortSpeedTargetsQuery,
    private readonly recorder: RouterSystemRecorder,
    logger: ILogger,
    private readonly clock: () => Date = () => new Date()
  ) {
    super(logger, 'GetRouterSystemUseCase');
  }

  protected async executeImpl(
    request: GetRouterSystemRequestDTO
  ): Promise<Result<RouterSystemResponseDTO>> {
    const deviceId = DeviceId.parse(request.deviceId);
    if (deviceId.isFailure) {
      return this.fail(`Invalid device ID: ${deviceId.error}`);
    }

    const router = await this.targets.findRouter(
      deviceId.value.toString()
    );
    if (router.isFailure) return Result.fail(router.error);
    if (!router.value) return this.fail(PORT_SPEED_ROUTER_NOT_FOUND);

    const recorded = await this.recorder.record(
      [router.value],
      this.clock()
    );
    if (recorded.isFailure) return Result.fail(recorded.error);

    const [only] = recorded.value;
    return this.ok({
      router: toRouterSystemDTO(only!.candidate, only!.state)
    });
  }
}
