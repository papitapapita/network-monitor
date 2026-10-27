import { Result } from 'domain/shared/core/Result';
import { BackupFormat } from 'domain/device-backups';
import {
  BackupCredentials,
  BackupDeviceKind,
  FetchedConfig,
  IConfigFetcher,
  IConfigFetcherResolver
} from 'application/device-backups/interfaces';

export const FAKE_AIROS_CONFIG =
  'aaa.1.status=enabled\nradio.1.mode=master\nusers.1.password=$1$secret\n';

/**
 * Stand-in for a device's configuration download. Answers like the real
 * registry: Ubiquiti access points and any MikroTik. serve() changes the
 * file, fail() makes every download error.
 */
export class FakeConfigFetcher
  implements IConfigFetcher, IConfigFetcherResolver
{
  readonly calls: {
    ipAddress: string;
    username: string;
    sshPort: number;
  }[] = [];
  private result: Result<FetchedConfig> =
    FakeConfigFetcher.file(FAKE_AIROS_CONFIG);

  private static file(
    content: string,
    format: BackupFormat = BackupFormat.AIROS_CFG
  ): Result<FetchedConfig> {
    return Result.ok({ format, content });
  }

  serve(
    content: string,
    format: BackupFormat = BackupFormat.AIROS_CFG
  ): void {
    this.result = FakeConfigFetcher.file(content, format);
  }

  fail(error: string): void {
    this.result = Result.fail(error);
  }

  reset(): void {
    this.calls.length = 0;
    this.serve(FAKE_AIROS_CONFIG);
  }

  forDevice(
    vendorSlug: string,
    kind: BackupDeviceKind
  ): IConfigFetcher | null {
    if (vendorSlug === 'mikrotik') return this;
    return vendorSlug === 'ubiquiti' &&
      (kind === 'ACCESS_POINT' || kind === 'STATION')
      ? this
      : null;
  }

  async fetch(
    ipAddress: string,
    credentials: BackupCredentials
  ): Promise<Result<FetchedConfig>> {
    this.calls.push({
      ipAddress,
      username: credentials.username,
      sshPort: credentials.sshPort
    });
    return this.result;
  }
}
