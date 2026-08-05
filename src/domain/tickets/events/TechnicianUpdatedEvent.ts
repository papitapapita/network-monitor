import { DomainEvent } from 'domain/shared/core';
import { TechnicianId } from 'domain/shared/ids';

interface TechnicianUpdatedEventProps {
  aggregateId: TechnicianId;
  fullName: string;
  changedFields: string[];
  dateTimeOccurred: Date;
}

export class TechnicianUpdatedEvent extends DomainEvent<TechnicianUpdatedEventProps> {
  constructor(props: TechnicianUpdatedEventProps) {
    super(props);
  }

  get aggregateId(): TechnicianId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get fullName(): string {
    return this.props.fullName;
  }

  get changedFields(): string[] {
    return this.props.changedFields;
  }
}
