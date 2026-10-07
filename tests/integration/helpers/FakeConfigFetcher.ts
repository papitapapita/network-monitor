import { Result } from 'domain/shared/core/Result';
import { BackupFormat } from 'domain/device-backups';
import {
  BackupCredentials,
  FetchedConfig,
  IConfigFetcher,
  IConfigFetcherResolver
} from 'application/device-backups/interfaces';

export const FAKE_AIROS_CONFIG =
  'aaa.1.status=enabled\nradio.1.mode=master\nusers.1.password=$1$secret\n';

/**
 * Stand-in for a radio's configuration download. Answers for `ubiquiti`
 * only, like the real registry. serve() changes the file, fail() makes
 * every download error.
 */
export class FakeConfigFetcher
  implements IConfigFetcher, IConfigFetcherResolver
{
  readonly calls: { ipAddress: string; username: string }[] = [];
  private result: Result<FetchedConfig> =
    FakeConfigFetcher.file(FAKE_AIROS_CONFIG);

  private static file(content: string): Result<FetchedConfig> {
    return Result.ok({ format: BackupFormat.AIROS_CFG, content });
  }

  serve(content: string): void {
    this.result = FakeConfigFetcher.file(content);
  }

  fail(error: string): void {
    this.result = Result.fail(error);
  }

  reset(): void {
    this.calls.length = 0;
    this.serve(FAKE_AIROS_CONFIG);
  }

  forVendor(vendorSlug: string): IConfigFetcher | null {
    return vendorSlug === 'ubiquiti' ? this : null;
  }

  async fetch(
    ipAddress: string,
    credentials: BackupCredentials
  ): Promise<Result<FetchedConfig>> {
    this.calls.push({ ipAddress, username: credentials.username });
    return this.result;
  }
}
