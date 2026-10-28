import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';

export interface SightedStation {
  macAddress: string;
  ipAddress: string | null;
  hostname: string | null;
  model: string | null;
}

export interface StationListing {
  accessPointId: DeviceId;
  accessPointName: string;
  seenAt: Date;
  stations: SightedStation[];
}

// An AP's station list, handed to inventory so a station it lacks becomes a
// suggestion to create it (DEV-208).
export interface IStationSightings {
  record(listing: StationListing): Promise<Result<void>>;
}

export const NoStationSightings: IStationSightings = {
  record: async () => Result.ok()
};
