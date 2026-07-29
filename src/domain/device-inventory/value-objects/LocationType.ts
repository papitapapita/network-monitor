import { ValueObject, Result, Guard } from 'domain/shared/core';
import { LocationTypeProps } from '../props';

export class LocationType extends ValueObject<LocationTypeProps> {
  public static readonly TOWER = 'TOWER';
  public static readonly DATACENTER = 'DATACENTER';
  public static readonly POINT_OF_PRESENCE = 'POINT_OF_PRESENCE';
  public static readonly OFFICE = 'OFFICE';
  public static readonly CUSTOMER_PREMISES = 'CUSTOMER_PREMISES';
  public static readonly OTHER = 'OTHER';

  private static readonly VALID_TYPES = [
    LocationType.TOWER,
    LocationType.DATACENTER,
    LocationType.POINT_OF_PRESENCE,
    LocationType.OFFICE,
    LocationType.CUSTOMER_PREMISES,
    LocationType.OTHER
  ] as const;

  get value(): string {
    return this._props.value;
  }

  private constructor(props: LocationTypeProps) {
    super(props);
  }

  public static create(type: string): Result<LocationType> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(type, 'type'),
      Guard.isString(type, 'type')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<LocationType>(guardResult.message!);
    }

    const trimmed = type.trim().toUpperCase();

    if (trimmed.length === 0) {
      return Result.fail<LocationType>(
        'Location type cannot be empty'
      );
    }

    if (!LocationType.isValid(trimmed)) {
      return Result.fail<LocationType>(
        `Invalid location type: "${type}". Must be one of: ${LocationType.VALID_TYPES.join(', ')}`
      );
    }

    return Result.ok<LocationType>(
      new LocationType({ value: trimmed })
    );
  }

  public static reconstitute(type: string): LocationType {
    return new LocationType({ value: type });
  }

  public static isValid(value: string): boolean {
    return LocationType.VALID_TYPES.includes(
      value as (typeof LocationType.VALID_TYPES)[number]
    );
  }

  public isCustomerPremises(): boolean {
    return this._props.value === LocationType.CUSTOMER_PREMISES;
  }

  public toString(): string {
    return this._props.value;
  }
}
