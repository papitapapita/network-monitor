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
 *
 * @example
 * const result = DeviceCategory.create('CORE');
 * if (result.isSuccess) {
 *   console.log(result.value.getDisplayName()); // 'Core'
 * }
 */
export class DeviceCategory extends ValueObject<DeviceCategoryProps> {
  public static readonly CORE = 'CORE';
  public static readonly DISTRIBUTION = 'DISTRIBUTION';
  public static readonly POE = 'POE';
  public static readonly ACCESS_POINT = 'ACCESS_POINT';
  public static readonly CLIENT_CPE = 'CLIENT_CPE';

  private static readonly VALID_CATEGORIES = [
    DeviceCategory.CORE,
    DeviceCategory.DISTRIBUTION,
    DeviceCategory.POE,
    DeviceCategory.ACCESS_POINT,
    DeviceCategory.CLIENT_CPE
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

  public static createCore(): DeviceCategory {
    return new DeviceCategory({ value: DeviceCategory.CORE });
  }

  public static createDistribution(): DeviceCategory {
    return new DeviceCategory({ value: DeviceCategory.DISTRIBUTION });
  }

  public static createPoe(): DeviceCategory {
    return new DeviceCategory({ value: DeviceCategory.POE });
  }

  public static createAccessPoint(): DeviceCategory {
    return new DeviceCategory({ value: DeviceCategory.ACCESS_POINT });
  }

  public static createClientCpe(): DeviceCategory {
    return new DeviceCategory({ value: DeviceCategory.CLIENT_CPE });
  }

  private static isValid(value: string): boolean {
    return DeviceCategory.VALID_CATEGORIES.includes(
      value as (typeof DeviceCategory.VALID_CATEGORIES)[number]
    );
  }

  public isCore(): boolean {
    return this._props.value === DeviceCategory.CORE;
  }

  public isDistribution(): boolean {
    return this._props.value === DeviceCategory.DISTRIBUTION;
  }

  public isPoe(): boolean {
    return this._props.value === DeviceCategory.POE;
  }

  public isAccessPoint(): boolean {
    return this._props.value === DeviceCategory.ACCESS_POINT;
  }

  public isClientCpe(): boolean {
    return this._props.value === DeviceCategory.CLIENT_CPE;
  }

  public getDisplayName(): string {
    switch (this._props.value) {
      case DeviceCategory.CORE:
        return 'Core';
      case DeviceCategory.DISTRIBUTION:
        return 'Distribution';
      case DeviceCategory.POE:
        return 'PoE';
      case DeviceCategory.ACCESS_POINT:
        return 'Access Point';
      case DeviceCategory.CLIENT_CPE:
        return 'Client CPE';
      default:
        return this._props.value;
    }
  }

  public toString(): string {
    return this._props.value;
  }
}
