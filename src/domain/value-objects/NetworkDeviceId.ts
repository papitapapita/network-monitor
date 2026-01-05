import { UniqueEntityID, Result } from '..';

/**
 * NetworkDeviceId - Unique identifier for NetworkDevice aggregate
 *
 * Type-safe wrapper around the network device's unique identifier.
 * Extends UniqueEntityID to ensure compatibility with Entity base class
 * while providing domain-specific type safety.
 *
 * Only accepts valid UUIDs (RFC 4122) - enforces UUID-only ID management.
 * Prevents accidentally mixing NetworkDevice IDs with other entity IDs.
 *
 * @example
 * // Create with existing UUID (from database)
 * const deviceId = new NetworkDeviceId('550e8400-e29b-41d4-a716-446655440000');
 *
 * // Create new ID (auto-generates UUID v4)
 * const newDeviceId = new NetworkDeviceId();
 *
 * // Get raw UUID value for persistence
 * const idValue = deviceId.toValue(); // "550e8400-e29b-41d4-a716-446655440000"
 *
 * // Invalid UUID throws error
 * const invalidId = new NetworkDeviceId('invalid'); // Throws error
 */
export class NetworkDeviceId extends UniqueEntityID {
  /**
   * Creates a new NetworkDeviceId instance.
   *
   * @param id - Optional UUID string. If not provided, a new UUID v4 will be generated.
   * @throws {Error} If the provided ID is not a valid UUID
   */
  private constructor(id?: string) {
    super(id);
  }

  /**
   * Creates a NetworkDeviceId from a UUID string.
   * Useful for converting database UUIDs to domain IDs.
   *
   * @param id - Optional UUID string (from database or external source)
   * @returns Result containing NetworkDeviceId instance or error message
   *
   * @example
   * const result = NetworkDeviceId.create('550e8400-e29b-41d4-a716-446655440000');
   * if (result.isSuccess) {
   *   const deviceId = result.value;
   * }
   */
  public static create(id?: string): Result<NetworkDeviceId> {
    try {
      const networkDeviceId = new NetworkDeviceId(id);
      return Result.ok<NetworkDeviceId>(networkDeviceId);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<NetworkDeviceId>(errorMessage);
    }
  }
}
