import { DeviceId } from 'domain/shared/ids';
import { IPAddress } from 'domain/shared/value-objects';

export interface WirelessPollingConfigProps {
  readonly deviceId: DeviceId;
  ipAddress: IPAddress | null; // Why is ipaddress null? The only way to make a http request to a device is through its ip address. If the ip address is null, how do we poll the device?
  enabled: boolean;
  intervalSecs: number; // What is the minimum intervalSecs? We should have a minimum interval to prevent too frequent polling which can cause performance issues.Can we use the PollingInterval value object?
  readonly deviceType: 'STATION' | 'ACCESS_POINT';
  linkCapacityBps: number | null; // Why is this a config option?
  clientsProvisionedLimit: number | null; // What is this?
  lastPolledAt: Date | null;
}
