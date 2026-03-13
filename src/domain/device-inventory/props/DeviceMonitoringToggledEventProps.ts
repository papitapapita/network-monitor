import { DeviceId } from '../../shared/ids';
import { DeviceName } from '../value-objects';

export interface DeviceMonitoringToggledEventProps {
  readonly aggregateId: DeviceId;
  readonly deviceName: DeviceName;
  readonly monitoringEnabled: boolean;
  readonly ipAddress: string | null;
  readonly dateTimeOccurred: Date;
}
