import {
  BackupDeviceKind,
  IConfigFetcher,
  IConfigFetcherResolver
} from 'application/device-backups/interfaces';

export interface ConfigFetcherEntry {
  vendor: string;
  kinds: readonly BackupDeviceKind[];
  fetcher: IConfigFetcher;
}

// A vendor's fetcher covers only the kinds of device that run its system: a
// Ubiquiti access point runs AirOS, a Ubiquiti router does not (BKP-014).
export class ConfigFetcherRegistry implements IConfigFetcherResolver {
  private readonly entries: readonly ConfigFetcherEntry[];

  constructor(entries: ConfigFetcherEntry[]) {
    this.entries = entries.map((entry) => ({
      ...entry,
      vendor: entry.vendor.toLowerCase()
    }));
  }

  forDevice(
    vendorSlug: string,
    kind: BackupDeviceKind
  ): IConfigFetcher | null {
    const vendor = vendorSlug.toLowerCase();
    return (
      this.entries.find(
        (entry) =>
          entry.vendor === vendor && entry.kinds.includes(kind)
      )?.fetcher ?? null
    );
  }
}
