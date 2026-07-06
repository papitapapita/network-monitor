export interface DiscoveredHostResult {
  ipAddress: string;
  latencyMs: number;
  macAddress: string | null;
  manufacturer: string | null;
}

export interface ScanNetworkSegmentResponseDTO {
  segment: string;
  scannedCount: number;
  responsiveCount: number;
  discoveredHosts: DiscoveredHostResult[];
}
