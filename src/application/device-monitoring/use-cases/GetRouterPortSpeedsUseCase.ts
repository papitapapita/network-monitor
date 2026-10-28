import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IPortSpeedTargetsQuery } from '../interfaces';
import { RouterPortInspector } from '../services';
import {
  GetRouterPortSpeedsRequestDTO,
  RouterPortSpeedsResponseDTO
} from '../dtos';
import { PORT_SPEED_ROUTER_NOT_FOUND } from './SetPortExpectedSpeedUseCase';

// MON-150: one router's ports read now, as the list shows them, without
// waiting for every other router. Only reads: the scheduled check's streaks
// are left alone.
export class GetRouterPortSpeedsUseCase extends UseCase<
  GetRouterPortSpeedsRequestDTO,
  RouterPortSpeedsResponseDTO
> {
  constructor(
    private readonly targets: IPortSpeedTargetsQuery,
    private readonly inspector: RouterPortInspector,
    logger: ILogger,
    private readonly clock: () => Date = () => new Date()
  ) {
    super(logger, 'GetRouterPortSpeedsUseCase');
  }

  protected async executeImpl(
    request: GetRouterPortSpeedsRequestDTO
  ): Promise<Result<RouterPortSpeedsResponseDTO>> {
    const deviceId = DeviceId.parse(request.deviceId);
    if (deviceId.isFailure) {
      return this.fail(`Invalid device ID: ${deviceId.error}`);
    }

    const router = await this.targets.findRouter(
      deviceId.value.toString()
    );
    if (router.isFailure) return Result.fail(router.error);
    if (!router.value) return this.fail(PORT_SPEED_ROUTER_NOT_FOUND);

    const inspected = await this.inspector.inspect([router.value]);
    if (inspected.isFailure) return Result.fail(inspected.error);

    return this.ok({
      checkedAt: this.clock().toISOString(),
      router: inspected.value[0]!
    });
  }
}
