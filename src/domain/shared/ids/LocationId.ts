import { UniqueEntityID, Result } from '../core';

/**
 * LocationId - Unique identifier for NetworkDevice aggregate
 *
 * Type-safe wrapper around the network device's unique identifier.
 * Extends UniqueEntityID to ensure compatibility with Entity base class
 * while providing domain-specific type safety.
 *
 * Only accepts valid UUIDs (RFC 4122) - enforces UUID-only ID management.
 * Prevents accidentally mixing NetworkDevice IDs with other entity IDs.
 */
export class LocationId extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  /**
   * Creates a new LocationId with a generated UUID.
   * @returns LocationId instance with a new UUID
   */
  public static create(): LocationId {
    return new LocationId(UniqueEntityID.createId());
  }

  /**
   * Creates a LocationId from a UUID string.
   * Useful for converting database UUIDs to domain IDs.
   *
   * @param id - Optional UUID string (from database or external source)
   * @returns Result containing LocationId instance or error message:
   */
  public static parse(id: string): Result<LocationId> {
    const result = LocationId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok(new LocationId(result.value));
  }
}
