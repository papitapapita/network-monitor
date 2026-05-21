import {
  IDeviceModelRepository,
  IDeviceRepository
} from '../../../domain/device-inventory/repository';
import { DeviceModelId } from '../../../domain/shared/ids';
import { Result } from '../../../domain/shared/core';
import { UseCase } from '../../shared/core';
import { ILogger } from '../../shared/interfaces';
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

    const deleteResult =
      await this.deviceModelRepository.delete(deviceModelId);
    if (deleteResult.isFailure) {
      return this.fail(deleteResult.error!);
    }

    return this.ok(undefined);
  }
}
