import { ValueObject, Result, Guard } from 'domain/shared/core';
import { ServiceAddressProps } from '../props';

const MAX_STREET = 255;
const MAX_MUNICIPALITY = 100;
const MAX_NEIGHBORHOOD = 150;
const MAX_REFERENCE = 255;

// Where the technician is actually going. Snapshotted onto the ticket at
// creation rather than resolved from the customer, because no customer address
// exists in the system and a closed ticket must keep the address it was worked
// at even if the customer later moves.
export class ServiceAddress extends ValueObject<ServiceAddressProps> {
  get street(): string {
    return this._props.street;
  }

  get municipality(): string {
    return this._props.municipality;
  }

  get neighborhood(): string {
    return this._props.neighborhood;
  }

  get reference(): string | null {
    return this._props.reference;
  }

  get latitude(): number | null {
    return this._props.latitude;
  }

  get longitude(): number | null {
    return this._props.longitude;
  }

  private constructor(props: ServiceAddressProps) {
    super(props);
  }

  public static create(props: {
    street: string;
    municipality: string;
    neighborhood: string;
    reference?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }): Result<ServiceAddress> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.street, 'street'),
      Guard.isString(props.street, 'street'),
      Guard.againstNullOrUndefined(
        props.municipality,
        'municipality'
      ),
      Guard.isString(props.municipality, 'municipality'),
      Guard.againstNullOrUndefined(
        props.neighborhood,
        'neighborhood'
      ),
      Guard.isString(props.neighborhood, 'neighborhood')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<ServiceAddress>(guardResult.message!);
    }

    const street = props.street.trim();
    if (street.length === 0) {
      return Result.fail<ServiceAddress>(
        'Street address cannot be empty'
      );
    }
    if (street.length > MAX_STREET) {
      return Result.fail<ServiceAddress>(
        `Street address cannot exceed ${MAX_STREET} characters`
      );
    }

    const municipality = props.municipality.trim();
    if (municipality.length === 0) {
      return Result.fail<ServiceAddress>(
        'Municipality cannot be empty'
      );
    }
    if (municipality.length > MAX_MUNICIPALITY) {
      return Result.fail<ServiceAddress>(
        `Municipality cannot exceed ${MAX_MUNICIPALITY} characters`
      );
    }

    const neighborhood = props.neighborhood.trim();
    if (neighborhood.length === 0) {
      return Result.fail<ServiceAddress>(
        'Neighborhood cannot be empty'
      );
    }
    if (neighborhood.length > MAX_NEIGHBORHOOD) {
      return Result.fail<ServiceAddress>(
        `Neighborhood cannot exceed ${MAX_NEIGHBORHOOD} characters`
      );
    }

    const rawReference = props.reference ?? null;
    let reference: string | null = null;
    if (rawReference !== null) {
      const guard = Guard.isString(rawReference, 'reference');
      if (!guard.succeeded) {
        return Result.fail<ServiceAddress>(guard.message!);
      }
      const trimmed = rawReference.trim();
      if (trimmed.length > MAX_REFERENCE) {
        return Result.fail<ServiceAddress>(
          `Address reference cannot exceed ${MAX_REFERENCE} characters`
        );
      }
      reference = trimmed.length === 0 ? null : trimmed;
    }

    const coordinatesResult = ServiceAddress.validateCoordinates(
      props.latitude ?? null,
      props.longitude ?? null
    );
    if (coordinatesResult.isFailure) {
      return Result.fail<ServiceAddress>(coordinatesResult.error);
    }

    return Result.ok<ServiceAddress>(
      new ServiceAddress({
        street,
        municipality,
        neighborhood,
        reference,
        latitude: props.latitude ?? null,
        longitude: props.longitude ?? null
      })
    );
  }

  // An address is optional on a ticket, but a partial one is not: a street with
  // no municipality is not something a technician can navigate to.
  public static createOptional(props: {
    street: string | null;
    municipality: string | null;
    neighborhood: string | null;
    reference?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }): Result<ServiceAddress | null> {
    const { street, municipality, neighborhood } = props;

    const allAbsent =
      street === null &&
      municipality === null &&
      neighborhood === null;

    if (allAbsent) {
      if (
        (props.latitude ?? null) !== null ||
        (props.longitude ?? null) !== null ||
        (props.reference ?? null) !== null
      ) {
        return Result.fail<ServiceAddress | null>(
          'An address requires a street, municipality, and neighborhood'
        );
      }
      return Result.ok<ServiceAddress | null>(null);
    }

    if (
      street === null ||
      municipality === null ||
      neighborhood === null
    ) {
      return Result.fail<ServiceAddress | null>(
        'An address requires a street, municipality, and neighborhood'
      );
    }

    const addressResult = ServiceAddress.create({
      street,
      municipality,
      neighborhood,
      reference: props.reference ?? null,
      latitude: props.latitude ?? null,
      longitude: props.longitude ?? null
    });
    if (addressResult.isFailure) {
      return Result.fail<ServiceAddress | null>(addressResult.error);
    }

    return Result.ok<ServiceAddress | null>(addressResult.value);
  }

  public static reconstitute(
    props: ServiceAddressProps
  ): ServiceAddress {
    return new ServiceAddress(props);
  }

  public hasCoordinates(): boolean {
    return (
      this._props.latitude !== null && this._props.longitude !== null
    );
  }

  public toString(): string {
    return `${this._props.street}, ${this._props.neighborhood}, ${this._props.municipality}`;
  }

  // Latitude and longitude are always paired — one without the other cannot be
  // put on a map.
  private static validateCoordinates(
    latitude: number | null,
    longitude: number | null
  ): Result<void> {
    if (latitude === null && longitude === null) {
      return Result.ok<void>();
    }

    if (latitude === null || longitude === null) {
      return Result.fail<void>(
        'Coordinates require both a latitude and a longitude'
      );
    }

    const guardResult = Guard.combine([
      Guard.isNumber(latitude, 'latitude'),
      Guard.isNumber(longitude, 'longitude')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    if (!isFinite(latitude)) {
      return Result.fail<void>('latitude must be a finite number');
    }
    if (!isFinite(longitude)) {
      return Result.fail<void>('longitude must be a finite number');
    }

    const latitudeCheck = Guard.inRange(
      latitude,
      -90,
      90,
      'latitude'
    );
    if (!latitudeCheck.succeeded) {
      return Result.fail<void>(latitudeCheck.message!);
    }

    const longitudeCheck = Guard.inRange(
      longitude,
      -180,
      180,
      'longitude'
    );
    if (!longitudeCheck.succeeded) {
      return Result.fail<void>(longitudeCheck.message!);
    }

    return Result.ok<void>();
  }
}
