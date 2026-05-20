import { ValueObject, Result, Guard } from '../../shared';
import { DeviceStatusProps } from '../props';

export class DeviceStatus extends ValueObject<DeviceStatusProps> {
  public static readonly ACTIVE = 'ACTIVE';
  public static readonly DAMAGED = 'DAMAGED';
  public static readonly INVENTORY = 'INVENTORY';

  private static readonly VALID_STATUSES = [
    DeviceStatus.ACTIVE,
    DeviceStatus.DAMAGED,
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

  public static createActive(): DeviceStatus {
    return new DeviceStatus({ value: DeviceStatus.ACTIVE });
  }

  public static createDamaged(): DeviceStatus {
    return new DeviceStatus({ value: DeviceStatus.DAMAGED });
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

  public isDamaged(): boolean {
    return this._props.value === DeviceStatus.DAMAGED;
  }

  public isInInventory(): boolean {
    return this._props.value === DeviceStatus.INVENTORY;
  }

  public getDisplayName(): string {
    switch (this._props.value) {
      case DeviceStatus.ACTIVE:
        return 'Active';
      case DeviceStatus.DAMAGED:
        return 'Damaged';
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
