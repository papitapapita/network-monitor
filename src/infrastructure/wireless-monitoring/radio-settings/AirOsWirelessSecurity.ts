import { Result } from 'domain/shared/core';
import { WirelessSecurityReading } from 'application/wireless-monitoring/interfaces';

// Reads the radio's Wi-Fi security out of its system.cfg (WLS-221). An
// access point keeps its key under `aaa.1`; a station under
// `wpasupplicant`. Both sections can be present at once — an AP keeps a
// stale station profile from before it was switched to AP mode — so the
// radio's mode decides which one counts.
export function readAirOsWirelessSecurity(
  config: string
): Result<WirelessSecurityReading> {
  const values = parse(config);
  const mode = values.get('radio.1.mode');
  if (!mode)
    return Result.fail(
      'The radio configuration has no wireless mode (radio.1.mode)'
    );

  const ssid = values.get('wireless.1.ssid') || null;
  const legacyWep = values.get('wireless.1.security.type') === 'wep';

  if (mode === 'master') {
    const wpaOn =
      values.get('aaa.status') === 'enabled' &&
      values.get('aaa.1.status') === 'enabled';
    return Result.ok({
      role: 'ACCESS_POINT',
      ssid,
      ...security(
        wpaOn,
        values.get('aaa.1.wpa.key.1.mgmt'),
        values.get('aaa.1.wpa.psk'),
        legacyWep
      )
    });
  }

  const wpaOn = values.get('wpasupplicant.status') === 'enabled';
  return Result.ok({
    role: 'STATION',
    ssid,
    ...security(
      wpaOn,
      values.get('wpasupplicant.profile.1.network.1.key_mgmt.1.name'),
      values.get('wpasupplicant.profile.1.network.1.psk'),
      legacyWep
    )
  });
}

function security(
  wpaOn: boolean,
  keyManagement: string | undefined,
  psk: string | undefined,
  legacyWep: boolean
): Pick<WirelessSecurityReading, 'security' | 'key'> {
  if (wpaOn) {
    return keyManagement === 'WPA-PSK' && psk
      ? { security: 'WPA_PSK', key: psk }
      : { security: 'OTHER', key: null };
  }
  return legacyWep
    ? { security: 'OTHER', key: null }
    : { security: 'OPEN', key: null };
}

// `key=value` per line. A value may itself hold `=`, as a key may.
function parse(config: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of config.split(/\r?\n/)) {
    if (line.startsWith('#')) continue;
    const at = line.indexOf('=');
    if (at <= 0) continue;
    values.set(line.slice(0, at), line.slice(at + 1));
  }
  return values;
}
