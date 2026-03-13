import { UniqueEntityID, Result } from '../core';

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
   * @param id - UUID string. If not provided, a new UUID v4 will be generated.
   * @throws {Error} If the provided ID is not a valid UUID
   */
  private constructor(id: string) {
    super(id);
  }

  public static create(): PollingConfigurationId {
    return new PollingConfigurationId(UniqueEntityID.createId());
  }

  /**
   * Creates a PollingConfigurationId from a UUID string.
   * Useful for converting database UUIDs to domain IDs.
   *
   * @param id - The UUID string (from database or external source)
   * @returns PollingConfigurationId instance
   *
   * @example
   * const configId = PollingConfigurationId.create('550e8400-e29b-41d4-a716-446655440000');
   */
  public static parse(id: string): Result<PollingConfigurationId> {
    const result = PollingConfigurationId.parseId(id);
    if (result.isFailure) {
      return Result.fail(result.error);
    }
    return Result.ok<PollingConfigurationId>(
      new PollingConfigurationId(result.value)
    );
  }
}
