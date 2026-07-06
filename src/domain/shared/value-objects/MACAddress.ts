import { ValueObject, Result, Guard } from '../core';
import { MACAddressProps } from '../props';

const COLON_REGEX = /^([0-9A-Fa-f]{2}:){5}([0-9A-Fa-f]{2})$/;
const HYPHEN_REGEX = /^([0-9A-Fa-f]{2}-){5}([0-9A-Fa-f]{2})$/;

export class MACAddress extends ValueObject<MACAddressProps> {
  get value(): string {
    return this._props.value;
  }

  private constructor(_props: MACAddressProps) {
    super(_props);
  }

  private static isValid(mac: string): boolean {
    return COLON_REGEX.test(mac) || HYPHEN_REGEX.test(mac);
  }

  private static normalizeMAC(mac: string): string {
    return mac.replace(/-/g, ':').toUpperCase();
  }

  public static reconstitute(mac: string): MACAddress {
    return new MACAddress({ value: mac });
  }

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

  public toString(): string {
    return this._props.value;
  }
}
