import arp from '@network-utils/arp-lookup';
import { IArpService } from 'application/device-inventory/interfaces';

/**
 * Infrastructure adapter for the system ARP table.
 *
 * Implements IArpService by delegating to the @network-utils/arp-lookup
 * package, which performs a cross-platform lookup against the OS ARP cache.
 *
 * Failure policy: any lookup error (host not in cache, permission denied,
 * unsupported platform) is swallowed and null is returned. Callers treat a
 * null MAC as "MAC not resolved" rather than a fatal error, which is the
 * correct semantic for an opportunistic ARP lookup during a network scan.
 */
export class ArpService implements IArpService {
  /**
   * Resolves the MAC address for the given IP by consulting the local ARP
   * cache. Returns null when the IP is not present in the cache or on any
   * lookup failure.
   *
   * @param ipAddress - IPv4 address string, e.g. "192.168.1.1"
   * @returns Resolved MAC address string, or null if not found
   */
  async toMAC(ipAddress: string): Promise<string | null> {
    try {
      const mac = await arp.toMAC(ipAddress);
      return mac ?? null;
    } catch {
      return null;
    }
  }
}
