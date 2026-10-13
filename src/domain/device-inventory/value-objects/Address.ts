import { ValueObject, Result, Guard } from 'domain/shared/core';
import { AddressProps } from '../props';

type AddressPart = keyof AddressProps;

const PARTS: { key: AddressPart; label: string; max: number }[] = [
  { key: 'street', label: 'Street address', max: 255 },
  { key: 'municipality', label: 'Municipality', max: 100 },
  { key: 'neighborhood', label: 'Neighborhood', max: 150 }
];

export class Address extends ValueObject<AddressProps> {
  get street(): string | null {
    return this._props.street;
  }

  get municipality(): string | null {
    return this._props.municipality;
  }

  get neighborhood(): string | null {
    return this._props.neighborhood;
  }

  private constructor(props: AddressProps) {
    super(props);
  }

  // Each part is optional on its own: a site is often known by its
  // neighborhood or municipality before anyone has a street for it.
  public static create(props: AddressProps): Result<Address> {
    const cleaned: Record<AddressPart, string | null> = {
      street: null,
      municipality: null,
      neighborhood: null
    };

    for (const { key, label, max } of PARTS) {
      const value = props[key];
      if (value === null || value === undefined) continue;

      const guardResult = Guard.isString(value, key);
      if (!guardResult.succeeded) {
        return Result.fail<Address>(guardResult.message!);
      }

      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return Result.fail<Address>(`${label} cannot be empty`);
      }
      if (trimmed.length > max) {
        return Result.fail<Address>(
          `${label} cannot exceed ${max} characters`
        );
      }
      cleaned[key] = trimmed;
    }

    if (PARTS.every(({ key }) => cleaned[key] === null)) {
      return Result.fail<Address>(
        'An address needs a street, municipality, or neighborhood'
      );
    }

    return Result.ok<Address>(new Address(cleaned));
  }

  public static createOptional(
    props: AddressProps
  ): Result<Address | null> {
    if (PARTS.every(({ key }) => props[key] == null)) {
      return Result.ok<Address | null>(null);
    }

    const addressResult = Address.create(props);
    if (addressResult.isFailure) {
      return Result.fail<Address | null>(addressResult.error);
    }

    return Result.ok<Address | null>(addressResult.value);
  }

  public static reconstitute(props: AddressProps): Address {
    return new Address(props);
  }

  public isComplete(): boolean {
    return PARTS.every(({ key }) => this._props[key] !== null);
  }
}
