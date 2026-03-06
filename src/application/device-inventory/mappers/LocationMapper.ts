import { Location } from '../../../domain/device-inventory/aggregates/Location';
import { LocationResponseDTO } from '../dtos/LocationResponseDTO';
import { LocationListResponseDTO } from '../dtos/LocationListResponseDTO';

/**
 * Mapper for pure data structure transformation between the Location domain
 * aggregate and its application-layer DTOs.
 *
 * Responsibilities (ONLY):
 * - Extract primitive values from the Location aggregate and its Value Objects.
 * - Flatten the Coordinates value object into individual numeric fields.
 * - Convert domain enum values (LocationType) to their string representations.
 * - Convert Date instances to ISO 8601 strings.
 * - Assemble pagination metadata for list responses.
 *
 * Does NOT:
 * - Validate business rules (use case responsibility).
 * - Create Value Objects (use case responsibility).
 * - Create domain aggregates (use case responsibility).
 * - Map string enums to domain enums (use case responsibility).
 * - Call repositories or external services.
 * - Perform any side effects.
 *
 * @see APPLICATION-MAPPER-STANDARD.md for the complete specification.
 */
export class LocationMapper {
  /**
   * Converts a Location domain aggregate to a response DTO.
   * Pure data transformation only — extracts primitives from Value Objects.
   *
   * The Coordinates value object is flattened into three optional numeric
   * fields (latitude, longitude, altitude). All three are null when no
   * coordinates were stored on the aggregate.
   *
   * @param location - Persisted Location domain aggregate
   * @returns Response DTO with complete location information
   */
  public static toDTO(location: Location): LocationResponseDTO {
    // Extract Coordinates value object fields as primitives.
    // coordinates may be null or undefined — both map to null on the DTO.
    const coords = location.coordinates ?? null;

    return {
      // Extract string ID from the LocationId value object
      id: location.id.toString(),

      // Primitive fields (direct access)
      name: location.name,

      // Extract string value from the LocationType domain enum
      type: location.type.toString(),

      // Optional address fields — undefined becomes null per DTO contract
      municipality: location.municipality ?? null,
      neighborhood: location.neighborhood ?? null,
      address: location.address ?? null,

      // Flatten Coordinates value object into individual primitives
      latitude: coords !== null ? coords.latitude : null,
      longitude: coords !== null ? coords.longitude : null,
      altitude: coords !== null ? (coords.altitude ?? null) : null,

      // Convert Date instances to ISO 8601 strings
      createdAt: location.createdAt.toISOString(),
      updatedAt: location.updatedAt.toISOString()
    };
  }

  /**
   * Converts an array of Location aggregates to a paginated list response DTO.
   * Includes pagination metadata and a hasMore flag derived from the total count.
   *
   * @param locations - Page of Location aggregates (already sliced by the use case)
   * @param total - Total number of locations matching the query (before pagination)
   * @param limit - Page size used for the current query
   * @param offset - Number of items skipped before the current page
   * @returns Paginated list response DTO
   */
  public static toListDTO(
    locations: Location[],
    total: number,
    limit: number = 20,
    offset: number = 0
  ): LocationListResponseDTO {
    return {
      locations: locations.map((location) => this.toDTO(location)),
      total,
      hasMore: offset + locations.length < total,
      limit,
      offset
    };
  }
}
