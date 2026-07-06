import { DeviceId } from 'domain/shared/ids';
import { IPAddress, PollingInterval } from 'domain/shared/value-objects';

export interface WirelessDeviceConfigProps {
  readonly deviceId: DeviceId;
  // Nullable: a config record is created when a device is registered for wireless
  // monitoring, which can happen before its IP is known (e.g. warehouse inventory).
  // Polling blocks at the use-case boundary until an IP is set.
  ipAddress: IPAddress | null;
  enabled: boolean;
  pollingInterval: PollingInterval;
  readonly deviceType: 'STATION' | 'ACCESS_POINT';
  linkCapacityKbps: number | null;
  clientsProvisionedLimit: number | null;
  lastPolledAt: Date | null;
}
