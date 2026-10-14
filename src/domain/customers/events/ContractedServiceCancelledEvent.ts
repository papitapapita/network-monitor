import { DomainEvent } from 'domain/shared/core';
import { ContractedServiceId, DeviceId } from 'domain/shared/ids';

interface ContractedServiceCancelledEventProps {
  aggregateId: ContractedServiceId;
  releasedDeviceId: DeviceId | null;
  dateTimeOccurred: Date;
}

export class ContractedServiceCancelledEvent extends DomainEvent<ContractedServiceCancelledEventProps> {
  constructor(props: ContractedServiceCancelledEventProps) {
    super(props);
  }

  get aggregateId(): ContractedServiceId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get releasedDeviceId(): DeviceId | null {
    return this.props.releasedDeviceId;
  }
}
