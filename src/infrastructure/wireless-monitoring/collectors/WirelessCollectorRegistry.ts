import {
  IWirelessCollector,
  IWirelessCollectorResolver
} from 'application/wireless-monitoring/interfaces';

export class WirelessCollectorRegistry
  implements IWirelessCollectorResolver
{
  private readonly byVendor: ReadonlyMap<string, IWirelessCollector>;

  constructor(collectors: Record<string, IWirelessCollector>) {
    this.byVendor = new Map(
      Object.entries(collectors).map(([slug, c]) => [
        slug.toLowerCase(),
        c
      ])
    );
  }

  forVendor(vendorSlug: string): IWirelessCollector | null {
    return this.byVendor.get(vendorSlug.toLowerCase()) ?? null;
  }
}
