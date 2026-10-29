import { Result } from 'domain/shared/core';

export interface DeviceAddressRow {
  id: string;
  name: string;
  status: string;
  ipAddress: string | null;
  // the MAC on file, then the ones the device itself last reported (its
  // radio, its RouterBOARD); upper case, no repeats
  macAddresses: string[];
}

// Read side of where devices sit on the network: their addresses, for
// locating them behind a router port and checking them against ARP.
export interface IDeviceAddressQuery {
  // live devices with an IP or a MAC
  findAll(): Promise<Result<DeviceAddressRow[]>>;
  findById(
    deviceId: string
  ): Promise<Result<DeviceAddressRow | null>>;
}
