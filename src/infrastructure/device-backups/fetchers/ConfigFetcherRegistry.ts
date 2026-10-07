import {
  IConfigFetcher,
  IConfigFetcherResolver
} from 'application/device-backups/interfaces';

export class ConfigFetcherRegistry implements IConfigFetcherResolver {
  private readonly byVendor: ReadonlyMap<string, IConfigFetcher>;

  constructor(fetchers: Record<string, IConfigFetcher>) {
    this.byVendor = new Map(
      Object.entries(fetchers).map(([slug, f]) => [
        slug.toLowerCase(),
        f
      ])
    );
  }

  forVendor(vendorSlug: string): IConfigFetcher | null {
    return this.byVendor.get(vendorSlug.toLowerCase()) ?? null;
  }
}
