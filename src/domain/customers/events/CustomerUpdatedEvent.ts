import { DomainEvent } from 'domain/shared/core';
import { CustomerId } from 'domain/shared/ids';

interface CustomerUpdatedEventProps {
  aggregateId: CustomerId;
  fullName: string;
  changedFields: string[];
  dateTimeOccurred: Date;
}

export class CustomerUpdatedEvent extends DomainEvent<CustomerUpdatedEventProps> {
  constructor(props: CustomerUpdatedEventProps) {
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

  get changedFields(): string[] {
    return this.props.changedFields;
  }
}
