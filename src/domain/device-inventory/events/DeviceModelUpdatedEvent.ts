import { DomainEvent } from '../../shared/core';
import { DeviceModelId } from '../../shared/ids';

interface DeviceModelUpdatedEventProps {
  aggregateId: DeviceModelId;
  model: string;
  changedFields: string[];
  dateTimeOccurred: Date;
}

export class DeviceModelUpdatedEvent extends DomainEvent<DeviceModelUpdatedEventProps> {
  constructor(props: DeviceModelUpdatedEventProps) {
    super(props);
  }

  get aggregateId(): DeviceModelId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get model(): string {
    return this.props.model;
  }

  get changedFields(): string[] {
    return this.props.changedFields;
  }
}
