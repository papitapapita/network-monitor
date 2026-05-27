import { ValueObject, Result, Guard } from 'domain/shared';
import { DeviceNameProps } from '../props';

export class DeviceName extends ValueObject<DeviceNameProps> {
  private static readonly MAX_LENGTH = 150;

  get value(): string {
    return this._props.value;
  }

  private constructor(props: DeviceNameProps) {
    super(props);
  }

  public static create(name: string): Result<DeviceName> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(name, 'name'),
      Guard.isString(name, 'name')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<DeviceName>(guardResult.message!);
    }

    const trimmed = name.trim();

    if (trimmed.length === 0) {
      return Result.fail<DeviceName>('Device name cannot be empty');
    }

    if (trimmed.length > DeviceName.MAX_LENGTH) {
      return Result.fail<DeviceName>(
        `Device name cannot exceed ${DeviceName.MAX_LENGTH} characters`
      );
    }

    return Result.ok<DeviceName>(new DeviceName({ value: trimmed }));
  }

  public static reconstitute(name: string): DeviceName {
    return new DeviceName({ value: name });
  }

  public toString(): string {
    return this._props.value;
  }
}
