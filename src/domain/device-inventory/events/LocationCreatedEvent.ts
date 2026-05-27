import { DomainEvent } from 'domain/shared/core';
import { LocationId } from 'domain/shared/ids';
import { LocationCreatedEventProps } from '../props';
import { LocationType } from '../enums';

export class LocationCreatedEvent extends DomainEvent<LocationCreatedEventProps> {
  constructor(props: LocationCreatedEventProps) {
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

  get locationType(): LocationType {
    return this.props.locationType;
  }
}
