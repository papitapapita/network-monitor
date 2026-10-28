import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { PortExpectedSpeed } from 'domain/device-monitoring/entities';
import { IPortExpectedSpeedRepository } from 'domain/device-monitoring/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IPortSpeedTargetsQuery } from '../interfaces';
import { RouterPortInspector, toRouterDTO } from '../services';
import {
  AcceptCurrentPortSpeedsRequestDTO,
  RouterPortSpeedsDTO
} from '../dtos';
import { PORT_SPEED_ROUTER_NOT_FOUND } from './SetPortExpectedSpeedUseCase';

export const PORT_SPEED_ROUTER_NOT_READABLE =
  'The router cannot be read';
export const PORT_SPEED_ROUTER_DID_NOT_ANSWER =
  'The router did not answer';

// MON-144: reads the router now and makes every linked port's rate the
// speed it should link at. Ports without a link keep what they had.
export class AcceptCurrentPortSpeedsUseCase extends UseCase<
  AcceptCurrentPortSpeedsRequestDTO,
  RouterPortSpeedsDTO
> {
  constructor(
    private readonly targets: IPortSpeedTargetsQuery,
    private readonly inspector: RouterPortInspector,
    private readonly repository: IPortExpectedSpeedRepository,
    logger: ILogger
  ) {
    super(logger, 'AcceptCurrentPortSpeedsUseCase');
  }

  protected async executeImpl(
    request: AcceptCurrentPortSpeedsRequestDTO
  ): Promise<Result<RouterPortSpeedsDTO>> {
    const deviceId = DeviceId.parse(request.deviceId);
    if (deviceId.isFailure) {
      return this.fail(`Invalid device ID: ${deviceId.error}`);
    }

    const router = await this.targets.findRouter(
      deviceId.value.toString()
    );
    if (router.isFailure) return Result.fail(router.error);
    if (!router.value) return this.fail(PORT_SPEED_ROUTER_NOT_FOUND);

    const read = await this.inspector.read(router.value);
    if ('reason' in read) {
      return this.fail(
        `${PORT_SPEED_ROUTER_NOT_READABLE}: ${read.reason}`
      );
    }
    if ('error' in read) {
      return this.fail(
        `${PORT_SPEED_ROUTER_DID_NOT_ANSWER}: ${read.error}`
      );
    }

    const existing = await this.repository.listForDevices([
      deviceId.value
    ]);
    if (existing.isFailure) return Result.fail(existing.error);
    const byPort = new Map(
      existing.value.map((e) => [e.portName, e])
    );

    const accepted: PortExpectedSpeed[] = [];
    for (const port of read.reading.ports) {
      if (!port.linked || port.rateMbps === null) continue;
      const current = byPort.get(port.name);
      if (current) {
        // a rate outside the known speeds is left as it was
        if (current.changeTo(port.rateMbps).isSuccess) {
          accepted.push(current);
        }
        continue;
      }
      const created = PortExpectedSpeed.create({
        deviceId: deviceId.value,
        portName: port.name,
        expectedMbps: port.rateMbps
      });
      if (created.isSuccess) {
        accepted.push(created.value);
        byPort.set(port.name, created.value);
      }
    }

    const saved = await this.repository.saveAll(accepted);
    if (saved.isFailure) return Result.fail(saved.error);

    return this.ok(toRouterDTO(read, [...byPort.values()]));
  }
}
