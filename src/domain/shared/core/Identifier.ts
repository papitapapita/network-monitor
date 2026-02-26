/**
 * Generic Identifier wrapper to ensure strong typing and identity
 * comparison for entity IDs or value objects.
 *
 * @template T The primitive type of the identifier's internal value (e.g., string, number, UUID).
 */
export class Identifier<T> {
  private _value: T;
  /**
   * @param {T} value - The underlying primitive value representing the identifier.
   */
  constructor(value: T) {
    this._value = value;
  }

  /**
   * Checks whether this identifier is equal to another identifier.
   *
   * Two identifiers are considered equal if:
   * - The other identifier is not null or undefined.
   * - Both instances are of the same class.
   * - Their internal values are strictly equal.
   *
   * @param {Identifier<T>} [id] - The identifier to compare with.
   * @returns {boolean} True if the identifiers are equal; otherwise, false.
   */
  public equals(id: Identifier<T>): boolean {
    if (id === null || id === undefined) {
      return false;
    }
    if (!(id instanceof this.constructor)) {
      return false;
    }
    if (id instanceof Identifier) {
      return id.toValue() === this.toValue();
    }

    return false;
  }

  /**
   * Converts the identifier value to a string representation.
   *
   * @returns {string} The identifier value converted to a string.
   */
  public toString(): string {
    return String(this._value);
  }

  /**
   * Returns the raw underlying value of the identifier.
   *
   * Useful when persisting or serializing the ID.
   *
   * @returns {T} The internal primitive value.
   */
  public toValue(): T {
    return this._value;
  }
}
