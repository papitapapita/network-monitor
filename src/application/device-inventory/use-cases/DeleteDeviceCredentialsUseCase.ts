import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IDeviceCredentialsRepository } from '../interfaces';

interface DeleteDeviceCredentialsRequestDTO {
  deviceId: string;
}

export class DeleteDeviceCredentialsUseCase extends UseCase<
  DeleteDeviceCredentialsRequestDTO,
  void
> {
  constructor(
    private readonly credentialsRepo: IDeviceCredentialsRepository,
    logger: ILogger
  ) {
    super(logger, 'DeleteDeviceCredentialsUseCase');
  }

  protected async beforeExecute(
    request: DeleteDeviceCredentialsRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('deviceId is required');
    }
    return null;
  }

  protected async executeImpl(
    request: DeleteDeviceCredentialsRequestDTO
  ): Promise<Result<void>> {
    const deviceIdResult = DeviceId.parse(request.deviceId.trim());
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid deviceId: ${deviceIdResult.error}`);
    }

    const result = await this.credentialsRepo.delete(
      deviceIdResult.value
    );
    if (result.isFailure) {
      return this.fail(
        `Failed to delete credentials: ${result.error}`
      );
    }

    return this.ok(undefined as unknown as void);
  }
}
