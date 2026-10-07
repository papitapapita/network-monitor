import { Result } from 'domain/shared/core';
import { BackupFormat } from 'domain/device-backups/enums';
import {
  BackupCredentials,
  BackupDeviceKind
} from './IBackupTargetsQuery';

export interface FetchedConfig {
  format: BackupFormat;
  content: string;
}

export interface IConfigFetcher {
  fetch(
    ipAddress: string,
    credentials: BackupCredentials
  ): Promise<Result<FetchedConfig>>;
}

export interface IConfigFetcherResolver {
  // null: no backup support for this kind of device from this vendor yet.
  forDevice(
    vendorSlug: string,
    kind: BackupDeviceKind
  ): IConfigFetcher | null;
}
