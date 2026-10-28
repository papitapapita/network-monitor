import { Result } from 'domain/shared/core';
import { DiscoveredDeviceId } from 'domain/shared/ids';
import { IDiscoveredDeviceRepository } from 'domain/device-inventory/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  DiscoveredDeviceDTO,
  DiscoveredDeviceIdRequestDTO
} from '../dtos';
import { DiscoveredDeviceMapper } from '../mappers';

export const DISCOVERED_DEVICE_NOT_FOUND =
  'Discovered device not found';

// DEV-204: kept until undone; ignoring twice changes nothing.
export class IgnoreDiscoveredDeviceUseCase extends UseCase<
  DiscoveredDeviceIdRequestDTO,
  DiscoveredDeviceDTO
> {
  constructor(
    private readonly repository: IDiscoveredDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'IgnoreDiscoveredDeviceUseCase');
  }

  protected async executeImpl(
    request: DiscoveredDeviceIdRequestDTO
  ): Promise<Result<DiscoveredDeviceDTO>> {
    const idResult = DiscoveredDeviceId.parse(request.id);
    if (idResult.isFailure) {
      return this.fail(
        `Invalid discovered device ID: ${idResult.error}`
      );
    }

    const found = await this.repository.findById(idResult.value);
    if (found.isFailure) {
      return this.fail(
        `Failed to load discovered device: ${found.error}`
      );
    }
    if (found.value === null)
      return this.fail(DISCOVERED_DEVICE_NOT_FOUND);

    const device = found.value;
    device.ignore(new Date());
    const saved = await this.repository.save(device);
    if (saved.isFailure) {
      return this.fail(
        `Failed to save discovered device: ${saved.error}`
      );
    }
    return this.ok(DiscoveredDeviceMapper.toDTO(device));
  }
}
