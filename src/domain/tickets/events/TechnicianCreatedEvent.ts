import { DomainEvent } from 'domain/shared/core';
import { TechnicianId } from 'domain/shared/ids';

interface TechnicianCreatedEventProps {
  aggregateId: TechnicianId;
  fullName: string;
  phone: string;
  dateTimeOccurred: Date;
}

export class TechnicianCreatedEvent extends DomainEvent<TechnicianCreatedEventProps> {
  constructor(props: TechnicianCreatedEventProps) {
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

  get phone(): string {
    return this.props.phone;
  }
}
