# TESTING INTEGRATION STANDARD

**Version:** 1.0
**Last Updated:** 2026-07-23
**Status:** Authoritative Standard

---

## Table of Contents

1. [Purpose of Integration Tests](#1-purpose-of-integration-tests)
2. [The Two Layers](#2-the-two-layers)
3. [Boundaries — What Integration Tests Must Not Do](#3-boundaries--what-integration-tests-must-not-do)
4. [When Does a Use Case Need Its Own Test?](#4-when-does-a-use-case-need-its-own-test)
5. [File Layout & Naming](#5-file-layout--naming)
6. [Route Test Template](#6-route-test-template)
7. [Use Case Test Template](#7-use-case-test-template)
8. [Fixtures, Seeds & Fakes](#8-fixtures-seeds--fakes)
9. [Database Lifecycle](#9-database-lifecycle)
10. [Required Coverage](#10-required-coverage)
11. [Running the Suites](#11-running-the-suites)
12. [Definition of Done](#12-definition-of-done)

---

## 1. Purpose of Integration Tests

**Integration tests are the regression net: they answer "after this change, does the
system still do what I expect?" against a real Postgres database.**

Unit tests prove that an aggregate enforces its invariants in isolation. They cannot
prove that the invariant survives a round trip through Prisma, that the route is
wired to the right use case, that the permission middleware is attached, or that a
cascade delete actually cascades. That is what this standard covers.

### Core Characteristics

- **Real database**: a real Postgres schema, migrated to HEAD. Never a Prisma mock.
- **Real wiring**: the real DI container, the real repositories, the real mappers.
- **Faked edges**: anything that leaves the process (ICMP, HTTP to devices, Telegram)
  is replaced by a controllable fake.
- **Self-cleaning**: every test starts from a known database state.
- **Deterministic**: no reliance on wall-clock timing, test ordering, or leftover rows.

### Why Two Layers

A single layer cannot give both guarantees cheaply:

| Question                                            | Answered by     |
| --------------------------------------------------- | --------------- |
| "Is the endpoint reachable, authorized, and shaped right?" | Route test      |
| "Does this business rule hold against real data?"   | Use case test   |
| "Does this aggregate reject invalid state?"         | Unit test       |

Writing one test per use case *and* one per endpoint duplicates ~70% of the
assertions. This standard splits them by **what can break**, not by what exists.

---

## 2. The Two Layers

### Layer 1 — Route Tests (the whole picture)

**One file per route file. Always. No exceptions.**

A route test proves the HTTP contract: that the endpoint exists, that it is guarded,
that it rejects malformed input, and that a well-formed request produces the
documented response envelope. It exercises the full stack — middleware, controller,
use case, repository, database — via `supertest`.

Route tests are about **breadth**. Every endpoint in the route file gets covered.
They do not need to enumerate every business rule; that is Layer 2's job.

✅ **A route test asserts:**

- HTTP status codes (`201`, `200`, `400`, `401`, `403`, `404`, `409`)
- The response envelope: `{ success: true, data: ... }` / `{ success: false, error: ... }`
- Authentication is enforced (no token → `401`)
- Authorization is enforced (insufficient role → `403`)
- Request validation rejects malformed bodies and params (`400`)
- The persisted side effect is visible on a subsequent read

❌ **A route test does not assert:**

- Every branch of a business rule (use the use case test)
- Log output, event ordering, or internal call counts
- Anything requiring a fake to be reconfigured mid-request

### Layer 2 — Use Case Integration Tests (specific features)

**One file per use case that meets a trigger in [Section 4](#4-when-does-a-use-case-need-its-own-test).**

A use case test instantiates the use case directly with real repositories and asserts
on the returned `Result<T>`. No HTTP, no middleware, no serialization.

Use case tests are about **depth**. They pin down the behavior that is expensive or
awkward to reach through a route: uniqueness collisions, cascade effects, state
machine transitions, pagination and filter semantics, event side effects, and
scheduled jobs that have no endpoint at all.

✅ **A use case test asserts:**

- `result.isSuccess` / `result.isFailure` and the error message
- Rows written, updated, or deleted — read back through Prisma
- Cross-aggregate side effects (a handler wrote a row, an alert was raised)
- Behavior under database state that is hard to set up over HTTP

❌ **A use case test does not assert:**

- HTTP status codes or response shape
- Middleware behavior

---

## 3. Boundaries — What Integration Tests Must Not Do

1. **❌ Never mock Prisma or a repository.**
   The point is the round trip. A test with a mocked repository is a unit test in the
   wrong directory — move it to `tests/application/`.

2. **❌ Never touch the network.**
   `IPingService`, `IUbiquitiHttpCollector`, `INotificationService`, and every other
   outbound port MUST be substituted with a fake from `tests/integration/helpers/`.
   A test that pings a real address is not a test, it is a flake.

3. **❌ Never depend on test execution order.**
   Each `it` must pass when run alone. The integration suite runs `--runInBand`
   against one shared database; ordering dependencies are invisible until they break
   in CI.

4. **❌ Never leave rows behind.**
   Clean in `beforeEach`, not `afterEach`. A failing test that skips its cleanup must
   not poison the next one.

5. **❌ Never assert on wall-clock timing.**
   Pass an explicit `now: Date` where the use case accepts one. Where a fire-and-forget
   handler is involved, poll with a helper like `waitForPollingConfig()` — never
   `setTimeout` and hope.

6. **❌ Never write to the development database.**
   The suite reads `DATABASE_URL` from `.env.test`. It must point at
   `network_monitor_test`, never at the dev or production database.

7. **❌ Never use `.spec.ts`.**
   The extension is `.test.ts`. See [Section 5](#5-file-layout--naming).

---

## 4. When Does a Use Case Need Its Own Test?

**Every use case gets its own integration test file. No exceptions.**

The rule is deliberately mechanical: one file per use case, named after it. A
judgment-based rule ("only if it's interesting") leaves gaps that nobody notices
until a refactor breaks something silently, and it makes the audit ambiguous —
you cannot tell a use case that *needs* no test from one that was *forgotten*.
With a 1:1 rule, coverage is a `find` command:

```bash
for f in $(find src/application -path "*/use-cases/*UseCase.ts" | grep -v "/shared/core/"); do
  ctx=$(echo "$f" | sed 's|src/application/||; s|/use-cases/.*||')
  uc=$(basename "$f" .ts)
  [ -f "tests/integration/use-cases/$ctx/$uc.integration.test.ts" ] || echo "MISSING $ctx/$uc"
done
```

The triggers below no longer decide *whether* to write the file — they decide **how
much depth the file needs**. A use case hitting several triggers deserves a thorough
suite; a thin pass-through can be short, but it still exists and still proves the
round trip works.

### Trigger 1 — It enforces a rule that depends on database state

Uniqueness, referential existence, "only one active X per Y". These cannot be proven
by a unit test because the constraint lives in Postgres.

> `CreateVendorUseCase` — rejects a duplicate slug.

### Trigger 2 — It has cascade or multi-table side effects

Deleting a row that cascades, or a write that fans out into other tables.

> `DeleteLocationUseCase` — devices at that location are detached, not deleted.

### Trigger 3 — It drives a state machine

Any aggregate with a status transition where the illegal transitions matter.

> `MarkBillPaidUseCase` — a cancelled bill cannot be marked paid.

### Trigger 4 — It emits domain events that another handler persists

The event dispatch is fire-and-forget; only an integration test proves the row lands.

> `CreateDeviceUseCase` — provisioning a monitored device creates its
> `PollingConfiguration`.

### Trigger 5 — Its query semantics are non-trivial

Pagination, sorting, filtering, date windows, aggregation. The SQL is the behavior.

> `ListDevicesUseCase` — filters compose; page 2 does not repeat page 1.

### Trigger 6 — It is not reachable over HTTP

Schedulers, purge jobs, orchestrators, and event-driven flows have **no route test to
fall back on**. For these, the use case integration test is the only coverage that
exists. These are the highest-priority gaps.

> `PurgeOldPingResultsUseCase`, `ExecutePollingCycleUseCase`,
> `GenerateBillsForPeriodUseCase`, `PollWirelessDeviceUseCase`.

### No trigger → still a file, just a shorter one

A thin pass-through — load by id, map to DTO, return — gets a minimal suite: the
happy path with a read-back, not-found, malformed id, and empty id. That is enough to
catch a broken mapper, a bad id parse, or a repository wired to the wrong table.

> `GetVendorUseCase` is the reference shape for this: four tests, no ceremony.

---

## 5. File Layout & Naming

Integration tests are the one deliberate exception to "tests mirror `src/`". They live
under `tests/integration/`, split by layer:

```
tests/integration/
├── <resource>.routes.test.ts              ← mirrors src/presentation/http/routes/<resource>.routes.ts
├── use-cases/
│   └── <context>/
│       └── <UseCaseName>.integration.test.ts   ← mirrors src/application/<context>/use-cases/<UseCaseName>.ts
├── helpers/
│   ├── createTestApp.ts
│   ├── db.ts
│   ├── auth.ts
│   └── Fake<Port>.ts
└── setup.ts
```

**Rules:**

| Thing              | Pattern                                  | Example                                      |
| ------------------ | ---------------------------------------- | -------------------------------------------- |
| Route test file    | `<resource>.routes.test.ts`              | `vendor.routes.test.ts`                       |
| Use case test file | `<UseCaseName>.integration.test.ts`      | `CreateVendorUseCase.integration.test.ts`     |
| Route describe     | `'<Resource> Routes — /api/<resource>'`  | `'Vendor Routes — /api/vendors'`              |
| Use case describe  | `'<UseCaseName> — integration'`          | `'CreateVendorUseCase — integration'`         |
| Nested describe    | `'<METHOD> /api/<path>'`                 | `'POST /api/vendors'`                         |
| Route `it`         | `'<status> — <behavior>'`                | `'403 — rejects VIEWER creating a vendor'`    |
| Use case `it`      | Plain behavioral sentence                | `'fails when the slug already exists'`        |

Every file opens with a `// Source:` comment naming the file under test.

**The extension is `.test.ts`.** `jest.integration.config.js` matches `*.test.ts`; a
file named `.spec.ts` is silently skipped and provides zero protection while looking
like coverage.

---

## 6. Route Test Template

```typescript
// Source: src/presentation/http/routes/<resource>.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import { cleanCatalog, seedVendor, GHOST_ID, INVALID_ID } from './helpers/db';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Vendor Routes — /api/vendors', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let adminToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCatalog(prisma);
  });

  describe('POST /api/vendors', () => {
    it('201 — creates a vendor', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Ubiquiti', slug: 'ubiquiti' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ name: 'Ubiquiti', slug: 'ubiquiti' });
    });

    it('401 — rejects an unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .send({ name: 'Ubiquiti', slug: 'ubiquiti' });

      expect(res.status).toBe(401);
    });

    it('403 — rejects a VIEWER', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'Ubiquiti', slug: 'ubiquiti' });

      expect(res.status).toBe(403);
    });

    it('400 — rejects a missing slug', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'No Slug' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/vendors/:id', () => {
    it('404 — unknown id', async () => {
      const res = await request(app)
        .get(`/api/vendors/${GHOST_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('400 — malformed id', async () => {
      const res = await request(app)
        .get(`/api/vendors/${INVALID_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });
});
```

**Every route test MUST carry a token.** Every `/api` route sits behind
`createAuthenticateMiddleware`; a request without `Authorization` receives `401`
regardless of what the handler does. A route test written without tokens does not
test the handler at all.

---

## 7. Use Case Test Template

```typescript
// Source: src/application/device-inventory/use-cases/CreateVendorUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateVendorUseCase } from 'application/device-inventory/use-cases/CreateVendorUseCase';
import { PrismaVendorRepository } from 'infrastructure/persistence/PrismaVendorRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { setupDependencies, DependencyContainer } from 'infrastructure/di/container';
import { cleanCatalog, seedVendor } from '../../helpers/db';

describe('CreateVendorUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: CreateVendorUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    useCase = new CreateVendorUseCase(
      new PrismaVendorRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCatalog(prisma);
  });

  it('persists a vendor and returns its id', async () => {
    const result = await useCase.execute({ name: 'MikroTik', slug: 'mikrotik' });

    expect(result.isSuccess).toBe(true);

    const row = await prisma.vendor.findUnique({ where: { slug: 'mikrotik' } });
    expect(row).not.toBeNull();
    expect(row!.name).toBe('MikroTik');
  });

  it('fails when the slug already exists', async () => {
    await seedVendor(prisma, { slug: 'mikrotik' });

    const result = await useCase.execute({ name: 'Other', slug: 'mikrotik' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/already exists/i);
  });
});
```

**Construct the use case explicitly** rather than pulling it off the container. The
explicit constructor call documents the dependency list and makes it obvious when a
fake needs to be substituted.

---

## 8. Fixtures, Seeds & Fakes

All shared setup lives in `tests/integration/helpers/`. Never inline a seed that two
files need.

### Naming

| Prefix     | Meaning                                                   | Example                      |
| ---------- | --------------------------------------------------------- | ---------------------------- |
| `clean*`   | Deletes rows in FK-safe order. Returns `void`.             | `cleanCatalog(prisma)`       |
| `seed*`    | Upserts or creates a fixture. Returns the id.              | `seedVendor(prisma)`         |
| `waitFor*` | Polls until an async side effect lands, or throws.         | `waitForPollingConfig(...)`  |
| `Fake*`    | Controllable in-memory implementation of an outbound port. | `FakePingService`            |

### Rules

1. **`seed*` returns the id**, so callers never hard-code UUIDs.
2. **`seed*` is idempotent** — use `upsert` keyed on a natural key where one exists.
3. **`clean*` deletes in FK-safe order**, children before parents, and documents the
   order in a comment when it is not obvious.
4. **A `Fake*` exposes its recorded calls** (`lastMessage`, `callCount`) and a
   `reset()`, plus setters to force failure paths (`setShouldFail(true)`).
5. **Use `GHOST_ID` for "valid UUID that does not exist"** and `INVALID_ID` for
   "malformed identifier". Do not invent new constants per file.

### Substituting a fake

Where the use case is constructed explicitly, pass the fake directly. Where the route
test needs it, the fake must be injected through the container before
`setupRoutes` — this is why `createTestApp()` returns the container.

---

## 9. Database Lifecycle

```
beforeAll   → setupDependencies() / createTestApp(); seed auth tokens
beforeEach  → clean<Context>(prisma), then seed this test's fixtures
it          → act, assert
afterAll    → container.disconnect()
```

**Migrations are not optional.** The suite runs against `network_monitor_test`, which
is a *separate database from dev*. Running `prisma migrate dev` in your normal shell
does **not** migrate it. Before blaming a failure on the code:

```bash
set -a; . ./.env.test; set +a; npx prisma migrate status
```

A schema drift shows up as `column <x> of relation <y> does not exist` in *every*
suite that seeds that table — a broad, uniform failure across unrelated contexts is
almost always drift, not a regression.

To bring the test database to HEAD:

```bash
set -a; . ./.env.test; set +a; npx prisma migrate deploy
```

---

## 10. Required Coverage

### Per route file — all of these, for every endpoint

- [ ] `2xx` happy path, asserting the response envelope
- [ ] `401` with no `Authorization` header
- [ ] `403` for a role lacking the required permission (where roles differ)
- [ ] `400` for at least one validation failure
- [ ] `404` for a well-formed id that does not exist (on `:id` routes)
- [ ] The persisted effect is confirmed by a read-back

### Per use case meeting a trigger

- [ ] Happy path, asserting the row actually written
- [ ] Each failure branch the use case can return, with the error message matched
- [ ] The specific trigger condition that justified the file (the uniqueness
      collision, the cascade, the illegal transition, the event side effect)
- [ ] Boundary values for any range or window

### Never required

- Getters, DTO field mapping, or anything already covered by a unit test on the
  aggregate.

---

## 11. Running the Suites

```bash
npm test                       # unit only — never touches a database
npm run test:integration       # integration only — requires a migrated test DB
```

The two suites are separated by config, not by discipline:

- `jest.config.js` ignores `tests/integration/` outright.
- `jest.integration.config.js` matches only `tests/integration/**`, runs
  `--runInBand` because the database is shared, and loads `.env.test` via
  `tests/integration/setup.ts`.

Scope a run while working:

```bash
npm run test:integration -- vendor.routes
npm run test:integration -- use-cases/device-inventory
```

Per the project's scoped-test-run convention, run the suites covering what you
changed. Do not chase pre-existing failures in unrelated bounded contexts, but do
report them.

---

## 12. Definition of Done

A change to a bounded context is not done until:

**Structure**

- [ ] Every route file has a matching `<resource>.routes.test.ts`
- [ ] Every use case meeting a Section 4 trigger has an `.integration.test.ts`
- [ ] Files use `.test.ts`, live in the right directory, open with a `// Source:` comment

**Coverage**

- [ ] Section 10's route checklist passes for every touched endpoint
- [ ] Every new failure branch has an assertion matching its message
- [ ] Every use case with no HTTP surface has a use case test — nothing else covers it

**Hygiene**

- [ ] No mocked repositories, no real network, no ordering dependencies
- [ ] Shared setup lives in `helpers/`, not inlined
- [ ] `beforeEach` cleans; `afterAll` disconnects
- [ ] The test database is at HEAD and the suite is green

---

**Remember**: a test file that is never executed — wrong extension, wrong directory,
missing token — is worse than no test, because it reports coverage that does not
exist. Prefer a small suite that genuinely runs to a large one that quietly does not.
