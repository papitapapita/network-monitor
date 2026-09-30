import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';

// Shared with the controllers, which answer 409 when a failure carries it.
export const OUT_OF_SERVER_REACH =
  'it sits behind an on-site agent, and this server is not on its network';

// Whether this server can talk to a device itself (WLS-029). Only an install
// hosted off site says no, and only for devices behind an agent.
export interface IDeviceReach {
  isOutOfReach(deviceId: DeviceId): Promise<Result<boolean>>;
}
