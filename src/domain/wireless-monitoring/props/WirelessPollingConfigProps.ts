import { DeviceId } from 'domain/shared';
import { IPAddress } from 'domain/shared/value-objects';

export interface WirelessPollingConfigProps {
  readonly deviceId: DeviceId;
  ipAddress: IPAddress | null;
  enabled: boolean;
  intervalSecs: number;
  readonly deviceType: 'CPE' | 'ACCESS_POINT';
  linkCapacityBps: number | null;
  clientsProvisionedLimit: number | null;
  lastPolledAt: Date | null;
}
