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
});
