// Source: src/infrastructure/device-backups/fetchers/ConfigFetcherRegistry.ts

import { ConfigFetcherRegistry } from '../../../../src/infrastructure/device-backups/fetchers';
import { IConfigFetcher } from '../../../../src/application/device-backups/interfaces';

describe('ConfigFetcherRegistry', () => {
  const airOs = { fetch: jest.fn() } as unknown as IConfigFetcher;
  const routerOs = { fetch: jest.fn() } as unknown as IConfigFetcher;
  const registry = new ConfigFetcherRegistry([
    { vendor: 'Ubiquiti', kinds: ['ACCESS_POINT'], fetcher: airOs },
    {
      vendor: 'mikrotik',
      kinds: ['ACCESS_POINT', 'ROUTER', 'SWITCH'],
      fetcher: routerOs
    }
  ]);

  it('should find a fetcher by vendor slug, ignoring case', () => {
    expect(registry.forDevice('ubiquiti', 'ACCESS_POINT')).toBe(
      airOs
    );
    expect(registry.forDevice('UBIQUITI', 'ACCESS_POINT')).toBe(
      airOs
    );
  });

  it('[BKP-010] should find the RouterOS fetcher for every MikroTik kind', () => {
    expect(registry.forDevice('mikrotik', 'ROUTER')).toBe(routerOs);
    expect(registry.forDevice('mikrotik', 'SWITCH')).toBe(routerOs);
    expect(registry.forDevice('mikrotik', 'ACCESS_POINT')).toBe(
      routerOs
    );
  });

  it('[BKP-014] should have nothing for a vendor with no fetcher', () => {
    expect(registry.forDevice('mimosa', 'ACCESS_POINT')).toBeNull();
  });

  it('[BKP-014] should have nothing for a kind the vendor fetcher does not cover', () => {
    expect(registry.forDevice('ubiquiti', 'ROUTER')).toBeNull();
  });
});
