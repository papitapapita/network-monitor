// Source: src/domain/device-backups/services/ConfigNormalizer.ts

import { describe, it, expect } from '@jest/globals';
import {
  BackupFormat,
  ConfigNormalizer
} from '../../../../src/domain/device-backups';

const normalize = (raw: string) =>
  ConfigNormalizer.normalize(BackupFormat.AIROS_CFG, raw);

describe('ConfigNormalizer', () => {
  it('[BKP-005] should treat CRLF and LF files as the same', () => {
    expect(normalize('a=1\r\nb=2\r\n')).toBe(normalize('a=1\nb=2\n'));
  });

  it('[BKP-005] should ignore trailing whitespace and blank lines at the end', () => {
    expect(normalize('a=1  \nb=2\t\n\n\n')).toBe('a=1\nb=2');
  });

  it('[BKP-005] should keep a changed value distinct', () => {
    expect(normalize('a=1\nb=2')).not.toBe(normalize('a=1\nb=3'));
  });

  it('[BKP-005] should keep line order significant', () => {
    expect(normalize('a=1\nb=2')).not.toBe(normalize('b=2\na=1'));
  });

  describe('a RouterOS export', () => {
    const routerOs = (raw: string) =>
      ConfigNormalizer.normalize(BackupFormat.ROUTEROS_EXPORT, raw);
    const body =
      '# software id = AB12-CD34\n/ip address\nadd address=10.0.0.1/24\n';

    it.each([
      [
        'RouterOS 6',
        '# oct/07/2026 03:00:01',
        '# oct/08/2026 03:00:09'
      ],
      ['RouterOS 7', '# 2026-10-07 03:00:01', '# 2026-10-08 03:00:09']
    ])(
      '[BKP-052] should ignore the export date on %s',
      (_label, first, second) => {
        expect(routerOs(`${first} by RouterOS 7.15\n${body}`)).toBe(
          routerOs(`${second} by RouterOS 7.15\n${body}`)
        );
      }
    );

    it('[BKP-052] should keep the version the export names', () => {
      expect(
        routerOs(`# 2026-10-07 03:00:01 by RouterOS 7.15\n${body}`)
      ).toBe(`# by RouterOS 7.15\n${body.trimEnd()}`);
      expect(
        routerOs(`# 2026-10-07 03:00:01 by RouterOS 7.15\n${body}`)
      ).not.toBe(
        routerOs(`# 2026-10-07 03:00:01 by RouterOS 7.16\n${body}`)
      );
    });

    it('[BKP-052] should leave a comment later in the file alone', () => {
      const raw = '/ip address\n# 2026-10-07 by RouterOS note\n';

      expect(routerOs(raw)).toBe(raw.trimEnd());
    });

    it('[BKP-052] should leave an AirOS file with such a line alone', () => {
      const raw = '# 2026-10-07 03:00:01 by RouterOS 7.15';

      expect(normalize(raw)).toBe(raw);
    });
  });

  describe('an AirOS file', () => {
    const file = (written: string, checksum: string) =>
      `### PART ###\n## ${written}\n##XC.v8.7.5\naaa.status=enabled\n#feature.g3=0\n#${checksum}\n### PART ###\nwireless.1.ssid=Sector\n`;

    it('[BKP-056] should ignore the time it was written and its checksum', () => {
      expect(
        normalize(
          file('1626992172', '417550ddade29c043f483ec1b1c2ff1a')
        )
      ).toBe(
        normalize(
          file('1628054048', '91121ca5b905d65444da5fe97ac1176c')
        )
      );
    });

    it('[BKP-056] should keep the firmware line and the commented features', () => {
      const normalized = normalize(
        file('1626992172', '417550ddade29c043f483ec1b1c2ff1a')
      );

      expect(normalized).toBe(
        '### PART ###\n##XC.v8.7.5\naaa.status=enabled\n#feature.g3=0\n### PART ###\nwireless.1.ssid=Sector'
      );
    });

    it('[BKP-056] should still see a changed value', () => {
      expect(
        normalize(file('1', '417550ddade29c043f483ec1b1c2ff1a'))
      ).not.toBe(
        normalize(
          file('1', '417550ddade29c043f483ec1b1c2ff1a').replace(
            'Sector',
            'Sector2'
          )
        )
      );
    });

    it('[BKP-056] should leave such lines in a RouterOS export alone', () => {
      const raw = '/ip address\n## 1626992172';

      expect(
        ConfigNormalizer.normalize(BackupFormat.ROUTEROS_EXPORT, raw)
      ).toBe(raw);
    });
  });
});
