import { Result } from 'domain/shared/core';

// Live devices only: one in the recycle bin is no longer in inventory.
export interface KnownDeviceOwners {
  byMac: Map<string, string>;
  byIp: Map<string, string>;
}

export interface IKnownDeviceLookup {
  findOwners(
    macAddresses: string[],
    ipAddresses: string[]
  ): Promise<Result<KnownDeviceOwners>>;
}
