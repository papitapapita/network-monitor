import { UniqueEntityID } from '../core';

export interface IDomainEvent {
  dateTimeOccurred: Date;
  aggregateId: UniqueEntityID;
}
