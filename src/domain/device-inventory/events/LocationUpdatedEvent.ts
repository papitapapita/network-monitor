import { DomainEvent } from '../../shared/core';
import { LocationId } from '../../shared/ids';
import { LocationUpdatedEventProps } from '../props';

export class LocationUpdatedEvent extends DomainEvent<LocationUpdatedEventProps> {
  constructor(props: LocationUpdatedEventProps) {
    super(props);
  }

  get aggregateId(): LocationId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get locationName(): string {
    return this.props.locationName;
  }

  get changedFields(): string[] {
    return this.props.changedFields;
  }

  get previousValues(): Record<string, unknown> {
    return this.props.previousValues;
  }

  get newValues(): Record<string, unknown> {
    return this.props.newValues;
  }
}
