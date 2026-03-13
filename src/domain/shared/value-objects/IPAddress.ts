import { ValueObject, Result, Guard } from '../core';
import { IPAddressProps } from '../props';

/**
 * IPAddress Value Object
 *
 * Represents an IPv4 or IPv6 address with validation.
 * Immutable and validated at creation time.
 *
 * Business Rules:
 * - Address cannot be null, undefined, or empty
 * - Must be a valid IPv4 format (xxx.xxx.xxx.xxx where xxx is 0-255)
 * - OR must be a valid IPv6 format (supports full and compressed notation)
 * - All octets in IPv4 must be in range 0-255
 * - IPv6 must follow RFC 4291 addressing architecture
 * - IPv6 is normalized to lowercase for consistent equality comparisons
 *
 * @example
 * const ipv4Result = IPAddress.create('192.168.1.1');
 * if (ipv4Result.isSuccess) {
 *   const ip = ipv4Result.value;
 *   console.log(ip.isIPv4()); // true
 *   console.log(ip.toString()); // '192.168.1.1'
 * }
 *
 * @example
 * const ipv6Result = IPAddress.create('2001:0db8:85a3::8a2e:0370:7334');
 * if (ipv6Result.isSuccess) {
 *   const ip = ipv6Result.value;
 *   console.log(ip.isIPv6()); // true
 * }
 */
export class IPAddress extends ValueObject<IPAddressProps> {
  get value(): string {
    return this._props.value;
  }

  private constructor(_props: IPAddressProps) {
    super(_props);
  }

  /**
   * Validates if a string is a valid IPv4 address.
   *
   * @param ip - IP address string to validate
   * @returns True if valid IPv4 format, false otherwise
   *
   * Format: xxx.xxx.xxx.xxx where xxx is 0-255
   */
  public static isValidIPv4(ip: string): boolean {
    const octet = '(25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]\\d|\\d)';
    const ipv4Regex = new RegExp(
      `^${octet}\\.${octet}\\.${octet}\\.${octet}$`
    );
    return ipv4Regex.test(ip);
  }

  /**
   * Validates if a string is a valid IPv6 address.
   *
   * @param ip - IP address string to validate
   * @returns True if valid IPv6 format, false otherwise
   *
   * Supports full notation and compressed notation (::)
   */
  public static isValidIPv6(ip: string): boolean {
    // IPv6 regex pattern (supports compressed notation)
    const ipv6Regex =
      /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

    return ipv6Regex.test(ip);
  }

  /**
   * Reconstitutes an IPAddress from a trusted persistence source, skipping validation.
   *
   * Use this when loading from the database where the value was already validated
   * at creation time. Avoids re-validating data that is known to be correct.
   *
   * @param ip - Raw IP address string from persistence (IPv4 or lowercase IPv6)
   * @returns IPAddress instance
   */
  public static reconstitute(ip: string): IPAddress {
    const version: 4 | 6 = ip.includes(':') ? 6 : 4;
    return new IPAddress({ value: ip, version });
  }

  /**
   * Creates a new IPAddress value object.
   *
   * @param ip - IPv4 or IPv6 address string
   * @returns Result containing IPAddress or error message
   */
  public static create(ip: string): Result<IPAddress> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(ip, 'ip address'),
      Guard.isString(ip, 'ip address')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<IPAddress>(guardResult.message!);
    }

    const trimmedIp = ip.trim();

    if (trimmedIp.length === 0) {
      return Result.fail<IPAddress>('IP address cannot be empty');
    }

    const isIPv4 = this.isValidIPv4(trimmedIp);
    const isIPv6 = !isIPv4 && this.isValidIPv6(trimmedIp);

    if (!isIPv4 && !isIPv6) {
      return Result.fail<IPAddress>(
        `Invalid IP address format: ${trimmedIp}. Must be a valid IPv4 or IPv6 address.`
      );
    }

    const version: 4 | 6 = isIPv4 ? 4 : 6;
    const normalizedIp = isIPv4 ? trimmedIp : trimmedIp.toLowerCase();

    return Result.ok<IPAddress>(
      new IPAddress({ value: normalizedIp, version })
    );
  }

  /**
   * Checks if this IP address is IPv4.
   *
   * @returns True if this is an IPv4 address, false otherwise
   */
  public isIPv4(): boolean {
    return this._props.version === 4;
  }

  /**
   * Checks if this IP address is IPv6.
   *
   * @returns True if this is an IPv6 address, false otherwise
   */
  public isIPv6(): boolean {
    return this._props.version === 6;
  }

  /**
   * Returns the string representation of the IP address.
   */
  public toString(): string {
    return this._props.value;
  }
}
