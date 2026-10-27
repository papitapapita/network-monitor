import { Result } from 'domain/shared/core';

export interface OutageDeviceDTO {
  deviceId: string;
  name: string;
  ipAddress: string | null;
  upstreamDeviceId: string | null;
}

// Device Inventory's upstream links, read for outage attribution (NOT-240).
export interface IOutageTopologyQuery {
  // Nearest first: the device's upstream, then that one's, up to the root.
  findUpstreamIds(deviceId: string): Promise<Result<string[]>>;
  findDownstream(
    deviceId: string
  ): Promise<Result<OutageDeviceDTO[]>>;
  findByIds(deviceIds: string[]): Promise<Result<OutageDeviceDTO[]>>;
}
