import { DeviceId } from 'domain/shared/ids';
import { Device } from 'domain/device-inventory/aggregates';
import { DeviceOwnerType } from 'domain/device-inventory/enums';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { DeviceStatus } from 'domain/device-inventory/value-objects';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  RetireDeviceAfterCancellationRequestDTO,
  RetireDeviceAfterCancellationResponseDTO
} from '../dtos/RetireDeviceAfterCancellationDTOs';

// DEV-173: once its subscription is cancelled a unit leaves the network.
// The owner decides where it goes — ours comes back to the warehouse, the
// customer's stays with them for good. Without a recorded owner there is no
// way to tell, so the device is left for an operator.
export class RetireDeviceAfterCancellationUseCase extends UseCase<
  RetireDeviceAfterCancellationRequestDTO,
  RetireDeviceAfterCancellationResponseDTO
> {
  constructor(
    private readonly deviceRepository: IDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'RetireDeviceAfterCancellationUseCase');
  }

  protected async executeImpl(
    request: RetireDeviceAfterCancellationRequestDTO
  ): Promise<Result<RetireDeviceAfterCancellationResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }

    const findResult = await this.deviceRepository.findById(
      deviceIdResult.value
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }

    const device = findResult.value;
    if (device === null) {
      return this.ok(
        this.response(request, 'SKIPPED_NOT_FOUND', null)
      );
    }

    // A unit already written off as broken or gone stays that way — moving
    // a DAMAGED radio back to INVENTORY would put it on the shelf as stock.
    if (
      device.status.isDamaged() ||
      device.status.isDecommissioned()
    ) {
      return this.ok(
        this.response(request, 'SKIPPED_ALREADY_RETIRED', device)
      );
    }

    if (device.ownerType === null) {
      return this.ok(
        this.response(request, 'SKIPPED_NO_OWNER', device)
      );
    }

    const targetStatus =
      device.ownerType === DeviceOwnerType.CLIENT
        ? DeviceStatus.createDecommissioned()
        : DeviceStatus.createInventory();

    // The address belongs to the site, not the box: the next subscriber's
    // device takes it over.
    const changeResult = device.applyChanges({
      status: targetStatus,
      monitoringEnabled: false,
      ipAddress: null
    });
    if (changeResult.isFailure) {
      return this.fail(changeResult.error!);
    }

    const saveResult = await this.deviceRepository.save(device);
    if (saveResult.isFailure) {
      return this.fail(saveResult.error!);
    }

    return this.ok(this.response(request, 'RETIRED', device));
  }

  private response(
    request: RetireDeviceAfterCancellationRequestDTO,
    outcome: RetireDeviceAfterCancellationResponseDTO['outcome'],
    device: Device | null
  ): RetireDeviceAfterCancellationResponseDTO {
    return {
      deviceId: request.deviceId,
      outcome,
      status: device ? device.status.toString() : null
    };
  }
}
