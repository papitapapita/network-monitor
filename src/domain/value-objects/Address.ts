import { ValueObject, Guard, Result, AddressProps } from '../';

/**
 * Address Value Object
 *
 * Represents a physical address with validation and formatting capabilities.
 * This object encapsulates all required and optional fields for an address
 * and enforces validation rules at creation time through Guard clauses.
 *
 * Business Rules:
 * - Required fields: street, city, province, country (cannot be null/undefined)
 * - Optional fields: houseNumber, postalCode, complement, neighborhood
 * - Street length: 3-200 characters
 * - City length: 2-100 characters
 * - Province length: 2-100 characters
 * - Country length: 2-100 characters
 * - House number length: 1-20 characters (if provided)
 * - Postal code length: 3-20 characters (if provided)
 * - Complement length: 1-200 characters (if provided)
 * - Neighborhood length: 2-100 characters (if provided)
 * - All fields are trimmed automatically
 *
 * @example
 * const addressResult = Address.create({
 *   street: '123 Main Street',
 *   houseNumber: '456',
 *   city: 'San Francisco',
 *   province: 'California',
 *   country: 'United States',
 *   postalCode: '94102'
 * });
 *
 * if (addressResult.isSuccess) {
 *   const address = addressResult.value;
 *   console.log(address.getFullAddress());
 *   console.log(address.getShortAddress());
 * }
 */
export class Address extends ValueObject<AddressProps> {
  /**
   * Private constructor. Use {@link Address.create} to instantiate.
   */
  private constructor(props: AddressProps) {
    super(props);
  }

  /** Street name (required). */
  get street(): string {
    return this.props.street;
  }

  /** House or building number (optional). */
  get houseNumber(): string | undefined {
    return this.props.houseNumber;
  }

  /** City or municipality (required). */
  get city(): string {
    return this.props.city;
  }

  /** State, province, or department (required). */
  get province(): string {
    return this.props.province;
  }

  /** Country name (required). */
  get country(): string {
    return this.props.country;
  }

  /** Postal or ZIP code (optional). */
  get postalCode(): string | undefined {
    return this.props.postalCode;
  }

  /** Additional information (optional), e.g., "Apt 302", "Floor 5". */
  get complement(): string | undefined {
    return this.props.complement;
  }

  /** Neighborhood or sector (optional). */
  get neighborhood(): string | undefined {
    return this.props.neighborhood;
  }

  /**
   * Returns the full address as a formatted string.
   *
   * Concatenates multiple components in a readable format:
   * - "Street # HouseNumber"
   * - complement
   * - neighborhood
   * - city
   * - province
   * - postalCode
   * - country
   *
   * Empty parts are automatically omitted.
   *
   * @returns Full formatted address.
   */
  public getFullAddress(): string {
    const streetWithHouseNumber = `${this.street}${this.houseNumber ? ' # ' + this.houseNumber : ''}`;
    const parts = [
      streetWithHouseNumber,
      this.complement,
      this.neighborhood,
      this.city,
      this.province,
      this.postalCode,
      this.country
    ].filter(Boolean);

    return parts.join(', ');
  }

  /**
   * Returns a shorter version of the address,
   * useful for UI lists or summaries.
   *
   * Format:
   * - "Street # HouseNumber, City, Province PostalCode"
   *
   * @returns Short formatted address.
   */
  public getShortAddress(): string {
    return `${this.street}${this.houseNumber ? ' # ' + this.houseNumber : ''}, ${this.city}, ${this.province} ${this.postalCode || ''}`.trim();
  }

  /**
   * Factory method to create an Address value object.
   *
   * Performs the following validations using Guard:
   * - Required fields must not be null/undefined.
   * - Minimum and maximum lengths for each field.
   * - Optional fields validated only if provided.
   *
   * @param props - Raw address properties.
   * @returns A {@link Result} wrapping either a valid Address or an error message.
   */
  public static create(props: AddressProps): Result<Address> {
    const againstNullResult = Guard.againstNullOrUndefinedBulk([
      { argument: props.street, argumentName: 'street' },
      { argument: props.city, argumentName: 'city' },
      { argument: props.province, argumentName: 'province' },
      { argument: props.country, argumentName: 'country' }
    ]);

    if (!againstNullResult.succeeded) {
      return Result.fail<Address>(againstNullResult.message!);
    }

    const guardResult = Guard.combine([
      Guard.inRange(props.street.trim().length, 3, 200, 'street'),
      Guard.inRange(props.city.trim().length, 2, 100, 'city'),
      Guard.inRange(props.province.trim().length, 2, 100, 'province'),
      Guard.inRange(props.country.trim().length, 2, 100, 'country')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<Address>(guardResult.message!);
    }

    const houseNumber = props.houseNumber?.trim() || undefined;
    const postalCode = props.postalCode?.trim() || undefined;
    const complement = props.complement?.trim() || undefined;
    const neighborhood = props.neighborhood?.trim() || undefined;

    if (houseNumber !== undefined) {
      const houseNumberLength = Guard.inRange(
        houseNumber.length,
        1,
        20,
        'houseNumber'
      );
      if (!houseNumberLength.succeeded) {
        return Result.fail<Address>(houseNumberLength.message!);
      }
    }

    if (postalCode !== undefined) {
      const postalCodeLength = Guard.inRange(
        postalCode.length,
        3,
        20,
        'postalCode'
      );
      if (!postalCodeLength.succeeded) {
        return Result.fail<Address>(postalCodeLength.message!);
      }
    }

    if (complement !== undefined) {
      const complementLength = Guard.inRange(
        complement.length,
        1,
        200,
        'complement'
      );
      if (!complementLength.succeeded) {
        return Result.fail<Address>(complementLength.message!);
      }
    }

    if (neighborhood !== undefined) {
      const neighborhoodLength = Guard.inRange(
        neighborhood.length,
        2,
        100,
        'neighborhood'
      );
      if (!neighborhoodLength.succeeded) {
        return Result.fail<Address>(neighborhoodLength.message!);
      }
    }

    return Result.ok<Address>(
      new Address({
        street: props.street.trim(),
        houseNumber,
        city: props.city.trim(),
        province: props.province.trim(),
        country: props.country.trim(),
        postalCode: postalCode,
        complement: complement,
        neighborhood: neighborhood
      })
    );
  }

  /**
   * Returns the full address as a string.
   *
   * Equivalent to {@link Address.getFullAddress}.
   */
  public toString(): string {
    return this.getFullAddress();
  }
}
