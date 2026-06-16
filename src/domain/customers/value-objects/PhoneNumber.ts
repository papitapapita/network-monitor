import { ValueObject, Result, Guard } from 'domain/shared/core';

interface PhoneNumberProps {
  value: string;
}

export class PhoneNumber extends ValueObject<PhoneNumberProps> {
  static readonly MIN_DIGITS = 7;
  static readonly MAX_DIGITS = 15;

  get value(): string {
    return this._props.value;
  }

  private constructor(props: PhoneNumberProps) {
    super(props);
  }

  // Keeps a leading '+' (country code) and digits only; drops spaces, dashes,
  // parentheses and dots commonly found in user input.
  private static normalize(phone: string): string {
    const trimmed = phone.trim();
    const hasPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');
    return hasPlus ? `+${digits}` : digits;
  }

  public static create(phone: string): Result<PhoneNumber> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(phone, 'phone'),
      Guard.isString(phone, 'phone')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<PhoneNumber>(guardResult.message!);
    }

    const normalized = PhoneNumber.normalize(phone);
    const digitCount = normalized.replace(/\D/g, '').length;

    if (digitCount === 0) {
      return Result.fail<PhoneNumber>('Phone number cannot be empty');
    }

    if (digitCount < PhoneNumber.MIN_DIGITS) {
      return Result.fail<PhoneNumber>(
        `Phone number must have at least ${PhoneNumber.MIN_DIGITS} digits`
      );
    }

    if (digitCount > PhoneNumber.MAX_DIGITS) {
      return Result.fail<PhoneNumber>(
        `Phone number must not exceed ${PhoneNumber.MAX_DIGITS} digits`
      );
    }

    return Result.ok<PhoneNumber>(
      new PhoneNumber({ value: normalized })
    );
  }

  public static reconstitute(phone: string): PhoneNumber {
    return new PhoneNumber({ value: phone });
  }

  public toString(): string {
    return this._props.value;
  }
}
