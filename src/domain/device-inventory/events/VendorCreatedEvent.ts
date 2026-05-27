import { DomainEvent } from 'domain/shared/core';
import { VendorId } from 'domain/shared/ids';

interface VendorCreatedEventProps {
  aggregateId: VendorId;
  vendorName: string;
  vendorSlug: string;
  dateTimeOccurred: Date;
}

export class VendorCreatedEvent extends DomainEvent<VendorCreatedEventProps> {
  constructor(props: VendorCreatedEventProps) {
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

  get vendorSlug(): string {
    return this.props.vendorSlug;
  }
}
