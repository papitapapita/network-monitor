#!/usr/bin/env node
// Cross-checks docs/business-rules/*.md against the test suite.
//
// Every rule declared in the rule book must be referenced by at least one test,
// via its ID in a describe/it title: it('[DEV-054] rejects ...').
//
//   node scripts/check-rule-coverage.mjs              all contexts
//   node scripts/check-rule-coverage.mjs DEV           one prefix
//   node scripts/check-rule-coverage.mjs --json        machine-readable
//   node scripts/check-rule-coverage.mjs --by-group    breakdown by test group
//
// Exit code 1 when a rule has no test, or a test cites an ID that no rule
// declares — the second case catches typos and IDs left behind by a deleted rule.
// --by-group never adds a failure condition of its own: a rule with a unit test
// but no integration test is a gap worth seeing, not a broken build — not every
// rule belongs in the domain layer, and integration coverage is tracked here
// because that is where most rules actually get exercised end to end.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const RULES_DIR = join(ROOT, 'docs/business-rules');
const TESTS_DIR = join(ROOT, 'tests');

const RULE_HEADING = /^###\s+([A-Z]{3}-\d{3})\s+—/gm;
const RULE_STATUS = /\*\*Type:\*\*\s*(\w+)\s*·\s*\*\*Status:\*\*\s*(\w+)/;
const ID_IN_TEST = /\[([A-Z]{3}-\d{3})\]/g;

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const byGroup = args.includes('--by-group');
const prefix = args.find((a) => /^[A-Z]{3}$/.test(a)) ?? null;

// Collapsed to three buckets, not one per layer: domain/application/
// infrastructure/presentation unit tests are graded together as "unit" because
// only the domain layer is expected to have exhaustive unit coverage — the
// other layers get one selectively, so counting them separately would make
// infrastructure/presentation look perpetually short of a bar nobody set.
function groupOf(relPath) {
  if (relPath.startsWith('tests/integration/use-cases/')) return 'integration (use-case)';
  if (relPath.startsWith('tests/integration/')) return 'integration (route)';
  return 'unit';
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

// --- declared rules -------------------------------------------------------
const declared = new Map(); // id -> { file, type, status }
for (const file of readdirSync(RULES_DIR).filter((f) => f.endsWith('.md'))) {
  if (file === 'README.md') continue;
  const text = readFileSync(join(RULES_DIR, file), 'utf8');
  const sections = text.split(/^###\s+/m).slice(1);
  for (const section of sections) {
    const id = section.match(/^([A-Z]{3}-\d{3})\s+—/)?.[1];
    if (!id) continue;
    const meta = section.match(RULE_STATUS);
    declared.set(id, {
      file,
      type: meta?.[1] ?? 'Unknown',
      status: meta?.[2] ?? 'Unknown',
      title: section.split('\n')[0].replace(/^[A-Z]{3}-\d{3}\s+—\s*/, '')
    });
  }
}
RULE_HEADING.lastIndex = 0;

// --- rules referenced by tests --------------------------------------------
const cited = new Map(); // id -> Set of test files
const citedByGroup = new Map(); // id -> Map(group -> Set of test files)
for (const file of walk(TESTS_DIR)) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);
  const group = groupOf(rel);
  for (const [, id] of text.matchAll(ID_IN_TEST)) {
    if (!cited.has(id)) cited.set(id, new Set());
    cited.get(id).add(rel);

    if (!citedByGroup.has(id)) citedByGroup.set(id, new Map());
    const groups = citedByGroup.get(id);
    if (!groups.has(group)) groups.set(group, new Set());
    groups.get(group).add(rel);
  }
}

// --- reconcile ------------------------------------------------------------
const inScope = (id) => !prefix || id.startsWith(prefix + '-');

// Retired rules stay *declared* so a citation left on an old ID is still
// recognised, but drop out of the coverage denominator. Superseded ones are
// carried by their successor's tests, under the successor's ID.
const RETIRED = new Set(['Removed', 'Superseded']);

const active = [...declared.entries()].filter(
  ([id, r]) => inScope(id) && !RETIRED.has(r.status)
);
const uncovered = active.filter(([id]) => !cited.has(id));
const unknown = [...cited.keys()].filter((id) => inScope(id) && !declared.has(id));
const covered = active.filter(([id]) => cited.has(id));

const GROUPS = ['unit', 'integration (use-case)', 'integration (route)'];
const hasGroup = (id, group) => citedByGroup.get(id)?.has(group) ?? false;
const hasAnyIntegration = (id) =>
  hasGroup(id, 'integration (use-case)') || hasGroup(id, 'integration (route)');

const groupCounts = Object.fromEntries(
  GROUPS.map((group) => [group, active.filter(([id]) => hasGroup(id, group)).length])
);
const anyIntegrationCount = active.filter(([id]) => hasAnyIntegration(id)).length;
const noIntegrationTest = active.filter(([id]) => !hasAnyIntegration(id));

if (asJson) {
  console.log(
    JSON.stringify(
      {
        total: active.length,
        covered: covered.length,
        uncovered: uncovered.map(([id, r]) => ({ id, title: r.title, file: r.file })),
        unknown,
        byGroup: { ...groupCounts, 'any integration': anyIntegrationCount },
        noIntegrationTest: noIntegrationTest.map(([id, r]) => ({
          id,
          title: r.title,
          file: r.file,
          existingTests: [...(cited.get(id) ?? [])]
        }))
      },
      null,
      2
    )
  );
} else {
  const pct = active.length
    ? Math.round((covered.length / active.length) * 100)
    : 100;
  console.log(
    `\nBusiness rule coverage${prefix ? ` (${prefix})` : ''}: ` +
      `${covered.length}/${active.length} rules have at least one test (${pct}%)\n`
  );

  if (byGroup) {
    const rows = [...GROUPS, 'any integration'];
    const counts = { ...groupCounts, 'any integration': anyIntegrationCount };
    const label = Math.max(...rows.map((r) => r.length));
    console.log('By test group:');
    for (const row of rows) {
      const n = counts[row];
      const groupPct = active.length ? Math.round((n / active.length) * 100) : 100;
      console.log(
        `  ${row.padEnd(label)}  ${String(n).padStart(4)}/${active.length}  (${groupPct}%)`
      );
    }
    console.log('');

    if (noIntegrationTest.length) {
      console.log(
        `Rules with NO integration test — use-case or route (${noIntegrationTest.length}):`
      );
      for (const [id, r] of noIntegrationTest) {
        const existing = cited.get(id);
        console.log(`  ${id}  ${r.type.padEnd(10)} ${r.title}`);
        console.log(
          existing
            ? `         └─ unit only: ${[...existing].join(', ')}`
            : `         └─ no test at all`
        );
      }
      console.log('');
    } else {
      console.log('Every rule has at least one integration test.\n');
    }
  }

  if (uncovered.length) {
    console.log(`Rules with NO test (${uncovered.length}):`);
    for (const [id, r] of uncovered) {
      console.log(`  ${id}  ${r.type.padEnd(10)} ${r.title}`);
      console.log(`         └─ ${r.file}`);
    }
    console.log('');
  }

  if (unknown.length) {
    console.log(`Test IDs matching no declared rule (${unknown.length}):`);
    for (const id of unknown) {
      for (const f of cited.get(id)) console.log(`  ${id}  cited in ${f}`);
    }
    console.log('');
  }

  if (!uncovered.length && !unknown.length) {
    console.log('Every rule is backed by at least one test.\n');
  }
}

process.exit(uncovered.length || unknown.length ? 1 : 0);
