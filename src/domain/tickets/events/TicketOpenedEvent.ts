import { DomainEvent } from 'domain/shared/core';
import { CustomerId, DeviceId, TicketId } from 'domain/shared/ids';

interface TicketOpenedEventProps {
  aggregateId: TicketId;
  title: string;
  priority: string;
  category: string;
  origin: string;
  customerId: CustomerId | null;
  deviceId: DeviceId | null;
  dateTimeOccurred: Date;
}

export class TicketOpenedEvent extends DomainEvent<TicketOpenedEventProps> {
  constructor(props: TicketOpenedEventProps) {
    super(props);
  }

  get aggregateId(): TicketId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get title(): string {
    return this.props.title;
  }

  get priority(): string {
    return this.props.priority;
  }

  get category(): string {
    return this.props.category;
  }

  get origin(): string {
    return this.props.origin;
  }

  get customerId(): CustomerId | null {
    return this.props.customerId;
  }

  get deviceId(): DeviceId | null {
    return this.props.deviceId;
  }
}
