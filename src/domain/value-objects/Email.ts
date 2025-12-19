import { ValueObject, Result, Guard, EmailProps } from '../';

/**
 * Email Value Object
 *
 * Represents an email address with validation and normalization.
 * In Domain-Driven Design (DDD), an Email is a Value Object — meaning:
 * - It is immutable once created
 * - It is compared by value, not identity
 * - It encapsulates validation and domain invariants internally
 *
 * Business Rules:
 * - Email cannot be null, undefined, or empty
 * - Must be valid email format (RFC 5322 simplified)
 * - Maximum total length: 320 characters
 * - Maximum local-part length: 64 characters (before @)
 * - Maximum domain length: 255 characters (after @)
 * - Minimum length: 1 character
 * - Automatically normalized to lowercase
 * - Whitespace is trimmed automatically
 *
 * @example
 * const emailResult = Email.create('user@example.com');
 * if (emailResult.isSuccess) {
 *   const email = emailResult.value;
 *   console.log(email.value); // 'user@example.com'
 *   console.log(email.toString()); // 'user@example.com'
 * }
 *
 * @example
 * const emailResult2 = Email.create('  USER@EXAMPLE.COM  ');
 * // Automatically trimmed and lowercased to 'user@example.com'
 */
export class Email extends ValueObject<EmailProps> {
  /**
   * Private constructor to enforce creation through the factory.
   *
   * @param props - The email properties containing the validated value.
   */
  private constructor(props: EmailProps) {
    super(props);
  }

  /**
   * Gets the normalized email value.
   *
   * Emails are always:
   * - trimmed
   * - lowercased
   *
   * @returns The normalized email string.
   */
  get value(): string {
    return this.props.value;
  }

  /**
   * Factory method to create a validated Email Value Object.
   *
   * This method performs multiple layers of validation:
   *
   * 1. **Null / undefined check**
   *    - Ensures an email value was provided.
   *
   * 2. **Whitespace normalization**
   *    - Trims and lowercases the email string.
   *
   * 3. **Basic emptiness check**
   *    - Prevents blank or whitespace-only emails.
   *
   * 4. **Format validation**
   *    - Uses Guard.isValidEmail() to verify standard email syntax.
   *
   * 5. **Length constraints**
   *    - Full email ≤ 320 characters
   *    - Local part ≤ 64 characters
   *    - Domain ≤ 255 characters
   *
   * If validation passes, returns a successful {@link Result} containing the Email VO.
   * If validation fails, returns a failed {@link Result} with the error message.
   *
   * @param email - The raw email string provided by the user or system.
   * @returns A {@link Result} containing either a valid Email VO or an error message.
   */
  public static create(email: string): Result<Email> {
    const isValid = Guard.combine([
      Guard.againstNullOrUndefined(email, 'email'),
      Guard.isString(email, 'email')
    ]);

    if (!isValid.succeeded) {
      return Result.fail<Email>(isValid.message!);
    }

    const trimmedEmail = email.trim().toLowerCase();

    const guardResult = Guard.combine([
      Guard.againstAtLeast(trimmedEmail.length, 1, 'email'),
      Guard.againstAtMost(trimmedEmail.length, 320, 'email')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<Email>(guardResult.message!);
    }

    const formatResult = this.isValidEmail(trimmedEmail, 'email');

    if (!formatResult.isSuccess) {
      return Result.fail<Email>(formatResult.error!);
    }

    const [localPart, domain] = trimmedEmail.split('@');

    const guardResult2 = Guard.combine([
      Guard.againstAtMost(localPart.length, 64, 'local email part'),
      Guard.againstAtMost(domain.length, 255, 'domain email part')
    ]);

    if (guardResult2.succeeded === false) {
      return Result.fail<Email>(guardResult2.message!);
    }

    return Result.ok<Email>(new Email({ value: trimmedEmail }));
  }

  /**
   * Validates that a string is a well-formed email.
   *
   * @param {string} email - Email value to validate.
   * @param {string} argumentName - Label for messaging.
   * @returns {IGuardResult} Validation result.
   */
  private static isValidEmail(
    email: string,
    argumentName: string
  ): Result<void> {
    const emailRegex = /^[\w-.+]+@([\w-]+\.)+[\w-]{2,4}$/;

    if (!emailRegex.test(email)) {
      return Result.fail<void>(
        `${argumentName} is not a valid email address`
      );
    }
    return Result.ok<void>();
  }

  /**
   * Returns the email value as a string.
   *
   * Useful for logging, serialization and template usage.
   *
   * @returns The normalized email value.
   */
  public toString(): string {
    return this.value;
  }
}
