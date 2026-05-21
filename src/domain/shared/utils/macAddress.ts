const COLON_REGEX = /^([0-9A-Fa-f]{2}:){5}([0-9A-Fa-f]{2})$/;
const HYPHEN_REGEX = /^([0-9A-Fa-f]{2}-){5}([0-9A-Fa-f]{2})$/;

export function isValidMacAddress(mac: string): boolean {
  return COLON_REGEX.test(mac) || HYPHEN_REGEX.test(mac);
}

export function normalizeMacAddress(mac: string): string {
  return mac.replace(/-/g, ':').toUpperCase();
}
