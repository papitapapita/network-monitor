import { Location } from '../../domain/device-inventory/aggregates/';
import { LocationId } from '../../domain/shared/ids';
import { LocationType } from '../../domain/device-inventory/enums';
import { Coordinates } from '../../domain/device-inventory/value-objects';
import { Result } from '../../domain/shared/core';

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
  /**
   * Converts a raw Prisma Location record to the Location domain aggregate.
   *
   * Uses Location.reconstitute() to bypass domain event emission and
   * invariant re-validation — appropriate when hydrating persisted data.
   *
   * @param raw - Raw Prisma Location record
   * @returns Result containing Location aggregate or an error message
   */
  public static toDomain(raw: any): Result<Location> {
    // Parse and validate the LocationId
    const locationIdResult = LocationId.parse(raw.id);
    if (locationIdResult.isFailure) {
      return Result.fail<Location>(
        `Invalid location ID: ${locationIdResult.error}`
      );
    }

    // Map Prisma LocationType to domain LocationType
    const locationType = this.mapLocationTypeFromPrisma(raw.type);

    // Reconstitute Coordinates value object if latitude and longitude are present.
    // Prisma stores coordinates as Decimal — convert to number before use.
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

  /**
   * Converts a Location domain aggregate to a plain object suitable for
   * Prisma create or update operations.
   *
   * @param location - Location aggregate
   * @returns Object ready for Prisma create/update operations
   */
  public static toPersistence(location: Location): any {
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
          ? coordinates.altitude
          : null,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Maps a Prisma LocationType string to the domain LocationType enum.
   *
   * The Prisma and domain enums are identical in value, so this is a direct
   * cast guarded by an exhaustive switch for safety.
   *
   * Throws on an unrecognised value rather than returning Result.fail() because
   * an unknown type in the database is a data integrity violation — corrupt
   * persisted state that the caller cannot meaningfully recover from. Throwing
   * lets the repository's try/catch surface it as an infrastructure error.
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

  /**
   * Maps a domain LocationType enum to the Prisma LocationType string.
   */
  private static mapLocationTypeToPrisma(
    locationType: LocationType
  ): string {
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
