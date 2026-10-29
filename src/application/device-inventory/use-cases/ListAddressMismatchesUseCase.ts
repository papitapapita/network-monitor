import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IDeviceAddressQuery, IRouterHostQuery } from '../interfaces';
import { AddressMismatchesResponseDTO } from '../dtos';
import { findAddressMismatches, routersWithout } from '../services';

// DEV-219: devices whose IP the MikroTiks' ARP tables and DHCP leases give
// to another MAC, read now.
export class ListAddressMismatchesUseCase extends UseCase<
  Record<string, never>,
  AddressMismatchesResponseDTO
> {
  constructor(
    private readonly addressQuery: IDeviceAddressQuery,
    private readonly routerHostQuery: IRouterHostQuery,
    logger: ILogger
  ) {
    super(logger, 'ListAddressMismatchesUseCase');
  }

  protected async executeImpl(
    _request: Record<string, never>
  ): Promise<Result<AddressMismatchesResponseDTO>> {
    const devices = await this.addressQuery.findAll();
    if (devices.isFailure) {
      return this.fail(
        `Failed to load the devices: ${devices.error}`
      );
    }
    const read = await this.routerHostQuery.findRouterHosts();
    if (read.isFailure) {
      return this.fail(`Failed to read the routers: ${read.error}`);
    }
    const { routers, unreadRouters } = read.value;

    return this.ok({
      mismatches: findAddressMismatches(devices.value, routers),
      unreadRouters: [
        ...unreadRouters.map((u) => ({ ...u })),
        ...routersWithout(routers, 'addresses')
      ]
    });
  }
}
