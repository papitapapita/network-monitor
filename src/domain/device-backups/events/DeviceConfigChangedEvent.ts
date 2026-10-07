import { DomainEvent } from 'domain/shared/core';
import { ConfigBackupId, DeviceId } from 'domain/shared/ids';

interface DeviceConfigChangedEventProps {
  // The new version.
  readonly aggregateId: ConfigBackupId;
  readonly deviceId: DeviceId;
  readonly deviceName: string;
  readonly previousBackupId: ConfigBackupId;
  // When the device was last seen still holding the previous version: the
  // change happened between then and now.
  readonly previousCheckedAt: Date;
  readonly dateTimeOccurred: Date;
}

export class DeviceConfigChangedEvent extends DomainEvent<DeviceConfigChangedEventProps> {
  get aggregateId(): ConfigBackupId {
    return this.props.aggregateId;
  }
  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }
  get deviceId(): DeviceId {
    return this.props.deviceId;
  }
  get deviceName(): string {
    return this.props.deviceName;
  }
  get previousBackupId(): ConfigBackupId {
    return this.props.previousBackupId;
  }
  get previousCheckedAt(): Date {
    return this.props.previousCheckedAt;
  }
}
