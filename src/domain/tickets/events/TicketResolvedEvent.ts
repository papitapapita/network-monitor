import { DomainEvent } from 'domain/shared/core';
import { TechnicianId, TicketId } from 'domain/shared/ids';

interface TicketResolvedEventProps {
  aggregateId: TicketId;
  technicianId: TechnicianId | null;
  resolutionNotes: string;
  resolvedAt: Date;
  dateTimeOccurred: Date;
}

export class TicketResolvedEvent extends DomainEvent<TicketResolvedEventProps> {
  constructor(props: TicketResolvedEventProps) {
    super(props);
  }

  get aggregateId(): TicketId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get technicianId(): TechnicianId | null {
    return this.props.technicianId;
  }

  get resolutionNotes(): string {
    return this.props.resolutionNotes;
  }

  get resolvedAt(): Date {
    return this.props.resolvedAt;
  }
}
