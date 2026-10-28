import getVendorImport from 'mac-oui-lookup';
import { Result } from 'domain/shared/core';
import { DiscoverySource } from 'domain/device-inventory/enums';
import { DeviceSightingRecorder } from 'application/device-inventory/services';
import {
  IStationSightings,
  StationListing
} from 'application/wireless-monitoring/interfaces';

// mac-oui-lookup ships as CJS with a .default re-export; normalise at import time.
const getVendor: (mac: string) => string | null =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (getVendorImport as any).default ?? getVendorImport;

export class StationSightingsAdapter implements IStationSightings {
  constructor(private readonly recorder: DeviceSightingRecorder) {}

  async record(listing: StationListing): Promise<Result<void>> {
    const result = await this.recorder.record({
      source: DiscoverySource.AP_STATION,
      segment: null,
      accessPointId: listing.accessPointId.toString(),
      where: listing.accessPointName,
      seenAt: listing.seenAt,
      hosts: listing.stations.map((station) => ({
        macAddress: station.macAddress,
        ipAddress: station.ipAddress,
        manufacturer: station.macAddress
          ? getVendor(station.macAddress)
          : null,
        hostname: station.hostname,
        model: station.model
      }))
    });
    return result.isSuccess ? Result.ok() : Result.fail(result.error);
  }
}
