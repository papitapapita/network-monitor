import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IDeviceNotificationPolicyRepository } from 'domain/notifications/repository';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { DeviceNotificationPolicyMapper } from '../mappers';
import {
  DeviceNotificationPolicyResponseDTO,
  GetDeviceNotificationPolicyDTO
} from '../dtos';

export class GetDeviceNotificationPolicyUseCase extends UseCase<
  GetDeviceNotificationPolicyDTO,
  DeviceNotificationPolicyResponseDTO
> {
  constructor(
    private readonly policyRepository: IDeviceNotificationPolicyRepository,
    private readonly deviceRepository: IDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'GetDeviceNotificationPolicyUseCase');
  }

  protected async beforeExecute(
    request: GetDeviceNotificationPolicyDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('deviceId is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetDeviceNotificationPolicyDTO
  ): Promise<Result<DeviceNotificationPolicyResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const existsResult = await this.deviceRepository.exists(deviceId);
    if (existsResult.isFailure) {
      return this.fail(existsResult.error);
    }
    if (!existsResult.value) {
      return this.fail('Device not found');
    }

    const policyResult =
      await this.policyRepository.findByDeviceId(deviceId);
    if (policyResult.isFailure) {
      return this.fail(
        `Failed to load notification policy: ${policyResult.error}`
      );
    }

    return this.ok(
      policyResult.value
        ? DeviceNotificationPolicyMapper.toDTO(policyResult.value)
        : DeviceNotificationPolicyMapper.toDefaultDTO(
            request.deviceId
          )
    );
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return data;
  }
}
