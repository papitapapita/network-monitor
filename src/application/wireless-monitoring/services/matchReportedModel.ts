import { CatalogModel } from '../interfaces';

// AirOS and the catalog spell the same hardware with different case, spacing
// and hyphens ("NanoStation loco M5" vs "Nanostation Loco-M5").
export function normalizeModelName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function matchReportedModel(
  reported: string,
  catalog: CatalogModel[],
  preferredVendorId: string
): CatalogModel | null {
  const key = normalizeModelName(reported);
  const matches = catalog.filter(
    (m) => normalizeModelName(m.model) === key
  );
  return (
    matches.find((m) => m.vendorId === preferredVendorId) ??
    matches[0] ??
    null
  );
}
