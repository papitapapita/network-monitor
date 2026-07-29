# Business Rules

The rule book for this system. One file per bounded context, one entry per rule,
each with a permanent ID.

This is **what the business requires**. For *how to write code* — layering,
naming, component templates — see [`docs/rules/`](../rules/), which is a
different document for a different audience.

## Contents

| Context | File | Rules |
| --- | --- | --- |
| Device Inventory | [device-inventory.md](device-inventory.md) | `DEV-001` … `DEV-143` |
| Customers | _not yet written_ | `CUS-` |
| Billing | _not yet written_ | `BIL-` |
| Device Monitoring | _not yet written_ | `MON-` |
| Wireless Monitoring | _not yet written_ | `WLS-` |
| Notifications | _not yet written_ | `NOT-` |
| Identity & Access | _not yet written_ | `IDN-` |
| Shared Kernel | _not yet written_ | `SHR-` |

## The three kinds of rule

Every entry is tagged with one of these. The distinction is not academic — it
decides where the rule lives, who may change it, and how it is tested.

| Type | Meaning | Enforced in | Changing it means |
| --- | --- | --- | --- |
| **Invariant** | Must hold at all times or the aggregate is corrupt | Domain aggregate | A migration and a data audit |
| **Validation** | Shape of incoming data — format, length, enum membership | Value object, or use case `beforeExecute` | A new rejection case; existing rows unaffected |
| **Policy** | A business decision that could change without breaking anything | Use case, domain service, or constants | A config change and a conversation |

An invariant is the expensive kind. If you find yourself writing one that only
matters at the HTTP edge, it is a validation.

## Rule IDs

Each rule has a permanent ID: `<CONTEXT>-<NNN>`.

- **IDs are never reused and never renumbered.** If a rule is removed, mark it
  `Status: Removed`, keep the entry, and let the ID die with it. Renumbering
  breaks every test name and every git blame that referenced it.
- IDs are allocated in **ranges with gaps** so a new rule can slot in beside its
  siblings instead of landing at the end of the file. Each context file
  documents its own ranges at the top.

## Entry format

```markdown
### DEV-054 — An ACTIVE device must have an IP address

**Type:** Invariant · **Status:** Active

A device cannot be in ACTIVE status without an IP address.

**Why:** ACTIVE means the device is in service and monitored. Monitoring is
ping-based, so a device with no IP cannot be polled — it would sit in the
dashboard permanently green and never be checked.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:447`
**Reached from:** `create`, `changeStatus`, `assignLocation`, `enableMonitoring`, `updateDetails`
**Message:** `An ACTIVE device must have an IP address assigned`
**Tests:** `tests/domain/device-inventory/Device.test.ts`
```

Two fields carry more weight than they look:

- **Why** — the only part not recoverable from the code. Without it, the next
  person to read the rule cannot tell a deliberate constraint from an accident,
  and will "simplify" it away.
- **Reached from** — every mutator that routes through the check. This is what
  catches the mutator someone adds next year that forgets to call `validate()`.

## Linking tests to rules

Test names carry the rule ID in brackets:

```ts
it('[DEV-054] rejects activating a device with no IP address', () => { … });
```

This buys three things:

1. `npm test -- -t "DEV-054"` runs exactly the tests for one rule.
2. A failing test names the business rule it broke, readable by someone who has
   never opened the file.
3. Coverage becomes mechanical rather than aspirational — a script can extract
   every ID from these files, grep `tests/`, and report the rules with no test
   behind them.

The tag goes on whichever block owns the rule — often the enclosing `describe`
rather than each `it`, since Jest matches against the full concatenated name.
One block may carry several IDs when it exercises more than one rule:

```ts
describe('[DEV-054] [DEV-055] ACTIVE status invariant', () => { … });
```

### Coverage check

```bash
npm run test:rules          # all contexts
npm run test:rules DEV      # one context
npm run test:rules -- --json
```

The script (`scripts/check-rule-coverage.mjs`) parses every rule ID out of these
files, greps `tests/` for `[ID]` citations, and exits non-zero when either side
is unmatched:

- **a rule with no test** — the rule book claims something nothing verifies
- **a test citing an unknown ID** — a typo, or an ID left behind by a deleted
  rule

Rules marked `Status: Removed` are excluded, so retiring a rule does not require
deleting its tests in the same commit.

## Keeping this honest

A rule book that drifts from the code is worse than none, because people trust
it. Two habits prevent that:

- **Same PR.** Changing a rule in code and updating its entry here are one
  change, not two. A rule change with no doc change should not pass review.
- **Verify the anchors.** Line numbers rot fastest. When you touch a file, check
  the `Enforced at` lines pointing into it. The `Message` field is the more
  durable anchor — it can be grepped.

## Adoption

Written so far:

- [x] `README.md` — conventions, ID scheme, entry format
- [x] `device-inventory.md` — all rules for the Device Inventory context
- [x] Rule IDs in device-inventory test names (unit + integration)
- [x] Coverage script — `npm run test:rules`
- [ ] Remaining seven contexts
- [ ] Wire `npm run test:rules` into CI

Until the other contexts are written, run the check scoped to a prefix
(`npm run test:rules DEV`); unscoped runs will report nothing for contexts that
have no rules declared yet.
