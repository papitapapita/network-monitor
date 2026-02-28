import { UniqueEntityID, Result } from '../core';

/**
 * NetworkDeviceId - Unique identifier for NetworkDevice aggregate
 *
 * Type-safe wrapper around the network device's unique identifier.
 * Extends UniqueEntityID to ensure compatibility with Entity base class
 * while providing domain-specific type safety.
 *
 * Only accepts valid UUIDs (RFC 4122) - enforces UUID-only ID management.
 * Prevents accidentally mixing NetworkDevice IDs with other entity IDs.
 */
export class NetworkDeviceId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  /**
   * Creates a new NetworkDeviceId with a generated UUID.
   * @returns NetworkDeviceId instance with a new UUID
   */
  public static create(): NetworkDeviceId {
    return new NetworkDeviceId(UniqueEntityID.createId());
  }

  /**
   * Creates a NetworkDeviceId from a UUID string.
   * Useful for converting database UUIDs to domain IDs.
   *
   * @param id - Optional UUID string (from database or external source)
   * @returns Result containing NetworkDeviceId instance or error message:
   */
  public static parse(id: string): Result<NetworkDeviceId> {
    const result = NetworkDeviceId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new NetworkDeviceId(result.value));
  }
}
