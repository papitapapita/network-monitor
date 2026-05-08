import { DomainEvent } from '../../shared/core';
import { VendorId } from '../../shared/ids';

interface VendorUpdatedEventProps {
  aggregateId: VendorId;
  vendorName: string;
  changedFields: string[];
  dateTimeOccurred: Date;
}

export class VendorUpdatedEvent extends DomainEvent<VendorUpdatedEventProps> {
  constructor(props: VendorUpdatedEventProps) {
    super(props);
  }

  get aggregateId(): VendorId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get vendorName(): string {
    return this.props.vendorName;
  }

  get changedFields(): string[] {
    return this.props.changedFields;
  }
}
