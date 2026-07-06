import { ValueObject, Result, Guard } from 'domain/shared/core';

interface UserEmailProps {
  value: string;
}

export class UserEmail extends ValueObject<UserEmailProps> {
  static readonly MAX_LENGTH = 255;
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  get value(): string {
    return this._props.value;
  }

  private constructor(props: UserEmailProps) {
    super(props);
  }

  public static create(email: string): Result<UserEmail> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(email, 'email'),
      Guard.isString(email, 'email')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<UserEmail>(guardResult.message!);
    }

    const normalized = email.trim().toLowerCase();

    if (normalized.length === 0) {
      return Result.fail<UserEmail>('Email cannot be empty');
    }

    if (normalized.length > UserEmail.MAX_LENGTH) {
      return Result.fail<UserEmail>(
        `Email must not exceed ${UserEmail.MAX_LENGTH} characters`
      );
    }

    if (!UserEmail.EMAIL_REGEX.test(normalized)) {
      return Result.fail<UserEmail>('Email is not valid');
    }

    return Result.ok<UserEmail>(new UserEmail({ value: normalized }));
  }

  public static reconstitute(email: string): UserEmail {
    return new UserEmail({ value: email });
  }

  public toString(): string {
    return this._props.value;
  }
}
