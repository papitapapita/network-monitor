import { DomainEvent } from 'domain/shared/core';
import { CustomerId } from 'domain/shared/ids';

interface CustomerCreatedEventProps {
  aggregateId: CustomerId;
  fullName: string;
  phone: string;
  dateTimeOccurred: Date;
}

export class CustomerCreatedEvent extends DomainEvent<CustomerCreatedEventProps> {
  constructor(props: CustomerCreatedEventProps) {
    super(props);
  }

  get aggregateId(): CustomerId {
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
