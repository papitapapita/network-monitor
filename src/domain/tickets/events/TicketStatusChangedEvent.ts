import { DomainEvent } from 'domain/shared/core';
import { TicketId } from 'domain/shared/ids';

interface TicketStatusChangedEventProps {
  aggregateId: TicketId;
  previousStatus: string;
  newStatus: string;
  dateTimeOccurred: Date;
}

export class TicketStatusChangedEvent extends DomainEvent<TicketStatusChangedEventProps> {
  constructor(props: TicketStatusChangedEventProps) {
    super(props);
  }

  get aggregateId(): TicketId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get previousStatus(): string {
    return this.props.previousStatus;
  }

  get newStatus(): string {
    return this.props.newStatus;
  }
}
