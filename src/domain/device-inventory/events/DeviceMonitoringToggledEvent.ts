import { IPAddress } from 'domain/shared/value-objects';
import { DomainEvent } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { DeviceMonitoringToggledEventProps } from '../props';
import { DeviceName } from '../value-objects';

export class DeviceMonitoringToggledEvent extends DomainEvent<DeviceMonitoringToggledEventProps> {
  get aggregateId(): DeviceId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get deviceName(): DeviceName {
    return this.props.deviceName;
  }

  get monitoringEnabled(): boolean {
    return this.props.monitoringEnabled;
  }

  get ipAddress(): IPAddress {
    return this.props.ipAddress;
  }
}
