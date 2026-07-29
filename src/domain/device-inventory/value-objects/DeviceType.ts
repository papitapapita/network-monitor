import { ValueObject, Result, Guard } from 'domain/shared/core';
import { DeviceTypeProps } from '../props';

export class DeviceType extends ValueObject<DeviceTypeProps> {
  public static readonly ANTENNA = 'ANTENNA';
  public static readonly OTHER = 'OTHER';
  public static readonly RADIO = 'RADIO';
  public static readonly ROUTER = 'ROUTER';
  public static readonly ROUTERBOARD = 'ROUTERBOARD';
  public static readonly SERVER = 'SERVER';
  public static readonly SWITCH = 'SWITCH';

  private static readonly VALID_TYPES = [
    DeviceType.ANTENNA,
    DeviceType.OTHER,
    DeviceType.RADIO,
    DeviceType.ROUTER,
    DeviceType.ROUTERBOARD,
    DeviceType.SERVER,
    DeviceType.SWITCH
  ] as const;

  get value(): string {
    return this._props.value;
  }

  private constructor(props: DeviceTypeProps) {
    super(props);
  }

  public static create(type: string): Result<DeviceType> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(type, 'deviceType'),
      Guard.isString(type, 'deviceType')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<DeviceType>(guardResult.message!);
    }

    const trimmed = type.trim().toUpperCase();

    if (trimmed.length === 0) {
      return Result.fail<DeviceType>('Device type cannot be empty');
    }

    if (!DeviceType.isValid(trimmed)) {
      return Result.fail<DeviceType>(
        `Invalid device type: "${type}". Must be one of: ${DeviceType.VALID_TYPES.join(', ')}`
      );
    }

    return Result.ok<DeviceType>(new DeviceType({ value: trimmed }));
  }

  public static reconstitute(type: string): DeviceType {
    return new DeviceType({ value: type });
  }

  public static isValid(value: string): boolean {
    return DeviceType.VALID_TYPES.includes(
      value as (typeof DeviceType.VALID_TYPES)[number]
    );
  }

  public toString(): string {
    return this._props.value;
  }
}
