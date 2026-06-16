import { Location } from 'domain/device-inventory/aggregates/';
import { LocationId } from 'domain/shared/ids';
import { LocationType } from 'domain/device-inventory/enums';
import { Coordinates } from 'domain/device-inventory/value-objects';
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

    const location = Location.reconstitute(locationIdResult.value, {
      name: raw.name,
      type: locationType,
      municipality: raw.municipality ?? null,
      neighborhood: raw.neighborhood ?? null,
      address: raw.address ?? null,
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
      type: this.mapLocationTypeToPrisma(location.type),
      municipality: location.municipality ?? null,
      neighborhood: location.neighborhood ?? null,
      address: location.address ?? null,
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

  // throws on unrecognised value — the repo's try/catch surfaces it as Result.fail
  private static mapLocationTypeFromPrisma(
    prismaType: string
  ): LocationType {
    switch (prismaType) {
      case 'TOWER':
        return LocationType.TOWER;
      case 'DATACENTER':
        return LocationType.DATACENTER;
      case 'POINT_OF_PRESENCE':
        return LocationType.POINT_OF_PRESENCE;
      case 'OFFICE':
        return LocationType.OFFICE;
      case 'OTHER':
        return LocationType.OTHER;
      case 'CUSTOMER_PREMISES':
        return LocationType.CUSTOMER_PREMISES;
      default:
        throw new Error(
          `Data integrity violation: unrecognised LocationType "${prismaType}" in persistence store`
        );
    }
  }

  private static mapLocationTypeToPrisma(
    locationType: LocationType
  ): PrismaLocationType {
    switch (locationType) {
      case LocationType.TOWER:
        return 'TOWER';
      case LocationType.DATACENTER:
        return 'DATACENTER';
      case LocationType.POINT_OF_PRESENCE:
        return 'POINT_OF_PRESENCE';
      case LocationType.OFFICE:
        return 'OFFICE';
      case LocationType.CUSTOMER_PREMISES:
        return 'CUSTOMER_PREMISES';
      case LocationType.OTHER:
        return 'OTHER';
      default:
        throw new Error(
          `Unknown domain LocationType: ${locationType}`
        );
    }
  }
}
