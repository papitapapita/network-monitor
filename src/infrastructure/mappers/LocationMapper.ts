import { Location } from 'domain/device-inventory/aggregates/';
import { LocationId } from 'domain/shared/ids';
import {
  Address,
  Coordinates,
  LocationType
} from 'domain/device-inventory/value-objects';
import { Result } from 'domain/shared/core';
import { LocationType as PrismaLocationType } from 'generated/prisma/client';

type PrismaLocationRecord = {
  id: string;
  name: string;
  type: string;
  municipality: string | null;
  neighborhood: string | null;
  address: string | null;
  latitude: number | { toNumber(): number } | null;
  longitude: number | { toNumber(): number } | null;
  altitude: number | { toNumber(): number } | null;
  createdAt: Date;
  updatedAt: Date;
};

type LocationPersistenceData = {
  id: string;
  name: string;
  type: PrismaLocationType;
  municipality: string | null;
  neighborhood: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export class LocationMapper {
  public static toDomain(
    raw: PrismaLocationRecord
  ): Result<Location> {
    const locationIdResult = LocationId.parse(raw.id);
    if (locationIdResult.isFailure) {
      return Result.fail<Location>(
        `Invalid location ID: ${locationIdResult.error}`
      );
    }

    const locationType = this.mapLocationTypeFromPrisma(raw.type);

    // Prisma stores coordinates as Decimal — normalise to number before use.
    let coordinates: Coordinates | null = null;
    if (raw.latitude != null && raw.longitude != null) {
      coordinates = Coordinates.reconstitute({
        latitude: Number(raw.latitude),
        longitude: Number(raw.longitude),
        altitude:
          raw.altitude != null ? Number(raw.altitude) : undefined
      });
    }

    let address: Address | null = null;
    if (
      raw.address != null &&
      raw.municipality != null &&
      raw.neighborhood != null
    ) {
      address = Address.reconstitute({
        street: raw.address,
        municipality: raw.municipality,
        neighborhood: raw.neighborhood
      });
    }

    const location = Location.reconstitute(locationIdResult.value, {
      name: raw.name,
      type: locationType,
      address,
      coordinates,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt
    });

    return Result.ok<Location>(location);
  }

  public static toPersistence(
    location: Location
  ): LocationPersistenceData {
    const coordinates = location.coordinates;

    return {
      id: location.id.toString(),
      name: location.name,
      type: location.type.value as PrismaLocationType,
      municipality: location.municipality,
      neighborhood: location.neighborhood,
      address: location.address,
      latitude: coordinates != null ? coordinates.latitude : null,
      longitude: coordinates != null ? coordinates.longitude : null,
      altitude:
        coordinates != null && coordinates.hasAltitude()
          ? coordinates.altitude!
          : null,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt
    };
  }

  // throws on unrecognised value — the repo's try/catch surfaces it as Result.fail.
  // Deliberately strict: the stored value must match a domain type exactly, with no
  // trimming or case-folding, so drift between the Prisma enum and the domain surfaces here.
  private static mapLocationTypeFromPrisma(
    prismaType: string
  ): LocationType {
    if (!LocationType.isValid(prismaType)) {
      throw new Error(
        `Data integrity violation: unrecognised LocationType "${prismaType}" in persistence store`
      );
    }

    return LocationType.reconstitute(prismaType);
  }
}
