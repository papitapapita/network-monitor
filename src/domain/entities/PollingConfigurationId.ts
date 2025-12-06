import { UniqueEntityID } from '../shared/kernel/UniqueEntityID';

/**
 * PollingConfigurationId - Unique identifier for PollingConfiguration entity
 *
 * Type-safe wrapper around the polling configuration's unique identifier.
 * Extends UniqueEntityID to ensure compatibility with Entity base class
 * while providing domain-specific type safety.
 *
 * @example
 * // Create with existing ID (from database)
 * const configId = new PollingConfigurationId('550e8400-e29b-41d4-a716-446655440000');
 *
 * // Create new ID (auto-generates UUID)
 * const newConfigId = new PollingConfigurationId();
 *
 * // Get raw value for persistence
 * const idValue = configId.toValue();
 */
export class PollingConfigurationId extends UniqueEntityID {
  /**
   * Creates a new PollingConfigurationId instance.
   *
   * @param id - Optional unique identifier value (UUID string or number).
   *             If not provided, a UUID will be auto-generated.
   */
  constructor(id?: string | number) {
    super(id);
  }

  /**
   * Creates a PollingConfigurationId from a raw string or number value.
   * Useful for converting database IDs to domain IDs.
   *
   * @param id - The raw identifier (typically UUID string from database)
   * @returns PollingConfigurationId instance
   *
   * @example
   * const configId = PollingConfigurationId.create('550e8400-e29b-41d4-a716-446655440000');
   */
  public static create(id: string | number): PollingConfigurationId {
    return new PollingConfigurationId(id);
  }
}
