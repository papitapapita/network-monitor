import { ValueObject, Result, Guard } from 'domain/shared/core';

interface EmailAddressProps {
  value: string;
}

export class EmailAddress extends ValueObject<EmailAddressProps> {
  static readonly MAX_LENGTH = 255;
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  get value(): string {
    return this._props.value;
  }

  private constructor(props: EmailAddressProps) {
    super(props);
  }

  public static create(email: string): Result<EmailAddress> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(email, 'email'),
      Guard.isString(email, 'email')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<EmailAddress>(guardResult.message!);
    }

    const normalized = email.trim().toLowerCase();

    if (normalized.length === 0) {
      return Result.fail<EmailAddress>('Email cannot be empty');
    }

    if (normalized.length > EmailAddress.MAX_LENGTH) {
      return Result.fail<EmailAddress>(
        `Email must not exceed ${EmailAddress.MAX_LENGTH} characters`
      );
    }

    if (!EmailAddress.EMAIL_REGEX.test(normalized)) {
      return Result.fail<EmailAddress>('Email is not valid');
    }

    return Result.ok<EmailAddress>(
      new EmailAddress({ value: normalized })
    );
  }

  public static reconstitute(email: string): EmailAddress {
    return new EmailAddress({ value: email });
  }

  public toString(): string {
    return this._props.value;
  }
}
