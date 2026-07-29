import { ILocationRepository } from 'domain/device-inventory/repository';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { Device } from 'domain/device-inventory/aggregates';
import { LocationId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  MapPinDTO,
  MapPinDeviceDTO,
  MapPinsResponseDTO
} from '../dtos/MapPinDTO';

export class GetMapLocationsUseCase extends UseCase<
  Record<string, never>,
  MapPinsResponseDTO
> {
  constructor(
    private readonly locationRepository: ILocationRepository,
    private readonly deviceRepository: IDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'GetMapLocationsUseCase');
  }

  protected async executeImpl(
    _request: Record<string, never>
  ): Promise<Result<MapPinsResponseDTO>> {
    const locationsResult =
      await this.locationRepository.findAllWithCoordinates();
    if (locationsResult.isFailure) {
      return this.fail<MapPinsResponseDTO>(locationsResult.error!);
    }

    const locations = locationsResult.value;
    if (locations.length === 0) {
      return this.ok<MapPinsResponseDTO>({ pins: [], total: 0 });
    }

    const locationIds = locations.map((l) => l.id as LocationId);
    const devicesResult =
      await this.deviceRepository.findByLocationIds(locationIds);
    if (devicesResult.isFailure) {
      return this.fail<MapPinsResponseDTO>(devicesResult.error!);
    }

    const devicesByLocation = new Map<string, Device[]>();
    for (const device of devicesResult.value) {
      if (device.locationId === null) continue;
      const key = device.locationId.toString();
      const bucket = devicesByLocation.get(key) ?? [];
      bucket.push(device);
      devicesByLocation.set(key, bucket);
    }

    const pins: MapPinDTO[] = locations.map((location) => {
      const coords = location.coordinates!;
      const devices = devicesByLocation.get(location.id.toString()) ?? [];

      const deviceDTOs: MapPinDeviceDTO[] = devices.map((d) => ({
        id: d.id.toString(),
        name: d.name.toString(),
        status: d.status.toString(),
        category: d.category?.toString() ?? null,
        ipAddress: d.ipAddress?.toString() ?? null,
        macAddress: d.macAddress?.toString() ?? null,
        monitoringEnabled: d.monitoringEnabled
      }));

      return {
        id: location.id.toString(),
        name: location.name,
        locationType: location.type.toString(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        altitude: coords.hasAltitude() ? coords.altitude! : null,
        municipality: location.municipality ?? null,
        neighborhood: location.neighborhood ?? null,
        address: location.address ?? null,
        devices: deviceDTOs
      };
    });

    return this.ok<MapPinsResponseDTO>({ pins, total: pins.length });
  }
}
