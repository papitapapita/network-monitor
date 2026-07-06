import { DomainEvent } from 'domain/shared/core';
import { ContractedServiceId } from 'domain/shared/ids';
import { ContractedServiceStatus } from '../enums';

interface ContractedServiceStatusChangedEventProps {
  aggregateId: ContractedServiceId;
  previousStatus: ContractedServiceStatus;
  newStatus: ContractedServiceStatus;
  dateTimeOccurred: Date;
}

export class ContractedServiceStatusChangedEvent extends DomainEvent<ContractedServiceStatusChangedEventProps> {
  constructor(props: ContractedServiceStatusChangedEventProps) {
    super(props);
  }

  get aggregateId(): ContractedServiceId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get previousStatus(): ContractedServiceStatus {
    return this.props.previousStatus;
  }

  get newStatus(): ContractedServiceStatus {
    return this.props.newStatus;
  }
}
