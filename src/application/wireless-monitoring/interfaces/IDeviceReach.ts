import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';

// Shared with the controllers, which answer 409 when a failure carries it.
export const OUT_OF_SERVER_REACH =
  'this server is not on the monitored network';

// Who reads a device's radio for a wireless poll (WLS-029).
export type WirelessReader =
  | { by: 'server' }
  | { by: 'agent'; agentId: string }
  | { by: 'none' };

// Whether this server can talk to a device itself (WLS-029). An install
// hosted off site says no for every device, with or without an agent.
export interface IDeviceReach {
  isOutOfReach(deviceId: DeviceId): Promise<Result<boolean>>;

  // Off site, a device behind an agent is read through that agent.
  readerFor(deviceId: DeviceId): Promise<Result<WirelessReader>>;
}
