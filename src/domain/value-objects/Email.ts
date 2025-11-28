import { ValueObject, Result, Guard } from '../shared/kernel';
import { EmailProps } from '../shared/props/EmailProps';

/**
 * Represents an email address as a Value Object.
 *
 * In Domain-Driven Design (DDD), an Email is a Value Object — meaning:
 * - It is immutable once created.
 * - It is compared by value, not identity.
 * - It encapsulates validation and domain invariants internally.
 *
 * This class ensures that every email created is valid according to:
 * - Basic null/undefined checks
 * - Standard email format validation
 * - RFC-like constraints:
 *   - Maximum total length: 320 characters
 *   - Maximum local-part length: 64 characters
 *   - Maximum domain length: 255 characters
 *
 * Instances can only be created through the {@link Email.create} factory method.
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
      Guard.againstAtLeast(trimmedEmail.length, 0, 'email'),
      Guard.againstAtMost(trimmedEmail.length, 320, 'email'),
      Guard.isValidEmail(trimmedEmail, 'email')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<Email>(guardResult.message!);
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
