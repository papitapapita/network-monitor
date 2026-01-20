import { ValueObject, Result, Guard, MACAddressProps } from '../';

/**
 * MACAddress Value Object
 *
 * Represents a MAC (Media Access Control) address with validation and normalization.
 * Supports both colon-separated (AA:BB:CC:DD:EE:FF) and hyphen-separated (AA-BB-CC-DD-EE-FF) formats.
 * Internally normalized to colon-separated uppercase format.
 *
 * Business Rules:
 * - MAC address cannot be null, undefined, or empty
 * - Must be in format XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX
 * - Each segment (XX) must be a valid hexadecimal number (0-9, A-F)
 * - Must contain exactly 6 segments (48-bit address)
 * - Automatically normalized to uppercase with colon separators
 * - Both colon and hyphen separators are accepted on input
 *
 * @example
 * const macResult = MACAddress.create('AA:BB:CC:DD:EE:FF');
 * if (macResult.isSuccess) {
 *   const mac = macResult.value;
 *   console.log(mac.toString()); // 'AA:BB:CC:DD:EE:FF'
 *   console.log(mac.toHyphenFormat()); // 'AA-BB-CC-DD-EE-FF'
 *   console.log(mac.toCompactFormat()); // 'AABBCCDDEEFF'
 * }
 *
 * @example
 * const macResult2 = MACAddress.create('aa-bb-cc-dd-ee-ff');
 * // Also valid, automatically normalized to 'AA:BB:CC:DD:EE:FF'
 */
export class MACAddress extends ValueObject<MACAddressProps> {
  get value(): string {
    return this._props.value;
  }

  private constructor(_props: MACAddressProps) {
    super(_props);
  }

  /**
   * Validates if a string is a valid MAC address.
   *
   * @param mac - MAC address string to validate
   * @returns True if valid MAC format, false otherwise
   *
   * Accepts both colon-separated and hyphen-separated formats.
   */
  public static isValid(mac: string): boolean {
    // Regex for MAC address (supports both : and - separators)
    const colonMACRegex = /^([0-9A-Fa-f]{2}:){5}([0-9A-Fa-f]{2})$/;
    const hyphenMACRegex = /^([0-9A-Fa-f]{2}-){5}([0-9A-Fa-f]{2})$/;

    return colonMACRegex.test(mac) || hyphenMACRegex.test(mac);
  }

  /**
   * Normalizes a MAC address to the standard format: AA:BB:CC:DD:EE:FF (uppercase with colons).
   *
   * @param mac - MAC address string to normalize
   * @returns Normalized MAC address string
   */
  private static normalizeMAC(mac: string): string {
    // Replace hyphens with colons and convert to uppercase
    return mac.replace(/-/g, ':').toUpperCase();
  }

  /**
   * Creates a new MACAddress value object.
   *
   * @param mac - MAC address string (supports AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF)
   * @returns Result containing MACAddress or error message
   */
  public static create(mac: string): Result<MACAddress> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(mac, 'MAC address'),
      Guard.isString(mac, 'MAC address')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<MACAddress>(guardResult.message!);
    }

    const trimmedMac = mac.trim();

    if (trimmedMac.length === 0) {
      return Result.fail<MACAddress>('MAC address cannot be empty');
    }

    if (!this.isValid(trimmedMac)) {
      return Result.fail<MACAddress>(
        `Invalid MAC address format: ${trimmedMac}. Must be in format AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF.`
      );
    }

    const normalized = this.normalizeMAC(trimmedMac);

    return Result.ok<MACAddress>(
      new MACAddress({ value: normalized })
    );
  }

  /**
   * Returns the normalized MAC address (AA:BB:CC:DD:EE:FF format).
   *
   * @returns MAC address in uppercase colon-separated format
   */
  public normalize(): string {
    return this._props.value;
  }

  /**
   * Returns the string representation of the MAC address.
   */
  public toString(): string {
    return this._props.value;
  }

  /**
   * Converts the MAC address to hyphen-separated format.
   *
   * @returns MAC address in AA-BB-CC-DD-EE-FF format
   */
  public toHyphenFormat(): string {
    return this._props.value.replace(/:/g, '-');
  }

  /**
   * Returns the MAC address without separators.
   *
   * @returns MAC address in compact format (AABBCCDDEEFF)
   */
  public toCompactFormat(): string {
    return this._props.value.replace(/:/g, '');
  }
}
