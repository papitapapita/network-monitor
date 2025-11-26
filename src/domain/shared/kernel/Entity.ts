import { UniqueEntityID } from './UniqueEntityID';

/**
 * Base class for all domain entities.
 *
 * Entities are domain objects that have a unique identity (ID) and may have
 * mutable or immutable properties. Their identity is defined by their
 * {@link UniqueEntityID}, and equality between entities is determined by
 * comparing their IDs.
 *
 * @template T The shape of the entity's properties.
 */
export abstract class Entity<T> {
  /**
   * The unique identifier of the entity.
   * @protected
   */
  protected readonly _id: UniqueEntityID;

  /**
   * The internal properties of the entity.
   * @protected
   */
  protected props: T;

  /**
   * Creates a new entity instance.
   *
   * @param {T} props - The properties that define the entity's state.
   * @param {UniqueEntityID} [id] - Optional pre-existing unique identifier. If omitted, a new one is generated.
   */
  constructor(props: T, id?: UniqueEntityID) {
    this._id = id ? id : new UniqueEntityID();
    this.props = props;
  }

  /**
   * Gets the unique identifier of the entity.
   *
   * @returns {UniqueEntityID} The entity's ID.
   */
  get id(): UniqueEntityID {
    return this._id;
  }

  /**
   * Compares this entity with another to determine if they are equal.
   *
   * Two entities are equal if:
   * - They are the same reference, or
   * - They are both entities and their IDs match.
   *
   * @param {Entity<T>} [object] - The entity to compare with.
   * @returns {boolean} True if both represent the same entity, otherwise false.
   */
  public equals(object?: Entity<T>): boolean {
    if (object === null || object === undefined) {
      return false;
    }

    if (this === object) {
      return true;
    }

    if (!Entity.isEntity(object)) {
      return false;
    }

    return this._id.equals(object._id);
  }

  /**
   * Type guard that checks whether a given value is an Entity.
   *
   * @private
   * @param {unknown} v - The value to check.
   * @returns {v is Entity<unknown>} True if the value is an Entity instance.
   */
  private static isEntity(v: unknown): v is Entity<unknown> {
    return v instanceof Entity;
  }
}
