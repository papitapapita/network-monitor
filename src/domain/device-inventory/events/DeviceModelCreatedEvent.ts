import { DomainEvent } from '../../shared/core';
import { DeviceModelId } from '../../shared/ids';

interface DeviceModelCreatedEventProps {
  aggregateId: DeviceModelId;
  vendorName: string;
  model: string;
  dateTimeOccurred: Date;
}

export class DeviceModelCreatedEvent extends DomainEvent<DeviceModelCreatedEventProps> {
  constructor(props: DeviceModelCreatedEventProps) {
    super(props);
  }

  get aggregateId(): DeviceModelId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get vendorName(): string {
    return this.props.vendorName;
  }

  get model(): string {
    return this.props.model;
  }
}
