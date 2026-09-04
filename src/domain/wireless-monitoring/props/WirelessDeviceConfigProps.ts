import { DeviceId } from 'domain/shared/ids';
import { IPAddress } from 'domain/shared/value-objects';
import { PollingInterval } from '../value-objects';

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
  // Auto-captured from the device's first poll that reports a LAN speed
  // (WLS-089); a subsequent poll opens a warning once negotiated speed
  // drops below this baseline. Editable afterward to correct a baseline
  // captured while the port was already degraded.
  provisionedLanSpeedMbps: number | null;
  lastPolledAt: Date | null;
}
