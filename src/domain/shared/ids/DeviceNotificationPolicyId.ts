import { UniqueEntityID, Result } from '../core';

/**
 * DeviceNotificationPolicyId - Unique identifier for DeviceNotificationPolicy entity
 *
 * Type-safe wrapper around the notification policy's unique identifier.
 * Extends UniqueEntityID to ensure compatibility with Entity base class
 * while providing domain-specific type safety.
 */
export class DeviceNotificationPolicyId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(): DeviceNotificationPolicyId {
    return new DeviceNotificationPolicyId(UniqueEntityID.createId());
  }

  public static parse(
    id: string
  ): Result<DeviceNotificationPolicyId> {
    const result = DeviceNotificationPolicyId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok<DeviceNotificationPolicyId>(
      new DeviceNotificationPolicyId(result.value)
    );
  }
}
