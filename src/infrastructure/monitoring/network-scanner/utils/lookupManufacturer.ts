import getVendorImport from 'mac-oui-lookup';
// mac-oui-lookup ships as CJS with a .default re-export; normalise at import time.
const getVendor: (mac: string) => string | null =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (getVendorImport as any).default ?? getVendorImport;

export function lookupManufacturer(
  mac: string | null
): string | null {
  return mac === null ? null : getVendor(mac);
}
