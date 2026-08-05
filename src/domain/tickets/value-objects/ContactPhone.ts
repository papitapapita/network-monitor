import { ValueObject, Result, Guard } from 'domain/shared/core';
import { ContactPhoneProps } from '../props';

export class ContactPhone extends ValueObject<ContactPhoneProps> {
  static readonly MIN_DIGITS = 7;
  static readonly MAX_DIGITS = 15;

  get value(): string {
    return this._props.value;
  }

  private constructor(props: ContactPhoneProps) {
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

  public static create(phone: string): Result<ContactPhone> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(phone, 'phone'),
      Guard.isString(phone, 'phone')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<ContactPhone>(guardResult.message!);
    }

    const normalized = ContactPhone.normalize(phone);
    const digitCount = normalized.replace(/\D/g, '').length;

    if (digitCount === 0) {
      return Result.fail<ContactPhone>(
        'Phone number cannot be empty'
      );
    }

    if (digitCount < ContactPhone.MIN_DIGITS) {
      return Result.fail<ContactPhone>(
        `Phone number must have at least ${ContactPhone.MIN_DIGITS} digits`
      );
    }

    if (digitCount > ContactPhone.MAX_DIGITS) {
      return Result.fail<ContactPhone>(
        `Phone number must not exceed ${ContactPhone.MAX_DIGITS} digits`
      );
    }

    return Result.ok<ContactPhone>(
      new ContactPhone({ value: normalized })
    );
  }

  public static reconstitute(phone: string): ContactPhone {
    return new ContactPhone({ value: phone });
  }

  public toString(): string {
    return this._props.value;
  }
}
