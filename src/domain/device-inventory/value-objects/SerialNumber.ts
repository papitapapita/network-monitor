import { ValueObject, Result, Guard } from '../../shared';
import { SerialNumberProps } from '../props';

/**
 * SerialNumber Value Object
 *
 * Represents the manufacturer-assigned serial number of a physical device.
 * Immutable and self-validating at creation time.
 *
 * Business Rules:
 * - Serial number cannot be null, undefined, or empty
 * - Must be a string
 * - Cannot exceed 100 characters (matches db VarChar(100))
 * - Leading and trailing whitespace is trimmed before storage
 *
 * @example
 * const result = SerialNumber.create('SN-2024-XYZ-001');
 * if (result.isSuccess) {
 *   console.log(result.value.toString()); // 'SN-2024-XYZ-001'
 * }
 */
export class SerialNumber extends ValueObject<SerialNumberProps> {
  private static readonly MAX_LENGTH = 100;

  get value(): string {
    return this._props.value;
  }

  private constructor(props: SerialNumberProps) {
    super(props);
  }

  public static create(serial: string): Result<SerialNumber> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(serial, 'serialNumber'),
      Guard.isString(serial, 'serialNumber')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<SerialNumber>(guardResult.message!);
    }

    const trimmed = serial.trim();

    if (trimmed.length === 0) {
      return Result.fail<SerialNumber>(
        'Serial number cannot be empty'
      );
    }

    if (trimmed.length > SerialNumber.MAX_LENGTH) {
      return Result.fail<SerialNumber>(
        `Serial number cannot exceed ${SerialNumber.MAX_LENGTH} characters`
      );
    }

    return Result.ok<SerialNumber>(
      new SerialNumber({ value: trimmed })
    );
  }

  public static reconstitute(serial: string): SerialNumber {
    return new SerialNumber({ value: serial });
  }

  public toString(): string {
    return this._props.value;
  }
}
