import { ValueObject, Result, Guard, IPAddressProps } from '../';

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
    return this.props.value;
  }

  private constructor(props: IPAddressProps) {
    super(props);
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
    const ipv4Regex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;

    if (!ipv4Regex.test(ip)) {
      return false;
    }

    const parts = ip.split('.');
    if (parts.length !== 4) {
      return false;
    }

    return parts.every((part) => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
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
    const isIPv6 = this.isValidIPv6(trimmedIp);

    if (!isIPv4 && !isIPv6) {
      return Result.fail<IPAddress>(
        `Invalid IP address format: ${trimmedIp}. Must be a valid IPv4 or IPv6 address.`
      );
    }

    return Result.ok<IPAddress>(new IPAddress({ value: trimmedIp }));
  }

  /**
   * Checks if this IP address is IPv4.
   *
   * @returns True if this is an IPv4 address, false otherwise
   */
  public isIPv4(): boolean {
    return IPAddress.isValidIPv4(this.props.value);
  }

  /**
   * Checks if this IP address is IPv6.
   *
   * @returns True if this is an IPv6 address, false otherwise
   */
  public isIPv6(): boolean {
    return IPAddress.isValidIPv6(this.props.value);
  }

  /**
   * Returns the string representation of the IP address.
   */
  public toString(): string {
    return this.props.value;
  }
}
