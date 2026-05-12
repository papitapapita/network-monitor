import arp from '@network-utils/arp-lookup';
import { readFile } from 'fs/promises';
import { IArpService } from 'application/device-inventory/interfaces';

/**
 * Infrastructure adapter for the system ARP table.
 *
 * On Linux, reads /proc/net/arp directly because `arp -an` (used by the
 * @network-utils/arp-lookup library) produces no output on WSL2. Falls back
 * to the library on other platforms.
 *
 * Failure policy: any lookup error is swallowed and null is returned. Callers
 * treat a null MAC as "MAC not resolved" rather than a fatal error.
 */
export class ArpService implements IArpService {
  async toMAC(ipAddress: string): Promise<string | null> {
    try {
      if (process.platform === 'linux') {
        return await this.fromProcNetArp(ipAddress);
      }
      const mac = await arp.toMAC(ipAddress);
      return mac ?? null;
    } catch {
      return null;
    }
  }

  // Parses /proc/net/arp to find the MAC for the given IP.
  // Each data line: IP | HW type | Flags | HW address | Mask | Device
  // Only entries with Flags & 0x2 (ATF_COM) are fully resolved.
  private async fromProcNetArp(ipAddress: string): Promise<string | null> {
    const raw = await readFile('/proc/net/arp', 'utf8');
    for (const line of raw.split('\n').slice(1)) {
      const cols = line.trim().split(/\s+/);
      if (cols.length < 4) continue;
      const [ip, , flags, mac] = cols;
      if (ip !== ipAddress) continue;
      const flagNum = parseInt(flags, 16);
      // 0x2 = ATF_COM (entry is complete / resolved)
      if ((flagNum & 0x2) === 0) continue;
      if (/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)) return mac;
    }
    return null;
  }
}
