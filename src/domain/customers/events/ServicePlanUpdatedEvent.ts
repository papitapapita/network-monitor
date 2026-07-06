import { DomainEvent } from 'domain/shared/core';
import { ServicePlanId } from 'domain/shared/ids';

interface ServicePlanUpdatedEventProps {
  aggregateId: ServicePlanId;
  name: string;
  changedFields: string[];
  dateTimeOccurred: Date;
}

export class ServicePlanUpdatedEvent extends DomainEvent<ServicePlanUpdatedEventProps> {
  constructor(props: ServicePlanUpdatedEventProps) {
    super(props);
  }

  get aggregateId(): ServicePlanId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get name(): string {
    return this.props.name;
  }

  get changedFields(): string[] {
    return this.props.changedFields;
  }
}
