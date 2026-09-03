import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IDeviceNotificationPolicyRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { DeleteDeviceNotificationPolicyDTO } from '../dtos';

export class DeleteDeviceNotificationPolicyUseCase extends UseCase<
  DeleteDeviceNotificationPolicyDTO,
  void
> {
  constructor(
    private readonly policyRepository: IDeviceNotificationPolicyRepository,
    logger: ILogger
  ) {
    super(logger, 'DeleteDeviceNotificationPolicyUseCase');
  }

  protected async beforeExecute(
    request: DeleteDeviceNotificationPolicyDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('deviceId is required');
    }
    return null;
  }

  protected async executeImpl(
    request: DeleteDeviceNotificationPolicyDTO
  ): Promise<Result<void>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }

    const deleteResult = await this.policyRepository.delete(
      deviceIdResult.value
    );
    if (deleteResult.isFailure) {
      return this.fail(
        `Failed to delete notification policy: ${deleteResult.error}`
      );
    }

    return this.ok(undefined);
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return data;
  }
}
