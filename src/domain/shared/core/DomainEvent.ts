import { UniqueEntityID } from './UniqueEntityID';
import { IDomainEvent } from '../interfaces';

export abstract class DomainEvent<TProps> implements IDomainEvent {
  protected readonly props: Readonly<TProps>;

  constructor(props: TProps) {
    // freeze props so all subclass getters return immutable data
    this.props = Object.freeze({ ...props }) as Readonly<TProps>;
  }

  abstract get aggregateId(): UniqueEntityID;

  abstract get dateTimeOccurred(): Date;

  public toString(): string {
    return `${this.constructor.name}(aggregateId: ${this.aggregateId.toString()}, occurred: ${this.dateTimeOccurred.toISOString()})`;
  }
}
