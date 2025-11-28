import { ValueObject, Result } from '../shared/kernel';
import { EmailProps } from '../shared/props/EmailProps';
//import { Guard } from '@/shared/kernel/Guard';

export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  /**
   * Validates that a string is a well-formed email.
   *
   * @param {string} email - Email value to validate.
   * @param {string} argumentName - Label for messaging.
   * @returns {IGuardResult} Validation result.
   */
  private isValidEmail(
    email: string,
    argumentName: string
  ): IGuardResult {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return {
        succeeded: false,
        message: `${argumentName} is not a valid email address.`
      };
    }
    return { succeeded: true };
  }

  public static create(email: string): Result<Email> {
    const guardResult = Guard.againstNullOrUndefined(email, 'email');
    if (!guardResult.succeeded) {
      return Result.fail<Email>(guardResult.message!);
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedEmail.length === 0) {
      return Result.fail<Email>('Email cannot be empty');
    }

    const emailValidation = this.isValidEmail(trimmedEmail, 'email');
    if (!emailValidation.succeeded) {
      return Result.fail<Email>(emailValidation.message!);
    }

    // Additional business rules
    if (trimmedEmail.length > 320) {
      return Result.fail<Email>('Email cannot exceed 320 characters');
    }

    const [localPart, domain] = trimmedEmail.split('@');

    if (localPart.length > 64) {
      return Result.fail<Email>(
        'Email local part cannot exceed 64 characters'
      );
    }

    if (domain.length > 255) {
      return Result.fail<Email>(
        'Email domain cannot exceed 255 characters'
      );
    }

    return Result.ok<Email>(new Email({ value: trimmedEmail }));
  }

  public toString(): string {
    return this.value;
  }
}
