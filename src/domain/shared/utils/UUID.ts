import { Result } from '../core/Result';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * UUID utility class providing type-safe UUID v4 handling.
 *
 * Intentionally exposes two distinct static factory methods with different
 * return types to reflect the two semantically different contexts in which
 * a UUID string originates:
 *
 * - {@link UUID.generate} — no input; always succeeds.
 * - {@link UUID.parse} — untrusted string input; may fail.
 *
 * For trusted sources (e.g. DB rows reconstituted by a mapper), call
 * `UUID.parse(value)` and handle the `Result` at the call site — the
 * caller knows whether failure represents a user error or a data-integrity
 * violation and can throw or propagate accordingly.
 */
export class UUID {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  /**
   * Generates a new, cryptographically random UUID v4.
   *
   * @returns A new `UUID` instance.
   *
   * @example
   * const id = UUID.generate();
   * console.log(id.value); // "e.g. 550e8400-e29b-41d4-a716-446655440000"
   */
  public static generate(): UUID {
    return new UUID(crypto.randomUUID());
  }

  /**
   * Parses an existing UUID v4 string into a `UUID` instance.
   *
   * Use this whenever the UUID originates outside this process — whether
   * from user input, an HTTP request, a message queue, or a DB row being
   * reconstituted by a mapper. The caller decides how to handle failure:
   * propagate the `Result` for user-facing errors, or throw for
   * data-integrity violations.
   *
   * @param value - The UUID string to validate and wrap.
   * @returns `Result.ok` containing the `UUID`, or `Result.fail` with a
   *          descriptive error message if the format is invalid.
   *
   * @example
   * // User input — propagate the Result
   * const result = UUID.parse(dto.id);
   * if (result.isFailure) return Result.fail(result.error);
   *
   * // DB mapper — treat failure as a data-integrity error
   * const result = UUID.parse(row.id);
   * if (result.isFailure) throw new Error(`Data integrity violation: ${result.error}`);
   */
  public static parse(value: string): Result<UUID> {
    if (!UUID_V4_REGEX.test(value)) {
      return Result.fail<UUID>(
        `Invalid UUID format: ${value}. Expected format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
      );
    }

    return Result.ok<UUID>(new UUID(value.toLowerCase()));
  }

  /**
   * Returns `true` if the given string is a valid UUID v4.
   *
   * Useful for guard clauses and conditional checks without constructing
   * a `UUID` instance.
   *
   * @param value - The string to validate.
   */
  public static isValid(value: string): boolean {
    return UUID_V4_REGEX.test(value);
  }

  /**
   * Compares this UUID with another for value equality.
   *
   * @param other - The UUID to compare with.
   * @Returns `false` if `undefined`.
   */
  public equals(other?: UUID): boolean {
    if (!other) return false;
    return this._value === other._value;
  }

  /** Returns the UUID string. */
  public toString(): string {
    return this._value;
  }

  /**
   * Returns the raw UUID string.
   *
   * Intended for serialisation and persistence layers.
   */
  public toValue(): string {
    return this._value;
  }
}
