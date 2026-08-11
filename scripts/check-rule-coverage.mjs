#!/usr/bin/env node
// Cross-checks docs/business-rules/*.md against the test suite.
//
// Every rule declared in the rule book must be referenced by at least one test,
// via its ID in a describe/it title: it('[DEV-054] rejects ...').
//
//   node scripts/check-rule-coverage.mjs              all contexts
//   node scripts/check-rule-coverage.mjs DEV           one prefix
//   node scripts/check-rule-coverage.mjs --json        machine-readable
//
// Exit code 1 when a rule has no test, or a test cites an ID that no rule
// declares — the second case catches typos and IDs left behind by a deleted rule.

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
const prefix = args.find((a) => /^[A-Z]{3}$/.test(a)) ?? null;

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
for (const file of walk(TESTS_DIR)) {
  const text = readFileSync(file, 'utf8');
  for (const [, id] of text.matchAll(ID_IN_TEST)) {
    if (!cited.has(id)) cited.set(id, new Set());
    cited.get(id).add(relative(ROOT, file));
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

if (asJson) {
  console.log(
    JSON.stringify(
      {
        total: active.length,
        covered: covered.length,
        uncovered: uncovered.map(([id, r]) => ({ id, title: r.title, file: r.file })),
        unknown
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
