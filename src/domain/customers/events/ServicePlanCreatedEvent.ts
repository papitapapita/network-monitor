import { DomainEvent } from 'domain/shared/core';
import { ServicePlanId } from 'domain/shared/ids';

interface ServicePlanCreatedEventProps {
  aggregateId: ServicePlanId;
  name: string;
  monthlyPrice: number;
  dateTimeOccurred: Date;
}

export class ServicePlanCreatedEvent extends DomainEvent<ServicePlanCreatedEventProps> {
  constructor(props: ServicePlanCreatedEventProps) {
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

  get monthlyPrice(): number {
    return this.props.monthlyPrice;
  }
}
