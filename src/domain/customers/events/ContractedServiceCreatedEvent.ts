import { DomainEvent } from 'domain/shared/core';
import {
  ContractedServiceId,
  CustomerId,
  ServicePlanId
} from 'domain/shared/ids';
import { ContractedServiceStatus } from '../enums';

interface ContractedServiceCreatedEventProps {
  aggregateId: ContractedServiceId;
  customerId: CustomerId;
  servicePlanId: ServicePlanId;
  status: ContractedServiceStatus;
  dateTimeOccurred: Date;
}

export class ContractedServiceCreatedEvent extends DomainEvent<ContractedServiceCreatedEventProps> {
  constructor(props: ContractedServiceCreatedEventProps) {
    super(props);
  }

  get aggregateId(): ContractedServiceId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get customerId(): CustomerId {
    return this.props.customerId;
  }

  get servicePlanId(): ServicePlanId {
    return this.props.servicePlanId;
  }

  get status(): ContractedServiceStatus {
    return this.props.status;
  }
}
