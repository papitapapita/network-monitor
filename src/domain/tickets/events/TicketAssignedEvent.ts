import { DomainEvent } from 'domain/shared/core';
import { TechnicianId, TicketId } from 'domain/shared/ids';

interface TicketAssignedEventProps {
  aggregateId: TicketId;
  previousTechnicianId: TechnicianId | null;
  newTechnicianId: TechnicianId;
  scheduledFor: Date | null;
  dateTimeOccurred: Date;
}

export class TicketAssignedEvent extends DomainEvent<TicketAssignedEventProps> {
  constructor(props: TicketAssignedEventProps) {
    super(props);
  }

  get aggregateId(): TicketId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get previousTechnicianId(): TechnicianId | null {
    return this.props.previousTechnicianId;
  }

  get newTechnicianId(): TechnicianId {
    return this.props.newTechnicianId;
  }

  get scheduledFor(): Date | null {
    return this.props.scheduledFor;
  }
}
