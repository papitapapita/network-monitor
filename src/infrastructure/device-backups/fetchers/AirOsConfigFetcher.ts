import { Result } from 'domain/shared/core';
import { BackupFormat } from 'domain/device-backups/enums';
import {
  BackupCredentials,
  FetchedConfig,
  IConfigFetcher
} from 'application/device-backups/interfaces';
import { AirOsHttpClient } from '../../wireless-monitoring/collectors/AirOsHttpClient';

export class AirOsConfigFetcher implements IConfigFetcher {
  constructor(private readonly client: AirOsHttpClient) {}

  async fetch(
    ipAddress: string,
    credentials: BackupCredentials
  ): Promise<Result<FetchedConfig>> {
    const fetched = await this.client.fetchConfig(
      ipAddress,
      credentials.httpPort,
      {
        username: credentials.username,
        password: credentials.password
      }
    );
    if (fetched.isFailure) return Result.fail(fetched.error!);
    return Result.ok({
      format: BackupFormat.AIROS_CFG,
      content: fetched.value
    });
  }
}
