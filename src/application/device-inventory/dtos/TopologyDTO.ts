// UNREACHABLE: DOWN while a device above it is DOWN too — most likely not a
// fault of its own (DEV-186).
export type TopologyReachability =
  | 'UP'
  | 'DOWN'
  | 'UNREACHABLE'
  | 'UNKNOWN';

export interface TopologyNodeDTO {
  id: string;
  name: string;
  status: string;
  category: string | null;
  ipAddress: string | null;
  locationId: string | null;
  locationName: string | null;
  upstreamDeviceId: string | null;
  reachability: TopologyReachability;
  downSince: string | null;
  childCount: number;
}

export interface TopologyResponseDTO {
  nodes: TopologyNodeDTO[];
  total: number;
}

export interface GetDeviceDescendantsRequestDTO {
  deviceId: string;
}
