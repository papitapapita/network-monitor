# Identity & Access — Business Rules

Who may call this API and what they may do with it. One aggregate (`User`), one
use case (`LoginUseCase`), and four pieces of middleware that every other
context sits behind.

This file is load-bearing for the rest of the book: `CUS-140`, `BIL-140`,
`NOT-150` and the device-inventory access rules all describe _which_ permission
their endpoints demand, and defer to `IDN-020` … `IDN-032` for what a permission
is and who holds one.

Format and conventions: [README.md](README.md).

## ID ranges

| Range                 | Area                          |
| --------------------- | ----------------------------- |
| `IDN-001` … `IDN-019` | User identity and credentials |
| `IDN-020` … `IDN-039` | Roles and permissions         |
| `IDN-040` … `IDN-059` | Login                         |
| `IDN-060` … `IDN-079` | Tokens and session lifetime   |
| `IDN-080` … `IDN-099` | Request-level enforcement     |
| `IDN-100` … `IDN-119` | Rate limiting                 |
| `IDN-120` … `IDN-139` | Audit and transport hardening |

## Layer coverage

| Layer                         | Rules |
| ----------------------------- | ----- |
| Presentation (middleware)     | 10    |
| Infrastructure                | 8     |
| Domain (value object)         | 4     |
| Application                   | 3     |
| Presentation                  | 2     |
| Domain (permission table)     | 2     |
| Domain (aggregate)            | 2     |
| Infrastructure + Presentation | 1     |
| Infrastructure (database)     | 1     |

The unusual shape here is that most of the enforcement is middleware, and most
of the _decisions_ are a table in the domain. `ROLE_PERMISSIONS` is a plain
constant under `domain/identity/permissions/` precisely so the question "may an
operator delete things" has one answer, testable without an HTTP request, that
no route can disagree with.

`User` is intentionally almost empty: it has no mutators. Password changes, role
changes and deactivation do not exist as operations — see `IDN-010`.

---

## User identity and credentials

### IDN-001 — A user must have an email, a role and a password hash

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

The hash must be a non-empty string after trimming.

**Why:** These three are the whole of what a user is here: how they are found,
what they may do, and how they prove it. A user missing any one cannot log in,
and an empty password hash is worse than a missing one — `bcrypt.compare`
against it would simply return false forever, producing an account that exists
and can never be used.

**Enforced at:** `src/domain/identity/aggregates/User.ts` (`create`)
**Message:** `passwordHash cannot be empty`
**Tests:** `tests/domain/identity/aggregates/User.test.ts`

### IDN-002 — A user's email must look like an address

**Type:** Validation · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-08-05

Non-empty local part, `@`, non-empty domain containing a dot, no whitespace.

**Why:** The same deliberately loose check as `CUS-009`, and a separate value
object for a separate reason: a `UserEmail` is a login credential and a
`Customer`'s email is a contact detail. They are unique in different tables and
would diverge the moment either grew a rule the other should not have.

**Enforced at:** `src/domain/identity/value-objects/UserEmail.ts` (`create`)
**Message:** `Email is not valid`
**Tests:** `tests/domain/identity/value-objects/UserEmail.test.ts`

### IDN-003 — A user's email is stored lowercased and trimmed

**Type:** Policy · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-08-05

**Why:** This is what makes login case-insensitive. Because `LoginUseCase`
normalises the submitted address through the same value object before looking it
up, `Ana@ISP.com` and `ana@isp.com` reach the same row — and `IDN-004` can rely
on there being only one.

**Enforced at:** `src/domain/identity/value-objects/UserEmail.ts` (`create`)
**Tests:** `tests/domain/identity/value-objects/UserEmail.test.ts`

### IDN-004 — An email identifies exactly one user

**Type:** Invariant · **Status:** Active
**Layer:** Infrastructure (database)
**Since:** 2026-08-05

**Why:** The email is the login identifier. Two rows sharing one would make
`findByEmail` return whichever the database felt like, so which password worked
would depend on query planning.

**Backed by:** `User.email @unique` in `prisma/schema.prisma`
**Tests:** `tests/integration/auth.routes.test.ts`

### IDN-005 — A user's email cannot exceed 255 characters

**Type:** Validation · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-08-05

**Why:** The practical ceiling for an address and the width of the column.

**Enforced at:** `src/domain/identity/value-objects/UserEmail.ts` (`create`)
**Backed by:** `User.email @db.VarChar(255)` in `prisma/schema.prisma`
**Message:** `Email must not exceed 255 characters`
**Tests:** `tests/domain/identity/value-objects/UserEmail.test.ts`

### IDN-006 — A password is stored only as a bcrypt hash, at cost 10

**Type:** Invariant · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-05

No plaintext password is ever persisted, and nothing in the system can recover
one.

**Why:** A database dump must not be a password list — these credentials protect
the ability to suspend subscribers and read their personal details. Cost 10 is
the tradeoff point where a login stays under ~100ms while a stolen hash stays
expensive to attack at scale; raising it is a one-constant change that
invalidates nothing, since bcrypt hashes carry their own cost.

**Enforced at:** `src/infrastructure/identity/services/BcryptPasswordService.ts` (`COST`)
**Tests:** `tests/integration/auth.routes.test.ts`

### IDN-010 — A user cannot be modified through the API

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

`User` has no mutators — no password change, no role change, no deactivation —
and there are no user-management endpoints. Accounts are created by the seed
script, which is idempotent and skips an email that already exists.

**Why:** Recorded because it is a real limitation, not an oversight to be
"fixed" by adding setters. This is a small operation with a handful of staff
accounts provisioned at deployment. The consequence to be aware of: **there is
no way to revoke a user's access short of deleting the row in the database**,
and because tokens are stateless (`IDN-062`), even that leaves their current
token valid until it expires. Adding user management means adding revocation at
the same time, not afterwards.

**Enforced at:** `src/domain/identity/aggregates/User.ts`, `prisma/seed.ts`
**Tests:** `tests/domain/identity/aggregates/User.test.ts`

---

## Roles and permissions

### IDN-020 — A user is an ADMIN, an OPERATOR or a VIEWER

**Type:** Invariant · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-08-05

Any other value is rejected. The role is stored uppercase and trimmed, so
`admin` and `ADMIN` are the same role.

**Why:** Three roles because there are three jobs: the person who runs the
network, the person who works in it day to day, and the person who only needs to
look. A fourth would need a fourth column in `ROLE_PERMISSIONS`, which is the
right place for that argument to happen.

**Enforced at:** `src/domain/identity/value-objects/UserRole.ts` (`create`)
**Backed by:** `UserRole` enum in `prisma/schema.prisma`
**Message:** `Invalid role: <value>. Must be one of: ADMIN, OPERATOR, VIEWER`
**Tests:** `tests/domain/identity/value-objects/UserRole.test.ts`

### IDN-021 — There are seven permissions

**Type:** Invariant · **Status:** Active
**Layer:** Domain (permission table)
**Since:** 2026-08-05

`read`, `create`, `update`, `delete`, `activate`, `bulk-import`,
`manage-credentials`.

**Why:** Permissions are verbs, not resources — one `delete` covers customers,
devices and alerts alike. That keeps the table small enough to hold in your head,
at the cost of not being able to grant deletion of one resource without the
others. Where a resource needs a stricter rule than its verb provides, the
endpoint is omitted entirely instead (`BIL-140`).

**Enforced at:** `src/domain/identity/permissions/Permission.ts`
**Tests:** `tests/domain/identity/permissions/Permission.test.ts`

### IDN-030 — Roles hold fixed permission sets

**Type:** Policy · **Status:** Active
**Layer:** Domain (permission table)
**Since:** 2026-08-05

| Role         | Permissions                                                                           |
| ------------ | ------------------------------------------------------------------------------------- |
| **ADMIN**    | `read`, `create`, `update`, `delete`, `activate`, `bulk-import`, `manage-credentials` |
| **OPERATOR** | `read`, `create`, `update`, `activate`, `bulk-import`                                 |
| **VIEWER**   | `read`                                                                                |

The two an operator lacks are `delete` and `manage-credentials`.

**Why:** An operator does the daily work — adding subscribers, commissioning
devices, activating service — and none of that destroys anything. The two
withheld verbs are the ones that are irreversible or that hand over the keys to
the equipment itself. `DEV-144` is the worked example of the second.

**Enforced at:** `src/domain/identity/permissions/Permission.ts` (`ROLE_PERMISSIONS`)
**Tests:** `tests/domain/identity/permissions/Permission.test.ts`

### IDN-031 — An unrecognised role grants nothing

**Type:** Invariant · **Status:** Active
**Layer:** Presentation (middleware)
**Since:** 2026-08-05

A role with no entry in `ROLE_PERMISSIONS` falls back to the empty set, so every
authorised endpoint answers `403`.

**Why:** Fail closed. The role arrives inside a token (`IDN-060`) and is trusted
as a string; if a role is ever removed from the table while tokens carrying it
are still valid, those tokens must lose access rather than keep whatever they
had.

**Enforced at:** `src/presentation/http/middleware/authorize.ts`
**Tests:** `tests/presentation/http/middleware/authorize.test.ts`

### IDN-032 — An endpoint requiring several permissions requires all of them

**Type:** Policy · **Status:** Active
**Layer:** Presentation (middleware)
**Since:** 2026-08-05

`authorize` takes a list and grants only if every one is held.

**Why:** The alternative reading — any one of them — would make adding a second
permission to a route _weaken_ it, which is the opposite of what someone writing
`authorize('update', 'manage-credentials')` intends.

**Enforced at:** `src/presentation/http/middleware/authorize.ts`
**Tests:** `tests/presentation/http/middleware/authorize.test.ts`

---

## Login

### IDN-040 — Login answers the same way for every kind of failure

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

A malformed email, an unknown user and a wrong password all return
`Invalid credentials`.

**Why:** Distinguishing them would turn the login endpoint into a directory:
"unknown user" versus "wrong password" tells an attacker which addresses are
real, and that is the expensive half of the work. The one exception is a
repository failure, which is reported as itself — it is an outage, not an
authentication answer.

**Enforced at:** `src/application/identity/use-cases/LoginUseCase.ts`
**Message:** `Invalid credentials`
**Tests:** `tests/application/identity/use-cases/LoginUseCase.test.ts`

### IDN-041 — A submitted password is never logged

**Type:** Invariant · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

`LoginUseCase` overrides `sanitizeForLogging` to strip `password` from the
request before the base `UseCase` records it.

**Why:** The base class logs every request it handles, which is what makes the
audit trail useful — and would put every password in the log file in plaintext.
Stripping at the use case rather than at the logger keeps the rule next to the
only request that carries one.

**Enforced at:** `src/application/identity/use-cases/LoginUseCase.ts` (`sanitizeForLogging`)
**Tests:** `tests/application/identity/use-cases/LoginUseCase.test.ts`

### IDN-042 — Login requires a syntactically valid email and a non-empty password

**Type:** Validation · **Status:** Active
**Layer:** Presentation
**Since:** 2026-08-05

Rejected at the edge with `400` before the use case runs.

**Why:** An empty password reaching bcrypt is a wasted hash comparison per
request, which is the cheapest denial-of-service available against a login
endpoint. Note the asymmetry with `IDN-040`: the edge distinguishes
_malformed_ from _wrong_, but never _unknown user_ from _wrong password_.

**Enforced at:** `src/presentation/http/validation/auth.schemas.ts`
**Message:** `Email is not valid` / `Password is required`
**Tests:** `tests/integration/auth.routes.test.ts`

### IDN-043 — A successful login returns a token and the user, never the hash

**Type:** Invariant · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

`UserMapper.toDTO` omits `passwordHash`.

**Why:** The DTO is what crosses the wire. A hash leaving the system is a
credential handed to an offline attacker with unlimited time — the mapper is the
single place that guarantees it does not.

**Enforced at:** `src/application/identity/mappers/UserMapper.ts`
**Tests:** `tests/integration/auth.routes.test.ts`

---

## Tokens and session lifetime

### IDN-060 — A token carries the user id, email and role

**Type:** Invariant · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-05

Nothing else. `verify` reconstructs exactly these three fields and discards any
other claim present in the token.

**Why:** The role travels in the token so authorisation needs no database read
per request. Rebuilding the payload field by field on verify rather than
returning the decoded object means a token with extra claims cannot smuggle
anything into `req.user`.

**Enforced at:** `src/infrastructure/identity/services/JwtTokenService.ts`
**Tests:** `tests/integration/auth.routes.test.ts`

### IDN-061 — A token is signed HS256 and expires after 24 hours

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-05

**Why:** Twenty-four hours means staff log in once a shift rather than once an
hour, and it bounds how long a leaked token stays useful. It is the only bound
there is — see `IDN-062`.

**Enforced at:** `src/infrastructure/identity/services/JwtTokenService.ts`
**Tests:** `tests/integration/auth.routes.test.ts`

### IDN-062 — Tokens are stateless and cannot be revoked

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-05

There is no session store, no deny-list, and no logout that invalidates anything
server-side. A token stays valid until it expires.

**Why:** Recorded because it is the consequence people are most likely to be
surprised by. Stateless tokens are what let every request be authorised without
a database round trip, and at this scale that tradeoff is deliberate. But taken
with `IDN-010` — no way to change a password or a role — it means **the fastest
possible response to a compromised account is 24 hours**, or rotating
`JWT_SECRET` and logging everyone out at once. Anything better requires a
revocation list, and that is the change to make before adding user management.

**Enforced at:** `src/infrastructure/identity/services/JwtTokenService.ts`
**Tests:** `tests/integration/auth.routes.test.ts`

### IDN-063 — The signing secret comes from the environment and is required

**Type:** Invariant · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-05

`JwtTokenService` throws at construction when `JWT_SECRET` is unset, so the
process fails to start rather than serving traffic.

**Why:** There is no default, and that is the point — a hardcoded fallback
secret would be published in the repository, which would let anyone mint an
ADMIN token. Failing at boot rather than at first login makes a
misconfiguration impossible to deploy unnoticed.

**Enforced at:** `src/infrastructure/identity/services/JwtTokenService.ts` (constructor)
**Message:** `JWT_SECRET environment variable is required`
**Tests:** `tests/integration/auth.routes.test.ts`

### IDN-064 — An invalid or expired token is indistinguishable in the response

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure + Presentation
**Since:** 2026-08-05

Both produce `401 Invalid token`. `verify` catches every failure — bad
signature, malformed, expired — and returns one message.

**Why:** The distinction is of no use to a legitimate client, which retries by
logging in either way, and of some use to an attacker probing whether a forged
signature was structurally accepted.

**Enforced at:** `src/infrastructure/identity/services/JwtTokenService.ts`,
`src/presentation/http/middleware/authenticate.ts`
**Message:** `Invalid token`
**Tests:** `tests/integration/auth.routes.test.ts`

---

## Request-level enforcement

### IDN-080 — Every `/api` route except login requires a valid Bearer token

**Type:** Invariant · **Status:** Active
**Layer:** Presentation (middleware)
**Since:** 2026-08-05

`/api/auth` is mounted before the authentication middleware; everything mounted
after it is behind the gate. There is no per-route opt-in.

**Why:** This is the rule the entire book depends on. Ordering rather than
decoration means a new route file cannot forget to be protected — the only way
to expose something publicly is to mount it above the middleware, which is a
visible, reviewable line in one file.

**Enforced at:** `src/presentation/http/routes/index.ts`
**Message:** `Authentication required`
**Tests:** `tests/integration/auth.routes.test.ts`

### IDN-081 — A malformed authorization header is a 401, not a 500

**Type:** Validation · **Status:** Active
**Layer:** Presentation (middleware)
**Since:** 2026-08-05

A missing header, or one not beginning `Bearer `, is rejected before any token
parsing is attempted.

**Why:** The check is on the prefix, not on the presence of a header, so
`Authorization: Basic …` is refused rather than having its payload fed to the
JWT verifier.

**Enforced at:** `src/presentation/http/middleware/authenticate.ts`
**Message:** `Authentication required`
**Tests:** `tests/integration/auth.routes.test.ts`

### IDN-082 — Authorisation without authentication is a 401

**Type:** Policy · **Status:** Active
**Layer:** Presentation (middleware)
**Since:** 2026-08-05

`authorize` finding no `req.user` answers `401`, not `403`.

**Why:** Defence in depth against a route mounted in the wrong order — but the
status still has to be right. `403` would tell an unauthenticated caller that
their identity was insufficient, when the real answer is that they have not
provided one.

**Enforced at:** `src/presentation/http/middleware/authorize.ts`
**Message:** `Authentication required`
**Tests:** `tests/presentation/http/middleware/authorize.test.ts`

### IDN-083 — A permission failure says nothing about what was required

**Type:** Policy · **Status:** Active
**Layer:** Presentation (middleware)
**Since:** 2026-08-05

`403 Forbidden`, with no mention of the missing permission or the caller's role.

**Why:** A VIEWER probing the API should not be able to map which endpoints
demand which verbs. The operator who genuinely needs to know is told by whoever
provisioned their account.

**Enforced at:** `src/presentation/http/middleware/authorize.ts`
**Message:** `Forbidden`
**Tests:** `tests/presentation/http/middleware/authorize.test.ts`

---

## Rate limiting

### IDN-100 — Requests are budgeted per authenticated user, falling back to IP

**Type:** Policy · **Status:** Active
**Layer:** Presentation (middleware)
**Since:** 2026-08-05

The bucket key is the user id when one is present, and the caller's IP
otherwise.

**Why:** Several operators work behind one office NAT. Keying on IP alone would
make them share a quota, so one person running a bulk import would lock out the
rest of the office. Keying on the user id gives each their own budget and makes
the limit a property of the account rather than the building.

**Enforced at:** `src/presentation/http/middleware/rateLimiter.ts` (`keyGenerator`)
**Tests:** `tests/presentation/http/middleware/rateLimiter.test.ts`

### IDN-101 — There are four rate budgets

**Type:** Policy · **Status:** Active
**Layer:** Presentation (middleware)
**Since:** 2026-08-05

| Budget        | Limit          |
| ------------- | -------------- |
| `read`        | 100 per minute |
| `write`       | 60 per minute  |
| `delete`      | 60 per minute  |
| `bulk-import` | 5 per hour     |

**Why:** Reads are cheap and are what a dashboard does on a timer, so they get
the loosest budget. `bulk-import` is three orders of magnitude tighter because
one call does the work of hundreds and can run for minutes — `BIL-141` explains
what that protects. `write` and `delete` are currently identical; the separate
name exists so deletion can be tightened without touching every write route.

**Enforced at:** `src/presentation/http/middleware/rateLimiter.ts` (`LIMITS`)
**Message:** `Too many requests`
**Tests:** `tests/presentation/http/middleware/rateLimiter.test.ts`

### IDN-102 — Rate limit state is per process and is lost on restart

**Type:** Policy · **Status:** Active
**Layer:** Presentation (middleware)
**Since:** 2026-08-05

The limiter keeps its counters in memory.

**Why:** Recorded because it bounds what these limits are for. They protect the
service from an accidental retry storm or a runaway client, not from a
determined attacker — who can reset every counter by causing a restart, and who
would face independent counters on each instance the moment this runs on more
than one. Making them real means a shared store.

**Enforced at:** `src/presentation/http/middleware/rateLimiter.ts`
**Tests:** `tests/presentation/http/middleware/rateLimiter.test.ts`

### IDN-103 — Login is not rate limited

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-08-05

`POST /api/auth/login` carries `validateRequest` and nothing else — no
`createRateLimiter`, because the limiter is applied per route and `/api/auth` is
mounted above the point where anything global would catch it.

**Why:** Recorded as a gap, not a decision. This is the one endpoint that is
reachable without credentials and the one where unlimited attempts are directly
useful to an attacker. `IDN-006` makes each attempt cost a bcrypt comparison,
which slows a guessing run down but also means an unthrottled flood is an
effective way to exhaust the process. The fix is a per-IP limiter on the login
route specifically — `IDN-100`'s user-id key is unavailable here, since there is
no authenticated user yet.

**Enforced at:** `src/presentation/http/routes/auth.routes.ts`
**Tests:** `tests/integration/auth.routes.test.ts`

---

## Audit and transport hardening

### IDN-120 — Every authenticated request is audited

**Type:** Policy · **Status:** Active
**Layer:** Presentation (middleware)
**Since:** 2026-08-05

On response, one log line records the user id, role, method, path, IP, status
code and duration. An unauthenticated caller is logged as `anonymous` / `none`.

**Why:** This is the record of who suspended whose service and when. Logging on
`finish` rather than on entry is what makes the status code available, so a
refused attempt is as visible as a successful one — and the audit middleware is
mounted _before_ authentication precisely so rejected requests are captured too.

**Enforced at:** `src/presentation/http/middleware/auditLog.ts`,
`src/presentation/http/routes/index.ts`
**Tests:** `tests/presentation/http/middleware/auditLog.test.ts`

### IDN-121 — The API sets security headers and restricts origins

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-05

Helmet's default header set is applied to every response, and CORS allows only
the origins in `ALLOWED_ORIGINS` (defaulting to `http://localhost:3001`), with
credentials permitted.

**Why:** The browser is the client, so these are the controls that stop another
site from driving this API with a logged-in operator's session. The allow-list
defaults to the local dev front end, which means a deployment that forgets to
set `ALLOWED_ORIGINS` fails visibly in the browser rather than silently
accepting every origin.

**Enforced at:** `src/main.ts`
**Tests:** `tests/integration/auth.routes.test.ts`

### IDN-122 — An unhandled error never reaches the client

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-05

The error handler logs the exception and answers `500 Internal server error`.
Unmatched routes answer `404 Not found`.

**Why:** A stack trace in a response body names file paths, library versions and
sometimes query fragments. Logging it and returning a fixed string keeps the
diagnostic where it is useful and out of where it is not.

**Enforced at:** `src/main.ts`
**Message:** `Internal server error` / `Not found`
**Tests:** `tests/integration/auth.routes.test.ts`

### IDN-123 — The health check is public

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-05

`GET /health` is mounted outside `/api` and returns a status and a timestamp,
with no authentication.

**Why:** It is what a load balancer or container orchestrator polls, and those
cannot hold credentials. It deliberately reveals nothing beyond the fact that
the process is up — no version, no database state, no dependency detail.

**Enforced at:** `src/main.ts`
**Tests:** `tests/integration/auth.routes.test.ts`
