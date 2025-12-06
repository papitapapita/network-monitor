import { v4 as uuidv4, validate as validateUuid } from 'uuid';
import { Result } from '@/core/Result';

/**
 * UUID Value Object
 *
 * Represents a universally unique identifier (UUID) following RFC 4122.
 * This value object ensures type safety and validation for all UUIDs in the domain.
 *
 * Features:
 * - Automatic generation of v4 UUIDs (random)
 * - Validation of existing UUID strings
 * - Type-safe UUID representation
 * - Immutability
 * - Equality comparison
 *
 * @example
 * ```typescript
 * // Generate a new UUID
 * const newId = UUID.create();
 * console.log(newId.getValue().value); // "550e8400-e29b-41d4-a716-446655440000"
 *
 * // Create from existing valid UUID
 * const existingId = UUID.create("550e8400-e29b-41d4-a716-446655440000");
 * if (existingId.isSuccess) {
 *   console.log(existingId.getValue().value);
 * }
 *
 * // Create from invalid UUID
 * const invalidId = UUID.create("invalid-uuid");
 * if (invalidId.isFailure) {
 *   console.log(invalidId.getErrorValue()); // "Invalid UUID format: invalid-uuid"
 * }
 * ```
 */
export class UUID {
  private readonly _value: string;

  /**
   * Private constructor to enforce creation through static factory methods.
   *
   * @param value - The UUID string value
   */
  private constructor(value: string) {
    this._value = value;
  }

  /**
   * Gets the UUID string value.
   */
  get value(): string {
    return this._value;
  }

  /**
   * Creates a new UUID instance.
   *
   * If no value is provided, generates a new v4 UUID.
   * If a value is provided, validates it before creating the instance.
   *
   * @param value - Optional UUID string. If omitted, generates a new UUID.
   * @returns Result containing the UUID instance or an error message
   */
  public static create(value?: string): Result<UUID> {
    // If no value provided, generate a new UUID
    if (!value) {
      const newUuid = uuidv4();
      return Result.ok<UUID>(new UUID(newUuid));
    }

    // Validate the provided UUID
    if (!validateUuid(value)) {
      return Result.fail<UUID>(
        `Invalid UUID format: ${value}. Expected format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
      );
    }

    return Result.ok<UUID>(new UUID(value));
  }

  /**
   * Checks if this UUID equals another UUID.
   *
   * @param other - The UUID to compare with
   * @returns true if the UUIDs are equal, false otherwise
   */
  public equals(other?: UUID): boolean {
    if (!other) {
      return false;
    }
    return this._value === other._value;
  }

  /**
   * Returns the string representation of the UUID.
   *
   * @returns The UUID string
   */
  public toString(): string {
    return this._value;
  }

  /**
   * Returns the raw value of the UUID.
   *
   * Useful for serialization and persistence.
   *
   * @returns The UUID string
   */
  public toValue(): string {
    return this._value;
  }

  /**
   * Validates if a string is a valid UUID.
   *
   * Utility method for validation without creating an instance.
   *
   * @param value - The string to validate
   * @returns true if valid UUID, false otherwise
   */
  public static isValid(value: string): boolean {
    return validateUuid(value);
  }
}
