import { Result } from '../shared/kernel';
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
   * @param id - Optional UUID string. If not provided, a new UUID v4 will be generated.
   * @throws {Error} If the provided ID is not a valid UUID
   */
  private constructor(id?: string) {
    super(id);
  }

  /**
   * Creates a PollingResultId from a UUID string.
   * Useful for converting database UUIDs to domain IDs.
   *
   * @param id - The UUID string (from database or external source)
   * @returns PollingResultId instance
   * @throws {Error} If the provided ID is not a valid UUID
   *
   * @example
   * const resultId = PollingResultId.create('550e8400-e29b-41d4-a716-446655440000');
   */
  public static create(id?: string): Result<PollingResultId> {
    try {
      const pollingResultId = new PollingResultId(id);
      return Result.ok<PollingResultId>(pollingResultId);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<PollingResultId>(errorMessage);
    }
  }
}
