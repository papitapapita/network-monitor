import { PoePortMatchKind } from '../enums';
import { PoePortLabel } from './PoePortLabel';

export interface LabelledPoePort {
  switchDeviceId: string;
  switchIp: string | null;
  port: string;
  label: string;
}

export interface InventoryDevice {
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  locationId: string | null;
  locationName: string | null;
}

export type PoePortMatch =
  | {
      kind:
        | PoePortMatchKind.MATCHED
        | PoePortMatchKind.MATCHED_OTHER_LOCATION;
      ip: string;
      device: InventoryDevice;
    }
  | { kind: PoePortMatchKind.UNMATCHED; ip: string | null }
  | { kind: PoePortMatchKind.DUPLICATE; ip: string };

// PWR-031..034: which antenna each port powers, judged across every port read
// at the site at once, because a duplicate can span two switches.
export class PoePortMatcher {
  public static match(
    ports: LabelledPoePort[],
    siteLocationId: string,
    inventory: InventoryDevice[]
  ): PoePortMatch[] {
    const ips = ports.map((p) => PoePortMatcher.antennaIpOf(p));
    const seen = new Map<string, number>();
    for (const ip of ips) {
      if (ip) seen.set(ip, (seen.get(ip) ?? 0) + 1);
    }
    const byIp = new Map(inventory.map((d) => [d.ipAddress, d]));

    return ips.map((ip): PoePortMatch => {
      if (!ip) return { kind: PoePortMatchKind.UNMATCHED, ip: null };
      if ((seen.get(ip) ?? 0) > 1)
        return { kind: PoePortMatchKind.DUPLICATE, ip };
      const device = byIp.get(ip);
      if (!device) return { kind: PoePortMatchKind.UNMATCHED, ip };
      return {
        kind:
          device.locationId === siteLocationId
            ? PoePortMatchKind.MATCHED
            : PoePortMatchKind.MATCHED_OTHER_LOCATION,
        ip,
        device
      };
    });
  }

  // PWR-034: a port labelled with the switch's own address names its uplink,
  // not an antenna it powers.
  public static antennaIpOf(port: LabelledPoePort): string | null {
    const ip = PoePortLabel.ipOf(port.label);
    return ip !== null && ip === port.switchIp ? null : ip;
  }
}
