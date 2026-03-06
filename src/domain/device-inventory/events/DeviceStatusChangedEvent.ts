import { DomainEvent } from '../../shared/core';
import { DeviceId } from '../../shared/ids';
import { DeviceStatusChangedEventProps } from '../props';
import { DeviceStatus, DeviceName } from '../value-objects';

/**
 * DeviceStatusChangedEvent - The operational status of a physical device has changed.
 *
 * Published By: Device aggregate
 * Published When: Device.changeStatus() is called with a different status value
 *
 * Handlers:
 * - AlertHandler: Sends an alert when a device enters DAMAGED or DECOMMISSIONED state
 * - MonitoringHandler: Pauses monitoring when device enters MAINTENANCE or DECOMMISSIONED
 * - AuditLogHandler: Records the status transition for audit trail
 *
 * Use Cases:
 * - UpdateDeviceStatusUseCase
 */
export class DeviceStatusChangedEvent extends DomainEvent<DeviceStatusChangedEventProps> {
  constructor(props: DeviceStatusChangedEventProps) {
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

  get previousStatus(): DeviceStatus {
    return this.props.previousStatus;
  }

  get newStatus(): DeviceStatus {
    return this.props.newStatus;
  }
}
