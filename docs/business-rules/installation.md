# Installation — Business Rules

What one install of the backend runs. The product is sold to other ISPs, one
backend and database per customer (ADR 0002), and not every customer buys
every part of it: the first pilot is monitoring only. These rules decide which
parts an install switches on and what the parts that stay on see when their
neighbours are off.

This is not a bounded context. It owns no aggregate and no data; it is the
composition root's policy, enforced in `src/infrastructure/di/` and
`src/presentation/http/routes/index.ts`.

Format and conventions: [README.md](README.md).

## ID ranges

| Range                 | Area            |
| --------------------- | --------------- |
| `INS-001` … `INS-019` | Module switches |

## Layer coverage

| Layer                        | Rules |
| ---------------------------- | ----- |
| Infrastructure (composition) | 7     |
| Application (use case)       | 1     |

---

## Module switches

The switch is `ENABLED_MODULES`, a comma-separated list. The optional modules
are `customers`, `billing`, `quoting`, `tickets` and `enforcement`. The core —
device inventory, device and wireless monitoring, notifications, identity,
network scan and admin — is named `monitoring`.

### INS-001 — An unset switch enables every module

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (composition)
**Since:** 2026-09-28

With `ENABLED_MODULES` missing or blank, every optional module runs.

**Why:** Insetel's own install predates the switch. Defaulting to "everything"
means it keeps running exactly as before without an edit to its environment,
and only a customer install has to say what it leaves out.

**Enforced at:** `src/infrastructure/di/enabledModules.ts` (`parse`)
**Tests:** `tests/infrastructure/di/enabledModules.test.ts`

### INS-002 — Monitoring is always on

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (composition)
**Since:** 2026-09-28

`monitoring` may be listed but cannot be left out: `ENABLED_MODULES=tickets`
runs monitoring and tickets. `ENABLED_MODULES=monitoring` runs the core alone.

**Why:** Monitoring is the product every customer buys; the other modules hang
off its devices and alerts. An install without it has nothing to do.

**Enforced at:** `src/infrastructure/di/enabledModules.ts` (`parse`)
**Tests:** `tests/infrastructure/di/enabledModules.test.ts`

### INS-003 — An unknown module name stops the boot

**Type:** Validation · **Status:** Active
**Layer:** Infrastructure (composition)
**Since:** 2026-09-28

Names are matched case-insensitively, with whitespace and empty entries
ignored. Anything else that is not a module name refuses to start the process.

**Why:** A misspelt module (`ticket`, `invoicing`) would otherwise be silently
off. A customer finding out a week later that a feature never ran is worse than
a backend that refuses to start and says why.

**Enforced at:** `src/infrastructure/di/enabledModules.ts` (`parse`)
**Message:** `ENABLED_MODULES: unknown module "<name>". Valid: monitoring, customers, billing, quoting, tickets, enforcement`
**Tests:** `tests/infrastructure/di/enabledModules.test.ts`

### INS-004 — Billing, quoting and enforcement require customers

**Type:** Validation · **Status:** Active
**Layer:** Infrastructure (composition)
**Since:** 2026-09-28

Enabling any of the three without `customers` refuses to start the process.

**Why:** A bill, a quotation and a suspension are each addressed to a customer
or a subscription. Without the customers module there is no way to create one,
so the dependent module would mount routes that can never succeed.

**Enforced at:** `src/infrastructure/di/enabledModules.ts` (`parse`)
**Message:** `ENABLED_MODULES: "<module>" requires "customers"`
**Tests:** `tests/infrastructure/di/enabledModules.test.ts`

### INS-005 — A disabled module's routes do not exist

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (composition)
**Since:** 2026-09-28

Its controllers are never built and its routes are never mounted, so they
answer `404`. They still sit behind authentication: an unauthenticated request
gets `401` first, as for any other `/api` path.

**Why:** `404` is the honest answer. The endpoint does not exist in this
install, and `503` would suggest it is down and coming back. Keeping the
`401` first means an anonymous caller cannot probe which modules a customer
bought.

**Enforced at:** `src/infrastructure/di/container.ts`, `src/presentation/http/routes/index.ts`
**Tests:** `tests/integration/enabled-modules.routes.test.ts`

### INS-006 — A disabled module runs no handlers and no background work

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (composition)
**Since:** 2026-09-28

With `customers` off, the WhatsApp suspension notice is not registered. With
`tickets` off, the ticket-assigned notice is not registered. With `enforcement`
off, neither the enforcement event handler nor the reconciliation orchestrator
is built (`SVC-063`).

**Why:** Unmounting the routes is not enough. A handler or orchestrator left
wired can still act on the network, as the reconciliation loop does against
the MikroTik. "Off" has to mean nothing of the module runs.

**Enforced at:** `src/infrastructure/di/container.ts`
**Tests:** `tests/integration/enabled-modules.routes.test.ts`

### INS-007 — Monitoring reads a disabled module's data as empty

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (composition)
**Since:** 2026-09-28

The repositories of the customers and tickets modules are always built, and
every install has the same schema. So deleting a device (`DeleteDeviceUseCase`)
finds no contract and no open tickets, replacing one (`ReplaceDeviceUseCase`)
finds no contract to move, and wireless capacity (`ContractedCapacityAdapter`)
finds no plan.

**Why:** "No contract" is the true answer in an install that sells no
contracts. Reading empty tables gives it without a second set of null-object
ports that would have to be kept in step with the real ones.

**Enforced at:** `src/infrastructure/di/container.ts`
**Tests:** `tests/integration/enabled-modules.routes.test.ts`

### INS-008 — With tickets off, alerts open no tickets

**Type:** Policy · **Status:** Active
**Layer:** Application (use case)
**Since:** 2026-09-28

No ticket opener is passed to `SendDeviceDownAlertUseCase` or
`OpenAlertUseCase`. The alert is recorded and notified as usual.

**Why:** A ticket nobody can see or assign is noise in a table. The alert
itself, which the customer does see, is unaffected.

**Enforced at:** `src/infrastructure/di/container.ts`, `src/application/notifications/use-cases/OpenAlertUseCase.ts`
**Tests:** `tests/application/notifications/use-cases/OpenAlertUseCase.test.ts`
