import { ValueObject, Guard, Result, PhoneNumberProps } from '../';
import {
  parsePhoneNumberWithError as parsePhoneNumber,
  isValidPhoneNumber,
  CountryCode,
  PhoneNumber as LibPhoneNumber
} from 'libphonenumber-js/max';
import {} from '../shared/props';

/**
 * PhoneNumber Value Object
 *
 * Represents a validated, immutable phone number in E.164 format.
 * This Value Object wraps `libphonenumber-js` to provide comprehensive phone number handling.
 *
 * Features:
 * - Normalize phone numbers to E.164 format
 * - Validate country-specific formats
 * - Detect number type (MOBILE, FIXED_LINE, etc.)
 * - Provide international/national formatting
 *
 * Business Rules:
 * - Phone number cannot be null, undefined, or empty
 * - Must be a valid phone number for the specified country
 * - Automatically normalized to E.164 format (+[country code][number])
 * - Supports parsing with or without country code
 * - Default country can be provided for local/national numbers
 * - Validates against libphonenumber-js rules for each country
 * - Whitespace is trimmed automatically
 *
 * @example
 * const phoneResult = PhoneNumber.create('3001234567', 'CO');
 * if (phoneResult.isSuccess) {
 *   const phone = phoneResult.value;
 *   console.log(phone.value); // '+573001234567' (E.164)
 *   console.log(phone.formattedInternational); // '+57 300 1234567'
 *   console.log(phone.formattedNational); // '300 1234567'
 *   console.log(phone.isMobile()); // true
 * }
 *
 * @example
 * const phoneResult2 = PhoneNumber.createFromE164('+14155552671');
 * // Creates phone number from E.164 format
 */
export class PhoneNumber extends ValueObject<PhoneNumberProps> {
  private constructor(_props: PhoneNumberProps) {
    super(_props);
  }

  /** @returns Phone number in E.164 format (e.g. +573001234567) */
  get value(): string {
    return this._props.value;
  }

  /** @returns The country calling code (e.g. "57", "1", "55") */
  get countryCode(): string {
    return this._props.countryCode;
  }

  /** @returns The national number portion without country code */
  get nationalNumber(): string {
    return this._props.nationalNumber;
  }

  /** @returns Internationally formatted version (e.g. +57 300 1234567) */
  get formattedInternational(): string {
    return this._props.formattedInternational;
  }

  /** @returns Nationally formatted version for its country */
  get formattedNational(): string {
    return this._props.formattedNational;
  }

  /** @returns ISO two-letter country code (e.g., "CO", "US") */
  get country(): CountryCode | undefined {
    return this._props.country;
  }

  /** @returns Detected phone number type (e.g., MOBILE, FIXED_LINE) */
  get type(): string | undefined {
    return this._props.type;
  }

  /**
   * Creates a validated and normalized PhoneNumber Value Object.
   *
   * @param phone - Raw phone number input (any format: local, national, or international).
   * @param defaultCountry - Optional ISO country code to assume when parsing local/national numbers.
   *
   * @returns `Result.ok(PhoneNumber)` if valid; otherwise `Result.fail` with error description.
   *
   * @example
   * const phone = PhoneNumber.create("3001234567", "CO");
   * const e164 = phone.getValue().value; // +573001234567
   */
  public static create(
    phone: string,
    defaultCountry?: CountryCode
  ): Result<PhoneNumber> {
    const guardResult = Guard.againstNullOrUndefined(phone, 'phone');
    if (!guardResult.succeeded) {
      return Result.fail<PhoneNumber>(guardResult.message!);
    }

    const trimmedPhone = phone.trim();

    const guardEmpty = Guard.againstAtLeast(
      trimmedPhone.length,
      1,
      'phone'
    );
    if (!guardEmpty.succeeded) {
      return Result.fail<PhoneNumber>(guardEmpty.message!);
    }

    try {
      const isValid = isValidPhoneNumber(
        trimmedPhone,
        defaultCountry
      );
      if (!isValid) {
        return Result.fail<PhoneNumber>(
          'Invalid phone number format for the specified country'
        );
      }

      const parsedPhone: LibPhoneNumber = parsePhoneNumber(
        trimmedPhone,
        defaultCountry
      );

      if (!parsedPhone) {
        return Result.fail<PhoneNumber>(
          'Unable to parse phone number'
        );
      }

      if (!parsedPhone.isValid()) {
        return Result.fail<PhoneNumber>(
          `Invalid phone number for country ${parsedPhone.country || 'unknown'}`
        );
      }

      return Result.ok<PhoneNumber>(
        new PhoneNumber({
          value: parsedPhone.number, // E.164
          countryCode: parsedPhone.countryCallingCode,
          nationalNumber: parsedPhone.nationalNumber,
          formattedInternational: parsedPhone.formatInternational(),
          formattedNational: parsedPhone.formatNational(),
          country: parsedPhone.country,
          type: parsedPhone.getType()
        })
      );
    } catch (error) {
      if (error instanceof Error) {
        return Result.fail<PhoneNumber>(
          `Phone validation error: ${error.message}`
        );
      }
      return Result.fail<PhoneNumber>('Invalid phone number');
    }
  }

  /**
   * Convenience constructor for numbers already in E.164 format.
   *
   * @param e164 - A phone number in valid E.164 format (e.g., +14155552671).
   * @returns A `PhoneNumber` instance wrapped in a `Result`.
   */
  public static createFromE164(e164: string): Result<PhoneNumber> {
    return this.create(e164);
  }

  /** @returns `true` if the number type is MOBILE */
  public isMobile(): boolean {
    return this.type === 'MOBILE';
  }

  /** @returns `true` if the number type is FIXED_LINE */
  public isFixedLine(): boolean {
    return this.type === 'FIXED_LINE';
  }

  /**
   * @returns `true` if this number can receive SMS (MOBILE or FIXED_LINE_OR_MOBILE)
   */
  public canReceiveSMS(): boolean {
    return (
      this.type === 'MOBILE' || this.type === 'FIXED_LINE_OR_MOBILE'
    );
  }

  /**
   * Formats this phone number based on a target country.
   *
   * @param country - ISO two-letter country code to format for.
   * @returns National format if the target matches the number's country, otherwise international format.
   */
  public formatFor(country: CountryCode): string {
    try {
      const parsed = parsePhoneNumber(this.value);
      if (parsed.country === country) {
        return parsed.formatNational();
      }
      return parsed.formatInternational();
    } catch {
      return this.formattedInternational;
    }
  }

  /**
   * Converts this phone number into `tel:` URI format.
   *
   * @returns `tel:+573001234567`
   */
  public toURI(): string {
    return `tel:${this.value}`;
  }

  /** @returns Internationally formatted phone number */
  public toString(): string {
    return this.formattedInternational;
  }

  /**
   * @returns The phone number normalized in E.164 format.
   */
  public toE164(): string {
    return this.value;
  }
}
