import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { PortExpectedSpeed } from 'domain/device-monitoring/entities';
import { IPortExpectedSpeedRepository } from 'domain/device-monitoring/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IPortSpeedTargetsQuery } from '../interfaces';
import {
  PortExpectedSpeedDTO,
  SetPortExpectedSpeedRequestDTO
} from '../dtos';

export const PORT_SPEED_ROUTER_NOT_FOUND = 'Router not found';

// MON-142: sets, changes or clears the speed one port should link at, and
// whether no link alerts (MON-149). The router is not read, so a port can be
// set while it is unreachable.
export class SetPortExpectedSpeedUseCase extends UseCase<
  SetPortExpectedSpeedRequestDTO,
  PortExpectedSpeedDTO
> {
  constructor(
    private readonly targets: IPortSpeedTargetsQuery,
    private readonly repository: IPortExpectedSpeedRepository,
    logger: ILogger
  ) {
    super(logger, 'SetPortExpectedSpeedUseCase');
  }

  protected async executeImpl(
    request: SetPortExpectedSpeedRequestDTO
  ): Promise<Result<PortExpectedSpeedDTO>> {
    const deviceId = DeviceId.parse(request.deviceId);
    if (deviceId.isFailure) {
      return this.fail(`Invalid device ID: ${deviceId.error}`);
    }
    const portName = request.portName.trim();

    const router = await this.targets.findRouter(
      deviceId.value.toString()
    );
    if (router.isFailure) return Result.fail(router.error);
    if (!router.value) return this.fail(PORT_SPEED_ROUTER_NOT_FOUND);

    if (request.expectedMbps === null) {
      const deleted = await this.repository.delete(
        deviceId.value,
        portName
      );
      if (deleted.isFailure) return Result.fail(deleted.error);
      return this.ok({
        deviceId: deviceId.value.toString(),
        portName,
        expectedMbps: null,
        alertOnNoLink: false
      });
    }

    const existing = await this.repository.find(
      deviceId.value,
      portName
    );
    if (existing.isFailure) return Result.fail(existing.error);

    let speed: PortExpectedSpeed;
    if (existing.value) {
      const changed = existing.value.changeTo(request.expectedMbps);
      if (changed.isFailure) return this.fail(changed.error);
      if (request.alertOnNoLink !== undefined) {
        existing.value.changeAlertOnNoLink(request.alertOnNoLink);
      }
      speed = existing.value;
    } else {
      const created = PortExpectedSpeed.create({
        deviceId: deviceId.value,
        portName,
        expectedMbps: request.expectedMbps,
        alertOnNoLink: request.alertOnNoLink
      });
      if (created.isFailure) return this.fail(created.error);
      speed = created.value;
    }

    const saved = await this.repository.saveAll([speed]);
    if (saved.isFailure) return Result.fail(saved.error);

    return this.ok({
      deviceId: speed.deviceId.toString(),
      portName: speed.portName,
      expectedMbps: speed.expected.mbps,
      alertOnNoLink: speed.alertOnNoLink
    });
  }
}
