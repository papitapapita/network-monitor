import { IPAddress } from 'domain/shared';
import { DomainEvent } from '../../shared/core';
import { DeviceId } from '../../shared/ids';
import { DeviceMonitoringToggledEventProps } from '../props';
import { DeviceName } from '../value-objects';

/**
 * DeviceMonitoringToggledEvent - Monitoring has been enabled or disabled for a device.
 *
 * Published By: Device aggregate
 * Published When: Device.enableMonitoring() or Device.disableMonitoring() is called
 * and the monitoring state actually changes
 *
 * Handlers:
 * - PollingSchedulerHandler: Adds or removes device from the active polling schedule
 * - AuditLogHandler: Records the monitoring configuration change
 *
 * Use Cases:
 * - EnableDeviceMonitoringUseCase
 * - DisableDeviceMonitoringUseCase
 */
export class DeviceMonitoringToggledEvent extends DomainEvent<DeviceMonitoringToggledEventProps> {
  constructor(props: DeviceMonitoringToggledEventProps) {
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

  get monitoringEnabled(): boolean {
    return this.props.monitoringEnabled;
  }

  get ipAddress(): IPAddress | null {
    return this.props.ipAddress;
  }
}
