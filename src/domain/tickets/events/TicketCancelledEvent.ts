import { DomainEvent } from 'domain/shared/core';
import { TicketId } from 'domain/shared/ids';

interface TicketCancelledEventProps {
  aggregateId: TicketId;
  reason: string;
  cancelledAt: Date;
  dateTimeOccurred: Date;
}

export class TicketCancelledEvent extends DomainEvent<TicketCancelledEventProps> {
  constructor(props: TicketCancelledEventProps) {
    super(props);
  }

  get aggregateId(): TicketId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get reason(): string {
    return this.props.reason;
  }

  get cancelledAt(): Date {
    return this.props.cancelledAt;
  }
}
