/**
 * DiscoveredHost
 *
 * Data structure representing a single responsive host found during
 * a network segment scan.
 */
export interface DiscoveredHost {
  /**
   * IPv4 address of the discovered host (e.g. "192.168.1.10").
   */
  ipAddress: string;

  /**
   * Round-trip latency in milliseconds from the ICMP probe.
   */
  latencyMs: number;

  /**
   * MAC address resolved via ARP, or null if resolution failed
   * (e.g. the host is on a different L2 segment).
   */
  macAddress: string | null;

  /**
   * NIC manufacturer derived from the MAC OUI prefix, or null
   * if the MAC address is unavailable or the OUI is unknown.
   */
  manufacturer: string | null;
}

/**
 * INetworkScannerService
 *
 * Application interface for active network segment discovery.
 *
 * Responsibilities:
 * - Probe all hosts within a CIDR range using ICMP (ping).
 * - Collect latency measurements and optionally resolve MAC addresses.
 * - Return only responsive hosts.
 *
 * Implementations:
 * - NetworkScannerService (infrastructure): Uses native ping + ARP probing.
 * - MockNetworkScannerService: Returns a configurable set of hosts for
 *   unit testing.
 *
 * Used By:
 * - ScanNetworkSegmentUseCase
 */
export interface INetworkScannerService {
  /**
   * Scans a CIDR network segment and returns all responsive hosts.
   *
   * Hosts that do not respond to ICMP probes within the implementation-
   * defined timeout are excluded from the result.
   *
   * @param cidr - CIDR notation of the segment to scan
   *               (e.g. "192.168.1.0/24").
   * @param concurrency - Maximum number of simultaneous probes.
   *                      Defaults to an implementation-defined value when
   *                      omitted.
   * @returns Array of responsive hosts with latency and optional MAC data.
   */
  scan(cidr: string, concurrency?: number): Promise<DiscoveredHost[]>;
}
