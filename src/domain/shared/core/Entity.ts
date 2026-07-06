import { UniqueEntityID } from './UniqueEntityID';

export abstract class Entity<T, TID extends UniqueEntityID> {
  protected readonly _id: TID;
  protected props: T;

  protected constructor(props: T, id: TID) {
    this._id = id;
    this.props = props;
  }

  get id(): TID {
    return this._id;
  }

  // Equality is ID-based, not structural — two entities with the same ID are
  // the same object regardless of their current property values.
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

  public static isEntity(v: unknown) {
    return v instanceof Entity;
  }
}
