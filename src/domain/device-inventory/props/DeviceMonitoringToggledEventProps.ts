import { IPAddress } from 'domain/shared';
import { DeviceId } from 'domain/shared/ids';
import { DeviceName } from '../value-objects';

export interface DeviceMonitoringToggledEventProps {
  readonly aggregateId: DeviceId;
  readonly deviceName: DeviceName;
  readonly monitoringEnabled: boolean;
  // Nullable: monitoring going *off* can coincide with the IP being cleared —
  // a replacement releases the retired unit's address in the same step. When
  // monitoring goes on the IP is always present (ACTIVE/COMMISSIONING require
  // one), which is what the enable path relies on.
  readonly ipAddress: IPAddress | null;
  readonly dateTimeOccurred: Date;
}
