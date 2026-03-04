import { UniqueEntityID, Result } from '../core';

/**
 * DeviceModelId - Unique identifier for NetworkDevice aggregate
 *
 * Type-safe wrapper around the network device's unique identifier.
 * Extends UniqueEntityID to ensure compatibility with Entity base class
 * while providing domain-specific type safety.
 *
 * Only accepts valid UUIDs (RFC 4122) - enforces UUID-only ID management.
 * Prevents accidentally mixing NetworkDevice IDs with other entity IDs.
 */
export class DeviceModelId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  /**
   * Creates a new DeviceModelId with a generated UUID.
   * @returns DeviceModelId instance with a new UUID
   */
  public static create(): DeviceModelId {
    return new DeviceModelId(UniqueEntityID.createId());
  }

  /**
   * Creates a DeviceModelId from a UUID string.
   * Useful for converting database UUIDs to domain IDs.
   *
   * @param id - Optional UUID string (from database or external source)
   * @returns Result containing DeviceModelId instance or error message:
   */
  public static parse(id: string): Result<DeviceModelId> {
    const result = DeviceModelId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new DeviceModelId(result.value));
  }
}
