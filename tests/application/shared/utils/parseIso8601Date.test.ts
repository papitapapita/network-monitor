// Source: src/application/shared/utils/parseIso8601Date.ts

import { parseIso8601Date } from '../../../../src/application/shared/utils';

describe('parseIso8601Date', () => {
  describe('accepted forms', () => {
    it.each([
      '2024-01-15',
      '2024-01-15T10:30:00.000Z',
      '2024-01-15T10:30:00Z',
      '2024-01-15T10:30Z',
      '2024-01-15T10:30:00-05:00',
      '2024-01-15T10:30:00+0530',
      '2024-02-29'
    ])('parses %s', (value) => {
      expect(parseIso8601Date(value)).toBeInstanceOf(Date);
    });

    it('returns the parsed instant', () => {
      const parsed = parseIso8601Date('2024-01-15T10:30:00.000Z');

      expect(parsed!.toISOString()).toBe('2024-01-15T10:30:00.000Z');
    });

    it('ignores surrounding whitespace', () => {
      expect(parseIso8601Date('  2024-01-15  ')).toBeInstanceOf(Date);
    });
  });

  describe('rejected forms', () => {
    it.each([
      'March 5, 2020',
      '5 March 2020',
      '03/05/2020',
      '2020',
      '2024-1-5',
      'not-a-date',
      ''
    ])('rejects %s', (value) => {
      expect(parseIso8601Date(value)).toBeNull();
    });

    it.each(['2024-02-31', '2023-02-29', '2024-13-01', '2024-00-10'])(
      'rejects the ISO-shaped but non-existent date %s',
      (value) => {
        expect(parseIso8601Date(value)).toBeNull();
      }
    );

    it.each(['2024-01-15T24:00:00Z', '2024-01-15T10:60:00Z'])(
      'rejects the out-of-range time %s',
      (value) => {
        expect(parseIso8601Date(value)).toBeNull();
      }
    );
  });
});
