import { ValueObject, Result, Guard } from '../../shared';
import { DeviceCategoryProps } from '../props';

/**
 * DeviceCategory Value Object
 *
 * Represents the network role / hardware category of a physical device asset.
 * Immutable and self-validating at creation time.
 *
 * Business Rules:
 * - Category must be one of the predefined valid categories
 * - Category cannot be null or empty
 * - When a category is assigned, the device must have an IP address (enforced by the aggregate)
 *
 * @example
 * const result = DeviceCategory.create('AP');
 * if (result.isSuccess) {
 *   console.log(result.value.getDisplayName()); // 'Access Point'
 * }
 */
export class DeviceCategory extends ValueObject<DeviceCategoryProps> {
  public static readonly CPE = 'CPE';
  public static readonly AP = 'AP';
  public static readonly ROUTERBOARD = 'ROUTERBOARD';
  public static readonly SMART_SWITCH = 'SMART_SWITCH';
  public static readonly SMART_SWITCH_POE = 'SMART_SWITCH_POE';
  public static readonly OTHER = 'OTHER';

  private static readonly VALID_CATEGORIES = [
    DeviceCategory.CPE,
    DeviceCategory.AP,
    DeviceCategory.ROUTERBOARD,
    DeviceCategory.SMART_SWITCH,
    DeviceCategory.SMART_SWITCH_POE,
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
      return Result.fail<DeviceCategory>('Device category cannot be empty');
    }

    if (!DeviceCategory.isValid(trimmed)) {
      return Result.fail<DeviceCategory>(
        `Invalid device category: ${category}. Must be one of: ${DeviceCategory.VALID_CATEGORIES.join(', ')}`
      );
    }

    return Result.ok<DeviceCategory>(new DeviceCategory({ value: trimmed }));
  }

  public static reconstitute(category: string): DeviceCategory {
    return new DeviceCategory({ value: category });
  }

  public static createCpe(): DeviceCategory {
    return new DeviceCategory({ value: DeviceCategory.CPE });
  }

  public static createAp(): DeviceCategory {
    return new DeviceCategory({ value: DeviceCategory.AP });
  }

  public static createRouterboard(): DeviceCategory {
    return new DeviceCategory({ value: DeviceCategory.ROUTERBOARD });
  }

  public static createSmartSwitch(): DeviceCategory {
    return new DeviceCategory({ value: DeviceCategory.SMART_SWITCH });
  }

  public static createSmartSwitchPoe(): DeviceCategory {
    return new DeviceCategory({ value: DeviceCategory.SMART_SWITCH_POE });
  }

  public static createOther(): DeviceCategory {
    return new DeviceCategory({ value: DeviceCategory.OTHER });
  }

  private static isValid(value: string): boolean {
    return DeviceCategory.VALID_CATEGORIES.includes(
      value as (typeof DeviceCategory.VALID_CATEGORIES)[number]
    );
  }

  public isCpe(): boolean {
    return this._props.value === DeviceCategory.CPE;
  }

  public isAp(): boolean {
    return this._props.value === DeviceCategory.AP;
  }

  public isRouterboard(): boolean {
    return this._props.value === DeviceCategory.ROUTERBOARD;
  }

  public isSmartSwitch(): boolean {
    return this._props.value === DeviceCategory.SMART_SWITCH;
  }

  public isSmartSwitchPoe(): boolean {
    return this._props.value === DeviceCategory.SMART_SWITCH_POE;
  }

  public isOther(): boolean {
    return this._props.value === DeviceCategory.OTHER;
  }

  public getDisplayName(): string {
    switch (this._props.value) {
      case DeviceCategory.CPE:
        return 'CPE';
      case DeviceCategory.AP:
        return 'Access Point';
      case DeviceCategory.ROUTERBOARD:
        return 'Routerboard';
      case DeviceCategory.SMART_SWITCH:
        return 'Smart Switch';
      case DeviceCategory.SMART_SWITCH_POE:
        return 'Smart Switch PoE';
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
