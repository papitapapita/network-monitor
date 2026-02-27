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
 * @template TID The type of the entity's unique identifier, extending {@link UniqueEntityID}.
 * @property {TID} id - The unique identifier of the entity.
 * @property {T} props - The properties that define the entity's state.
 */
export abstract class Entity<T, TID extends UniqueEntityID> {
  protected readonly _id: TID;
  protected props: T;

  /**
   * @param {T} props - The properties that define the entity's state.
   * @param {TID} id - The unique identifier for this entity. Must be created by the concrete entity's factory method.
   */
  protected constructor(props: T, id: TID) {
    this._id = id;
    this.props = props;
  }

  get id(): TID {
    return this._id;
  }

  /**
   * Compares this entity with another to determine if they are equal.
   *
   * Two entities are equal if:
   * - They are the same reference, or
   * - They are both entities and their IDs match.
   *
   * @param {Entity<T, TID>} [object] - The entity to compare with.
   * @returns {boolean} True if both represent the same entity, otherwise false.
   */
  public equals(object?: Entity<T, TID>): boolean {
    if (object === null || object === undefined) {
      return false;
    }

    if (this === object) {
      return true;
    }

    if (!Entity.isEntity(object)) {
      return false;
    }

    return this._id.equals(object.id);
  }

  /**
   * Type guard that checks whether a given value is an Entity.
   *
   * @private
   * @param {unknown} v - The value to check.
   * @returns True if the value is an Entity instance.
   */
  public static isEntity(v: unknown) {
    return v instanceof Entity;
  }
}
