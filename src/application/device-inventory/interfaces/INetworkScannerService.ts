export interface DiscoveredHost {
  ipAddress: string;
  latencyMs: number;
  // null when the host is on a different L2 segment (ARP resolution fails).
  macAddress: string | null;
  manufacturer: string | null;
}

export interface INetworkScannerService {
  scan(cidr: string, concurrency?: number): Promise<DiscoveredHost[]>;
}
