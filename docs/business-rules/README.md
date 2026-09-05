# Business Rules

The rule book for this system. One file per bounded context, one entry per rule,
each with a permanent ID.

This is **what the business requires**. For _how to write code_ — layering,
naming, component templates — see [`docs/rules/`](../rules/), which is a
different document for a different audience.

## Contents

| Context             | File                                             | Rules                 |
| ------------------- | ------------------------------------------------ | --------------------- |
| Device Inventory    | [device-inventory.md](device-inventory.md)       | `DEV-001` … `DEV-147` |
| Customers           | [customers.md](customers.md)                     | `CUS-001` … `CUS-140` |
| Billing             | [billing.md](billing.md)                         | `BIL-001` … `BIL-141` |
| Quoting             | [quoting.md](quoting.md)                         | `QUO-001` … `QUO-142` |
| Device Monitoring   | [device-monitoring.md](device-monitoring.md)     | `MON-001` … `MON-042` |
| Wireless Monitoring | [wireless-monitoring.md](wireless-monitoring.md) | `WLS-001` … `WLS-161` |
| Service Enforcement | [service-enforcement.md](service-enforcement.md) | `SVC-001` … `SVC-120` |
| Notifications       | [notifications.md](notifications.md)             | `NOT-001` … `NOT-195` |
| Identity & Access   | [identity.md](identity.md)                       | `IDN-001` … `IDN-123` |
| Tickets             | [tickets.md](tickets.md)                         | `TKT-001` … `TKT-114` |
| Shared Kernel       | [shared.md](shared.md)                           | `SHR-001` … `SHR-104` |

Every context now has a file. Two conventions settled while filling them in:

- **Access control is declared once.** Authentication, roles, permissions, rate
  limiting and transport hardening live in [identity.md](identity.md)
  (`IDN-020` … `IDN-123`). A context file declares only which permission each of
  its own endpoints demands — one rule, not a copy of the middleware rules.
- **The shared kernel documents rules, not mechanism.** `domain/shared/core/` is
  mostly base classes, and a base class is not a business rule. `shared.md`
  declares only what would change behaviour if broken; how to write a value
  object stays in [`docs/rules/`](../rules/).

## The three kinds of rule

Every entry is tagged with one of these. The distinction is not academic — it
decides where the rule lives, who may change it, and how it is tested.

| Type           | Meaning                                                         | Enforced in                               | Changing it means                              |
| -------------- | --------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------- |
| **Invariant**  | Must hold at all times or the aggregate is corrupt              | Domain aggregate                          | A migration and a data audit                   |
| **Validation** | Shape of incoming data — format, length, enum membership        | Value object, or use case `beforeExecute` | A new rejection case; existing rows unaffected |
| **Policy**     | A business decision that could change without breaking anything | Use case, domain service, or constants    | A config change and a conversation             |

An invariant is the expensive kind. If you find yourself writing one that only
matters at the HTTP edge, it is a validation.

## Rule status

Every entry carries a status alongside its type. Three values — and the
difference between the last two is about what happened to the **rule**, not to
its ID.

| Status                   | Meaning                                                                     |
| ------------------------ | --------------------------------------------------------------------------- |
| **Active**               | In force. The default, and almost every entry.                              |
| **Dormant**              | Implemented and tested, but its input is never supplied, so it cannot fire. |
| **Removed**              | No longer applies. Nothing enforces it, nothing replaced it.                |
| **Superseded by `<ID>`** | Still in force, under a new ID in another context's file.                   |

`Dormant` is not a gap and not a `Removed` rule: the logic is wired in and
covered by tests, and it starts working the day something upstream begins
supplying the value — with no edit to the rule itself. State what is missing in
the entry, so the reader can tell a dormant rule from one that is silently
broken. `WLS-090` is the worked example. Dormant rules still need a test, and
the coverage check still counts them.

`Superseded` exists because rules migrate between contexts as this book fills
in. A rule written against Device Inventory before the Wireless Monitoring file
existed can turn out to be owned by wireless — enforced in its use cases, tested
in its test tree, changeable without Device Inventory noticing.

Moving the text alone does not finish the job: `npm run test:rules WLS` filters
on the **ID prefix**, not on the file the rule was declared in. A `DEV-` rule
sitting in `wireless-monitoring.md` is still invisible to the context that owns
it. So the ID has to change — and `Removed` would be a lie, because the rule is
in force.

Superseding a rule is four steps in one commit:

1. Write the full entry under its new ID, carrying the original `Since` and
   `Revised` dates forward. The rule's history did not restart.
2. Reduce the old entry to a stub — heading, status line, and enough of the
   `Why` that someone arriving from the old context sees the consequence and
   follows the pointer.
3. Re-tag every test citing the old ID.
4. Date the old entry with `· **Superseded:** <date>`.

Both IDs stay forever and neither is reused, exactly as for `Removed`.

`DEV-064` is the first candidate: it is declared in `device-inventory.md` but
enforced entirely in `CreateWirelessConfigUseCase` and tested only under
`tests/application/wireless-monitoring/`. Nothing has moved yet — when
`wireless-monitoring.md` is written, the stub left behind should read:

```markdown
### DEV-064 — Wireless radio mode is derived from the device's category, never supplied

**Type:** Policy · **Status:** Superseded by `WLS-0xx`
**Since:** 2026-07-29 · **Revised:** 2026-07-30 · **Superseded:** 2026-08-04

Moved to [wireless-monitoring.md](wireless-monitoring.md). The rule is enforced
in `CreateWirelessConfigUseCase` and tested in the wireless test tree, so the
wireless context owns it.

**Why it is still mentioned here:** the deciding input is a device-inventory
concept. Adding a third device category changes what this rule derives.
```

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
**Since:** 2026-07-28 · **Revised:** 2026-07-30

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

## Dating a rule

Every entry carries a date line under its type:

```markdown
**Since:** 2026-07-28 · **Revised:** 2026-07-30
```

- **Since** — when the rule was first written down _here_. It is not when the
  business first required it: this catalogue was written on 2026-07-28, long
  after most of the code it describes, so every rule dated `2026-07-28` should be
  read as _at or before_ that date. Rules added afterwards carry their real
  birthday, and the distinction stops mattering as the file ages.
- **Revised** — the last date the rule itself changed: what it requires, what it
  refuses, where it is enforced, or the message it returns. **Omitted entirely
  while a rule has never changed** — an absent `Revised` is a claim, not a gap.
- **Checked** — the last date someone re-read the rule against the code and
  confirmed it still holds, with nothing to change. Distinct from `Revised`:
  stamping a verification pass as `Revised` would claim the rule changed when
  it did not, which is exactly the false claim the `Revised` definition above
  rules out. Replaces a stale `Revised` date on a rule that was checked but
  not altered — a rule keeps at most one of the two for its most recent
  activity, never both dated the same day.
- **Removed** — appended as a third field when a rule is retired
  (`· **Removed:** 2026-08-04`). The entry and its ID stay forever, so the date
  is the only thing that says when it stopped being true.
- **Superseded** — the same, for a rule that kept applying but moved to another
  context's file under a new ID (`· **Superseded:** 2026-08-04`). See
  [Rule status](#rule-status). Leave `Revised` alone: the successor carries the
  rule's revision history, and moving it changed nothing about what it requires.

`Revised` is not a "last touched" stamp. Rewording a `Why`, repairing a rotted
line number, or adding a test to the `Tests` list leaves it alone. Ask whether
someone who obeyed the old entry would now be wrong; if not, the date stands.

All of these are the day the change (or check) lands on the branch, not the
day it ships.

### When the change needs a reason

A date says _when_. When the _why_ matters — a rule that reversed itself, a set
of enum values that was recast, a migration that rewrote existing rows — add a
narrative paragraph at the end of the entry:

```markdown
**History — this rule replaced a cascade on 2026-07-30.** It previously deleted
the wireless configuration of every device on the model, which is how the data
loss described above was possible.
```

Reserve it for changes whose old shape still explains something about the
current one — usually because data written under the old rule is still in the
database, or because the obvious "simplification" is the rule we already
retreated from. Most revisions need only the date. See `DEV-027` and `DEV-043`
in [device-inventory.md](device-inventory.md) for the two kinds worth writing:
a reversed decision and a migrated enum.

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

## Checking coverage

`scripts/check-rule-coverage.mjs` parses every rule ID out of the files in this
directory, greps `tests/` for `[ID]` citations, and reconciles the two lists.
This is a walkthrough of using it — the full flag reference is below.

### 1. Run the basic check

```bash
npm run test:rules          # all contexts
npm run test:rules DEV      # one context (aliases exist: test:rules:dev, :cus, :bil, …)
```

Output looks like this (real run, device-inventory context):

```
Business rule coverage (DEV): 94/94 rules have at least one test (100%)

Every rule is backed by at least one test.
```

When something is missing, the same run instead lists it:

```
Rules with NO test (3):
  DEV-091  Validation  A location type is one of two values
           └─ device-inventory.md

Test IDs matching no declared rule (1):
  DEV-999  cited in tests/domain/device-inventory/aggregates/Device.test.ts
```

The first block is a rule the book claims and nothing verifies — go add or tag
a test. The second is a citation with no matching rule — usually a typo in the
`[ID]`, or a leftover from a rule that was renumbered instead of retired (IDs
are never reused — see [Rule IDs](#rule-ids)). Either case exits non-zero, which
is what would gate CI once the six untagged contexts catch up (see
[Adoption](#adoption)).

`Status: Removed` and `Status: Superseded` rules are skipped in both directions:
retiring a rule doesn't require deleting its tests in the same commit, and a
superseded rule stops being reported once its tests cite the successor ID.

### 2. Ask where the coverage actually lives

"At least one test" hides _which_ test. Not every layer is obligated to carry
one — only the domain layer is expected to have exhaustive unit coverage (see
[Testing](../../CLAUDE.md#testing)); application, infrastructure and
presentation get unit tests selectively. But most rules, whichever layer
enforces them, end up genuinely exercised end-to-end in an integration test —
so a rule that only a unit test touches is worth a second look. `--by-group`
shows that split:

```bash
npm run test:rules:groups          # all contexts
npm run test:rules:groups -- DEV   # one context
npm run test:rules -- --by-group --json   # machine-readable
```

Real output for the device-inventory context:

```
Business rule coverage (DEV): 94/94 rules have at least one test (100%)

By test group:
  unit                      88/94  (94%)
  integration (use-case)    66/94  (70%)
  integration (route)       33/94  (35%)
  any integration           68/94  (72%)

Rules with NO integration test — use-case or route (26):
  DEV-051  Invariant  An installation date cannot be in the future
           └─ unit only: tests/domain/device-inventory/aggregates/Device.test.ts
  DEV-146  Policy     Request rate is budgeted per user, per resource
           └─ unit only: tests/presentation/http/middleware/rateLimiter.test.ts
  …
```

`unit` collapses `tests/domain`, `tests/application`, `tests/infrastructure` and
`tests/presentation` into one bucket rather than grading each layer separately —
grading infrastructure/presentation against a unit-coverage bar nobody set would
just make them look perpetually short. `integration (use-case)` and
`integration (route)` are `tests/integration/use-cases/` and the route suites
directly under `tests/integration/`, reported separately since they catch
different things (a use case's own logic vs. the HTTP surface — auth, RBAC,
validation, envelope — in front of it).

`--by-group` never changes the exit code. A unit-only rule is a visible gap to
weigh case by case — some rules (pure value-object formatting, for instance)
are legitimately fine with only a unit test — not a broken build.

### 3. Close a gap

Pick a rule from the `Rules with NO integration test` list, find the
integration suite that owns its use case or route (`tests/integration/use-cases/<context>/<Name>.integration.test.ts`
or `tests/integration/<resource>.routes.test.ts` — see
[Integration tests](../../CLAUDE.md#integration-tests) for which one applies),
add a case that exercises the rule, and tag its `describe`/`it` with the rule's
`[ID]`:

```ts
it('[DEV-051] rejects an installedDate in the future', async () => { … });
```

Re-run `npm run test:rules:groups -- DEV` and the rule moves out of the gap
list.

### 4. Machine-readable output

`--json` (with or without `--by-group`) is for tooling — CI summaries,
dashboards, whatever needs the numbers rather than the formatted report:

```json
{
  "total": 94,
  "covered": 94,
  "uncovered": [],
  "unknown": [],
  "byGroup": {
    "unit": 88,
    "integration (use-case)": 66,
    "integration (route)": 33,
    "any integration": 68
  },
  "noIntegrationTest": [
    {
      "id": "DEV-007",
      "title": "Vendor names are unique",
      "file": "device-inventory.md",
      "existingTests": [
        "tests/application/device-inventory/use-cases/CreateVendorUseCase.test.ts",
        "…"
      ]
    }
  ]
}
```

`--json` always includes `byGroup` and `noIntegrationTest` — computing them is
cheap, so `--by-group` only controls whether the _text_ report prints the
breakdown; JSON consumers get it either way.

## Keeping this honest

A rule book that drifts from the code is worse than none, because people trust
it. Two habits prevent that:

- **Same PR.** Changing a rule in code and updating its entry here are one
  change, not two. A rule change with no doc change should not pass review — and
  a rule change that leaves `Revised` untouched is the same omission, just
  harder to spot.
- **Verify the anchors.** Line numbers rot fastest. When you touch a file, check
  the `Enforced at` lines pointing into it. The `Message` field is the more
  durable anchor — it can be grepped.

## Adoption

Written so far:

- [x] `README.md` — conventions, ID scheme, entry format
- [x] `device-inventory.md` — all rules for the Device Inventory context
- [x] Rule IDs in device-inventory test names (unit + integration)
- [x] `Since` / `Revised` dates on every device-inventory rule
- [x] Coverage script — `npm run test:rules`
- [x] `device-monitoring.md` — the reachability lifecycle (not yet the whole context)
- [x] `Superseded` status — for rules that migrate between contexts
- [x] `wireless-monitoring.md` — the whole context
- [x] `DEV-064` superseded into `WLS-003`
- [x] `customers.md`, `billing.md`, `notifications.md`, `identity.md`,
      `service-enforcement.md`, `shared.md` — every context now has a file
- [x] `service-enforcement` recognised as a bounded context in its own right —
      the reasoning is at the top of
      [service-enforcement.md](service-enforcement.md)
- [ ] **Rule IDs in test names for the six new contexts.** The rules are
      declared; nothing cites them yet, so `npm run test:rules CUS` (and `BIL`,
      `NOT`, `IDN`, `SVC`, `SHR`) reports every rule as uncovered. The `Tests:`
      field on each entry names the suite that already exercises the behaviour —
      tagging is a matter of adding `[ID]` to the right `describe`, not writing
      new tests.
- [ ] Move `DEV-140`, `DEV-141`, `DEV-144`, `DEV-146` into `identity.md` —
      all four are enforced and tested entirely under `domain/identity` or the
      shared HTTP middleware, and `identity.md` now exists to receive them.
      Deferred because superseding requires re-tagging their existing tests in
      the same commit.
- [ ] Wire `npm run test:rules` into CI — blocked on the tagging above.

Until the new contexts are tagged, run the check scoped to a prefix that has
citations (`npm run test:rules DEV`).
