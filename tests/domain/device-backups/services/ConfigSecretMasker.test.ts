// Source: src/domain/device-backups/services/ConfigSecretMasker.ts

import { describe, it, expect } from '@jest/globals';
import {
  BackupFormat,
  ConfigSecretMasker,
  MASKED_SECRET
} from '../../../../src/domain/device-backups';

const mask = (line: string) =>
  ConfigSecretMasker.maskLine(BackupFormat.AIROS_CFG, line);

describe('ConfigSecretMasker', () => {
  describe('AirOS', () => {
    it.each([
      'users.1.password=$1$abc$def',
      'wpasupplicant.profile.1.network.1.psk=supersecret',
      'aaa.1.wpa.psk=supersecret',
      'snmp.community=public',
      'aaa.1.radius.auth.1.secret=shared',
      'ppp.1.passwd=secret',
      'wireless.1.security.wep.key=0123456789'
    ])('[BKP-071] should hide the value of "%s"', (line) => {
      const name = line.slice(0, line.indexOf('='));

      expect(mask(line)).toBe(`${name}=${MASKED_SECRET}`);
    });

    it.each([
      'wpa.1.key.1.mgmt=WPA-PSK',
      'wireless.1.ssid=Torre Norte',
      'netconf.1.ip=10.0.0.10',
      'radio.1.mode=master',
      'a line without equals'
    ])('[BKP-071] should leave "%s" as it is', (line) => {
      expect(mask(line)).toBe(line);
    });

    it('[BKP-071] should leave an empty secret empty', () => {
      expect(mask('users.1.password=')).toBe('users.1.password=');
    });
  });
});
