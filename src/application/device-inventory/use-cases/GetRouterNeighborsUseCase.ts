import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  IKnownDeviceLookup,
  IRouterNeighborQuery,
  ITopologyQuery
} from '../interfaces';
import {
  GetRouterNeighborsRequestDTO,
  RouterNeighborsResponseDTO
} from '../dtos';
import { RouterNeighborMap, findNeighborOwners } from '../services';

// DEV-198: what each port of one MikroTik hears, read now, with the comment
// each port could carry.
export class GetRouterNeighborsUseCase extends UseCase<
  GetRouterNeighborsRequestDTO,
  RouterNeighborsResponseDTO
> {
  constructor(
    private readonly routerNeighborQuery: IRouterNeighborQuery,
    private readonly knownDevices: IKnownDeviceLookup,
    private readonly topologyQuery: ITopologyQuery,
    logger: ILogger
  ) {
    super(logger, 'GetRouterNeighborsUseCase');
  }

  protected async executeImpl(
    request: GetRouterNeighborsRequestDTO
  ): Promise<Result<RouterNeighborsResponseDTO>> {
    const idResult = DeviceId.parse(request.deviceId?.trim() ?? '');
    if (idResult.isFailure) {
      return this.fail(`Invalid device ID: ${idResult.error}`);
    }
    const deviceId = idResult.value.toString();

    const read =
      await this.routerNeighborQuery.findRouterNeighborsOf(deviceId);
    if (read.isFailure) {
      return this.fail(`Failed to read the router: ${read.error}`);
    }
    if (read.value === null) {
      return this.fail(`MikroTik router not found: ${deviceId}`);
    }
    const unread = read.value.unreadRouters[0];
    if (unread) {
      return this.ok({
        deviceId,
        deviceName: unread.name,
        reason: unread.reason,
        ports: []
      });
    }

    const routers = read.value.routers;
    const [owners, rows] = await Promise.all([
      findNeighborOwners(this.knownDevices, routers),
      this.topologyQuery.findAll()
    ]);
    if (owners.isFailure) return this.fail(owners.error);
    if (rows.isFailure) {
      return this.fail(`Failed to load topology: ${rows.error}`);
    }

    return this.ok({
      deviceId,
      deviceName: routers[0]!.routerName,
      reason: null,
      ports: new RouterNeighborMap(
        routers,
        owners.value,
        rows.value
      ).ports(deviceId)
    });
  }
}
