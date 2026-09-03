import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  BulkUpsertDeviceNotificationPoliciesDTO,
  BulkUpsertDeviceNotificationPoliciesResponseDTO
} from '../dtos';
import { UpsertDeviceNotificationPolicyUseCase } from './UpsertDeviceNotificationPolicyUseCase';

export class BulkUpsertDeviceNotificationPoliciesUseCase extends UseCase<
  BulkUpsertDeviceNotificationPoliciesDTO,
  BulkUpsertDeviceNotificationPoliciesResponseDTO
> {
  constructor(
    private readonly upsertDeviceNotificationPolicyUseCase: UpsertDeviceNotificationPolicyUseCase,
    logger: ILogger
  ) {
    super(logger, 'BulkUpsertDeviceNotificationPoliciesUseCase');
  }

  protected async beforeExecute(
    request: BulkUpsertDeviceNotificationPoliciesDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceIds || request.deviceIds.length === 0) {
      return Result.fail('deviceIds must contain at least one id');
    }
    return null;
  }

  protected async executeImpl(
    request: BulkUpsertDeviceNotificationPoliciesDTO
  ): Promise<
    Result<BulkUpsertDeviceNotificationPoliciesResponseDTO>
  > {
    const updated: BulkUpsertDeviceNotificationPoliciesResponseDTO['updated'] =
      [];
    const failed: BulkUpsertDeviceNotificationPoliciesResponseDTO['failed'] =
      [];

    for (const deviceId of request.deviceIds) {
      const result =
        await this.upsertDeviceNotificationPolicyUseCase.execute({
          deviceId,
          quietHoursStart: request.quietHoursStart,
          quietHoursEnd: request.quietHoursEnd,
          alertDelayMinutes: request.alertDelayMinutes
        });

      if (result.isFailure) {
        failed.push({ id: deviceId, error: result.error });
        continue;
      }
      updated.push(result.value);
    }

    return this.ok({ updated, failed });
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return data;
  }
}
