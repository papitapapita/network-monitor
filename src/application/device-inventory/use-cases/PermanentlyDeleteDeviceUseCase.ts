import { DeviceId } from 'domain/shared/ids';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { PermanentlyDeleteDeviceRequestDTO } from '../dtos/PermanentlyDeleteDeviceRequestDTO';

// "Empty the bin" for one device: removes it now instead of waiting out the
// grace period. Same cascade as the scheduled purge — every ping, alert,
// snapshot and credential goes with it.
export class PermanentlyDeleteDeviceUseCase extends UseCase<
  PermanentlyDeleteDeviceRequestDTO,
  void
> {
  constructor(
    private readonly deviceRepository: IDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'PermanentlyDeleteDeviceUseCase');
  }

  protected async beforeExecute(
    request: PermanentlyDeleteDeviceRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Device ID is required');
    }

    return null;
  }

  protected async executeImpl(
    request: PermanentlyDeleteDeviceRequestDTO
  ): Promise<Result<void>> {
    const deviceIdResult = DeviceId.parse(request.id.trim());
    if (deviceIdResult.isFailure) {
      return this.fail<void>(
        `Invalid device ID: ${deviceIdResult.error}`
      );
    }

    const deviceId = deviceIdResult.value;

    const findResult =
      await this.deviceRepository.findByIdIncludingDeleted(deviceId);
    if (findResult.isFailure) {
      return this.fail<void>(findResult.error!);
    }

    const device = findResult.value;
    if (device === null) {
      return this.fail<void>(`Device not found: ${request.id}`);
    }

    // The bin is the only way in. A live device must go through
    // DeleteDeviceUseCase first, which is where the contracted-service and
    // open-ticket guards live — skipping it would be a back door around both.
    if (!device.isDeleted()) {
      return this.fail<void>(
        'Cannot permanently delete a device that is not in the recycle bin. Delete it first.'
      );
    }

    const deleteResult = await this.deviceRepository.delete(deviceId);
    if (deleteResult.isFailure) {
      return this.fail<void>(deleteResult.error!);
    }

    return this.ok(undefined);
  }
}
