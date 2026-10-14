import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IDeviceCredentialsRepository } from '../interfaces';
import { RevealedDeviceCredentialsDTO } from '../dtos';
import { DeviceCredentialsMapper } from '../mappers';

interface RevealDeviceCredentialsRequestDTO {
  deviceId: string;
  revealedBy: string;
}

// The plaintext counterpart of GetDeviceCredentialsUseCase. Whether the caller
// unlocked it is the route's question (IDN-086); this one only answers and
// leaves a trace of who saw what (DEV-134, DEV-135).
export class RevealDeviceCredentialsUseCase extends UseCase<
  RevealDeviceCredentialsRequestDTO,
  RevealedDeviceCredentialsDTO
> {
  constructor(
    private readonly credentialsRepo: IDeviceCredentialsRepository,
    logger: ILogger
  ) {
    super(logger, 'RevealDeviceCredentialsUseCase');
  }

  protected sanitizeForLogging(data: unknown): unknown {
    // The answer is every secret in plaintext; only the request may be logged.
    if (data && typeof data === 'object' && 'httpPassword' in data) {
      return {
        deviceId: (data as RevealedDeviceCredentialsDTO).deviceId
      };
    }
    return data;
  }

  protected async beforeExecute(
    request: RevealDeviceCredentialsRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('deviceId is required');
    }
    return null;
  }

  protected async executeImpl(
    request: RevealDeviceCredentialsRequestDTO
  ): Promise<Result<RevealedDeviceCredentialsDTO>> {
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

    this.logger.warn('Device credentials revealed', {
      deviceId: deviceIdResult.value.toString(),
      revealedBy: request.revealedBy
    });

    return this.ok(
      DeviceCredentialsMapper.toRevealedDTO(
        deviceIdResult.value.toString(),
        result.value
      )
    );
  }
}
