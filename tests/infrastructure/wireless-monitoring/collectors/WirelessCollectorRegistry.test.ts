// Source: src/infrastructure/wireless-monitoring/collectors/WirelessCollectorRegistry.ts

import { WirelessCollectorRegistry } from '../../../../src/infrastructure/wireless-monitoring/collectors/WirelessCollectorRegistry';
import { IWirelessCollector } from '../../../../src/application/wireless-monitoring/interfaces/IWirelessCollector';

function makeCollector(
  method: IWirelessCollector['method']
): IWirelessCollector {
  return { method, collect: jest.fn() };
}

describe('[WLS-053] WirelessCollectorRegistry', () => {
  const ubiquiti = makeCollector('http_api');
  const mimosa = makeCollector('snmp');
  const registry = new WirelessCollectorRegistry({
    ubiquiti,
    mimosa
  });

  it('should return the collector registered for a vendor', () => {
    expect(registry.forVendor('ubiquiti')).toBe(ubiquiti);
    expect(registry.forVendor('mimosa')).toBe(mimosa);
  });

  it('should match vendor slugs case-insensitively', () => {
    expect(registry.forVendor('Mimosa')).toBe(mimosa);
    expect(
      new WirelessCollectorRegistry({ UBIQUITI: ubiquiti }).forVendor(
        'ubiquiti'
      )
    ).toBe(ubiquiti);
  });

  it('should return null for a vendor with no collector', () => {
    expect(registry.forVendor('tp-link')).toBeNull();
  });
});
