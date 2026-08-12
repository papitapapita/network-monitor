import {
  IDeviceModelRepository,
  IDeviceRepository
} from 'domain/device-inventory/repository';
import { DeviceModelId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { DeleteDeviceModelRequestDTO } from '../dtos';

export class DeleteDeviceModelUseCase extends UseCase<
  DeleteDeviceModelRequestDTO,
  void
> {
  constructor(
    private readonly deviceModelRepository: IDeviceModelRepository,
    private readonly deviceRepository: IDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'DeleteDeviceModelUseCase');
  }

  protected async beforeExecute(
    request: DeleteDeviceModelRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Device model ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: DeleteDeviceModelRequestDTO
  ): Promise<Result<void>> {
    const idResult = DeviceModelId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid device model ID: ${idResult.error}`);
    }

    const deviceModelId = idResult.value;

    const findResult =
      await this.deviceModelRepository.findById(deviceModelId);
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Device model not found: ${request.id}`);
    }

    // Guard: cannot delete a device model that has associated devices
    const devicesResult =
      await this.deviceRepository.findByDeviceModel(deviceModelId);
    if (devicesResult.isFailure) {
      return this.fail(devicesResult.error!);
    }
    if (devicesResult.value.length > 0) {
      return this.fail(
        `Cannot delete device model: it has ${devicesResult.value.length} device(s) associated. Reassign or remove those devices first.`
      );
    }

    const binnedResult = await this.purgeBinnedDevices(
      deviceModelId,
      request.purgeBinnedDevices === true
    );
    if (binnedResult.isFailure) {
      return this.fail(binnedResult.error!);
    }

    const deleteResult =
      await this.deviceModelRepository.delete(deviceModelId);
    if (deleteResult.isFailure) {
      return this.fail(deleteResult.error!);
    }

    return this.ok(undefined);
  }

  // DEV-026 only sees live devices, so a model whose last units are in the
  // recycle bin looks free to delete — and then the FK on devices.device_model_id
  // (ON DELETE RESTRICT) refuses, which the caller would read as a server fault.
  // Surface the tombstones instead, and empty them only when asked to.
  //
  // Purging here is safe for the same reason PurgeDeletedDevicesUseCase is:
  // nothing reaches the bin without clearing the live-contract and open-ticket
  // guards in DeleteDeviceUseCase first.
  private async purgeBinnedDevices(
    deviceModelId: DeviceModelId,
    confirmed: boolean
  ): Promise<Result<void>> {
    const binnedResult = await this.deviceRepository.findByFilters({
      deviceModelId,
      deleted: 'only'
    });
    if (binnedResult.isFailure) {
      return Result.fail(
        `Failed to load deleted devices for the model check: ${binnedResult.error}`
      );
    }

    const binned = binnedResult.value;
    if (binned.length === 0) {
      return Result.ok<void>();
    }

    if (!confirmed) {
      return Result.fail(
        `Cannot delete device model: it has ${binned.length} device(s) in the recycle bin. Retry with purgeBinnedDevices=true to remove them permanently along with the model.`
      );
    }

    for (const device of binned) {
      const purgeResult = await this.deviceRepository.delete(
        device.id
      );
      if (purgeResult.isFailure) {
        return Result.fail(
          `Cannot delete device model: failed to purge deleted device ${device.id.toString()}: ${purgeResult.error}`
        );
      }
    }

    return Result.ok<void>();
  }
}
