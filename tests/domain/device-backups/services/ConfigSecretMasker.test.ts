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

  describe('RouterOS export', () => {
    const maskRos = (line: string) =>
      ConfigSecretMasker.maskLine(BackupFormat.ROUTEROS_EXPORT, line);

    it.each([
      [
        'add authentication-types=wpa2-psk name=clientes wpa2-pre-shared-key=Clave123',
        `add authentication-types=wpa2-psk name=clientes wpa2-pre-shared-key=${MASKED_SECRET}`
      ],
      [
        'add name=juan password="mi clave" profile=plan-10M service=pppoe',
        `add name=juan password=${MASKED_SECRET} profile=plan-10M service=pppoe`
      ],
      [
        'add address=10.0.0.2 secret=radius-secret service=ppp',
        `add address=10.0.0.2 secret=${MASKED_SECRET} service=ppp`
      ],
      [
        'add listen-port=13231 name=wg1 private-key="aGVsbG8gd29ybGQ="',
        `add listen-port=13231 name=wg1 private-key=${MASKED_SECRET}`
      ],
      [
        'set authentication-password=a1 encryption-password=b2',
        `set authentication-password=${MASKED_SECRET} encryption-password=${MASKED_SECRET}`
      ]
    ])('[BKP-053] should mask the secret in "%s"', (line, masked) => {
      expect(maskRos(line)).toBe(masked);
    });

    it.each([
      '/interface wireless security-profiles',
      'add address=10.0.0.1/24 interface=ether1 network=10.0.0.0',
      'set [ find default-name=ether1 ] comment="Hacia la torre"',
      '# software id = AB12-CD34',
      'add name=juan password="" profile=default'
    ])('[BKP-053] should leave "%s" as it is', (line) => {
      expect(maskRos(line)).toBe(line);
    });

    it('[BKP-053] should not read a quoted value as an argument', () => {
      const line = 'add comment="password=abc" name=x';

      expect(maskRos(line)).toBe(line);
    });
  });
});
