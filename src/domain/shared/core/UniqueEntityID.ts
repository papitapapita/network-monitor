import { Identifier } from './Identifier';
import { UUID } from './UUID';

/**
 * Represents a unique identifier for entities using UUID.
 *
 * This class enforces that all entity IDs are valid UUIDs (RFC 4122).
 * It extends the base {@link Identifier} class and uses the {@link UUID} value object
 * to ensure type safety and validation.
 *
 * Features:
 * - Only accepts valid UUID strings (validated by uuid package)
 * - Automatically generates new UUIDs if none provided
 * - Type-safe UUID handling
 * - Immutable
 *
 * @example
 * ```typescript
 * // Create with auto-generated UUID
 * const id1 = new UniqueEntityID();
 * console.log(id1.toString()); // "550e8400-e29b-41d4-a716-446655440000"
 *
 * // Create with existing UUID
 * const id2 = new UniqueEntityID("550e8400-e29b-41d4-a716-446655440000");
 *
 * // Invalid UUID throws error
 * const id3 = new UniqueEntityID("invalid"); // Throws error
 * ```
 */
export abstract class UniqueEntityID extends Identifier<string> {
  /**
   * Creates a new UniqueEntityID instance.
   *
   * If an ID is not provided, a new UUID v4 will be generated automatically.
   * If an ID is provided, it must be a valid UUID or an error will be thrown.
   *
   * @param {string} [id] - Optional UUID string. If omitted, a new UUID is generated.
   * @throws {Error} If the provided ID is not a valid UUID
   */
  protected constructor(id?: string) {
    const uuidResult = UUID.create(id);

    if (!uuidResult.isSuccess) {
      throw new Error(uuidResult.error);
    }

    const uuid = uuidResult.value;
    super(uuid.value);
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
