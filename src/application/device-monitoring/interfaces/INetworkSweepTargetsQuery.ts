import { Result } from 'domain/shared/core';

export interface NetworkSweepFilter {
  locationId?: string;
  category?: string;
}

// A device as inventory and its polling configuration describe it; whether
// it is pinged is decided by RunNetworkSweepUseCase.
export interface NetworkSweepCandidate {
  deviceId: string;
  deviceName: string;
  // the polling configuration's, which is what the scheduler pings
  ipAddress: string | null;
  category: string | null;
  locationId: string | null;
  locationName: string | null;
  agentId: string | null;
  agentName: string | null;
  // the device's flag and its polling configuration's, both on
  monitored: boolean;
}

export interface INetworkSweepTargetsQuery {
  // MON-081: the in-service devices, not in the recycle bin.
  listInService(
    filter: NetworkSweepFilter
  ): Promise<Result<NetworkSweepCandidate[]>>;
}
