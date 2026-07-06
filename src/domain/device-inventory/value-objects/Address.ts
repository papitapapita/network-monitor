import { ValueObject, Result, Guard } from 'domain/shared/core';
import { AddressProps } from '../props';

export class Address extends ValueObject<AddressProps> {
  get street(): string {
    return this._props.street;
  }

  get municipality(): string {
    return this._props.municipality;
  }

  get neighborhood(): string {
    return this._props.neighborhood;
  }

  private constructor(props: AddressProps) {
    super(props);
  }

  public static create(props: AddressProps): Result<Address> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.street, 'street'),
      Guard.isString(props.street, 'street'),
      Guard.againstNullOrUndefined(props.municipality, 'municipality'),
      Guard.isString(props.municipality, 'municipality'),
      Guard.againstNullOrUndefined(props.neighborhood, 'neighborhood'),
      Guard.isString(props.neighborhood, 'neighborhood')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<Address>(guardResult.message!);
    }

    const street = props.street.trim();
    if (street.length === 0) {
      return Result.fail<Address>('Street address cannot be empty');
    }
    if (street.length > 255) {
      return Result.fail<Address>('Street address cannot exceed 255 characters');
    }

    const municipality = props.municipality.trim();
    if (municipality.length === 0) {
      return Result.fail<Address>('Municipality cannot be empty');
    }
    if (municipality.length > 100) {
      return Result.fail<Address>('Municipality cannot exceed 100 characters');
    }

    const neighborhood = props.neighborhood.trim();
    if (neighborhood.length === 0) {
      return Result.fail<Address>('Neighborhood cannot be empty');
    }
    if (neighborhood.length > 150) {
      return Result.fail<Address>('Neighborhood cannot exceed 150 characters');
    }

    return Result.ok<Address>(new Address({ street, municipality, neighborhood }));
  }

  public static reconstitute(props: AddressProps): Address {
    return new Address(props);
  }
}
