# Installation — Business Rules

What one install of the backend runs. The product is sold to other ISPs, one
backend and database per customer (ADR 0002), and not every customer buys
every part of it: the first pilot is monitoring only. These rules decide which
parts an install switches on, what the parts that stay on see when their
neighbours are off, what happens when the customer stops paying, and how it
sits behind the proxy that publishes it.

This is not a bounded context. It owns no aggregate and no data; it is the
composition root's policy, enforced in `src/infrastructure/di/` and
`src/presentation/http/routes/index.ts`.

Format and conventions: [README.md](README.md).

## ID ranges

| Range                 | Area            |
| --------------------- | --------------- |
| `INS-001` … `INS-019` | Module switches |
| `INS-020` … `INS-039` | Subscription and the vendor's settings |
| `INS-040` … `INS-059` | Hosting         |

## Layer coverage

| Layer                        | Rules |
| ---------------------------- | ----- |
| Domain                       | 1     |
| Application (use case)       | 5     |
| Infrastructure (composition) | 15    |
| Infrastructure               | 1     |
| Presentation                 | 6     |

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

### INS-009 — Every signed-in user can read what the install runs

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (composition) · Presentation
**Since:** 2026-09-29 · **Revised:** 2026-09-30

`GET /api/installation` answers, for any role, which optional modules are on,
whether the server is on the monitored network (`SERVER_ON_SITE`, INS-041),
whether agents can be paired (`AGENT_PUBLIC_URL`, AGT-007), and whether agent
installers can be downloaded (`INSTALLERS_DIR`, INS-042). The answer is
settled when the backend starts, from the same settings that decide what it
runs, so it cannot disagree with them. It sits behind the subscription guard
like every other route (INS-025): a locked install shows only its lock screen.

**Why:** A disabled module's routes answer 404 (INS-005), and an off-site
server refuses some actions with 409 (WLS-029, DEV-171). The dashboard should
not find that out by clicking: reading the settings once lets it hide the
menus and buttons the install does not offer, so a customer on a
monitoring-only plan never sees billing or quoting.

**Enforced at:** `src/infrastructure/di/container.ts` (`installationController`), `src/presentation/http/routes/installation.routes.ts`
**Reached from:** `GET /api/installation`
**Tests:** `tests/integration/installation.routes.test.ts`

---

## Subscription

A customer install pays monthly (ADR 0002, R17). The vendor records what has
been paid for in environment variables; there is no screen for it. When a
payment is missed the install escalates in stages — full service during grace,
then read-only, then locked — and tells the customer every day on the way.
Nothing is ever deleted. The install knows only its own terms; how payments
are recorded across customers is a separate decision.

| Stage       | Dashboard             | Agents, polling, jobs | Alerts | Reminder       |
| ----------- | --------------------- | --------------------- | ------ | -------------- |
| `ACTIVE`    | Full                  | Running               | Sent   | Last 5 days    |
| `GRACE`     | Full                  | Running               | Sent   | Daily          |
| `READ_ONLY` | Reads only (402)      | Stopped               | None   | Daily          |
| `LOCKED`    | Status and login only | Stopped               | None   | Once, that day |

### INS-020 — A lapsed subscription escalates from grace to read-only to locked

**Type:** Policy · **Status:** Active
**Layer:** Domain · Application
**Since:** 2026-09-29

The stage follows from the terms and the clock alone: `ACTIVE` until the paid
period ends, `GRACE` for the grace days after that, `READ_ONLY` for the
read-only days after the grace, `LOCKED` from then on. A stage of zero days is
skipped. An install with no terms is `NOT_ENFORCED`. `GRACE` changes nothing
but the reminders; what `READ_ONLY` and `LOCKED` change is set out in
`INS-022` … `INS-027`. Paying again — a new date and a restart — resumes
everything.

**Why:** ADR 0002, R17 asks for read-only, never deletion; the vendor asked
for more pressure than that (2026-09-29). Stopping the service in steps gives
the customer a visible warning before losing the dashboard, and keeping the
data means paying again is all it takes to come back.

**Enforced at:** `src/domain/shared/value-objects/SubscriptionTerms.ts`, `src/application/shared/use-cases/GetSubscriptionStatusUseCase.ts`
**Tests:** `tests/domain/shared/value-objects/SubscriptionTerms.test.ts`, `tests/application/shared/use-cases/GetSubscriptionStatusUseCase.test.ts`, `tests/integration/use-cases/shared/GetSubscriptionStatusUseCase.integration.test.ts`

### INS-021 — The terms are the last paid day and two stage lengths, set by the vendor

**Type:** Validation · **Status:** Active
**Layer:** Domain · Infrastructure (composition)
**Since:** 2026-09-29 · **Revised:** 2026-09-30 (set from the dashboard, INS-028)

The last day paid for is a `YYYY-MM-DD` date, covered to its end in Colombian
time (UTC−5). The grace days (default 3) and read-only days (default 7) are
whole numbers from 0 to 90, checked even while no date is set. With no date
nothing is enforced — Insetel's own install sets none. The vendor sets them
from its settings (INS-028), read on every status check, so a renewal applies
at once; until the first save they come from `SUBSCRIPTION_PAID_UNTIL`,
`SUBSCRIPTION_GRACE_DAYS` and `SUBSCRIPTION_READ_ONLY_DAYS` (INS-029), where a
date that is not a real calendar day, or a stage length outside the range,
stops the boot.

**Why:** The vendor, not the customer, controls billing. Failing the boot on a
typo is safer than guessing: a wrong guess either cuts off a paying customer
or never cuts off anyone. The whole last day is covered so "paid until the
31st" means what it says.

**Enforced at:** `src/domain/shared/value-objects/VendorSettings.ts` (`subscriptionTerms`), `src/domain/shared/value-objects/SubscriptionTerms.ts`, `src/infrastructure/di/vendorSettingsDefaults.ts`
**Tests:** `tests/domain/shared/value-objects/VendorSettings.test.ts`, `tests/infrastructure/di/vendorSettingsDefaults.test.ts`, `tests/domain/shared/value-objects/SubscriptionTerms.test.ts`, `tests/integration/use-cases/shared/GetSubscriptionStatusUseCase.integration.test.ts`

### INS-022 — A read-only or locked install refuses its agents

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-09-29

From `READ_ONLY` on, an agent's hello is answered by closing the connection
with code 4003 (`SUBSCRIPTION_EXPIRED`) before anything is recorded — not even
its last contact. An agent already connected when the grace ends is closed the
same way within a minute. The agent is expected to wait and retry hourly. If
the status cannot be read, agents are let in.

**Why:** No results means no new state, history or alerts from the agents.
Recording nothing lets the agent go offline in the usual way, so its devices
show as unknown (`MON-006`) rather than as they were last seen. A distinct
close code tells the agent — and whoever looks at it — why it is idle.

**Enforced at:** `src/presentation/ws/agent/AgentSession.ts`
**Tests:** `tests/integration/agent-gateway.test.ts`

### INS-023 — A read-only or locked install sends no alerts

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (composition)
**Since:** 2026-09-29

From `READ_ONLY` on, every outbound alert is withheld: device and wireless
alerts, recoveries, agent offline and back-online messages, and the vendor's
copy of them. Alerts are still recorded, and a withheld publish counts as a
deliberate suppression like quiet hours or a mute, so it is not logged as a
failure and a down alert still open when payment resumes is sent on the next
scan. If the status cannot be read, the alert is sent. Subscription reminders
(`INS-027`) are not alerts and are not withheld.

**Why:** A monitoring system that has stopped alerting is the clearest sign
the service has lapsed. Failing open keeps a configuration problem from ever
silencing a paying customer.

**Enforced at:** `src/infrastructure/notifications/SubscriptionAlertPublisher.ts`, `src/application/shared/interfaces/IAlertPublisher.ts` (`isSuppressedPublish`), `src/infrastructure/di/container.ts`
**Tests:** `tests/infrastructure/notifications/SubscriptionAlertPublisher.test.ts`

### INS-024 — Every role can read the subscription status, even when locked

**Type:** Policy · **Status:** Active
**Layer:** Presentation · Application
**Since:** 2026-09-29

`GET /api/subscription` returns the stage, when the paid period ends, when
the grace ends, when the dashboard locks, and whether the install is
read-only or locked, to any signed-in user in every stage.

**Why:** The dashboard shows a warning during grace, a notice while read-only
and a lock screen once locked, to whoever is looking at it; it has to be able
to ask in every stage.

**Enforced at:** `src/presentation/http/routes/subscription.routes.ts`, `src/presentation/http/routes/index.ts`, `src/application/shared/use-cases/GetSubscriptionStatusUseCase.ts`
**Tests:** `tests/integration/subscription.routes.test.ts`

### INS-025 — Read-only refuses every write; locked refuses everything but signing in and the status

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-09-29

While `READ_ONLY`, every `/api` request other than `GET`, `HEAD` or `OPTIONS`
is answered `402`, whatever the role, and so is pairing a new agent
(`POST /agent/v1/enroll`). While `LOCKED`, every `/api` request is answered
`402` except the `/api/auth` routes and `GET /api/subscription`. The check
runs ahead of authentication, so an anonymous request to a locked install
also gets `402`. If the status cannot be read, the request goes through.

**Why:** Read-only lets the customer see what they are about to lose; locked
takes it away without deleting it. Signing in and the status stay open so the
dashboard can explain why. `402 Payment Required` tells the frontend exactly
which screen to show.

**Enforced at:** `src/presentation/http/middleware/subscriptionGuard.ts`, `src/presentation/http/routes/index.ts`
**Tests:** `tests/presentation/http/middleware/subscriptionGuard.test.ts`, `tests/integration/subscription.routes.test.ts`

### INS-026 — A read-only or locked install measures nothing and runs no background jobs

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (composition)
**Since:** 2026-09-29

From `READ_ONLY` on, in-process ICMP polling, wireless polling, data
retention, the overdue down-alert scan and suspension reconciliation are
stopped — at boot if the install starts that way, and within a minute if the
grace ends while it runs. Agent liveness keeps running so refused agents go
offline and their devices read as unknown. If the status cannot be read at
boot the jobs start; a failed check later leaves them as they are.

**Why:** The vendor asked that nothing keep working for an install that does
not pay (2026-09-29). Data retention stops too, because purging history
during a lapse would break "nothing is deleted": the customer comes back to
everything they had.

**Enforced at:** `src/infrastructure/installation/SubscriptionJobSupervisor.ts`, `src/infrastructure/di/container.ts`, `src/main.ts`
**Tests:** `tests/infrastructure/installation/SubscriptionJobSupervisor.test.ts`

### INS-027 — The customer is reminded every day before anything stops

**Type:** Policy · **Status:** Active
**Layer:** Application · Infrastructure (composition)
**Since:** 2026-09-29

One Telegram message a day, from 9:00 Colombian time, to the install's own
chat: in the 5 days before the paid period ends, every day of grace and of
read-only — each saying what happens next and when — and once on the day it
locks. Reminders go straight to the chat, not through the alert publisher, so
they arrive while alerts are silenced. The day already reminded is kept in
memory: a restart after 9:00 can repeat that day's message. A failed send is
retried on the next check, every 15 minutes.

**Why:** Non-payment should never come as a surprise. Each message names the
next stage and its date, so the customer knows exactly how long they have.

**Enforced at:** `src/application/notifications/use-cases/SendSubscriptionReminderUseCase.ts`, `src/infrastructure/notifications/orchestrator/SubscriptionReminderOrchestrator.ts`
**Tests:** `tests/application/notifications/use-cases/SendSubscriptionReminderUseCase.test.ts`, `tests/infrastructure/notifications/orchestrator/SubscriptionReminderOrchestrator.test.ts`, `tests/integration/use-cases/notifications/SendSubscriptionReminderUseCase.integration.test.ts`

---

## Hosting

### INS-028 — The vendor sets its chat, the subscription, retention and the install's integrations from the dashboard

**Type:** Invariant · **Status:** Active
**Layer:** Domain · Application · Infrastructure
**Since:** 2026-09-30 · **Revised:** 2026-09-30 (issuer, WhatsApp, enforcement router)

The vendor's settings for an install are stored together and replaced as a
whole:

| Setting                             | Allowed values                                         | Read by                                   |
| ----------------------------------- | ------------------------------------------------------ | ----------------------------------------- |
| `vendorTelegramChatId`              | numeric chat id or `@channel`; `null` = none           | agent-health alerts to the vendor (AGT-023) |
| `subscriptionPaidUntil`             | real `YYYY-MM-DD` date; `null` = not enforced          | subscription status (INS-020, INS-021)    |
| `subscriptionGraceDays`             | whole number 0–90                                      | subscription status                       |
| `subscriptionReadOnlyDays`          | whole number 0–90                                      | subscription status                       |
| `pingResultRetentionDays`           | whole number 1–3650                                    | daily purge and the vendor's manual purge |
| `alertRetentionDays`                | whole number 1–3650                                    | same                                      |
| `wirelessSnapshotRetentionDays`     | whole number 1–3650                                    | same                                      |
| `wirelessAlertRecordRetentionDays`  | whole number 1–3650                                    | same                                      |
| `issuer`                            | all eight fields (BIL-232); `null` = not configured    | every cuenta de cobro PDF                  |
| `whatsApp`                          | phone number id, template, language, API version; `null` = not configured | every subscriber and technician notice (NOT-115) |
| `enforcementRouter`                 | device id and API port 1–65535; `null` = not configured | every enforcement operation (SVC-060)     |

Each is read where it is used, every time: the subscription on every status
check, the vendor chat on every agent-health alert, the windows on every
purge, the issuer on every PDF, WhatsApp on every send, the router on every
enforcement operation. A save therefore applies with no restart — a payment recorded here
unlocks a locked install on its next request. If the settings cannot be read
the subscription fails open (the guard of INS-025 lets the request through) and the
purge skips that run. Secrets — bot tokens, the WhatsApp access token — the
issuer's logo file, and how long a deleted device stays restorable
(`DEVICE_DELETE_GRACE_DAYS`) stay in the environment.

**Why:** These are the levers the vendor pulls for each customer — recording a
payment, keeping data for as long as the customer paid for, getting alerts
about their agents — and each needed shell access to the host and a restart.
The retention windows are the vendor's, not the customer's, because on an
install the vendor hosts they decide how much of the vendor's disk the
customer uses.

**Enforced at:** `src/domain/shared/value-objects/VendorSettings.ts`, `src/application/shared/use-cases/UpdateVendorSettingsUseCase.ts`, `src/application/shared/use-cases/GetSubscriptionStatusUseCase.ts`, `src/application/shared/use-cases/TriggerDataRetentionUseCase.ts`, `src/infrastructure/retention/DataRetentionOrchestrator.ts`, `src/infrastructure/persistence/PrismaVendorSettingsRepository.ts`, `src/infrastructure/di/container.ts`
**Reached from:** `GET`, `PUT /api/installation/settings`
**Tests:** `tests/domain/shared/value-objects/VendorSettings.test.ts`, `tests/application/shared/use-cases/VendorSettingsUseCases.test.ts`, `tests/application/shared/use-cases/GetSubscriptionStatusUseCase.test.ts`, `tests/application/shared/use-cases/TriggerDataRetentionUseCase.test.ts`, `tests/infrastructure/retention/DataRetentionOrchestrator.test.ts`, `tests/integration/use-cases/shared/UpdateVendorSettingsUseCase.integration.test.ts`, `tests/integration/vendor-settings.routes.test.ts`

### INS-029 — Until the vendor saves them, its settings come from the env

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (composition)
**Since:** 2026-09-30

With nothing saved, the settings are `TELEGRAM_VENDOR_CHAT_ID` (unset = none),
`SUBSCRIPTION_PAID_UNTIL` (unset = not enforced), `SUBSCRIPTION_GRACE_DAYS`
(3), `SUBSCRIPTION_READ_ONLY_DAYS` (7), `PING_RESULT_RETENTION_DAYS` (30),
`ALERT_RETENTION_DAYS` (90), `WIRELESS_SNAPSHOT_RETENTION_DAYS` (30),
`WIRELESS_ALERT_RECORD_RETENTION_DAYS` (90), the `ISSUER_*` variables
(BIL-232), the non-secret `WHATSAPP_*` ones (NOT-115) and
`ENFORCEMENT_ROUTER_DEVICE_ID` / `ENFORCEMENT_ROUTER_API_PORT` (SVC-060). An
env value that INS-028 would refuse stops the boot, naming the variable, and so
does a group given only in part. Once saved, the stored values win
and the env ones are ignored. The table holds at most one row.

**Why:** Every install ran on these env values before; reading them as defaults
means an upgrade changes nothing until the vendor saves. Naming the variable in
the boot error tells the vendor which line to fix.

**Enforced at:** `src/infrastructure/di/vendorSettingsDefaults.ts`, `src/infrastructure/persistence/PrismaVendorSettingsRepository.ts`
**Tests:** `tests/infrastructure/di/vendorSettingsDefaults.test.ts`, `tests/integration/use-cases/shared/GetVendorSettingsUseCase.integration.test.ts`, `tests/integration/use-cases/shared/GetSubscriptionStatusUseCase.integration.test.ts`

### INS-030 — Only the vendor reads or changes its settings, even on a locked install

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-09-30

`GET` and `PUT /api/installation/settings` need `manage-installation`
(VENDOR, IDN-033); the customer's `ADMIN` answers `403` on both. The route is
exempt from the subscription guard (INS-025), so it answers on a read-only or
locked install too.

**Why:** The subscription terms and the vendor's own chat are not the
customer's business, and changing them is the vendor's lever. Exempting the
route is what lets the vendor record a payment on an install that is locked
for non-payment; the role check still keeps everyone else out.

**Enforced at:** `src/presentation/http/routes/vendor-settings.routes.ts`, `src/presentation/http/routes/index.ts` (guard exemption)
**Tests:** `tests/integration/vendor-settings.routes.test.ts`

### INS-040 — Behind a proxy, only the proxy named in `TRUST_PROXY` may say who the caller is

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (composition)
**Since:** 2026-09-29

`TRUST_PROXY` names the proxy allowed to report the caller's real address in
`X-Forwarded-For`: `loopback` when `cloudflared` (Cloudflare Tunnel) runs on
the same machine, or a hop count, or a comma-separated list of addresses and
CIDRs. Unset trusts no proxy. `true`, which would trust any caller's claim
about itself, stops the boot, and so does an address Express cannot read.

**Why:** Limits on callers who are not signed in key on the caller's
address; agent enrollment, for one, allows 10 attempts per address per 15
minutes (`AGT-008`). Behind a tunnel every request arrives from the
tunnel, so without this all agents and all users would share one limit, and
one mistyped pairing key could lock every other installer out. Trusting
everyone instead would let an attacker set a fresh address on each guess.

**Enforced at:** `src/infrastructure/di/trustProxy.ts`, `src/main.ts`
**Tests:** `tests/infrastructure/di/trustProxy.test.ts`

### INS-041 — `SERVER_ON_SITE` says whether the server can reach the devices itself

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (composition)
**Since:** 2026-09-29

`SERVER_ON_SITE` is `true` or `false`, case-insensitive. Unset means `true`,
which is how every install ran before agents. Set it to `false` when the
backend is hosted off site (a VPS) and its devices are reached through
on-site agents. Anything else stops the boot.

Off site, the server talks to no device: it pings nothing (MON-023), gives no
wireless polling, reboot or link diagnosis (WLS-029), and refuses the network
scan (DEV-171). Devices are measured only by their agents; a device with no
agent shows as UNKNOWN (MON-006). On site, the server pings every device with
no agent, and ping of a device behind an agent is the agent's either way
(MON-022).

**Why:** The backend cannot find out by itself whether a private address is
reachable: a timeout looks the same as a dead radio. The vendor who installs it
knows where it runs, so the install states it once. Defaulting to `true` keeps
the existing on-site install unchanged, and it continues to use these features
for devices it moves behind an agent.

**Enforced at:** `src/infrastructure/di/serverOnSite.ts`, `src/infrastructure/di/container.ts`
**Tests:** `tests/infrastructure/di/serverOnSite.test.ts`, `tests/integration/wireless.routes.test.ts`, `tests/integration/scan.routes.test.ts`, `tests/integration/polling.routes.test.ts`

### INS-042 — Agent installers are served from the folder in `INSTALLERS_DIR`

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (composition) · Application (use case) · Presentation
**Since:** 2026-09-30

`INSTALLERS_DIR` is an absolute path; a relative one stops the boot. Unset, the
install offers no downloads: `installersAvailable` is `false` and both installer
routes answer `503`. Set, any signed-in role lists the installers
(`GET /api/installation/installers`, newest first, with platform, version and
size) and downloads one (`GET /api/installation/installers/:fileName`).

The folder is read on every request, so an installer copied in is offered at
once and the folder may be created or mounted after the backend starts; one
that cannot be read answers `503`. Both routes are reads, so they keep working
while the subscription is read-only, and answer `402` once it is locked, like
every other route (INS-025).

**Why:** The installer is what a customer's technician runs on the site PC, and
it is useless without a pairing key only the vendor can issue (IDN-033), so
handing it to any signed-in user gives nothing away. Serving it from a folder
the vendor controls — one shared folder for every install on a host — means a
new agent version reaches every customer by copying one file, with no deploy.
Keeping downloads open in read-only mode lets a customer who has fallen behind
still repair a broken agent, which is what keeps their monitoring honest while
they pay.

**Enforced at:** `src/infrastructure/di/installersDir.ts`,
`src/infrastructure/di/container.ts`,
`src/application/shared/use-cases/ListInstallersUseCase.ts`,
`src/application/shared/use-cases/GetInstallerUseCase.ts`,
`src/presentation/http/routes/installation.routes.ts`,
`src/presentation/http/controllers/InstallationController.ts`
**Message:** `Installer downloads are not configured on this install` /
`Installer folder cannot be read: …` / `INSTALLERS_DIR: expected an absolute path, got "<value>"`
**Tests:** `tests/infrastructure/di/installersDir.test.ts`,
`tests/application/shared/use-cases/ListInstallersUseCase.test.ts`,
`tests/application/shared/use-cases/GetInstallerUseCase.test.ts`,
`tests/integration/use-cases/shared/ListInstallersUseCase.integration.test.ts`,
`tests/integration/use-cases/shared/GetInstallerUseCase.integration.test.ts`,
`tests/integration/installation.routes.test.ts`

### INS-043 — Only installer files in the folder itself can be downloaded

**Type:** Invariant · **Status:** Active
**Layer:** Infrastructure · Presentation
**Since:** 2026-09-30

A file is an installer when its name ends in `.exe` or `.msi` (Windows) or
`.tar.gz` (Linux), case-insensitive, it is a regular file, and its name does not
start with `.`. Everything else in the folder — notes, subfolders, hidden
files — is neither listed nor served. A download is found by matching the
requested name exactly against the folder's own listing; the name as sent is
never joined onto a path. A name containing `/` or `\`, or starting with `.`,
is refused with `400` before that.

**Why:** The folder is shared and edited by hand, so it will hold other things,
and a download route is the classic way to read files a server never meant to
serve (`../../.env`). Matching against the listing, rather than cleaning up the
requested path, means no spelling of a path can reach outside the folder or a
file the listing did not offer.

**Enforced at:** `src/infrastructure/installation/FileSystemInstallerStore.ts`,
`src/presentation/http/validation/installation.schemas.ts`
**Message:** `Installer not found: <fileName>` (404) / `Invalid installer file name` (400)
**Tests:** `tests/infrastructure/installation/FileSystemInstallerStore.test.ts`,
`tests/integration/use-cases/shared/GetInstallerUseCase.integration.test.ts`,
`tests/integration/installation.routes.test.ts`
