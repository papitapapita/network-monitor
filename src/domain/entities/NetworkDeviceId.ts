import { UniqueEntityID } from '../shared/kernel/UniqueEntityID';

/**
 * NetworkDeviceId - Unique identifier for NetworkDevice aggregate
 *
 * Type-safe wrapper around the network device's unique identifier.
 * Extends UniqueEntityID to ensure compatibility with Entity base class
 * while providing domain-specific type safety.
 *
 * Prevents accidentally mixing NetworkDevice IDs with other entity IDs.
 *
 * @example
 * // Create with existing ID (from database)
 * const deviceId = new NetworkDeviceId('550e8400-e29b-41d4-a716-446655440000');
 *
 * // Create new ID (auto-generates UUID)
 * const newDeviceId = new NetworkDeviceId();
 *
 * // Get raw value for persistence
 * const idValue = deviceId.toValue();
 */
export class NetworkDeviceId extends UniqueEntityID {
  /**
   * Creates a new NetworkDeviceId instance.
   *
   * @param id - Optional unique identifier value (UUID string or number).
   *             If not provided, a UUID will be auto-generated.
   */
  constructor(id?: string | number) {
    super(id);
  }

  /**
   * Creates a NetworkDeviceId from a raw string or number value.
   * Useful for converting database IDs to domain IDs.
   *
   * @param id - The raw identifier (typically UUID string from database)
   * @returns NetworkDeviceId instance
   *
   * @example
   * const deviceId = NetworkDeviceId.create('550e8400-e29b-41d4-a716-446655440000');
   */
  public static create(id: string | number): NetworkDeviceId {
    return new NetworkDeviceId(id);
  }
}
