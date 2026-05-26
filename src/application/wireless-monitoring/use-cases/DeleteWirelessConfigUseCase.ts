import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IWirelessPollingConfigRepository } from 'domain/wireless-monitoring/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';

export interface DeleteWirelessConfigRequestDTO {
  deviceId: string;
}

export class DeleteWirelessConfigUseCase extends UseCase<
  DeleteWirelessConfigRequestDTO,
  void
> {
  constructor(
    private readonly configRepo: IWirelessPollingConfigRepository,
    logger: ILogger
  ) {
    super(logger, 'DeleteWirelessConfigUseCase');
  }

  protected async beforeExecute(
    request: DeleteWirelessConfigRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: DeleteWirelessConfigRequestDTO
  ): Promise<Result<void>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const configResult =
      await this.configRepo.findByDeviceId(deviceId);
    if (configResult.isFailure) {
      return this.fail(configResult.error);
    }
    if (configResult.value === null) {
      return this.fail('Wireless config not found for device');
    }

    const deleteResult = await this.configRepo.delete(deviceId);
    if (deleteResult.isFailure) {
      return this.fail(deleteResult.error);
    }

    return this.ok(undefined as unknown as void);
  }
}
