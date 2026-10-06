# Identity & Access — Business Rules

Who may call this API and what they may do with it. One aggregate (`User`), the
login and user-management use cases, and four pieces of middleware that every
other context sits behind.

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
| `IDN-140` … `IDN-159` | User management               |
| `IDN-160` … `IDN-179` | Two-factor sign-in            |

## Layer coverage

| Layer                         | Rules |
| ----------------------------- | ----- |
| Presentation (middleware)     | 14    |
| Infrastructure                | 11    |
| Domain (value object)         | 4     |
| Application                   | 18    |
| Presentation                  | 5     |
| Domain (permission table)     | 2     |
| Domain (aggregate)            | 8     |
| Infrastructure + Presentation | 1     |
| Infrastructure (database)     | 1     |

The unusual shape here is that most of the enforcement is middleware, and most
of the _decisions_ are a table in the domain. `ROLE_PERMISSIONS` is a plain
constant under `domain/identity/permissions/` precisely so the question "may an
operator delete things" has one answer, testable without an HTTP request, that
no route can disagree with.

`User` is small: a role change, a password change, disabling and re-enabling,
and the count of wrong passwords that pauses its sign-in (`IDN-044`). Every
change except re-enabling and that count ends the sessions the account has
open (`IDN-065`).

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

### IDN-010 — Users are managed by the customer's administrator, through the API

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05 · **Revised:** 2026-09-30

`/api/users` creates accounts, changes a role, disables and re-enables an
account and resets a password (`IDN-140` … `IDN-144`). Nothing deletes a user:
disabling is the way to take access away, and it keeps the account's history
and its link to a technician. The seed script still creates the first
administrator of a new install, and the vendor account comes from the
environment (`IDN-011`).

**Why:** Until 2026-09-30 accounts were rows inserted by hand, with no way to
take access away short of deleting one — and a deleted user's token kept working
until it expired. User management arrived together with session revocation
(`IDN-065`), which is what makes disabling an account mean something.

**Enforced at:** `src/domain/identity/aggregates/User.ts`, `prisma/seed.ts`
**Tests:** `tests/domain/identity/aggregates/User.test.ts`

### IDN-011 — The vendor account is put in place from the environment at boot

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-30

When `VENDOR_EMAIL` is set, every boot makes sure that account exists and is a
`VENDOR`:

| The account              | What happens                               |
| ------------------------ | ------------------------------------------ |
| does not exist           | created as `VENDOR` with `VENDOR_PASSWORD` |
| exists with another role | promoted to `VENDOR`; its password is kept |
| is already a `VENDOR`    | nothing                                    |

`VENDOR_PASSWORD` is read only to create the account, so it can be removed from
the environment afterwards. A failure — a malformed email, a missing password
for a new account, a database error — stops the boot. `VENDOR_PASSWORD` set
without `VENDOR_EMAIL` also stops it. With neither set the install runs with no
vendor account and logs a warning.

Changing `VENDOR_EMAIL` later promotes the new address and leaves the old one a
`VENDOR`; taking the role away from an account is a database change for now.

**Why:** The vendor account is what separates the company that runs the install
from the customer using it (`IDN-033`), so it cannot depend on someone
remembering to insert a row. Promoting an existing account is how an install
whose owner is also the vendor (Insetel) moves its owner over without a second
login. Keeping the existing password means a restart never overwrites a password
the owner already uses.

**Enforced at:** `src/application/identity/use-cases/EnsureVendorAccountUseCase.ts`,
`src/infrastructure/di/vendorAccount.ts`, `src/infrastructure/di/container.ts`
(`ensureVendorAccount`), `src/main.ts`
**Message:** `Vendor account: …` (boot error) / `VENDOR_PASSWORD is set but VENDOR_EMAIL is not`
**Tests:** `tests/application/identity/use-cases/EnsureVendorAccountUseCase.test.ts`,
`tests/infrastructure/di/vendorAccount.test.ts`,
`tests/integration/use-cases/identity/EnsureVendorAccountUseCase.integration.test.ts`,
`tests/domain/identity/aggregates/User.test.ts`

### IDN-012 — The vendor account's password is at least 12 characters

**Type:** Validation · **Status:** Active
**Layer:** Application
**Since:** 2026-09-30

Both when the boot creates it and when the vendor changes it
(`IDN-144`).

**Why:** It is the one account that can pair machines onto a customer's network
(`IDN-033`), and it is typed into an environment file rather than chosen at a
login screen, so a short placeholder would otherwise go live unnoticed. Staff
accounts need 8 (`IDN-142`).

**Enforced at:** `src/application/identity/use-cases/EnsureVendorAccountUseCase.ts` (`VENDOR_PASSWORD_MIN_LENGTH`), `src/application/identity/use-cases/ChangeOwnPasswordUseCase.ts`
**Message:** `A password of at least 12 characters is required to create the vendor account` / `Password must be at least 12 characters`
**Tests:** `tests/application/identity/use-cases/EnsureVendorAccountUseCase.test.ts`,
`tests/integration/use-cases/identity/EnsureVendorAccountUseCase.integration.test.ts`,
`tests/application/identity/use-cases/ChangeOwnPasswordUseCase.test.ts`

### IDN-013 — A disabled account cannot sign in, and its open sessions end

**Type:** Invariant · **Status:** Active
**Layer:** Domain (aggregate)
**Since:** 2026-09-30

`disable()` sets `disabledAt` and ends the account's sessions (`IDN-065`);
login answers a disabled account exactly as a wrong password (`IDN-040`).
`enable()` clears it. Disabling twice, or enabling an enabled account, is
refused by the aggregate; `PATCH /api/users/:id` treats both as no change.

**Why:** Taking access away has to work now, not when the token expires — that
is the whole point of disabling someone who has left or whose password leaked.
Answering like a wrong password keeps `IDN-040`'s promise that login does not
tell anyone which accounts exist or are active.

**Enforced at:** `src/domain/identity/aggregates/User.ts`,
`src/application/identity/use-cases/LoginUseCase.ts`,
`src/application/identity/services/SessionValidator.ts`
**Message:** `User is already disabled` / `User is not disabled`
**Tests:** `tests/domain/identity/aggregates/User.test.ts`,
`tests/application/identity/use-cases/LoginUseCase.test.ts`,
`tests/integration/user.routes.test.ts`

---

## Roles and permissions

### IDN-020 — A user is a VENDOR, an ADMIN, an OPERATOR or a VIEWER

**Type:** Invariant · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-08-05 · **Revised:** 2026-09-30

Any other value is rejected. The role is stored uppercase and trimmed, so
`admin` and `ADMIN` are the same role.

**Why:** Four roles because there are four jobs: the company that sells and runs
the install (`VENDOR`, added 2026-09-30 — `IDN-033`), the customer's person who
runs the network, the person who works in it day to day, and the person who only
needs to look. A fifth would need a fifth entry in `ROLE_PERMISSIONS`, which is
the right place for that argument to happen.

**Enforced at:** `src/domain/identity/value-objects/UserRole.ts` (`create`)
**Backed by:** `UserRole` enum in `prisma/schema.prisma`
**Message:** `Invalid role: <value>. Must be one of: VENDOR, ADMIN, OPERATOR, VIEWER`
**Tests:** `tests/domain/identity/value-objects/UserRole.test.ts`

### IDN-021 — There are nine permissions

**Type:** Invariant · **Status:** Active
**Layer:** Domain (permission table)
**Since:** 2026-08-05 · **Revised:** 2026-09-30

`read`, `create`, `update`, `delete`, `activate`, `bulk-import`,
`manage-credentials`, `manage-users`, `manage-installation`.

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
**Since:** 2026-08-05 · **Revised:** 2026-09-30 (`manage-settings`, IDN-034)

| Role         | Permissions                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| **VENDOR**   | everything ADMIN has, plus `manage-installation`                                                                         |
| **ADMIN**    | `read`, `create`, `update`, `delete`, `activate`, `bulk-import`, `manage-credentials`, `manage-users`, `manage-settings` |
| **OPERATOR** | `read`, `create`, `update`, `activate`, `bulk-import`                                                 |
| **VIEWER**   | `read`                                                                                                |

An operator lacks `delete`, `manage-credentials`, `manage-users` and
`manage-settings`; an administrator lacks only `manage-installation`
(`IDN-033`).

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

### IDN-033 — Running the install is the vendor's, not the customer's

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-09-30

`manage-installation`, held by `VENDOR` alone, gates:

| Endpoint                               | What it does                          |
| -------------------------------------- | ------------------------------------- |
| `POST /api/agents`                     | create an agent and its pairing key   |
| `POST /api/agents/:id/pairing-key`     | issue a new pairing key               |
| `POST /api/agents/:id/revoke`          | revoke an agent                       |
| `POST /api/admin/data-retention/purge` | purge stale data across every context |
| `GET`, `PUT /api/installation/settings` | the vendor's settings (INS-028, INS-030) |

A customer's `ADMIN` answers `403` on all of them, and still reads its agents
(`AGT-009`).

**Why:** These are the actions of whoever installs and maintains the system,
not of whoever uses it. Pairing an agent puts a machine on the customer's
network with access to its measurements; a customer who could do that could
also undo the vendor's installation without the vendor knowing. The purge is a
maintenance lever on the database the vendor is answerable for. Keeping all of
it on one permission means the customer's dashboard can hide every vendor
control by checking one thing.

**Enforced at:** `src/domain/identity/permissions/Permission.ts`,
`src/presentation/http/routes/agent.routes.ts`,
`src/presentation/http/routes/admin.routes.ts`
**Tests:** `tests/integration/agent.routes.test.ts`,
`tests/integration/admin.routes.test.ts`,
`tests/domain/identity/permissions/Permission.test.ts`

### IDN-034 — The customer's administrator changes the install's settings

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-09-30

`manage-settings`, held by `ADMIN` (and so by `VENDOR`), gates changing the
install's settings from the dashboard: today the notification settings
(`PUT /api/notification-settings` and its test message, `NOT-204`). Reading
them stays on `read`. An `OPERATOR` or `VIEWER` answers `403`.

**Why:** Where alerts go and how long the system waits before paging are
decisions for whoever answers for the install, not for every member of staff;
a wrong chat silently stops every alert. They are the customer's own, so they
sit below `manage-installation`, which stays the vendor's.

**Enforced at:** `src/domain/identity/permissions/Permission.ts`,
`src/presentation/http/routes/notification-settings.routes.ts`
**Tests:** `tests/domain/identity/permissions/Permission.test.ts`,
`tests/integration/notification-settings.routes.test.ts`

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

A paused account (`IDN-044`) is the accepted leak: it answers `429` where an
unknown email answers `401`, so five wrong passwords reveal that an address
has an account. `IDN-103` caps that at two addresses per caller address every
15 minutes, too slow to map a directory, and a person locked out needs to know
to wait rather than to doubt their password.

**Enforced at:** `src/application/identity/use-cases/LoginUseCase.ts`
**Message:** `Invalid credentials`
**Tests:** `tests/application/identity/use-cases/LoginUseCase.test.ts`

### IDN-041 — A submitted password is never logged

**Type:** Invariant · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

`LoginUseCase` and the two-factor steps strip every sign-in secret before the
base `UseCase` records the request or its answer: the password, codes,
recovery codes, the two-factor secret and link, challenges, session tokens and
remembered-browser tokens (`withoutSignInSecrets`).

**Why:** The base class logs every request it handles, which is what makes the
audit trail useful — and would put every password in the log file in plaintext.
Stripping at the use case rather than at the logger keeps the rule next to the
only request that carries one.

**Enforced at:** `src/application/identity/use-cases/LoginUseCase.ts` (`sanitizeForLogging`),
`src/application/identity/services/SignInSteps.ts` (`withoutSignInSecrets`)
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

### IDN-043 — A finished sign-in returns a token and the user, never the hash

**Type:** Invariant · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05 · **Revised:** 2026-10-05

A sign-in finishes at the two-factor step (`IDN-169`, `IDN-170`), not at login
(`IDN-166`). `UserMapper.toDTO` omits `passwordHash` and every two-factor
field.

**Why:** The DTO is what crosses the wire. A hash leaving the system is a
credential handed to an offline attacker with unlimited time — the mapper is the
single place that guarantees it does not.

**Enforced at:** `src/application/identity/mappers/UserMapper.ts`
**Tests:** `tests/integration/auth.routes.test.ts`

### IDN-044 — Five wrong passwords in a row pause the account's sign-in

**Type:** Policy · **Status:** Active
**Layer:** Domain (aggregate)
**Since:** 2026-10-05 · **Revised:** 2026-10-05

Each wrong password for an existing, enabled account is counted on the account,
and so is each wrong two-factor code or recovery code (`IDN-169`, `IDN-170`).
The first four cost nothing. The fifth pauses sign-in for 1 minute, and each
further wrong password doubles the pause, up to 15 minutes. While a pause runs,
every attempt is refused before the password is checked — even the right one —
and is not counted, so it neither stretches the pause nor raises the next one.
The count survives the pause's end: the first wrong password after it pauses
for twice as long. A finished sign-in — the right code after the right
password — clears the count and the pause; the right password alone does not
(`IDN-166`). A new password clears them too (the failures were against the old one), so an
administrator can let a person in at once by resetting their password.

The count is kept in the database, so a restart does not reset it.

**Why:** A per-address limit (`IDN-103`) does not stop a guessing run spread
over many addresses; the account is the one thing every such attempt shares.
A doubling pause rather than a lock is deliberate: a lock that only an
administrator can lift lets anyone who knows an email shut its owner out. Here
the worst an attacker can do is make the owner wait up to 15 minutes, while
guessing slows to four tries an hour.

**Enforced at:** `src/domain/identity/aggregates/User.ts` (`recordFailedSignIn`, `signInPauseAfter`),
`src/application/identity/use-cases/LoginUseCase.ts`,
`src/application/identity/services/SignInSteps.ts` (`recordFailure`),
`src/application/identity/use-cases/VerifyTwoFactorUseCase.ts`,
`src/application/identity/use-cases/ConfirmTwoFactorSetupUseCase.ts`,
`prisma/migrations/20261005120000_user_sign_in_pause/migration.sql` (`users_sign_in_pause_check`)
**Message:** `Too many failed sign-in attempts. Try again later.` (`429`)
**Tests:** `tests/domain/identity/aggregates/User.test.ts`,
`tests/application/identity/use-cases/LoginUseCase.test.ts`,
`tests/integration/use-cases/identity/LoginUseCase.integration.test.ts`,
`tests/integration/auth.routes.test.ts`

### IDN-045 — A paused sign-in is announced in the install's alert chat

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-05

When an account's fifth wrong password in a row starts a pause (`IDN-044`),
one alert goes to the install's own Telegram chat: the account, the caller's
address and how long it waits. Further pauses in the same run of failures send
nothing more. The alert has no device, so quiet hours do not apply; it can be
muted like any other type (`sign_in_paused`).

**Why:** Five misses are either a forgotten password or someone guessing, and
only the people who run the install can tell which. One message per run tells
them it is happening without letting an attacker flood their phones.

**Enforced at:** `src/domain/identity/aggregates/User.ts` (`UserSignInPausedEvent`),
`src/application/notifications/event-handlers/UserSignInPausedNotificationHandler.ts`
**Tests:** `tests/domain/identity/aggregates/User.test.ts`,
`tests/application/notifications/event-handlers/UserSignInPausedNotificationHandler.test.ts`,
`tests/application/identity/use-cases/LoginUseCase.test.ts`

---

## Tokens and session lifetime

### IDN-060 — A token carries the user id, email, role and token version

**Type:** Invariant · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-05 · **Revised:** 2026-10-05

Nothing else. `verify` reconstructs exactly these four fields and discards any
other claim present in the token; a token without a token version is invalid,
and so is one with a `kind`, which marks a two-factor challenge (`IDN-167`).
The role in the token is not what authorisation uses: each request takes the
role from the account (`IDN-065`).

**Why:** Rebuilding the payload field by field on verify rather than returning
the decoded object means a token with extra claims cannot smuggle anything into
`req.user`. Refusing a token with no version signs out, once, everyone who
signed in before versioning existed — the price of making revocation work.

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

### IDN-062 — Logout forgets this browser's session; only the account ends a token early

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-05 · **Revised:** 2026-10-05

There is no session store. `POST /api/auth/logout` clears the session cookie
(`IDN-066`) in the browser that calls it and leaves its remembered browser
(`IDN-171`) alone; the token itself stays valid until it expires. What ends a
token early is the account — disabling it, or changing its role or password,
invalidates every token it holds (`IDN-065`).

**Why:** Until 2026-09-30 tokens could not be revoked at all, which is what made
user management unsafe to add (`IDN-010`). Versioning the account rather than
listing revoked tokens keeps nothing to store per session and needs no cleanup.
Its limit: it ends all of an account's sessions at once, never one device's.

**Enforced at:** `src/infrastructure/identity/services/JwtTokenService.ts`,
`src/application/identity/services/SessionValidator.ts`,
`src/presentation/http/controllers/AuthController.ts` (`logout`)
**Tests:** `tests/integration/auth.routes.test.ts`, `tests/integration/user.routes.test.ts`,
`tests/presentation/http/middleware/sessionCookies.test.ts`

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

### IDN-065 — Every request checks that the account still stands behind the token

**Type:** Invariant · **Status:** Active
**Layer:** Presentation (middleware)
**Since:** 2026-09-30

After the signature, the authentication middleware — the Bearer one and the
stream one alike — loads the account by id and refuses the token with
`401 Invalid token` if the account is gone, disabled, or its `tokenVersion` is
not the one the token carries. `tokenVersion` goes up on every role change,
password change and disabling. The role and email put on the request come from
the account, not from the token. A failure to read the account is a `500`, not
a `401`.

**Why:** A signature proves a token was issued, not that it should still work.
One primary-key lookup per request is what it costs to make disabling and role
changes take effect immediately instead of up to 24 hours later (`IDN-061`),
and at this scale it is small. Reading the role from the account means a
demoted administrator loses the rights on their next click.

**Enforced at:** `src/application/identity/services/SessionValidator.ts`,
`src/presentation/http/middleware/authenticate.ts`,
`src/presentation/http/middleware/authenticateStream.ts`,
`src/domain/identity/aggregates/User.ts`
**Message:** `Invalid token`
**Tests:** `tests/application/identity/services/SessionValidator.test.ts`,
`tests/presentation/http/middleware/authenticate.test.ts`,
`tests/integration/user.routes.test.ts`

### IDN-066 — A browser holds its session in a cookie scripts cannot read

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-10-05

Every answer that hands out a session — the two-factor steps (`IDN-169`,
`IDN-170`), a login from a remembered browser (`IDN-171`) and a password
change (`IDN-144`) — also sets it as the `nms_session` cookie: `HttpOnly`,
`Secure`, `SameSite=Strict`, for the whole site, for 24 hours like the token
(`IDN-061`). A remembered browser gets `nms_trusted_browser` the same way,
sent only to `/api/auth`, for 30 days. The token is still in the answer's
body for clients that are not browsers; a browser should ignore it.

The dashboard and the API must share a main domain (`app.example.com` and
`api.example.com`), or `Strict` keeps the browser from sending the cookie.

**Why:** A token in the page's storage is one injected script away from being
copied and used from anywhere for a day. A script cannot read an `HttpOnly`
cookie, and `Strict` stops the browser attaching it to a request another site
started.

**Enforced at:** `src/presentation/http/middleware/sessionCookies.ts`,
`src/presentation/http/controllers/AuthController.ts`,
`src/presentation/http/controllers/UserController.ts`
**Tests:** `tests/presentation/http/middleware/sessionCookies.test.ts`,
`tests/integration/auth.routes.test.ts`,
`tests/integration/user.routes.test.ts`

---

## Request-level enforcement

### IDN-080 — Every `/api` route except login requires a valid session

**Type:** Invariant · **Status:** Active
**Layer:** Presentation (middleware)
**Since:** 2026-08-05 · **Revised:** 2026-10-05

The session comes as a Bearer token or as the session cookie (`IDN-084`).

`/api/auth` is mounted before the authentication middleware; everything mounted
after it is behind the gate. The two-factor routes under it take a challenge
token instead (`IDN-167`). There is no per-route opt-in.

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

### IDN-084 — A request signs in with a Bearer header or the session cookie

**Type:** Policy · **Status:** Active
**Layer:** Presentation (middleware)
**Since:** 2026-10-05

The authentication middleware takes the `Authorization: Bearer` header when
there is one and the `nms_session` cookie (`IDN-066`) otherwise; both then
pass the same checks (`IDN-065`). Streams accept the cookie as well as
`?token=`, so an `EventSource` opened `withCredentials` needs no token in its
address.

**Why:** Browsers move to the cookie; scripts, tests and other clients keep
the header. The header wins so a client that sends one is never judged by a
stale cookie it did not mean to send.

**Enforced at:** `src/presentation/http/middleware/authenticate.ts` (`findSessionToken`),
`src/presentation/http/middleware/authenticateStream.ts`
**Tests:** `tests/presentation/http/middleware/authenticate.test.ts`,
`tests/integration/auth.routes.test.ts`

### IDN-085 — A change signed by the cookie must come from one of our dashboards

**Type:** Invariant · **Status:** Active
**Layer:** Presentation (middleware)
**Since:** 2026-10-05

A request signed by the session cookie with any method other than `GET`,
`HEAD` or `OPTIONS` must carry an `Origin` listed in `ALLOWED_ORIGINS`;
otherwise it answers `403 Cross-site request refused` before the token is
checked. A missing `Origin` is refused too. Requests signed with a Bearer
header are not affected.

**Why:** The browser attaches the cookie to any request a page makes, which is
what cross-site request forgery abuses. `SameSite=Strict` already stops other
sites; this also stops a page on a sibling subdomain, which counts as the same
site. Browsers always send `Origin` on these requests, so refusing its absence
costs a real dashboard nothing. A header is something a forging page cannot
add, so Bearer requests need no such check.

**Enforced at:** `src/presentation/http/middleware/authenticate.ts`,
`src/infrastructure/di/allowedOrigins.ts`
**Message:** `Cross-site request refused` (`403`)
**Tests:** `tests/presentation/http/middleware/authenticate.test.ts`,
`tests/integration/auth.routes.test.ts`

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

### IDN-101 — There are seven rate budgets

**Type:** Policy · **Status:** Active
**Layer:** Presentation (middleware)
**Since:** 2026-08-05

| Budget        | Limit                  |
| ------------- | ---------------------- |
| `read`        | 100 per minute         |
| `write`       | 60 per minute          |
| `delete`      | 60 per minute          |
| `bulk-import` | 5 per hour             |
| `enroll`      | 10 per 15 min          |
| `sign-in`     | 10 failures per 15 min |
| `address`     | 1000 per minute        |

**Why:** Reads are cheap and are what a dashboard does on a timer, so they get
the loosest budget. `bulk-import` is three orders of magnitude tighter because
one call does the work of hundreds and can run for minutes — `BIL-141` explains
what that protects. `write` and `delete` are currently identical; the separate
name exists so deletion can be tightened without touching every write route.
`enroll` and `sign-in` are the budgets for a caller with no user — agent
enrollment (`AGT-008`) and login (`IDN-103`) — keyed by IP address.
`address` sits in front of all the others (`IDN-104`).

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

### IDN-103 — An address gets ten failed sign-ins per 15 minutes

**Type:** Policy · **Status:** Active
**Layer:** Presentation (middleware)
**Since:** 2026-08-05 · **Revised:** 2026-10-05

Login and the three two-factor routes share one `sign-in` budget (`IDN-101`),
keyed by the caller's address, so wrong passwords and wrong codes add up.
Only failed attempts spend it — any answer of `400` or above — so an office
whose staff all sign in from one address is never held up by its own
successes. The eleventh failure within 15 minutes answers `429`
`Too many requests`.

Behind Cloudflare Tunnel the address is only the caller's own when
`TRUST_PROXY` names the tunnel (`loopback` when `cloudflared` runs on the same
machine); otherwise every caller shares one budget.

**Why:** Until 2026-10-05 login had no limit at all — the one endpoint reachable
without credentials and the one where unlimited attempts help an attacker most.
Each attempt costs a bcrypt comparison (`IDN-006`), so a flood also wears the
process down. This budget slows one source; `IDN-044` covers guessing spread
across many.

**Enforced at:** `src/presentation/http/routes/auth.routes.ts`,
`src/presentation/http/middleware/rateLimiter.ts` (`skipSuccessfulRequests`)
**Message:** `Too many requests`
**Tests:** `tests/presentation/http/middleware/rateLimiter.test.ts`,
`tests/integration/auth.routes.test.ts`

### IDN-104 — An address gets 1000 requests a minute across the whole API

**Type:** Policy · **Status:** Active
**Layer:** Presentation (middleware)
**Since:** 2026-10-05

Every request under `/api` and `/agent/v1` spends one shared `address` budget
(`IDN-101`), keyed by the caller's address whoever is signed in, before the
subscription check, the token check or any other budget runs. The 1001st
request within a minute answers `429` `Too many requests`. The other budgets
still apply on top of it.

**Why:** The per-user budgets run only after the token is checked, so a flood
with no token or a forged one was unlimited — and each such request still
costs a signature check and, for a well-formed token, a database lookup
(`IDN-065`). A thousand a minute is ten people's worth of `read` budget, so an
office sharing one address does not meet it in normal use, while a single
source can no longer hammer the install. Like the others, the count lives in
memory (`IDN-102`).

**Enforced at:** `src/presentation/http/routes/index.ts` (`perAddress`),
`src/presentation/http/middleware/rateLimiter.ts`
**Message:** `Too many requests`
**Tests:** `tests/presentation/http/middleware/rateLimiter.test.ts`,
`tests/integration/auth.routes.test.ts`

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

---

## User management

### IDN-140 — An administrator manages the install's staff

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-30

`manage-users` (ADMIN, and VENDOR through `IDN-030`) gates:

| Endpoint                               | What it does                                        |
| -------------------------------------- | --------------------------------------------------- |
| `GET /api/users`                       | list accounts, oldest first                         |
| `POST /api/users`                      | create an account (`ADMIN`, `OPERATOR` or `VIEWER`) |
| `PATCH /api/users/:id`                 | change `role`, `disabled` and/or `password`         |
| `POST /api/users/:id/two-factor/reset` | reset two-factor sign-in (`IDN-172`)                |

The list leaves out the vendor account unless the caller is the vendor, and
shows whether each account has two-factor on (`twoFactorEnabled`). A
password reset replaces the old password at once and, like a role change or
disabling, ends the account's sessions. Setting a field to its current value
changes nothing.

**Why:** The customer runs their own team — hiring, moving someone to a
different job, someone leaving — and should not need the vendor for it. The
vendor account is not part of that team, so it is not shown among it.

**Enforced at:** `src/application/identity/use-cases/ListUsersUseCase.ts`,
`src/application/identity/use-cases/CreateUserUseCase.ts`,
`src/application/identity/use-cases/UpdateUserUseCase.ts`,
`src/presentation/http/routes/user.routes.ts`
**Tests:** `tests/application/identity/use-cases/ListUsersUseCase.test.ts`,
`tests/application/identity/use-cases/CreateUserUseCase.test.ts`,
`tests/application/identity/use-cases/UpdateUserUseCase.test.ts`,
`tests/integration/use-cases/identity/ListUsersUseCase.integration.test.ts`,
`tests/integration/use-cases/identity/CreateUserUseCase.integration.test.ts`,
`tests/integration/use-cases/identity/UpdateUserUseCase.integration.test.ts`,
`tests/integration/user.routes.test.ts`

### IDN-141 — Nobody manages the vendor account through the API

**Type:** Invariant · **Status:** Active
**Layer:** Application · Presentation
**Since:** 2026-09-30

`PATCH /api/users/:id` and a two-factor reset (`IDN-172`) on a `VENDOR`
account answer `403`, whoever asks. The
`VENDOR` role cannot be given to anyone: creating or changing a user to it is a
`400`. The vendor changes its own password like anyone else (`IDN-144`).

**Why:** The vendor account is how the vendor keeps running the install
(`IDN-033`). If the customer could disable it, demote it or reset its password,
they could lock the vendor out; if they could hand out `VENDOR`, the separation
would mean nothing. Only the vendor's own environment setting creates or
promotes it (`IDN-011`).

**Enforced at:** `src/application/identity/services/userAccountPolicy.ts`,
`src/application/identity/use-cases/UpdateUserUseCase.ts`,
`src/application/identity/use-cases/CreateUserUseCase.ts`,
`src/presentation/http/validation/user.schemas.ts`
**Message:** `The vendor account is managed by the vendor` (403) /
`The VENDOR role cannot be assigned through the API` (400)
**Tests:** `tests/application/identity/use-cases/UpdateUserUseCase.test.ts`,
`tests/application/identity/use-cases/CreateUserUseCase.test.ts`,
`tests/integration/use-cases/identity/UpdateUserUseCase.integration.test.ts`,
`tests/integration/user.routes.test.ts`

### IDN-142 — A staff password is at least 12 characters

**Type:** Validation · **Status:** Active
**Layer:** Application
**Since:** 2026-09-30 · **Revised:** 2026-10-05

On creation, on reset and on a change of one's own password, the same 12 as the
vendor account (`IDN-012`). It was 8 until 2026-10-05; a shorter password set
before then keeps working until it is next changed. Passwords over 200 characters are refused at the edge.

**Why:** The floor stops the obvious placeholders (`1234`, the company name)
without forcing rules people work around by writing passwords down. The ceiling
keeps a request from handing bcrypt an arbitrarily long string.

**Enforced at:** `src/application/identity/services/userAccountPolicy.ts` (`USER_PASSWORD_MIN_LENGTH`),
`src/presentation/http/validation/user.schemas.ts`
**Message:** `Password must be at least 12 characters`
**Tests:** `tests/application/identity/use-cases/CreateUserUseCase.test.ts`,
`tests/application/identity/use-cases/UpdateUserUseCase.test.ts`,
`tests/integration/user.routes.test.ts`

### IDN-143 — An administrator cannot change their own account through user management

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-30

`PATCH /api/users/:id` on the caller's own id answers `403`, whatever the
fields. Their own password goes through `IDN-144`.

**Why:** An administrator who demotes or disables themselves by mistake can lock
the install out of its only administrator. Having someone else do it keeps a
second pair of eyes on the one change that can remove the last person able to
undo it.

**Enforced at:** `src/application/identity/use-cases/UpdateUserUseCase.ts`
**Message:** `You cannot change your own account here — use /api/users/me/password for your password`
**Tests:** `tests/application/identity/use-cases/UpdateUserUseCase.test.ts`,
`tests/integration/user.routes.test.ts`

### IDN-144 — Everyone changes their own password with the current one

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-30

`POST /api/users/me/password`, any role, with `currentPassword` and
`newPassword`. A wrong current password is a `400`. The change ends every
session of the account, the caller's included, so the response carries a new
token to continue with.

**Why:** Asking for the current password means a token left on an unattended
screen cannot be turned into a permanent takeover. Returning a fresh token keeps
the person who just changed their password signed in, while any other device
that had the old one is signed out.

**Enforced at:** `src/application/identity/use-cases/ChangeOwnPasswordUseCase.ts`
**Message:** `Current password is incorrect`
**Tests:** `tests/application/identity/use-cases/ChangeOwnPasswordUseCase.test.ts`,
`tests/integration/use-cases/identity/ChangeOwnPasswordUseCase.integration.test.ts`,
`tests/integration/user.routes.test.ts`

---

## Two-factor sign-in

Every account signs in with a password and a six-digit code from an
authenticator app (Google Authenticator, Microsoft Authenticator and the like).
`IDN-160` to `IDN-165` are the account's side of it; `IDN-166` to `IDN-170`
are the sign-in steps that ask for the code; `IDN-171` lets a browser skip the
code for 30 days; `IDN-172` and `IDN-173` are the administrator's reset.

### IDN-160 — Two-factor turns on only with its first valid code

**Type:** Invariant · **Status:** Active
**Layer:** Domain (aggregate)
**Since:** 2026-10-05

Setup stores a new secret but leaves two-factor off. It turns on when the
person enters a valid code from their app, which also stores their recovery
codes (`IDN-163`). While two-factor is off the account keeps no recovery codes
and no last-used code, and it can never be on without a secret; the database
enforces the same (`users_two_factor_check`). Using a code never ends a
session.

**Why:** Turning two-factor on before a code proves the app holds the secret
would lock out anyone whose scan failed — they would be asked for codes their
phone cannot make.

**Enforced at:** `src/domain/identity/aggregates/User.ts` (`confirmTwoFactor`, `validate`),
`prisma/migrations/20261005130000_user_two_factor/migration.sql`
**Message:** `Two-factor setup has not been started`
**Tests:** `tests/domain/identity/aggregates/User.test.ts`,
`tests/integration/use-cases/identity/LoginUseCase.integration.test.ts`

### IDN-161 — Codes follow RFC 6238, accepting one step of clock drift

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-10-05

Codes are TOTP as every authenticator app makes them by default: HMAC-SHA1, a
new six-digit code every 30 seconds, from a 160-bit secret. A code from the
step before or after the current one is accepted too, so a phone whose clock
is up to 30 seconds off still works. The setup QR code encodes an `otpauth://`
link naming the product and the account.

**Why:** The defaults are the only settings every app honours; some ignore any
other algorithm or length silently and then show codes that never match. One
step either way absorbs ordinary clock drift and the seconds it takes to type
the code.

**Enforced at:** `src/infrastructure/identity/services/TotpTwoFactorCodes.ts`
**Tests:** `tests/infrastructure/identity/services/TotpTwoFactorCodes.test.ts` (the RFC 6238 test vectors)

### IDN-162 — The two-factor secret is stored encrypted with the install's key

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-10-05

The secret is encrypted with AES-256-GCM under `DEVICE_CREDENTIALS_KEY`, the
same key that protects device passwords, and is decrypted only to check a code.

**Why:** Unlike a password, the server must read the secret back, so it cannot
be hashed. Encrypting it means a copy of the database alone — a stolen backup —
does not let anyone make valid codes. Reusing the install's existing key keeps
one key to back up and rotate.

**Enforced at:** `src/infrastructure/identity/services/AesSecretCipher.ts`
**Tests:** `tests/infrastructure/identity/services/AesSecretCipher.test.ts`

### IDN-163 — Ten single-use recovery codes, stored only as hashes

**Type:** Policy · **Status:** Active
**Layer:** Domain (aggregate)
**Since:** 2026-10-05

Turning two-factor on hands out ten recovery codes like `K7MPQ-3WXRT`, shown
once. Each replaces the app's code for one sign-in and is then gone. Only their
SHA-256 hashes are stored. Case, spaces and the dash do not matter when typing
one; the alphabet leaves out `0`, `O`, `1`, `I` and `L`.

**Why:** A lost phone is the common way to lose two-factor; recovery codes let
the person back in without waiting for an administrator (`IDN-165`). At about
50 bits each they cannot be guessed within the sign-in limits (`IDN-044`), so a
fast hash is enough — a stolen database does not reveal them.

**Enforced at:** `src/domain/identity/aggregates/User.ts` (`useRecoveryCode`),
`src/infrastructure/identity/services/HashedRecoveryCodes.ts`
**Message:** `Unknown or used recovery code`
**Tests:** `tests/domain/identity/aggregates/User.test.ts`,
`tests/infrastructure/identity/services/HashedRecoveryCodes.test.ts`

### IDN-164 — No code is accepted twice

**Type:** Invariant · **Status:** Active
**Layer:** Domain (aggregate)
**Since:** 2026-10-05

The account remembers the time step of the last code it accepted and refuses
any code from that step or an earlier one.

**Why:** A code stays valid for up to 90 seconds (`IDN-161`). Without this, a
code read over someone's shoulder or captured on its way could be replayed
within that window.

**Enforced at:** `src/domain/identity/aggregates/User.ts` (`acceptTwoFactorCode`)
**Message:** `This code was already used`
**Tests:** `tests/domain/identity/aggregates/User.test.ts`

### IDN-165 — Only a reset replaces a working two-factor setup

**Type:** Invariant · **Status:** Active
**Layer:** Domain (aggregate)
**Since:** 2026-10-05

A setup that was started but never confirmed can be started again with a new
secret. Once two-factor is on, starting again is refused; it takes a reset,
which clears the secret and the recovery codes and ends every session and
remembered browser of the account, so the person sets two-factor up again at
their next sign-in. Only an administrator runs a reset (`IDN-172`).

**Why:** If a signed-in session could swap the secret, a stolen session would
become permanent access with the thief's own phone.

**Enforced at:** `src/domain/identity/aggregates/User.ts` (`startTwoFactorSetup`, `resetTwoFactor`)
**Message:** `Two-factor sign-in is already on`
**Tests:** `tests/domain/identity/aggregates/User.test.ts`

### IDN-166 — A right password opens the two-factor step, never a session

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-05

Login no longer returns a session. A right password answers with a challenge
token (`IDN-167`) and which step comes next: `verify` when the account has
two-factor on, `setup` when it does not yet. Every role takes the same path,
the vendor account included. The right password does not clear the count of
failures (`IDN-044`); only the right code does.

An account that has not set two-factor up yet is enrolled by whoever signs in
with its password first. That window closes once the owner sets it up; an
administrator's reset opens it again.

**Why:** A password alone is what phishing pages and leaked password lists
deliver. With a code from a phone on top, a stolen password no longer opens
the dashboard. Leaving the count for the code to clear stops someone who has
the password from wiping their wrong codes with it.

**Enforced at:** `src/application/identity/use-cases/LoginUseCase.ts`,
`src/application/identity/services/SignInSteps.ts` (`challenge`)
**Tests:** `tests/application/identity/use-cases/LoginUseCase.test.ts`,
`tests/integration/use-cases/identity/LoginUseCase.integration.test.ts`,
`tests/integration/auth.routes.test.ts`

### IDN-167 — A challenge lasts five minutes and opens only its own step

**Type:** Invariant · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-10-05

A challenge is a signed token like a session's, carrying the user id, the
token version and a `kind`: `two-factor` for the code step, `two-factor-setup`
for setup. It expires after five minutes. It is sent as the Bearer token of
the two-factor routes. A session token is refused there, a challenge is
refused everywhere a session is expected, and a challenge of one kind does not
open the other step. Like a session (`IDN-065`), a challenge stops working when
the account is disabled or its sessions are ended.

**Why:** Without the kind, a token proving only the password would pass the
session check, and two-factor would stop nothing. Five minutes is enough to
open the app and type a code.

**Enforced at:** `src/infrastructure/identity/services/JwtTokenService.ts` (`verify`, `verifyChallenge`),
`src/application/identity/services/SignInSteps.ts` (`open`)
**Message:** `Sign-in step expired. Sign in again.` (`401`)
**Tests:** `tests/infrastructure/identity/services/JwtTokenService.test.ts`,
`tests/integration/use-cases/identity/StartTwoFactorSetupUseCase.integration.test.ts`,
`tests/integration/auth.routes.test.ts`

### IDN-168 — Setup hands out a new secret and the link the app scans

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-05

`POST /api/auth/two-factor/setup` makes a new secret, stores it encrypted
(`IDN-162`) and returns it in plain text once, with the `otpauth://` link the
QR code encodes. The app shows the account as `Mi Red Control (email)`.
Starting again before confirming replaces the secret; once two-factor is on,
starting again is refused (`IDN-165`).

**Why:** The person needs the secret exactly once, to put it in their app.
After that the server only ever needs it to check codes.

**Enforced at:** `src/application/identity/use-cases/StartTwoFactorSetupUseCase.ts`
**Message:** `Two-factor sign-in is already on` (`409`)
**Tests:** `tests/application/identity/use-cases/StartTwoFactorSetupUseCase.test.ts`,
`tests/integration/use-cases/identity/StartTwoFactorSetupUseCase.integration.test.ts`,
`tests/integration/auth.routes.test.ts`

### IDN-169 — The first code turns two-factor on and finishes the sign-in

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-05

`POST /api/auth/two-factor/setup/confirm` checks the code against the secret
from setup. A right code turns two-factor on (`IDN-160`), clears the failure
count, and answers with the session and the ten recovery codes, which are
never shown again. A wrong code counts as a failed sign-in (`IDN-044`).

**Why:** Ending setup with a session saves the person a second sign-in.
Showing the recovery codes at that moment is the only chance to see them,
because only their hashes are stored (`IDN-163`).

**Enforced at:** `src/application/identity/use-cases/ConfirmTwoFactorSetupUseCase.ts`
**Message:** `Invalid code` (`401`), `Two-factor setup has not been started` (`409`)
**Tests:** `tests/application/identity/use-cases/ConfirmTwoFactorSetupUseCase.test.ts`,
`tests/integration/use-cases/identity/ConfirmTwoFactorSetupUseCase.integration.test.ts`,
`tests/integration/auth.routes.test.ts`

### IDN-170 — A code from the app, or one recovery code, finishes the sign-in

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-05

`POST /api/auth/two-factor/verify` takes either `code` or `recoveryCode`,
never both. A right answer clears the failure count and returns the session.
A wrong code, a code already used (`IDN-164`) and an unknown or spent
recovery code all count as a failed sign-in (`IDN-044`) and answer the same
way. While the account is paused, the answer is `429` before any code is
checked. If the used code cannot be saved, no session is given.

**Why:** A replayed code comes from someone who saw it, so it is treated as
an attack, not a typo. Refusing the session when the save fails keeps a code
or a recovery code from working twice.

**Enforced at:** `src/application/identity/use-cases/VerifyTwoFactorUseCase.ts`,
`src/presentation/http/validation/auth.schemas.ts`
**Message:** `Invalid code` (`401`)
**Tests:** `tests/application/identity/use-cases/VerifyTwoFactorUseCase.test.ts`,
`tests/integration/use-cases/identity/VerifyTwoFactorUseCase.integration.test.ts`,
`tests/integration/auth.routes.test.ts`

### IDN-171 — A browser can skip the code for 30 days

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-05

Sending `rememberBrowser: true` with the code (`IDN-169`, `IDN-170`) adds a
`trustedBrowserToken` to the answer. Sent back with the email and password at
login, it signs in straight away, with no code, and clears the failure count.
It is a signed token like a challenge (`IDN-167`) with the kind
`trusted-browser`, valid 30 days from the code that made it; it is never a
session and never opens a two-factor step. It names the account and its token
version, so anything that ends the account's sessions (`IDN-065`) — a new
password, a role change, disabling, a two-factor reset — forgets every
remembered browser too. A token that no longer fits leads to the code step as
usual. The password is always checked.

**Why:** Asking a technician for a code every day on the office computer
teaches them to resent it. A stolen laptop with a remembered browser still
needs the password, and the administrator can end it at once by changing the
password or resetting two-factor.

**Enforced at:** `src/application/identity/services/SignInSteps.ts` (`session`, `remembers`),
`src/application/identity/use-cases/LoginUseCase.ts`,
`src/infrastructure/identity/services/JwtTokenService.ts`
**Tests:** `tests/application/identity/use-cases/LoginUseCase.test.ts`,
`tests/application/identity/use-cases/VerifyTwoFactorUseCase.test.ts`,
`tests/application/identity/use-cases/ConfirmTwoFactorSetupUseCase.test.ts`,
`tests/infrastructure/identity/services/JwtTokenService.test.ts`,
`tests/integration/use-cases/identity/LoginUseCase.integration.test.ts`,
`tests/integration/auth.routes.test.ts`

### IDN-172 — An administrator resets a lost two-factor; only the vendor resets an administrator's

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-05

`POST /api/users/:id/two-factor/reset` (`manage-users`) clears the account's
two-factor and ends its sessions and remembered browsers (`IDN-165`); the
person sets it up again at their next sign-in. An `ADMIN` account can be reset
only by the vendor, and nobody resets the vendor account (`IDN-141`). An
account that never started setup has nothing to reset.

**Why:** Someone who lost both their phone and their recovery codes needs a
way back in. Keeping administrators' resets with the vendor means one stolen
administrator session cannot strip the second factor from the other
administrators, or from itself, and the vendor stays reachable for the case
where the customer's only administrator is the one locked out.

**Enforced at:** `src/application/identity/use-cases/ResetTwoFactorUseCase.ts`,
`src/presentation/http/routes/user.routes.ts`
**Message:** `Only the vendor can reset an administrator's two-factor sign-in` (`403`),
`The vendor account is managed by the vendor` (`403`),
`Two-factor sign-in is not on` (`409`)
**Tests:** `tests/application/identity/use-cases/ResetTwoFactorUseCase.test.ts`,
`tests/integration/use-cases/identity/ResetTwoFactorUseCase.integration.test.ts`,
`tests/integration/user.routes.test.ts`

### IDN-173 — Every two-factor reset is announced in the install's alert chat

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-05

Each reset sends one alert to the install's own Telegram chat naming the
account and who reset it. It has no device, so quiet hours do not apply; it
can be muted like any other type (`two_factor_reset`).

**Why:** A reset followed by a sign-in with a known password is how an
insider, or someone with a stolen administrator session, would take over an
account. The people who run the install should hear of every one, so an
unexpected reset is noticed the same day.

**Enforced at:** `src/domain/identity/aggregates/User.ts` (`UserTwoFactorResetEvent`),
`src/application/notifications/event-handlers/UserTwoFactorResetNotificationHandler.ts`
**Tests:** `tests/domain/identity/aggregates/User.test.ts`,
`tests/application/notifications/event-handlers/UserTwoFactorResetNotificationHandler.test.ts`,
`tests/application/identity/use-cases/ResetTwoFactorUseCase.test.ts`
