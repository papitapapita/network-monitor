/**
 * Represents the shape of the properties allowed for a Value Object.
 *
 * Value Objects hold immutable data and must be compared by their properties,
 * not by identity.
 */
interface ValueObjectProps {
  [index: string]: any;
}

/**
 * Base class for Value Objects used in Domain-Driven Design (DDD).
 *
 * Value Objects represent immutable concepts in the domain. They do not have
 * identity and must be compared purely by the equality of their properties.
 *
 * @template T Extends the set of allowed properties for the Value Object.
 */
export abstract class ValueObject<T extends ValueObjectProps> {
  /**
   * Immutable properties that define the Value Object.
   * @protected
   */
  protected readonly props: T;

  /**
   * Creates a new immutable Value Object.
   *
   * The provided props object is deeply frozen to prevent any mutation.
   *
   * @param {T} props - The set of properties representing the value.
   */
  constructor(props: T) {
    this.props = Object.freeze(props);
  }

  /**
   * Compares this Value Object to another to determine if they are equal.
   *
   * Two Value Objects are equal if:
   * - The other object is defined
   * - Both have properties (`props`)
   * - Their properties are structurally identical
   *
   * Note: Uses `JSON.stringify` for deep comparison. Suitable for small,
   * simple Value Objects, but for performance-sensitive cases, consider
   * a custom comparison method.
   *
   * @param {ValueObject<T>} [vo] - The Value Object to compare against.
   * @returns {boolean} True if both Value Objects have the same properties.
   */
  public equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }
    if (!(vo instanceof ValueObject)) {
      return false;
    }
    if (vo.props === undefined) {
      return false;
    }
    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }
}
