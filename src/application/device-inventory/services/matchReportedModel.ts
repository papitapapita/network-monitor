import { CatalogModel } from '../interfaces';

// AirOS and the catalog spell the same hardware with different case, spacing
// and hyphens ("NanoStation loco M5" vs "Nanostation Loco-M5").
export function normalizeModelName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// By name first; failing that, the one catalog model other radios have
// confirmed for this name (WLS-155). Several confirmed models is ambiguous.
export function matchReportedModel(
  reported: string,
  catalog: CatalogModel[],
  preferredVendorId: string,
  confirmedModelIds: string[] = []
): CatalogModel | null {
  const key = normalizeModelName(reported);
  const matches = catalog.filter(
    (m) => normalizeModelName(m.model) === key
  );
  const byName =
    matches.find((m) => m.vendorId === preferredVendorId) ??
    matches[0];
  if (byName) return byName;

  const confirmed = new Set(confirmedModelIds);
  if (confirmed.size !== 1) return null;
  return catalog.find((m) => confirmed.has(m.id)) ?? null;
}
