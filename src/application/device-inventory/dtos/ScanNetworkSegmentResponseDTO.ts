export interface DiscoveredHostResult {
  ipAddress: string;
  latencyMs: number;
  macAddress: string | null;
  manufacturer: string | null;
  // DEV-201: the inventory device this host is, matched by MAC, then IP.
  knownDeviceId: string | null;
  // The suggestion to create it; null when known or when its MAC is unknown.
  discoveredDeviceId: string | null;
  // First seen by this scan (DEV-206).
  isNew: boolean;
}

export interface ScanNetworkSegmentResponseDTO {
  segment: string;
  // The agent that scanned it; null when the server did.
  agentId: string | null;
  scannedCount: number;
  responsiveCount: number;
  newCount: number;
  discoveredHosts: DiscoveredHostResult[];
}
