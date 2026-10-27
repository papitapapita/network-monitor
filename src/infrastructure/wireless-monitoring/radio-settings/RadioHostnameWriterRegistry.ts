import {
  IRadioHostnameWriter,
  IRadioHostnameWriterResolver
} from 'application/wireless-monitoring/interfaces';

export class RadioHostnameWriterRegistry
  implements IRadioHostnameWriterResolver
{
  private readonly byVendor: ReadonlyMap<
    string,
    IRadioHostnameWriter
  >;

  constructor(writers: Record<string, IRadioHostnameWriter>) {
    this.byVendor = new Map(
      Object.entries(writers).map(([slug, w]) => [
        slug.toLowerCase(),
        w
      ])
    );
  }

  forVendor(vendorSlug: string): IRadioHostnameWriter | null {
    return this.byVendor.get(vendorSlug.toLowerCase()) ?? null;
  }
}
