/**
 * DiscoveredHost
 *
 * A single host that responded to ICMP ping during a network segment scan.
 */
export interface DiscoveredHostResult {
  ipAddress: string;
  latencyMs: number;
  macAddress: string | null;
  manufacturer: string | null;
}

/**
 * ScanNetworkSegmentResponseDTO
 *
 * Output DTO for the ScanNetworkSegmentUseCase.
 *
 * API Endpoint:
 * - POST /api/network/scan
 *
 * @example
 * ```json
 * {
 *   "segment": "192.168.1.0/24",
 *   "scannedCount": 254,
 *   "responsiveCount": 3,
 *   "discoveredHosts": [
 *     { "ipAddress": "192.168.1.1", "latencyMs": 2, "macAddress": "A4:C3:F0:85:AC:11", "manufacturer": "TP-Link Technologies Co., Ltd." },
 *     { "ipAddress": "192.168.1.5", "latencyMs": 4, "macAddress": "DC:A6:32:00:11:22", "manufacturer": "Raspberry Pi Trading Ltd." },
 *     { "ipAddress": "192.168.1.20", "latencyMs": 1, "macAddress": null, "manufacturer": null }
 *   ]
 * }
 * ```
 */
export interface ScanNetworkSegmentResponseDTO {
  segment: string;
  scannedCount: number;
  responsiveCount: number;
  discoveredHosts: DiscoveredHostResult[];
}
