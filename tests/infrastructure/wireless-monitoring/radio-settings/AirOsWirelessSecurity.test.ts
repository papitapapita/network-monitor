// Source: src/infrastructure/wireless-monitoring/radio-settings/AirOsWirelessSecurity.ts

import { readAirOsWirelessSecurity } from '../../../../src/infrastructure/wireless-monitoring/radio-settings';

// Trimmed from a real airOS 8 access point backup (keys renamed). It keeps
// a stale station profile with its own key, as such radios do.
const ACCESS_POINT = [
  '## 1626992172',
  'aaa.1.devname=ath0',
  'aaa.1.ssid=AP LLANERITA 1_',
  'aaa.1.status=enabled',
  'aaa.1.wpa.1.pairwise=CCMP',
  'aaa.1.wpa.key.1.mgmt=WPA-PSK',
  'aaa.1.wpa.mode=2',
  'aaa.1.wpa.psk=ap-key=with-equals',
  'aaa.status=enabled',
  'radio.1.freq=5790',
  'radio.1.mode=master',
  'resolv.host.1.name=AP LLANERITA',
  'wireless.1.security.type=none',
  'wireless.1.ssid=AP LLANERITA 1_',
  'wpasupplicant.device.1.status=disabled',
  'wpasupplicant.profile.1.network.1.key_mgmt.1.name=WPA-PSK',
  'wpasupplicant.profile.1.network.1.psk=stale-station-key',
  'wpasupplicant.status=disabled',
  '#417550dd417550dd417550dd417550dd'
].join('\n');

const STATION = [
  'aaa.status=disabled',
  'radio.1.mode=managed',
  'wireless.1.ssid=AP LLANERITA 1_',
  'wpasupplicant.device.1.status=enabled',
  'wpasupplicant.profile.1.network.1.key_mgmt.1.name=WPA-PSK',
  'wpasupplicant.profile.1.network.1.psk=station-key',
  'wpasupplicant.status=enabled'
].join('\r\n');

function edit(config: string, key: string, value: string): string {
  return config
    .split(/\r?\n/)
    .map((line) =>
      line.startsWith(`${key}=`) ? `${key}=${value}` : line
    )
    .join('\n');
}

describe('[WLS-221] readAirOsWirelessSecurity', () => {
  it('should read an access point key from aaa.1, not the stale station profile', () => {
    const result = readAirOsWirelessSecurity(ACCESS_POINT);

    expect(result.value).toEqual({
      role: 'ACCESS_POINT',
      ssid: 'AP LLANERITA 1_',
      security: 'WPA_PSK',
      key: 'ap-key=with-equals'
    });
  });

  it('should read a station key from wpasupplicant network 1, with CRLF lines', () => {
    const result = readAirOsWirelessSecurity(STATION);

    expect(result.value).toEqual({
      role: 'STATION',
      ssid: 'AP LLANERITA 1_',
      security: 'WPA_PSK',
      key: 'station-key'
    });
  });

  it('should call an access point with WPA off open', () => {
    const result = readAirOsWirelessSecurity(
      edit(ACCESS_POINT, 'aaa.1.status', 'disabled')
    );

    expect(result.value).toMatchObject({
      security: 'OPEN',
      key: null
    });
  });

  it('should call a station with wpasupplicant off open', () => {
    const result = readAirOsWirelessSecurity(
      edit(STATION, 'wpasupplicant.status', 'disabled')
    );

    expect(result.value).toMatchObject({
      security: 'OPEN',
      key: null
    });
  });

  it('should return no key for WPA Enterprise', () => {
    const result = readAirOsWirelessSecurity(
      edit(ACCESS_POINT, 'aaa.1.wpa.key.1.mgmt', 'WPA-EAP')
    );

    expect(result.value).toMatchObject({
      security: 'OTHER',
      key: null
    });
  });

  it('should return no key for WEP', () => {
    const result = readAirOsWirelessSecurity(
      edit(
        edit(ACCESS_POINT, 'aaa.status', 'disabled'),
        'wireless.1.security.type',
        'wep'
      )
    );

    expect(result.value).toMatchObject({
      security: 'OTHER',
      key: null
    });
  });

  it('should return no key when WPA-PSK is on but the key line is empty', () => {
    const result = readAirOsWirelessSecurity(
      edit(STATION, 'wpasupplicant.profile.1.network.1.psk', '')
    );

    expect(result.value).toMatchObject({
      security: 'OTHER',
      key: null
    });
  });

  it('should give a null SSID when none is set', () => {
    const result = readAirOsWirelessSecurity(
      edit(STATION, 'wireless.1.ssid', '')
    );

    expect(result.value.ssid).toBeNull();
  });

  it('should fail on a file with no wireless mode', () => {
    const result = readAirOsWirelessSecurity('netmode=bridge\n');

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('radio.1.mode');
  });
});
