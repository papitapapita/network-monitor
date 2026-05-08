import getVendor from 'mac-oui-lookup';
import { IPingService } from 'application/device-monitoring/interfaces';
import {
  INetworkScannerService,
  IArpService,
  DiscoveredHost
} from 'application/device-inventory/interfaces';
import { expandCidr } from './utils/expandCidr';

/**
 * Infrastructure implementation of INetworkScannerService.
 *
 * Discovers live hosts on an IPv4 CIDR segment by:
 *   1. Expanding the CIDR to individual host IPs via expandCidr()
 *   2. Pinging all IPs in concurrent batches (capped at `concurrency`)
 *   3. For each reachable IP, resolving the MAC address from the ARP cache
 *   4. Enriching resolved MACs with manufacturer information via mac-oui-lookup
 *
 * Design decisions:
 * - expandCidr() is not try/caught — invalid CIDR is a programming error that
 *   should surface immediately to the caller (use case / controller).
 * - Ping failures (Result.fail) are treated as "host unreachable" and silently
 *   skipped; only hosts where isReachable=true are returned.
 * - ARP and manufacturer lookup failures produce null values; the DiscoveredHost
 *   is still included with macAddress=null and manufacturer=null rather than excluded.
 * - latencyMs falls back to 0 when the ping response carries null (e.g. when
 *   the underlying library does not report timing for a live host).
 * - No logger is injected to keep this component simple and orthogonal.
 */
export class NetworkScannerService implements INetworkScannerService {
  constructor(
    private readonly pingService: IPingService,
    private readonly arpService: IArpService
  ) {}

  /**
   * Scans all usable host addresses within the given CIDR block and returns
   * those that respond to ICMP ping.
   *
   * @param cidr        - IPv4 CIDR string, e.g. "192.168.1.0/24"
   * @param concurrency - Maximum number of IPs pinged simultaneously (default 50)
   * @returns Array of discovered, reachable hosts with optional MAC and manufacturer
   * @throws Error propagated from expandCidr() on invalid or oversized CIDR
   */
  async scan(
    cidr: string,
    concurrency: number = 50
  ): Promise<DiscoveredHost[]> {
    const ips = expandCidr(cidr);

    const discovered: DiscoveredHost[] = [];

    for (let i = 0; i < ips.length; i += concurrency) {
      const chunk = ips.slice(i, i + concurrency);

      const chunkResults = await Promise.all(
        chunk.map(async (ip): Promise<DiscoveredHost | null> => {
          const pingResult = await this.pingService.ping(ip);

          // Treat a failed Result or an unreachable host as absent.
          if (pingResult.isFailure || !pingResult.value.isReachable) {
            return null;
          }

          const latencyMs = pingResult.value.latencyMs ?? 0;

          // ARP lookup: null means MAC is not in the local cache — still a
          // valid DiscoveredHost, just without MAC/manufacturer enrichment.
          const macAddress = await this.arpService.toMAC(ip);

          // Manufacturer lookup is synchronous and never throws per mac-oui-lookup
          // contract; a null MAC produces a null manufacturer.
          const manufacturer =
            macAddress !== null ? getVendor(macAddress) : null;

          return { ipAddress: ip, macAddress, manufacturer, latencyMs };
        })
      );

      for (const host of chunkResults) {
        if (host !== null) {
          discovered.push(host);
        }
      }
    }

    return discovered;
  }
}
