import { Location } from '../../domain/device-inventory/aggregates/';
import { LocationId } from '../../domain/shared/ids';
import { LocationType } from '../../domain/device-inventory/enums';
import { Coordinates } from '../../domain/device-inventory/value-objects';
import { Result } from '../../domain/shared/core';
import { LocationType as PrismaLocationType } from '../../generated/prisma/client';

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

/**
 * Mapper for converting Location aggregate to/from Prisma model.
 *
 * Handles bidirectional conversion between:
 * - Domain aggregate (Location)
 * - Persistence model (Prisma Location)
 *
 * Key mappings:
 * - latitude / longitude / altitude (Prisma Decimal?) → Coordinates value object (nullable)
 * - type (Prisma LocationType enum) → domain LocationType enum (1-to-1, no translation needed)
 * - Optional address fields (municipality, neighborhood, address) preserved as-is
 */
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

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Throws on an unrecognised value — an unknown type in the database is a data
   * integrity violation that the repository's try/catch will surface as Result.fail.
   */
  private static mapLocationTypeFromPrisma(
    prismaType: string
  ): LocationType {
    switch (prismaType) {
      case 'TOWER':
        return LocationType.TOWER;
      case 'NODE':
        return LocationType.NODE;
      case 'DATACENTER':
        return LocationType.DATACENTER;
      case 'POP':
        return LocationType.POP;
      case 'WAREHOUSE':
        return LocationType.WAREHOUSE;
      case 'OFFICE':
        return LocationType.OFFICE;
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
      case LocationType.NODE:
        return 'NODE';
      case LocationType.DATACENTER:
        return 'DATACENTER';
      case LocationType.POP:
        return 'POP';
      case LocationType.WAREHOUSE:
        return 'WAREHOUSE';
      case LocationType.OFFICE:
        return 'OFFICE';
      default:
        throw new Error(
          `Unknown domain LocationType: ${locationType}`
        );
    }
  }
}
