import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  DiscoveredDeviceDTO,
  ListDiscoveredDevicesRequestDTO
} from '../dtos';
import { IDiscoveredDeviceListQuery } from '../interfaces';

export class ListDiscoveredDevicesUseCase extends UseCase<
  ListDiscoveredDevicesRequestDTO,
  DiscoveredDeviceDTO[]
> {
  constructor(
    private readonly query: IDiscoveredDeviceListQuery,
    logger: ILogger
  ) {
    super(logger, 'ListDiscoveredDevicesUseCase');
  }

  protected async executeImpl(
    request: ListDiscoveredDevicesRequestDTO
  ): Promise<Result<DiscoveredDeviceDTO[]>> {
    const listed = await this.query.list(request.ignored);
    if (listed.isFailure) {
      return this.fail(
        `Failed to list discovered devices: ${listed.error}`
      );
    }
    return this.ok(listed.value);
  }
}
