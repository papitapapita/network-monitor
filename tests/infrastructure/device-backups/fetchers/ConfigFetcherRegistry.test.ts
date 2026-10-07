// Source: src/infrastructure/device-backups/fetchers/ConfigFetcherRegistry.ts

import { ConfigFetcherRegistry } from '../../../../src/infrastructure/device-backups/fetchers';
import { IConfigFetcher } from '../../../../src/application/device-backups/interfaces';

describe('ConfigFetcherRegistry', () => {
  const airOs = { fetch: jest.fn() } as unknown as IConfigFetcher;
  const registry = new ConfigFetcherRegistry({ Ubiquiti: airOs });

  it('should find a fetcher by vendor slug, ignoring case', () => {
    expect(registry.forVendor('ubiquiti')).toBe(airOs);
    expect(registry.forVendor('UBIQUITI')).toBe(airOs);
  });

  it('[BKP-014] should have nothing for a vendor with no fetcher', () => {
    expect(registry.forVendor('mimosa')).toBeNull();
  });
});
