import { Result } from 'domain/shared/core';
import {
  DeviceId,
  DeviceNotificationPolicyId
} from 'domain/shared/ids';
import {
  DeviceNotificationPolicy,
  QuietHours
} from 'domain/notifications';
import { QuietHoursMode } from 'domain/notifications/props';
import { IDeviceNotificationPolicyRepository } from 'domain/notifications/repository';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { DeviceNotificationPolicyMapper } from '../mappers';
import {
  DeviceNotificationPolicyResponseDTO,
  UpsertDeviceNotificationPolicyDTO
} from '../dtos';

export class UpsertDeviceNotificationPolicyUseCase extends UseCase<
  UpsertDeviceNotificationPolicyDTO,
  DeviceNotificationPolicyResponseDTO
> {
  constructor(
    private readonly policyRepository: IDeviceNotificationPolicyRepository,
    private readonly deviceRepository: IDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'UpsertDeviceNotificationPolicyUseCase');
  }

  protected async beforeExecute(
    request: UpsertDeviceNotificationPolicyDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('deviceId is required');
    }
    const hasStart = request.quietHoursStart !== null;
    const hasEnd = request.quietHoursEnd !== null;
    if (hasStart !== hasEnd) {
      return Result.fail(
        'quietHoursStart and quietHoursEnd must both be set, or both be null'
      );
    }
    return null;
  }

  protected async executeImpl(
    request: UpsertDeviceNotificationPolicyDTO
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

    const quietHoursResult = this.buildQuietHours(request);
    if (quietHoursResult.isFailure) {
      return this.fail(quietHoursResult.error);
    }
    const quietHours = quietHoursResult.value;
    // An unknown string is refused by DeviceNotificationPolicy.
    const quietHoursMode = (request.quietHoursMode ??
      (quietHours ? 'CUSTOM' : 'INHERIT')) as QuietHoursMode;

    const existingResult =
      await this.policyRepository.findByDeviceId(deviceId);
    if (existingResult.isFailure) {
      return this.fail(
        `Failed to load notification policy: ${existingResult.error}`
      );
    }

    const policyResult = existingResult.value
      ? this.applyUpdates(
          existingResult.value,
          quietHoursMode,
          quietHours,
          request.alertDelayMinutes
        )
      : DeviceNotificationPolicy.create(
          {
            deviceId,
            quietHoursMode,
            quietHours,
            alertDelayMinutes: request.alertDelayMinutes
          },
          DeviceNotificationPolicyId.create()
        );

    if (policyResult.isFailure) {
      return this.fail(policyResult.error);
    }

    const saveResult = await this.policyRepository.save(
      policyResult.value
    );
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to save notification policy: ${saveResult.error}`
      );
    }

    return this.ok(
      DeviceNotificationPolicyMapper.toDTO(saveResult.value)
    );
  }

  private applyUpdates(
    policy: DeviceNotificationPolicy,
    quietHoursMode: QuietHoursMode,
    quietHours: QuietHours | null,
    alertDelayMinutes: number | null
  ): Result<DeviceNotificationPolicy> {
    const quietHoursResult = policy.setQuietHours(
      quietHoursMode,
      quietHours
    );
    if (quietHoursResult.isFailure) {
      return Result.fail(quietHoursResult.error);
    }

    const delayResult =
      policy.setAlertDelayMinutes(alertDelayMinutes);
    if (delayResult.isFailure) {
      return Result.fail(delayResult.error);
    }

    return Result.ok(policy);
  }

  private buildQuietHours(
    request: UpsertDeviceNotificationPolicyDTO
  ): Result<QuietHours | null> {
    if (
      request.quietHoursStart === null ||
      request.quietHoursEnd === null
    ) {
      return Result.ok(null);
    }

    return QuietHours.fromHHmm(
      request.quietHoursStart,
      request.quietHoursEnd
    );
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return data;
  }
}
