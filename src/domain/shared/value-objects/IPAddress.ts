import { ValueObject, Result, Guard } from '../core';
import { IPAddressProps } from '../props';

export class IPAddress extends ValueObject<IPAddressProps> {
  get value(): string {
    return this._props.value;
  }

  private constructor(props: IPAddressProps) {
    super(props);
  }

  private static isValidIPv4(ip: string): boolean {
    const octet = '(25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]\\d|\\d)';
    const ipv4Regex = new RegExp(
      `^${octet}\\.${octet}\\.${octet}\\.${octet}$`
    );
    return ipv4Regex.test(ip);
  }

  private static isValidIPv6(ip: string): boolean {
    const ipv6Regex =
      /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

    return ipv6Regex.test(ip);
  }

  public static reconstitute(ip: string): IPAddress {
    const version: 4 | 6 = ip.includes(':') ? 6 : 4;
    return new IPAddress({ value: ip, version });
  }

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

  public isIPv4(): boolean {
    return this._props.version === 4;
  }

  public isIPv6(): boolean {
    return this._props.version === 6;
  }

  public toString(): string {
    return this._props.value;
  }
}
