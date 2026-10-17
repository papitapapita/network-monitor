import { IPAddress } from 'domain/shared/value-objects';

// Four dot-separated digit groups not glued to more digits or dots, so a
// longer run like "1.10.0.5.21" is not read as an address inside it.
const IPV4_CANDIDATE = /(?<![\d.])\d{1,3}(?:\.\d{1,3}){3}(?![\d.])/g;

// PWR-030: a port names the antenna it powers by that antenna's IP, because
// SwOS port names are too short for more. Only the first valid IPv4 counts.
export class PoePortLabel {
  public static ipOf(label: string): string | null {
    for (const [candidate] of label.matchAll(IPV4_CANDIDATE)) {
      const ip = IPAddress.create(candidate);
      if (ip.isSuccess && ip.value.isIPv4()) return ip.value.value;
    }
    return null;
  }
}
