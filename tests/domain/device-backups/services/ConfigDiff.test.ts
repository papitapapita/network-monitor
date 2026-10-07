// Source: src/domain/device-backups/services/ConfigDiff.ts

import { describe, it, expect } from '@jest/globals';
import { ConfigDiff } from '../../../../src/domain/device-backups';

const numbered = (count: number, from = 1) =>
  Array.from({ length: count }, (_, i) => `line.${from + i}=x`);

describe('ConfigDiff', () => {
  it('[BKP-070] should find nothing between identical texts', () => {
    const text = numbered(5).join('\n');

    const diff = ConfigDiff.compare(text, text);

    expect(diff).toEqual({ added: 0, removed: 0, hunks: [] });
  });

  it('[BKP-070] should show a changed line with three lines of context', () => {
    const before = numbered(10);
    const after = [...before];
    after[4] = 'line.5=y';

    const diff = ConfigDiff.compare(
      before.join('\n'),
      after.join('\n')
    );

    expect(diff.added).toBe(1);
    expect(diff.removed).toBe(1);
    expect(diff.hunks).toEqual([
      {
        fromStart: 2,
        fromLines: 7,
        toStart: 2,
        toLines: 7,
        lines: [
          { kind: 'context', text: 'line.2=x' },
          { kind: 'context', text: 'line.3=x' },
          { kind: 'context', text: 'line.4=x' },
          { kind: 'removed', text: 'line.5=x' },
          { kind: 'added', text: 'line.5=y' },
          { kind: 'context', text: 'line.6=x' },
          { kind: 'context', text: 'line.7=x' },
          { kind: 'context', text: 'line.8=x' }
        ]
      }
    ]);
  });

  it('[BKP-070] should keep far-apart changes in separate hunks', () => {
    const before = numbered(30);
    const after = [...before];
    after[2] = 'line.3=y';
    after[25] = 'line.26=y';

    const diff = ConfigDiff.compare(
      before.join('\n'),
      after.join('\n')
    );

    expect(diff.hunks).toHaveLength(2);
    expect(diff.hunks[1].fromStart).toBe(23);
  });

  it('[BKP-070] should join changes whose context touches', () => {
    const before = numbered(30);
    const after = [...before];
    after[5] = 'line.6=y';
    after[12] = 'line.13=y';

    const diff = ConfigDiff.compare(
      before.join('\n'),
      after.join('\n')
    );

    expect(diff.hunks).toHaveLength(1);
  });

  it('[BKP-070] should match unchanged lines around inserted ones', () => {
    const before = ['a=1', 'b=2', 'c=3'];
    const after = ['a=1', 'new=1', 'b=2', 'c=3', 'tail=1'];

    const diff = ConfigDiff.compare(
      before.join('\n'),
      after.join('\n')
    );

    expect(diff.added).toBe(2);
    expect(diff.removed).toBe(0);
    expect(diff.hunks[0].lines.map((l) => l.kind)).toEqual([
      'context',
      'added',
      'context',
      'context',
      'added'
    ]);
  });

  it('[BKP-070] should number an empty side from the line before it', () => {
    const diff = ConfigDiff.compare('', 'a=1\nb=2');

    expect(diff.hunks).toEqual([
      {
        fromStart: 0,
        fromLines: 0,
        toStart: 1,
        toLines: 2,
        lines: [
          { kind: 'added', text: 'a=1' },
          { kind: 'added', text: 'b=2' }
        ]
      }
    ]);
  });

  it('[BKP-070] should show a huge rewritten block as removed then added', () => {
    const before = numbered(2100);
    const after = numbered(2100, 5000);

    const diff = ConfigDiff.compare(
      before.join('\n'),
      after.join('\n')
    );

    expect(diff.removed).toBe(2100);
    expect(diff.added).toBe(2100);
    const kinds = diff.hunks[0].lines.map((l) => l.kind);
    expect(kinds.indexOf('added')).toBe(2100);
  });
});
