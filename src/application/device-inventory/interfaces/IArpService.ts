/**
 * IArpService
 *
 * Application interface for ARP (Address Resolution Protocol) lookup.
 *
 * Responsibilities:
 * - Resolve an IPv4 address to its associated MAC address using the
 *   local ARP cache or active network probing.
 *
 * Implementations:
 * - ArpService (infrastructure): Uses OS-level ARP table or active
 *   ping + ARP lookup.
 * - MockArpService: In-memory stub for unit testing.
 *
 * Used By:
 * - ScanNetworkSegmentUseCase (indirectly via INetworkScannerService)
 */
export interface IArpService {
  /**
   * Resolves the MAC address associated with an IP address.
   *
   * Performs an ARP lookup (passive table query or active probe).
   * Returns null when the IP is unreachable or not in the ARP cache.
   *
   * @param ipAddress - IPv4 address to resolve (e.g. "192.168.1.1")
   * @returns The MAC address string (e.g. "AA:BB:CC:DD:EE:FF"), or null
   *          if resolution fails or the host is not reachable.
   */
  toMAC(ipAddress: string): Promise<string | null>;
}
