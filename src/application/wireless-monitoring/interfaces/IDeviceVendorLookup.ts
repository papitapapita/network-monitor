import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';

export interface IDeviceVendorLookup {
  // The slug of the vendor that makes the device's model, or null when the
  // device, its model or its vendor cannot be found.
  findVendorSlug(deviceId: DeviceId): Promise<Result<string | null>>;
}
