import { Result } from 'domain/shared/core';
import { BackupFormat } from 'domain/device-backups';
import { BackupCredentials } from './IBackupTargetsQuery';

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
  forVendor(vendorSlug: string): IConfigFetcher | null;
}
