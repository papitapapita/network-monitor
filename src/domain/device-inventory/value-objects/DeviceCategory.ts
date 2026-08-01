import { ValueObject, Result, Guard } from 'domain/shared';
import { DeviceCategoryProps } from '../props';

export class DeviceCategory extends ValueObject<DeviceCategoryProps> {
  public static readonly CPE = 'CPE';
  public static readonly WIRELESS_CPE = 'WIRELESS_CPE';
  public static readonly ACCESS_POINT = 'ACCESS_POINT';
  public static readonly GATEWAY = 'GATEWAY';
  public static readonly AGGREGATION_SWITCH = 'AGGREGATION_SWITCH';
  public static readonly OTHER = 'OTHER';

  private static readonly VALID_CATEGORIES = [
    DeviceCategory.CPE,
    DeviceCategory.WIRELESS_CPE,
    DeviceCategory.ACCESS_POINT,
    DeviceCategory.GATEWAY,
    DeviceCategory.AGGREGATION_SWITCH,
    DeviceCategory.OTHER
  ] as const;

  get value(): string {
    return this._props.value;
  }

  private constructor(props: DeviceCategoryProps) {
    super(props);
  }

  public static create(category: string): Result<DeviceCategory> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(category, 'category'),
      Guard.isString(category, 'category')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<DeviceCategory>(guardResult.message!);
    }

    const trimmed = category.trim().toUpperCase();

    if (trimmed.length === 0) {
      return Result.fail<DeviceCategory>(
        'Device category cannot be empty'
      );
    }

    if (!DeviceCategory.isValid(trimmed)) {
      return Result.fail<DeviceCategory>(
        `Invalid device category: ${category}. Must be one of: ${DeviceCategory.VALID_CATEGORIES.join(', ')}`
      );
    }

    return Result.ok<DeviceCategory>(
      new DeviceCategory({ value: trimmed })
    );
  }

  public static reconstitute(category: string): DeviceCategory {
    return new DeviceCategory({ value: category });
  }

  public static createCpe(): DeviceCategory {
    return new DeviceCategory({ value: DeviceCategory.CPE });
  }

  public static createWirelessCpe(): DeviceCategory {
    return new DeviceCategory({ value: DeviceCategory.WIRELESS_CPE });
  }

  public static createAccessPoint(): DeviceCategory {
    return new DeviceCategory({ value: DeviceCategory.ACCESS_POINT });
  }

  public static createGateway(): DeviceCategory {
    return new DeviceCategory({ value: DeviceCategory.GATEWAY });
  }

  public static createAggregationSwitch(): DeviceCategory {
    return new DeviceCategory({
      value: DeviceCategory.AGGREGATION_SWITCH
    });
  }

  public static createOther(): DeviceCategory {
    return new DeviceCategory({ value: DeviceCategory.OTHER });
  }

  public static isValid(value: string): boolean {
    return DeviceCategory.VALID_CATEGORIES.includes(
      value as (typeof DeviceCategory.VALID_CATEGORIES)[number]
    );
  }

  public isCpe(): boolean {
    return this._props.value === DeviceCategory.CPE;
  }

  public isWirelessCpe(): boolean {
    return this._props.value === DeviceCategory.WIRELESS_CPE;
  }

  public isAccessPoint(): boolean {
    return this._props.value === DeviceCategory.ACCESS_POINT;
  }

  public isGateway(): boolean {
    return this._props.value === DeviceCategory.GATEWAY;
  }

  public isAggregationSwitch(): boolean {
    return this._props.value === DeviceCategory.AGGREGATION_SWITCH;
  }

  public isOther(): boolean {
    return this._props.value === DeviceCategory.OTHER;
  }

  public getDisplayName(): string {
    switch (this._props.value) {
      case DeviceCategory.CPE:
        return 'CPE';
      case DeviceCategory.WIRELESS_CPE:
        return 'Wireless CPE';
      case DeviceCategory.ACCESS_POINT:
        return 'Access Point';
      case DeviceCategory.GATEWAY:
        return 'Gateway';
      case DeviceCategory.AGGREGATION_SWITCH:
        return 'Aggregation Switch';
      case DeviceCategory.OTHER:
        return 'Other';
      default:
        return this._props.value;
    }
  }

  public toString(): string {
    return this._props.value;
  }
}
