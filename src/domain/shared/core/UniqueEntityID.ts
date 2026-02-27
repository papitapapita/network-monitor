import { Identifier } from './Identifier';
import { UUID } from '../utils/UUID';
import { Result } from './Result';

/**
 * Represents a unique identifier for entities using UUID.
 *
 * This class enforces that all entity IDs are valid UUIDs (RFC 4122).
 * It extends the base {@link Identifier} class and uses the {@link UUID} utility
 * for validation and generation of UUIDs.
 *
 * Features:
 * - Only accepts valid UUID strings
 * - Type-safe UUID handling
 */
export abstract class UniqueEntityID extends Identifier<string> {
  /**
   * Creates a new UniqueEntityID instance.
   *
   * @param {string} [id]  UUID string. If omitted, a new UUID is generated.
   * @throws {Error} If the provided ID is not a valid UUID
   */
  protected constructor(id: string) {
    if (!UUID.isValid(id)) {
      throw new Error(
        `[UniqueEntityID] Invariant violation: "${id}" is not a valid UUID v4. ` +
          `Use generateId() or parseId() in your subclass factory methods.`
      );
    }
    super(id);
  }

  /**
   * Generates a new UUID string for use as an entity ID.
   * @returns {string} A new UUID string
   */
  protected static createId(): string {
    return UUID.create().toValue();
  }

  /**
   * Parses a UUID string and validates it for use as an entity ID.
   *
   * @param {string} id - The UUID string to parse and validate
   * @returns {Result<string>} A Result containing the valid UUID string or an error message
   */
  protected static parseId(id: string): Result<string> {
    const result = UUID.parse(id);
    if (result.isFailure) return Result.fail(result.error);
    return Result.ok(result.value.toValue());
  }

  /**
   * Validates if a string is a valid UUID.
   *
   * @param {string} value - The string to validate
   * @returns {boolean} true if valid UUID, false otherwise
   */
  public static isValid(value: string): boolean {
    return UUID.isValid(value);
  }
}
