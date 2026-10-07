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
});
