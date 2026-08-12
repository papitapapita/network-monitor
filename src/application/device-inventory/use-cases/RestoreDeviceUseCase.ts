import { DeviceId } from 'domain/shared/ids';
import { Device } from 'domain/device-inventory/aggregates';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { RestoreDeviceRequestDTO } from '../dtos/RestoreDeviceRequestDTO';
import { DeviceResponseDTO } from '../dtos/DeviceResponseDTO';
import { DeviceMapper } from '../mappers/DeviceMapper';

// Undoes a soft delete inside the grace period. Past it the row is either
// already purged or about to be, and pretending otherwise would hand back a
// device that vanishes again on the next retention sweep.
export class RestoreDeviceUseCase extends UseCase<
  RestoreDeviceRequestDTO,
  DeviceResponseDTO
> {
  constructor(
    private readonly deviceRepository: IDeviceRepository,
    logger: ILogger,
    private readonly graceDays: number = Device.DELETE_GRACE_DAYS
  ) {
    super(logger, 'RestoreDeviceUseCase');
  }

  protected async beforeExecute(
    request: RestoreDeviceRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Device ID is required');
    }

    return null;
  }

  protected async executeImpl(
    request: RestoreDeviceRequestDTO
  ): Promise<Result<DeviceResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.id.trim());
    if (deviceIdResult.isFailure) {
      return this.fail<DeviceResponseDTO>(
        `Invalid device ID: ${deviceIdResult.error}`
      );
    }

    // The only read that sees tombstones — findById hides exactly the row
    // this use case exists to load.
    const findResult =
      await this.deviceRepository.findByIdIncludingDeleted(
        deviceIdResult.value
      );
    if (findResult.isFailure) {
      return this.fail<DeviceResponseDTO>(findResult.error!);
    }

    const device = findResult.value;
    if (device === null) {
      return this.fail<DeviceResponseDTO>(
        `Device not found: ${request.id}`
      );
    }

    const restoreResult = device.restore(new Date(), this.graceDays);
    if (restoreResult.isFailure) {
      return this.fail<DeviceResponseDTO>(restoreResult.error);
    }

    const saveResult = await this.deviceRepository.save(device);
    if (saveResult.isFailure) {
      return this.fail<DeviceResponseDTO>(saveResult.error!);
    }

    return this.ok(DeviceMapper.toDTO(saveResult.value));
  }
}
