import { ValueObject, Result, Guard } from 'domain/shared';
import { DeviceStatusProps } from '../props';

export class DeviceStatus extends ValueObject<DeviceStatusProps> {
  public static readonly ACTIVE = 'ACTIVE';
  public static readonly COMMISSIONING = 'COMMISSIONING';
  public static readonly DAMAGED = 'DAMAGED';
  public static readonly DECOMMISSIONED = 'DECOMMISSIONED';
  public static readonly INVENTORY = 'INVENTORY';

  private static readonly VALID_STATUSES = [
    DeviceStatus.ACTIVE,
    DeviceStatus.COMMISSIONING,
    DeviceStatus.DAMAGED,
    DeviceStatus.DECOMMISSIONED,
    DeviceStatus.INVENTORY
  ] as const;

  // The statuses a unit can be retired into — none of them is in service, so
  // none of them polls. A replacement names one of these for the outgoing box:
  // back to stock, broken, or permanently out of service.
  private static readonly RETIRED_STATUSES = [
    DeviceStatus.DAMAGED,
    DeviceStatus.DECOMMISSIONED,
    DeviceStatus.INVENTORY
  ] as const;

  get value(): string {
    return this._props.value;
  }

  private constructor(props: DeviceStatusProps) {
    super(props);
  }

  public static create(status: string): Result<DeviceStatus> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(status, 'status'),
      Guard.isString(status, 'status')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<DeviceStatus>(guardResult.message!);
    }

    const trimmed = status.trim().toUpperCase();

    if (trimmed.length === 0) {
      return Result.fail<DeviceStatus>(
        'Device status cannot be empty'
      );
    }

    if (!DeviceStatus.isValid(trimmed)) {
      return Result.fail<DeviceStatus>(
        `Invalid device status: ${status}. Must be one of: ${DeviceStatus.VALID_STATUSES.join(', ')}`
      );
    }

    return Result.ok<DeviceStatus>(
      new DeviceStatus({ value: trimmed })
    );
  }

  public static reconstitute(status: string): DeviceStatus {
    return new DeviceStatus({ value: status });
  }

  public static isRetiredStatus(value: string): boolean {
    return DeviceStatus.RETIRED_STATUSES.includes(
      value as (typeof DeviceStatus.RETIRED_STATUSES)[number]
    );
  }

  public static retiredStatuses(): readonly string[] {
    return DeviceStatus.RETIRED_STATUSES;
  }

  public static createActive(): DeviceStatus {
    return new DeviceStatus({ value: DeviceStatus.ACTIVE });
  }

  public static createCommissioning(): DeviceStatus {
    return new DeviceStatus({ value: DeviceStatus.COMMISSIONING });
  }

  public static createDamaged(): DeviceStatus {
    return new DeviceStatus({ value: DeviceStatus.DAMAGED });
  }

  public static createDecommissioned(): DeviceStatus {
    return new DeviceStatus({
      value: DeviceStatus.DECOMMISSIONED
    });
  }

  public static createInventory(): DeviceStatus {
    return new DeviceStatus({ value: DeviceStatus.INVENTORY });
  }

  private static isValid(value: string): boolean {
    return DeviceStatus.VALID_STATUSES.includes(
      value as (typeof DeviceStatus.VALID_STATUSES)[number]
    );
  }

  public isActive(): boolean {
    return this._props.value === DeviceStatus.ACTIVE;
  }

  public isCommissioning(): boolean {
    return this._props.value === DeviceStatus.COMMISSIONING;
  }

  public isDamaged(): boolean {
    return this._props.value === DeviceStatus.DAMAGED;
  }

  public isDecommissioned(): boolean {
    return this._props.value === DeviceStatus.DECOMMISSIONED;
  }

  public isInInventory(): boolean {
    return this._props.value === DeviceStatus.INVENTORY;
  }

  public isRetired(): boolean {
    return DeviceStatus.isRetiredStatus(this._props.value);
  }

  public getDisplayName(): string {
    switch (this._props.value) {
      case DeviceStatus.ACTIVE:
        return 'Active';
      case DeviceStatus.COMMISSIONING:
        return 'Commissioning';
      case DeviceStatus.DAMAGED:
        return 'Damaged';
      case DeviceStatus.DECOMMISSIONED:
        return 'Decommissioned';
      case DeviceStatus.INVENTORY:
        return 'Inventory';
      default:
        return this._props.value;
    }
  }

  public toString(): string {
    return this._props.value;
  }
}
