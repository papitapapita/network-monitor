import { IPAddress } from 'domain/shared';
import { DeviceId } from 'domain/shared/ids';
import { DeviceName } from '../value-objects';

export interface DeviceMonitoringToggledEventProps {
  readonly aggregateId: DeviceId;
  readonly deviceName: DeviceName;
  readonly monitoringEnabled: boolean;
  readonly ipAddress: IPAddress;
  readonly dateTimeOccurred: Date;
}
