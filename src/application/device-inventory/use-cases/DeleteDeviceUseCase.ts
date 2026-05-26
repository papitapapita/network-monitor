import { DeviceId } from 'domain/shared/ids';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { DeleteDeviceRequestDTO } from '../dtos/DeleteDeviceRequestDTO';

export class DeleteDeviceUseCase extends UseCase<
  DeleteDeviceRequestDTO,
  void
> {
  constructor(
    private readonly deviceRepository: IDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'DeleteDeviceUseCase');
  }

  protected async beforeExecute(
    request: DeleteDeviceRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Device ID is required');
    }

    return null;
  }

  protected async executeImpl(
    request: DeleteDeviceRequestDTO
  ): Promise<Result<void>> {
    const deviceIdResult = DeviceId.parse(request.id.trim());
    if (deviceIdResult.isFailure) {
      return this.fail<void>(
        `Invalid device ID: ${deviceIdResult.error}`
      );
    }

    const deviceId = deviceIdResult.value;

    const findResult = await this.deviceRepository.findById(deviceId);
    if (findResult.isFailure) {
      return this.fail<void>(findResult.error!);
    }

    if (findResult.value === null) {
      return this.fail<void>(`Device not found: ${request.id}`);
    }

    const deleteResult = await this.deviceRepository.delete(deviceId);
    if (deleteResult.isFailure) {
      return this.fail<void>(deleteResult.error!);
    }

    return this.ok(undefined);
  }
}
