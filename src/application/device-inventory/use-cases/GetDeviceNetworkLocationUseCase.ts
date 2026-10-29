import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IDeviceAddressQuery, IRouterHostQuery } from '../interfaces';
import {
  DeviceNetworkLocationResponseDTO,
  GetDeviceNetworkLocationRequestDTO
} from '../dtos';
import {
  arpMacsOf,
  locateOnNetwork,
  routersWithout
} from '../services';

// DEV-199: which router and port a device sits behind, read now from the
// MikroTiks' bridge host tables.
export class GetDeviceNetworkLocationUseCase extends UseCase<
  GetDeviceNetworkLocationRequestDTO,
  DeviceNetworkLocationResponseDTO
> {
  constructor(
    private readonly addressQuery: IDeviceAddressQuery,
    private readonly routerHostQuery: IRouterHostQuery,
    logger: ILogger
  ) {
    super(logger, 'GetDeviceNetworkLocationUseCase');
  }

  protected async executeImpl(
    request: GetDeviceNetworkLocationRequestDTO
  ): Promise<Result<DeviceNetworkLocationResponseDTO>> {
    const idResult = DeviceId.parse(request.deviceId?.trim() ?? '');
    if (idResult.isFailure) {
      return this.fail(`Invalid device ID: ${idResult.error}`);
    }
    const deviceId = idResult.value.toString();

    const device = await this.addressQuery.findById(deviceId);
    if (device.isFailure) {
      return this.fail(`Failed to load the device: ${device.error}`);
    }
    if (device.value === null) {
      return this.fail(`Device not found: ${deviceId}`);
    }

    const read = await this.routerHostQuery.findRouterHosts();
    if (read.isFailure) {
      return this.fail(`Failed to read the routers: ${read.error}`);
    }
    const { routers, unreadRouters } = read.value;

    const { ipAddress } = device.value;
    const macAddresses = [
      ...new Set([
        ...device.value.macAddresses,
        ...(ipAddress ? arpMacsOf(ipAddress, routers) : [])
      ])
    ];
    const sightings = locateOnNetwork(macAddresses, routers);
    const closest = sightings.filter((s) => s.closest);

    return this.ok({
      deviceId,
      deviceName: device.value.name,
      macAddresses,
      location: closest.length === 1 ? closest[0]! : null,
      sightings,
      unreadRouters: [
        ...unreadRouters.map((u) => ({ ...u })),
        ...routersWithout(routers, 'bridgeHosts')
      ]
    });
  }
}
