import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import { UseCase } from '../../shared/core';
import { ILogger } from '../../shared/interfaces';
import { IDeviceCredentialsRepository } from '../interfaces/IDeviceCredentialsRepository';
import { DeviceCredentialsResponseDTO } from '../dtos/DeviceCredentialsResponseDTO';
import { maskCredentials } from '../mappers/DeviceCredentialsMapper';

interface GetDeviceCredentialsRequestDTO {
  deviceId: string;
}

export class GetDeviceCredentialsUseCase extends UseCase<
  GetDeviceCredentialsRequestDTO,
  DeviceCredentialsResponseDTO
> {
  constructor(
    private readonly credentialsRepo: IDeviceCredentialsRepository,
    logger: ILogger
  ) {
    super(logger, 'GetDeviceCredentialsUseCase');
  }

  protected async beforeExecute(
    request: GetDeviceCredentialsRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('deviceId is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetDeviceCredentialsRequestDTO
  ): Promise<Result<DeviceCredentialsResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId.trim());
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid deviceId: ${deviceIdResult.error}`);
    }

    const result = await this.credentialsRepo.findByDeviceId(
      deviceIdResult.value
    );
    if (result.isFailure) {
      return this.fail(
        `Failed to retrieve credentials: ${result.error}`
      );
    }
    if (!result.value) {
      return this.fail('No credentials configured for this device');
    }

    return this.ok(
      maskCredentials(request.deviceId.trim(), result.value)
    );
  }
}
