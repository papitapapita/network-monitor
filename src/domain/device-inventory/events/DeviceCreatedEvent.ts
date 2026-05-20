import { DomainEvent } from '../../shared/core';
import { DeviceId } from '../../shared/ids';
import { DeviceCreatedEventProps } from '../props';
import { DeviceStatus, DeviceName } from '../value-objects';
import { DeviceOwnerType } from '../enums';
import { IPAddress } from 'domain/shared';

export class DeviceCreatedEvent extends DomainEvent<DeviceCreatedEventProps> {
  get aggregateId(): DeviceId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get deviceName(): DeviceName {
    return this.props.deviceName;
  }

  get status(): DeviceStatus {
    return this.props.status;
  }

  get ownerType(): DeviceOwnerType | null {
    return this.props.ownerType;
  }

  get monitoringEnabled(): boolean {
    return this.props.monitoringEnabled;
  }

  get ipAddress(): IPAddress | null {
    return this.props.ipAddress;
  }
}
