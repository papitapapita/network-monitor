import { ValueObject } from '../shared/kernel/ValueObject';
import { Result } from '../shared/kernel/Result';
import { Guard } from '../shared/kernel/Guard';

/**
 * MACAddress Value Object
 *
 * Represents a MAC (Media Access Control) address with validation and normalization.
 * Supports both colon-separated (AA:BB:CC:DD:EE:FF) and hyphen-separated (AA-BB-CC-DD-EE-FF) formats.
 * Internally normalized to colon-separated uppercase format.
 *
 * @example
 * const macResult = MACAddress.create('AA:BB:CC:DD:EE:FF');
 * const macResult2 = MACAddress.create('aa-bb-cc-dd-ee-ff'); // Also valid, normalized to AA:BB:CC:DD:EE:FF
 */

interface MACAddressProps {
  value: string; // Normalized format: AA:BB:CC:DD:EE:FF
}

export class MACAddress extends ValueObject<MACAddressProps> {

  get value(): string {
    return this.props.value;
  }

  private constructor(props: MACAddressProps) {
    super(props);
  }

  /**
   * Validates if a string is a valid MAC address.
   * Accepts both colon-separated and hyphen-separated formats.
   */
  public static isValid(mac: string): boolean {
    // Regex for MAC address (supports both : and - separators)
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return macRegex.test(mac);
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

    return Result.ok<MACAddress>(new MACAddress({ value: normalized }));
  }

  /**
   * Returns the normalized MAC address (AA:BB:CC:DD:EE:FF format).
   */
  public normalize(): string {
    return this.props.value;
  }

  /**
   * Returns the string representation of the MAC address.
   */
  public toString(): string {
    return this.props.value;
  }

  /**
   * Converts the MAC address to hyphen-separated format (AA-BB-CC-DD-EE-FF).
   */
  public toHyphenFormat(): string {
    return this.props.value.replace(/:/g, '-');
  }

  /**
   * Returns the MAC address without separators (AABBCCDDEEFF).
   */
  public toCompactFormat(): string {
    return this.props.value.replace(/:/g, '');
  }
}
