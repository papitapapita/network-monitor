import { Location } from 'domain/device-inventory/aggregates/Location';
import {
  LocationResponseDTO,
  LocationListResponseDTO,
  CreateLocationRequestDTO,
  UpdateLocationRequestDTO
} from '../dtos';

export class LocationMapper {
  public static toDTO(location: Location): LocationResponseDTO {
    // `coordinates` is typed as optional — coerce to null so the three
    // flattened fields are consistently null when absent.
    const coords = location.coordinates ?? null;

    return {
      id: location.id.toString(),
      name: location.name,
      type: location.type.toString(),
      municipality: location.municipality ?? null,
      neighborhood: location.neighborhood ?? null,
      address: location.address ?? null,
      latitude: coords !== null ? coords.latitude : null,
      longitude: coords !== null ? coords.longitude : null,
      altitude: coords !== null ? (coords.altitude ?? null) : null,
      createdAt: location.createdAt.toISOString(),
      updatedAt: location.updatedAt.toISOString()
    };
  }

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

  public static extractCreateData(dto: CreateLocationRequestDTO) {
    return {
      name: dto.name,
      type: dto.type,
      municipality: dto.municipality ?? null,
      neighborhood: dto.neighborhood ?? null,
      address: dto.address ?? null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      altitude: dto.altitude ?? null
    };
  }

  public static extractUpdateData(dto: UpdateLocationRequestDTO) {
    const updates: {
      name?: string;
      type?: string;
      municipality?: string | null;
      neighborhood?: string | null;
      address?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      altitude?: number | null;
    } = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.type !== undefined) updates.type = dto.type;
    if (dto.municipality !== undefined)
      updates.municipality = dto.municipality;
    if (dto.neighborhood !== undefined)
      updates.neighborhood = dto.neighborhood;
    if (dto.address !== undefined) updates.address = dto.address;
    if (dto.latitude !== undefined) updates.latitude = dto.latitude;
    if (dto.longitude !== undefined)
      updates.longitude = dto.longitude;
    if (dto.altitude !== undefined) updates.altitude = dto.altitude;
    return updates;
  }
}
