import { DomainEvent } from '../../shared/core';
import { DeviceId } from '../../shared/ids';
import { DeviceDetailsUpdatedEventProps } from '../props';
import { DeviceName } from '../value-objects';

/**
 * DeviceDetailsUpdatedEvent - The mutable details of a physical device have been updated.
 *
 * Published By: Device aggregate
 * Published When: Device.updateDetails() is called with at least one field to change
 *
 * Handlers:
 * - AuditLogHandler: Records the detail changes for audit trail
 * - SearchIndexHandler: Re-indexes device data for search
 *
 * Use Cases:
 * - UpdateDeviceUseCase
 */
export class DeviceDetailsUpdatedEvent extends DomainEvent<DeviceDetailsUpdatedEventProps> {
  constructor(props: DeviceDetailsUpdatedEventProps) {
    super(props);
  }

  get aggregateId(): DeviceId {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get deviceName(): DeviceName {
    return this.props.deviceName;
  }

  get updatedFields(): DeviceDetailsUpdatedEventProps['updatedFields'] {
    return this.props.updatedFields;
  }
}
