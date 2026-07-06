import { DomainEvent } from 'domain/shared/core';
import { ContractedServiceId, DeviceId } from 'domain/shared/ids';

interface DeviceAssignedToServiceEventProps {
  aggregateId: ContractedServiceId;
  previousDeviceId: DeviceId | null;
  newDeviceId: DeviceId | null;
  dateTimeOccurred: Date;
}

export class DeviceAssignedToServiceEvent extends DomainEvent<DeviceAssignedToServiceEventProps> {
  constructor(props: DeviceAssignedToServiceEventProps) {
    super(props);
  }

  get aggregateId(): ContractedServiceId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get previousDeviceId(): DeviceId | null {
    return this.props.previousDeviceId;
  }

  get newDeviceId(): DeviceId | null {
    return this.props.newDeviceId;
  }
}
