import { ValueObject, Result, Guard } from '../../shared';
import {
  isValidMacAddress,
  normalizeMacAddress
} from '../../shared/utils/macAddress';
import { MACAddressProps } from '../props';

export class MACAddress extends ValueObject<MACAddressProps> {
  get value(): string {
    return this._props.value;
  }

  private constructor(_props: MACAddressProps) {
    super(_props);
  }

  public static isValid(mac: string): boolean {
    return isValidMacAddress(mac);
  }

  private static normalizeMAC(mac: string): string {
    return normalizeMacAddress(mac);
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

  public toHyphenFormat(): string {
    return this._props.value.replace(/:/g, '-');
  }

  public toCompactFormat(): string {
    return this._props.value.replace(/:/g, '');
  }
}
