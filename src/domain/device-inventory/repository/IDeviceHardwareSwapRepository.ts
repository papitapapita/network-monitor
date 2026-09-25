import { Result } from 'domain/shared/core';
import { Device } from '../aggregates/Device';

// A separate port from IDeviceRepository: one operation needs a multi-row
// atomic write, and widening the general repository for it would ripple into
// every consumer that only reads or saves one device.
export interface IDeviceHardwareSwapRepository {
  // Persists two devices that traded hardware, all or nothing. Two save() calls
  // cannot do this: the live-MAC uniqueness index rejects the first write while
  // the other row still holds that address.
  saveHardwareSwap(first: Device, second: Device): Promise<Result<void>>;
}
