export type DiffLineKind = 'context' | 'added' | 'removed';

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

// Unified-diff numbering: 1-based, and a side with no lines starts at the
// line before the hunk.
export interface DiffHunk {
  fromStart: number;
  fromLines: number;
  toStart: number;
  toLines: number;
  lines: DiffLine[];
}

export interface ConfigDifference {
  added: number;
  removed: number;
  hunks: DiffHunk[];
}

interface Op extends DiffLine {
  oldBefore: number;
  newBefore: number;
}

export const DIFF_CONTEXT_LINES = 3;
// Past this many line pairs a changed block is shown as removed then added,
// instead of matching lines one by one (BKP-070).
const MAX_MATCHED_CELLS = 4_000_000;

// Line-by-line comparison of two versions of a configuration (BKP-070).
export class ConfigDiff {
  public static compare(
    from: string,
    to: string,
    contextLines = DIFF_CONTEXT_LINES
  ): ConfigDifference {
    const a = ConfigDiff.lines(from);
    const b = ConfigDiff.lines(to);

    let prefix = 0;
    while (
      prefix < a.length &&
      prefix < b.length &&
      a[prefix] === b[prefix]
    )
      prefix++;
    let suffix = 0;
    while (
      suffix < a.length - prefix &&
      suffix < b.length - prefix &&
      a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
    )
      suffix++;

    const ops: Op[] = [];
    let oldBefore = 0;
    let newBefore = 0;
    const push = (kind: DiffLineKind, text: string) => {
      ops.push({ kind, text, oldBefore, newBefore });
      if (kind !== 'added') oldBefore++;
      if (kind !== 'removed') newBefore++;
    };

    for (let i = 0; i < prefix; i++) push('context', a[i]);
    for (const [kind, text] of ConfigDiff.middle(
      a.slice(prefix, a.length - suffix),
      b.slice(prefix, b.length - suffix)
    ))
      push(kind, text);
    for (let i = a.length - suffix; i < a.length; i++)
      push('context', a[i]);

    return {
      added: ops.filter((op) => op.kind === 'added').length,
      removed: ops.filter((op) => op.kind === 'removed').length,
      hunks: ConfigDiff.hunks(ops, Math.max(0, contextLines))
    };
  }

  private static lines(text: string): string[] {
    return text === '' ? [] : text.split('\n');
  }

  private static middle(
    a: string[],
    b: string[]
  ): [DiffLineKind, string][] {
    if (a.length * b.length > MAX_MATCHED_CELLS)
      return [
        ...a.map((t): [DiffLineKind, string] => ['removed', t]),
        ...b.map((t): [DiffLineKind, string] => ['added', t])
      ];

    // Longest common subsequence of the remaining lines, from the end, so
    // the walk below can go forward. Lengths stay under 2000 (see the cap).
    const width = b.length + 1;
    const lcs = new Uint16Array((a.length + 1) * width);
    for (let i = a.length - 1; i >= 0; i--)
      for (let j = b.length - 1; j >= 0; j--)
        lcs[i * width + j] =
          a[i] === b[j]
            ? lcs[(i + 1) * width + j + 1] + 1
            : Math.max(
                lcs[(i + 1) * width + j],
                lcs[i * width + j + 1]
              );

    const out: [DiffLineKind, string][] = [];
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        out.push(['context', a[i]]);
        i++;
        j++;
      } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
        out.push(['removed', a[i++]]);
      } else {
        out.push(['added', b[j++]]);
      }
    }
    while (i < a.length) out.push(['removed', a[i++]]);
    while (j < b.length) out.push(['added', b[j++]]);
    return out;
  }

  private static hunks(ops: Op[], context: number): DiffHunk[] {
    const changes = ops
      .map((op, index) => (op.kind === 'context' ? -1 : index))
      .filter((index) => index >= 0);

    // Changes whose context would touch or overlap share one hunk.
    const hunks: DiffHunk[] = [];
    let g = 0;
    while (g < changes.length) {
      const first = changes[g];
      while (
        g + 1 < changes.length &&
        changes[g + 1] - changes[g] <= 2 * context + 1
      )
        g++;
      const last = changes[g];
      hunks.push(
        ConfigDiff.hunk(
          ops,
          Math.max(0, first - context),
          Math.min(ops.length, last + context + 1)
        )
      );
      g++;
    }
    return hunks;
  }

  private static hunk(
    ops: Op[],
    start: number,
    end: number
  ): DiffHunk {
    const slice = ops.slice(start, end);
    const fromLines = slice.filter(
      (op) => op.kind !== 'added'
    ).length;
    const toLines = slice.filter(
      (op) => op.kind !== 'removed'
    ).length;
    const { oldBefore, newBefore } = ops[start];
    return {
      fromStart: fromLines === 0 ? oldBefore : oldBefore + 1,
      fromLines,
      toStart: toLines === 0 ? newBefore : newBefore + 1,
      toLines,
      lines: slice.map(({ kind, text }) => ({ kind, text }))
    };
  }
}
