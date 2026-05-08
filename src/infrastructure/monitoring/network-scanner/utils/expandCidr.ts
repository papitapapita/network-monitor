/**
 * Expands an IPv4 CIDR block into the array of all usable host addresses.
 *
 * The network address (first) and broadcast address (last) are excluded, so a
 * /24 yields 254 entries, a /30 yields 2, and a /32 yields 0.
 *
 * Validation rules:
 * - Must contain exactly one '/'
 * - Prefix length must be a decimal integer in [0, 32]
 * - Each IP octet must be a decimal integer in [0, 255]
 *
 * Capacity guard: prefixes smaller than /22 produce more than 1024 usable
 * hosts and are rejected to prevent accidental memory exhaustion.
 *
 * @param cidr - IPv4 CIDR notation, e.g. "192.168.1.0/24"
 * @returns Array of usable host IP strings in ascending order
 * @throws Error if the CIDR string is malformed
 * @throws Error if the range would exceed 1024 usable host addresses
 */
export function expandCidr(cidr: string): string[] {
  if (!cidr.includes('/')) {
    throw new Error(
      `Invalid CIDR format: missing prefix length in "${cidr}"`
    );
  }

  const parts = cidr.split('/');

  if (parts.length !== 2) {
    throw new Error(
      `Invalid CIDR format: expected exactly one '/' in "${cidr}"`
    );
  }

  const [base, prefixStr] = parts as [string, string];

  const prefixLen = Number(prefixStr);

  if (!Number.isInteger(prefixLen) || prefixLen < 0 || prefixLen > 32) {
    throw new Error(
      `Invalid CIDR prefix: "${prefixStr}" is not an integer in range 0-32`
    );
  }

  const octets = base.split('.');

  if (octets.length !== 4) {
    throw new Error(
      `Invalid CIDR IP address: "${base}" does not have exactly 4 octets`
    );
  }

  const octetNumbers = octets.map((octet, index) => {
    const num = Number(octet);
    if (!Number.isInteger(num) || num < 0 || num > 255 || octet.trim() === '') {
      throw new Error(
        `Invalid CIDR IP address: octet ${index + 1} "${octet}" is not an integer in range 0-255`
      );
    }
    return num;
  }) as [number, number, number, number];

  const [a, b, c, d] = octetNumbers;

  // Build the 32-bit integer for the base IP using bitwise arithmetic.
  // The result of bitwise OR on signed 32-bit integers may be negative in JS
  // due to two's-complement representation; >>> 0 coerces to unsigned 32-bit.
  const ipNum = (((a << 24) | (b << 16) | (c << 8) | d) >>> 0);

  // A prefix of 0 means the mask is all zeros; left-shifting 32 positions is
  // undefined behaviour in JS (it wraps), so we special-case it to 0.
  const mask = (prefixLen === 0 ? 0 : (~0 << (32 - prefixLen))) >>> 0;

  const network = (ipNum & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;

  // Usable hosts live in (network, broadcast) exclusive.
  // For /31 and /32 that range is empty (0 hosts), which is correct.
  const hostCount = broadcast - network - 1;

  if (hostCount > 1024) {
    throw new Error(
      'CIDR range too large: maximum 1024 host addresses allowed'
    );
  }

  const hosts: string[] = [];

  for (let ipInt = network + 1; ipInt < broadcast; ipInt++) {
    hosts.push(
      [
        (ipInt >>> 24) & 0xff,
        (ipInt >>> 16) & 0xff,
        (ipInt >>> 8) & 0xff,
        ipInt & 0xff
      ].join('.')
    );
  }

  return hosts;
}
