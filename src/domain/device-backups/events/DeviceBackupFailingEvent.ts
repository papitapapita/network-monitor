import { DomainEvent } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';

interface DeviceBackupFailingEventProps {
  readonly aggregateId: DeviceId;
  readonly deviceName: string;
  readonly consecutiveFailures: number;
  readonly failingSince: Date;
  // null when the device has never been backed up.
  readonly lastSuccessAt: Date | null;
  readonly lastError: string;
  readonly dateTimeOccurred: Date;
}

export class DeviceBackupFailingEvent extends DomainEvent<DeviceBackupFailingEventProps> {
  get aggregateId(): DeviceId {
    return this.props.aggregateId;
  }
  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }
  get deviceName(): string {
    return this.props.deviceName;
  }
  get consecutiveFailures(): number {
    return this.props.consecutiveFailures;
  }
  get failingSince(): Date {
    return this.props.failingSince;
  }
  get lastSuccessAt(): Date | null {
    return this.props.lastSuccessAt;
  }
  get lastError(): string {
    return this.props.lastError;
  }
}
