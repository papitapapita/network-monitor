import { UniqueEntityID } from '../shared/kernel/UniqueEntityID';

/**
 * PollingResultId - Unique identifier for PollingResult aggregate
 *
 * Type-safe wrapper around the polling result's unique identifier.
 * Extends UniqueEntityID to ensure compatibility with Entity base class
 * while providing domain-specific type safety.
 *
 * PollingResult is an immutable aggregate that captures the outcome
 * of a single polling operation at a specific point in time.
 *
 * @example
 * // Create with existing ID (from database)
 * const resultId = new PollingResultId('550e8400-e29b-41d4-a716-446655440000');
 *
 * // Create new ID (auto-generates UUID)
 * const newResultId = new PollingResultId();
 *
 * // Get raw value for persistence
 * const idValue = resultId.toValue();
 */
export class PollingResultId extends UniqueEntityID {
  /**
   * Creates a new PollingResultId instance.
   *
   * @param id - Optional unique identifier value (UUID string or number).
   *             If not provided, a UUID will be auto-generated.
   */
  constructor(id?: string | number) {
    super(id);
  }

  /**
   * Creates a PollingResultId from a raw string or number value.
   * Useful for converting database IDs to domain IDs.
   *
   * @param id - The raw identifier (typically UUID string from database)
   * @returns PollingResultId instance
   *
   * @example
   * const resultId = PollingResultId.create('550e8400-e29b-41d4-a716-446655440000');
   */
  public static create(id: string | number): PollingResultId {
    return new PollingResultId(id);
  }
}
