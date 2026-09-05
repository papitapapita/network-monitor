# Business Rules — Wireless Monitoring

What a Ubiquiti AirOS radio reports and what the system does with it: the
per-device polling configuration (WirelessDeviceConfig), the metrics captured on
each cycle (WirelessSnapshot), the thirteen rules that turn those metrics into
alerts, and the open/clear lifecycle of each alert (WirelessAlertRecord).

Conventions, rule types and the ID scheme are in [README.md](README.md).

**ID ranges**

| Range                 | Subject                            |
| --------------------- | ---------------------------------- |
| `WLS-001` – `WLS-019` | Wireless configuration             |
| `WLS-020` – `WLS-039` | Polling schedule and execution     |
| `WLS-040` – `WLS-059` | Collection from the radio          |
| `WLS-060` – `WLS-079` | Metric and client-entry validation |
| `WLS-080` – `WLS-119` | Alert evaluation                   |
| `WLS-120` – `WLS-139` | Alert lifecycle and notification   |
| `WLS-140` – `WLS-159` | Queries and HTTP surface           |
| `WLS-160` – `WLS-179` | Retention                          |

Rationales marked _(inferred)_ were reconstructed from the code, not stated by
the business. They are the ones to read critically.

Every rule carries two extra fields. **Layer** names the layer that actually
enforces it, so a rule sitting outside the domain is visible without opening the
code. **Tests** lists the suites covering it — `_none_` means genuinely nothing
covers it, which is a gap rather than an omission in this document.

## What lives in device-inventory instead

Two rules decide whether a device may be monitored wirelessly at all. Both are
enforced on the `Device` aggregate, so they stay in
[device-inventory.md](device-inventory.md) and are only consumed here:

- **DEV-062** — only `WIRELESS_CPE` and `ACCESS_POINT` devices may hold a
  wireless configuration. `CreateWirelessConfigUseCase` calls
  `device.canHaveWirelessConfig()` and refuses when it returns false.
- **DEV-065** — a device's category cannot change while it has a wireless
  configuration, which is what keeps [WLS-003](#wls-003--radio-mode-is-derived-from-the-devices-category-never-supplied)'s
  derived value from silently going stale.

`WLS-003` is the former `DEV-064`, superseded on 2026-08-03.

---

## Wireless configuration

### WLS-001 — A device has at most one wireless configuration

**Type:** Invariant · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-03

`CreateWirelessConfigUseCase` looks the device up by id before inserting and
refuses when a configuration already exists. Every other operation — read,
update, delete, poll, reboot — reaches the configuration through
`findByDeviceId`, so the one-to-one relationship is assumed everywhere.

**Why:** The configuration _is_ the device's polling identity: its IP, its
interval, its radio mode. A second row would mean two schedules for one radio
and two `lastPolledAt` clocks, and `findByDeviceId` would have to pick one
arbitrarily. _(inferred)_

**Enforced at:** `src/application/wireless-monitoring/use-cases/CreateWirelessConfigUseCase.ts:112`
**Reached from:** `POST /api/devices/:id/wireless-config`
**Message:** `Wireless config already exists for this device`
**Tests:** `tests/application/wireless-monitoring/use-cases/CreateWirelessConfigUseCase.test.ts`, `tests/integration/wireless-config.routes.test.ts`

### WLS-002 — The device's model must be marked wireless-capable

**Type:** Validation · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-03

Beyond the category check (DEV-062), the device's `DeviceModel` must have
`isWireless` set. A model that is not wireless-capable is refused with a message
naming the fix.

**Why:** Category says what role the unit plays in the network; `isWireless`
says whether the hardware has a radio at all. Both can disagree — a model
mis-registered as non-wireless would otherwise be scheduled for AirOS polls that
can only fail. The error names the remedy because the fix is on the model, not
on the request being rejected.

**Enforced at:** `src/application/wireless-monitoring/use-cases/CreateWirelessConfigUseCase.ts:101`
**Reached from:** `POST /api/devices/:id/wireless-config`
**Message:** `Device model is not wireless-capable. Mark the device model as wireless before configuring wireless polling.`
**Tests:** `tests/application/wireless-monitoring/use-cases/CreateWirelessConfigUseCase.test.ts`

### WLS-003 — Radio mode is derived from the device's category, never supplied

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-29 · **Revised:** 2026-07-30

When a wireless configuration is created, its `deviceType` (`STATION` or
`ACCESS_POINT`) is computed from the device's category — `ACCESS_POINT` category
→ `ACCESS_POINT` radio mode, otherwise `STATION`. Given DEV-062 has already
narrowed the field to two categories, "otherwise" means `WIRELESS_CPE`. The HTTP
schema does not accept a `deviceType` field; one sent anyway is stripped and
ignored, not rejected.

**Why:** The category already encodes the distinction — an access point serves
subscribers, a wireless CPE is the station end of that same link. Accepting it a
second time as client input creates a value that can disagree with the category
it duplicates, and there is no correct answer when it does. Deriving it removes
the contradiction rather than adding a rule to detect it.

The derived value is then frozen: nothing updates `deviceType` after creation.
DEV-065 is what makes that safe — the category it was derived from cannot change
while the configuration exists.

**Enforced at:** `src/application/wireless-monitoring/use-cases/CreateWirelessConfigUseCase.ts:70`; `deviceType` absent from `src/presentation/http/validation/wireless.schemas.ts:63`
**Reached from:** `POST /api/devices/:id/wireless-config`
**Tests:** `tests/application/wireless-monitoring/use-cases/CreateWirelessConfigUseCase.test.ts`, `tests/integration/wireless-config.routes.test.ts`

**History — this rule was `DEV-064` until 2026-08-03.** It was filed under
Device Inventory because the deciding input is a device-inventory concept, but
every line that enforces it and every test that covers it lives here. The
`linkCapacityKbps` and `clientsProvisionedLimit` cross-checks it used to carry
are now [WLS-004](#wls-004--linkcapacitykbps-is-a-station-only-setting) and
[WLS-005](#wls-005--clientsprovisionedlimit-is-an-access_point-only-setting).

### WLS-004 — `linkCapacityKbps` is a STATION-only setting

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-30

A configuration whose radio mode is `ACCESS_POINT` cannot carry a link capacity,
at creation or on update. The aggregate refuses it in `create` and in
`updateLinkCapacityKbps`; the use case checks it once more against the derived
mode before the aggregate is built, so the HTTP caller gets the message without
a half-constructed config.

**Why:** Link capacity describes the throughput of one point-to-point link, which
is what the station end of a link has. An access point serves many subscribers
and has no single link whose capacity this could mean. The value feeds
[WLS-093](#wls-093--sustained-throughput-above-80-of-link-capacity-is-saturation),
so a value set on the wrong end would produce saturation alerts against a
denominator that means nothing.

**Enforced at:** `src/domain/wireless-monitoring/aggregates/WirelessDeviceConfig.ts:59` (`create`), `:136` (`updateLinkCapacityKbps`); pre-checked at `src/application/wireless-monitoring/use-cases/CreateWirelessConfigUseCase.ts:75`
**Reached from:** `create`, `updateLinkCapacityKbps`
**Message:** `linkCapacityKbps can only be set for STATION devices`
**Tests:** `tests/domain/wireless-monitoring/aggregates/WirelessDeviceConfig.test.ts`, `tests/application/wireless-monitoring/use-cases/CreateWirelessConfigUseCase.test.ts`

### WLS-005 — `clientsProvisionedLimit` is an ACCESS_POINT-only setting

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-30

The mirror of WLS-004. A `STATION` configuration cannot carry a provisioned
client limit, at creation or on update.

**Why:** Only an access point has a client roster to compare against a limit. The
value feeds [WLS-091](#wls-091--more-clients-than-provisioned-is-a-warning), which
would have nothing to count on a station.

**Enforced at:** `src/domain/wireless-monitoring/aggregates/WirelessDeviceConfig.ts:67` (`create`), `:151` (`updateClientsProvisionedLimit`); pre-checked at `src/application/wireless-monitoring/use-cases/CreateWirelessConfigUseCase.ts:83`
**Reached from:** `create`, `updateClientsProvisionedLimit`
**Message:** `clientsProvisionedLimit can only be set for ACCESS_POINT devices`
**Tests:** `tests/domain/wireless-monitoring/aggregates/WirelessDeviceConfig.test.ts`, `tests/application/wireless-monitoring/use-cases/CreateWirelessConfigUseCase.test.ts`

### WLS-162 — `parentApDeviceId` is a STATION-only, self-reference-free declared link

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-09-05

A configuration whose radio mode is `ACCESS_POINT` cannot carry a
`parentApDeviceId`, at creation or on update — the mirror of WLS-004/WLS-005.
A `STATION` config also cannot set `parentApDeviceId` to its own `deviceId`.
Both checks live in `create` and `updateParentApDeviceId`; the create use case
pre-checks the role restriction once more before the aggregate is built.

**Why:** This field is the operator's declared intent — "this CPE is meant to
sit on this AP" — kept separate from `WirelessMetrics.remoteApDeviceId`, which
is what the radio's own last poll actually reported. Only a station has a
single upstream AP to declare; an access point serves many CPEs and has no
"parent" of its own. The self-reference guard rules out a config nonsensically
claiming to be downstream of itself. The field feeds
[WLS-163](#wls-163--the-expected-clients-query-diffs-declared-stations-against-a-live-snapshot),
which needs one well-formed roster per AP, not a graph.

**Enforced at:** `src/domain/wireless-monitoring/aggregates/WirelessDeviceConfig.ts` (`create`, `updateParentApDeviceId`); pre-checked at `src/application/wireless-monitoring/use-cases/CreateWirelessConfigUseCase.ts`
**Reached from:** `create`, `updateParentApDeviceId`
**Message:** `parentApDeviceId can only be set for STATION devices` / `parentApDeviceId cannot reference itself`
**Tests:** `tests/domain/wireless-monitoring/aggregates/WirelessDeviceConfig.test.ts`, `tests/integration/wireless-config.routes.test.ts`

### WLS-006 — A polling interval is between 60 seconds and 24 hours

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

`PollingInterval` accepts whole seconds from 60 to 86400 inclusive. A
non-integer is rejected by the same branch as a too-small value. The HTTP schema
repeats the bounds so a bad request is a `400` rather than a use-case failure.

**Why:** AirOS status pages are scraped over the radio's own embedded web
server, which is a small process on a small CPU. Polling faster than once a
minute overloads it — the radio starts refusing connections, which looks like a
device fault rather than a monitoring fault. The 24-hour ceiling is the point
past which a "monitored" device is not meaningfully monitored. _(inferred, for
the ceiling)_

**Enforced at:** `src/domain/wireless-monitoring/value-objects/PollingInterval.ts:29`, `:34`; schema bounds at `src/presentation/http/validation/wireless.schemas.ts:75`, `:105`
**Reached from:** `CreateWirelessConfigUseCase`, `UpdateWirelessConfigUseCase`
**Message:** `Wireless polling interval must be at least 60 seconds` / `Wireless polling interval must not exceed 86400 seconds`
**Tests:** `tests/domain/wireless-monitoring/value-objects/PollingInterval.test.ts`

### WLS-007 — A new configuration polls hourly and is enabled

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-03

`intervalSecs` defaults to 3600 and `enabled` to `true` when the request omits
them. An explicit `false` is respected.

**Why:** Configuring wireless polling is an act of asking for wireless polling,
so the default that requires no follow-up request is the useful one. An hour is
slow enough to be safe on any radio and fast enough that a link problem is
noticed the same working day. _(inferred)_

**Enforced at:** `src/application/wireless-monitoring/use-cases/CreateWirelessConfigUseCase.ts:128` (interval), `:139` (enabled)
**Reached from:** `POST /api/devices/:id/wireless-config`
**Tests:** `tests/application/wireless-monitoring/use-cases/CreateWirelessConfigUseCase.test.ts`

### WLS-008 — Enabling or disabling polling is idempotent and raises an event

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

`enable()` on an already-enabled configuration succeeds and does nothing —
no state change, no event. The same for `disable()` on a disabled one. A real
transition raises `WirelessDeviceConfigToggledEvent` carrying the new state.
`UpdateWirelessConfigUseCase` routes the `enabled` field through these methods
rather than assigning the property, which is what keeps the event honest.

**Why:** The event says "someone turned this on", and a `PATCH` that echoes the
current value back is not that. Emitting on every write would make the event
stream unusable for anything that reacts to the transition.

**Enforced at:** `src/domain/wireless-monitoring/aggregates/WirelessDeviceConfig.ts:92` (`enable`), `:108` (`disable`)
**Reached from:** `UpdateWirelessConfigUseCase.ts:229`, and since 2026-08-13 two
device-inventory event handlers in this context —
`DeviceDeletedWirelessConfigHandler` (DEV-072) and
`DeviceStatusChangedWirelessConfigHandler` (DEV-089)
**Tests:** `tests/domain/wireless-monitoring/aggregates/WirelessDeviceConfig.test.ts`, `tests/domain/wireless-monitoring/events/WirelessDeviceConfigToggled.test.ts`

**Related:** the `enabled` flag is no longer set only by an operator. Retiring a
device disables it, and commissioning one re-enables it, per
[DEV-089](device-inventory.md) — the idempotence above is what makes those
handlers safe to re-run after a failed dispatch. Enabling through this use case
is now guarded on device eligibility (DEV-088/DEV-089); disabling never is.

### WLS-009 — The polling IP address is the configuration's, not the device's

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

`WirelessDeviceConfig` carries its own nullable `ipAddress`, validated as IPv4
or IPv6 by the shared `IPAddress` value object. It is never read from the
`Device` record, and it may be null — a configuration with no IP is legal, and
simply never becomes due (WLS-020).

**Why:** The address the management HTTP interface answers on is not always the
device's inventory address — a radio may be reached over a management VLAN while
its service address is something else. Keeping a separate field means correcting
one does not silently repoint the other. _(inferred)_

**Enforced at:** `src/domain/wireless-monitoring/aggregates/WirelessDeviceConfig.ts:23`, `:124`; parsed at `src/application/wireless-monitoring/use-cases/CreateWirelessConfigUseCase.ts:120`
**Reached from:** `CreateWirelessConfigUseCase`, `UpdateWirelessConfigUseCase`
**Message:** `Invalid IP address: <reason>`
**Tests:** `tests/application/wireless-monitoring/use-cases/UpdateWirelessConfigUseCase.test.ts`, `tests/integration/wireless-config.routes.test.ts`

### WLS-010 — An update must change at least one field

**Type:** Validation · **Status:** Active
**Layer:** Presentation (not in domain)
**Since:** 2026-08-03

`PATCH` with an empty body is a `400`. Any single recognised field satisfies it.

**Why:** An empty patch has no meaning to satisfy, and answering `200` to one
tells the caller a change landed when none did. _(inferred)_

**Enforced at:** `src/presentation/http/validation/wireless.schemas.ts:120`
**Reached from:** `PATCH /api/devices/:id/wireless-config`
**Message:** `At least one field must be provided`
**Tests:** `tests/integration/wireless-config.routes.test.ts`

### WLS-011 — Reading, updating or deleting a configuration requires it to exist

**Type:** Validation · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-03

All three use cases load by device id first and fail with the same message when
nothing is there. Delete is **not** idempotent — deleting a configuration that
does not exist is an error, not a silent success.

**Why:** These endpoints are addressed by _device_ id, not by configuration id,
so "not found" is ambiguous between "no such device" and "device has no wireless
config". The message names the second because the first is already a `400` from
the UUID schema. Delete reports rather than absorbs because an operator deleting
a configuration that was never there has a wrong device id in hand. _(inferred)_

**Enforced at:** `src/application/wireless-monitoring/use-cases/GetWirelessConfigUseCase.ts`, `UpdateWirelessConfigUseCase.ts:210`, `DeleteWirelessConfigUseCase.ts:313`
**Reached from:** `GET`, `PATCH`, `DELETE /api/devices/:id/wireless-config`
**Message:** `Wireless config not found for device`
**Tests:** `tests/application/wireless-monitoring/use-cases/GetWirelessConfigUseCase.test.ts`, `tests/application/wireless-monitoring/use-cases/DeleteWirelessConfigUseCase.test.ts`

---

## Polling schedule and execution

### WLS-020 — A device is due when its interval has elapsed since the last poll

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-03

`findAllDue` selects configurations that are `enabled`, have a non-null
`ip_address`, and whose `last_polled_at + interval_secs` has passed — or that
have never been polled at all. The arithmetic is done in PostgreSQL, not in
Node.

**Why:** Doing the comparison in SQL means the scheduler transfers only the rows
it will act on, and there is one clock involved instead of two. A never-polled
configuration is due immediately so a newly created one starts collecting
without waiting a full interval.

**Enforced at:** `src/infrastructure/wireless-monitoring/repositories/PrismaWirelessDeviceConfigRepository.ts:144`
**Reached from:** `WirelessPollingOrchestrator.pollDevices`
**Tests:** `tests/infrastructure/wireless-monitoring/persistence/PrismaWirelessDeviceConfigRepository.test.ts`

### WLS-021 — A disabled configuration is never polled on schedule

**Type:** Policy · **Status:** Active
**Layer:** Application + infrastructure
**Since:** 2026-08-03

Two independent gates. `findAllDue` filters `enabled = true`, so a disabled
configuration is never offered to the scheduler. `PollWirelessDeviceUseCase`
checks `config.enabled` again and returns `skipped: true` — a success, not a
failure — unless `forceExecution` is set.

**Why:** The second check exists because the use case is also reachable from the
manual-poll endpoint, which does not go through `findAllDue`. Reporting a skip
as success rather than an error is what lets the orchestrator treat "nothing to
do" and "did the work" the same way, and keeps a disabled device from filling
the log with failures.

**Enforced at:** `src/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.ts:111`; `src/infrastructure/wireless-monitoring/repositories/PrismaWirelessDeviceConfigRepository.ts:144`
**Reached from:** `WirelessPollingOrchestrator`, `POST /api/devices/:id/wireless/poll`
**Tests:** `tests/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.test.ts`

### WLS-022 — A device is polled at most once at a time

**Type:** Invariant · **Status:** Active
**Layer:** Application + infrastructure
**Since:** 2026-08-03

`PollWirelessDeviceUseCase` keeps an in-process set of device ids currently
being polled and returns `skipped: true` for a second concurrent request. The
orchestrator keeps its own set and filters due devices against it before
dispatching a batch.

**Why:** A poll can outlive its own interval — a radio that answers slowly, or a
60-second interval against a 10-second timeout chain. Without the guard the
scheduler would stack polls on the same radio, multiplying the load on exactly
the device that is already struggling. The two sets are deliberately separate:
the orchestrator's avoids dispatching work, the use case's protects the
manual-poll path that never touches the orchestrator.

Both are per-process. A second application instance would poll the same device
concurrently — see [G-2](#known-gaps).

**Enforced at:** `src/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.ts:72`; `src/infrastructure/wireless-monitoring/orchestrator/WirelessPollingOrchestrator.ts:85`
**Reached from:** `execute`, `WirelessPollingOrchestrator.pollDevices`
**Tests:** `tests/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.test.ts`

### WLS-023 — At most ten devices are polled concurrently

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-03

The orchestrator wakes every 10 seconds, takes the due list, and dispatches at
most `maxConcurrentPolls` (default 10) minus whatever is already in flight.
Devices that do not fit stay due and are picked up on a later tick.

**Why:** Each poll is an HTTPS round trip to a radio that may be unreachable and
will then hold its slot for the full 10-second timeout. An unbounded batch after
an outage would open one socket per configured device at once. The overflow
needs no queue because a device that was due stays due.

**Enforced at:** `src/infrastructure/wireless-monitoring/orchestrator/WirelessPollingOrchestrator.ts:89`
**Reached from:** `pollDevices`
**Tests:** `tests/infrastructure/wireless-monitoring/orchestrator/WirelessPollingOrchestrator.test.ts`

### WLS-024 — Polling requires stored credentials and a configured IP

**Type:** Validation · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-03

A poll fails — a real failure, not a skip — when the device has no credentials
row (DEV-120–DEV-132) or when the configuration's `ipAddress` is null. Reboot
applies the same two checks in the opposite order.

**Why:** Both are unrecoverable within the cycle and both are operator errors
rather than device faults, so they are reported rather than absorbed. Contrast
WLS-021: a disabled device is a deliberate state, a device configured for
polling with no way to reach it is not. _(inferred)_

**Enforced at:** `src/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.ts:131`, `:135`; `src/application/wireless-monitoring/use-cases/RebootWirelessDeviceUseCase.ts:62`, `:74`
**Reached from:** `PollWirelessDeviceUseCase`, `RebootWirelessDeviceUseCase`
**Message:** `No credentials configured for device` / `Device has no IP address configured for polling` / `Credentials not configured for device` / `Device has no IP address configured`
**Tests:** `tests/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.test.ts`, `tests/application/wireless-monitoring/use-cases/RebootWirelessDeviceUseCase.test.ts`

### WLS-025 — A manual poll runs even when polling is disabled

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-03

`TriggerWirelessPollUseCase` calls the orchestrator port with
`forceExecution: true`, which is the flag WLS-021's second gate honours. It
reaches `PollWirelessDeviceUseCase` through `IWirelessPollOrchestrator` rather
than by direct reference, so no use case calls another use case.

**Why:** The manual poll is what an operator uses to check a link they are
working on right now, including one whose scheduled polling they have
deliberately turned off. Forcing it is the whole point of the endpoint.

**Enforced at:** `src/application/wireless-monitoring/use-cases/TriggerWirelessPollUseCase.ts:35`
**Reached from:** `POST /api/devices/:id/wireless/poll`
**Tests:** `tests/application/wireless-monitoring/use-cases/TriggerWirelessPollUseCase.test.ts`

### WLS-026 — The scheduler stays quiet while the database is recovering

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-03

When `findAllDue` fails with PostgreSQL code `57P03` (`cannot_connect_now`) the
tick returns without logging. Every other failure is logged as a warning. In
both cases the orchestrator keeps running and tries again on the next tick.

**Why:** `57P03` is what PostgreSQL answers while it is still starting up. On a
restart the orchestrator would otherwise emit a warning every 10 seconds until
the database finishes recovery, burying the failures that matter. The tick
itself must not stop, because the condition is temporary by definition.

**Enforced at:** `src/infrastructure/wireless-monitoring/orchestrator/WirelessPollingOrchestrator.ts:75`
**Reached from:** `pollDevices`
**Tests:** `tests/infrastructure/wireless-monitoring/orchestrator/WirelessPollingOrchestrator.test.ts`

### WLS-027 — Shutdown waits up to 30 seconds for in-flight polls

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-03

`stop()` clears the interval immediately so no new work is dispatched, then
polls its own active set every 200 ms until it drains or 30 seconds pass,
whichever is first.

**Why:** A poll interrupted between collecting metrics and saving the snapshot
loses the cycle and can leave an alert record opened with no snapshot to explain
it. 30 seconds is three timeout chains, past which the poll is not going to
finish anyway and the shutdown matters more.

**Enforced at:** `src/infrastructure/wireless-monitoring/orchestrator/WirelessPollingOrchestrator.ts:52`
**Reached from:** `stop`
**Tests:** `tests/infrastructure/wireless-monitoring/orchestrator/WirelessPollingOrchestrator.test.ts`

### WLS-028 — A poll marks the device polled even if the snapshot fails to save

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-03

A failed snapshot save is logged as an error and the cycle continues:
`markPolled` is still called and the configuration is still written. The same
applies to a failed alert-record save. Only a collector failure aborts the
cycle.

**Why:** `lastPolledAt` schedules the next attempt (WLS-020). Leaving it
unchanged after a storage failure makes the device immediately due again, and a
persistent storage failure becomes a hot loop hammering the radio. Advancing the
clock means a failing save costs one cycle of history, not a self-inflicted
denial of service against the device.

**Enforced at:** `src/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.ts:381`, `:393`
**Reached from:** `poll`
**Tests:** `tests/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.test.ts`

---

## Collection from the radio

### WLS-040 — An AirOS session is cached per radio and reused

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-03

`AirOsHttpClient` keeps one session per IP — the `AIROS_<hex>` cookie plus the
`X-CSRF-ID` header if the firmware issued one. A request with no cached session
authenticates first; a cached one is used directly.

**Why:** `/api/auth` is the most expensive call on the radio: it is a form POST
that the embedded server handles synchronously. Authenticating on every poll
would double the load the interval floor (WLS-006) exists to bound.

**Enforced at:** `src/infrastructure/wireless-monitoring/collectors/AirOsHttpClient.ts:38`, `:202`
**Reached from:** `fetchStatus`, `reboot`
**Message:** `No AIROS session cookie in authentication response` / `Authentication failed: HTTP <code>`
**Tests:** `tests/infrastructure/wireless-monitoring/collectors/AirOsHttpClient.test.ts`

### WLS-041 — 401, 403 and 302 all mean the session expired

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-03

Any of these three status codes on `/status.cgi` or `/api/system/reboot` drops
the cached session, re-authenticates once, and retries the request. A second
failure is returned to the caller.

**Why:** AirOS answers `403` — not `401` — when it rejects a cookie it no longer
holds in its session table, and on a stale CSRF id; `302` is the redirect to the
login page that older firmwares send instead. Treating only `401` as expiry left
a radio permanently unpollable after it dropped the session, because the client
kept presenting the same dead cookie and reading the `403` as a permission
error. One retry, not a loop: if a fresh session also fails, the problem is the
credentials, not the session.

**Enforced at:** `src/infrastructure/wireless-monitoring/collectors/AirOsHttpClient.ts:146`
**Reached from:** `fetchStatus`, `reboot`
**Message:** `status.cgi returned HTTP <code> after re-auth` / `Reboot request returned HTTP <code> after re-auth`
**Tests:** `tests/infrastructure/wireless-monitoring/collectors/AirOsHttpClient.test.ts`

### WLS-042 — A failed retry leaves no cached session behind

**Type:** Invariant · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-03

When the post-re-auth retry fails — transport error or unacceptable status —
the newly cached session is deleted before returning. The next poll therefore
starts from a clean authentication rather than reusing a session already known
to be unusable.

**Why:** `authenticate()` writes the session into the cache as a side effect of
succeeding, so a successful auth followed by a failed retry leaves a session
cached that has just demonstrated it does not work. Without the delete the next
cycle skips authentication, replays the same bad session, and the radio stays
unpollable until the process restarts — the exact failure WLS-041 was widened to
fix, reintroduced one layer down.

**Enforced at:** `src/infrastructure/wireless-monitoring/collectors/AirOsHttpClient.ts:65`, `:69`, `:117`, `:121`
**Reached from:** `fetchStatus`, `reboot`
**Tests:** `tests/infrastructure/wireless-monitoring/collectors/AirOsHttpClient.test.ts`

### WLS-043 — A reboot always drops the cached session

**Type:** Invariant · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-03

Every successful path out of `reboot()` deletes the session for that IP, whether
the reboot succeeded on the first attempt or after a re-auth.

**Why:** The radio drops every session when it restarts. A cached cookie
surviving the reboot is guaranteed stale, and the next poll would spend a
round trip discovering that.

**Enforced at:** `src/infrastructure/wireless-monitoring/collectors/AirOsHttpClient.ts:126`, `:136`
**Reached from:** `reboot`
**Tests:** `tests/infrastructure/wireless-monitoring/collectors/AirOsHttpClient.test.ts`

### WLS-044 — Radio certificates are not verified

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-03

Every request sets `rejectUnauthorized: false`.

**Why:** AirOS ships a self-signed certificate generated on the device, for an
IP address, with no CA anybody could validate against. Verification would reject
every radio in the fleet. The connection is to a management address on the
operator's own network; the credentials are what authenticate the exchange.
_(inferred)_

**Enforced at:** `src/infrastructure/wireless-monitoring/collectors/AirOsHttpClient.ts:258`
**Reached from:** `httpsRequest`
**Tests:** `tests/infrastructure/wireless-monitoring/collectors/AirOsHttpClient.test.ts`

### WLS-045 — Every radio request times out after 10 seconds

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-03

A timer destroys the socket and settles the promise with `HTTPS_TIMEOUT` naming
the host and port. The promise is settled exactly once regardless of which of
timeout, error or completion arrives first.

**Why:** A radio on a degraded link accepts the TCP connection and then answers
slowly or not at all, so without a deadline the poll hangs indefinitely, holding
one of the ten concurrency slots (WLS-023). The single-settle guard matters
because destroying the socket fires an error event that would otherwise resolve
the same promise a second time.

**Enforced at:** `src/infrastructure/wireless-monitoring/collectors/AirOsHttpClient.ts:285`, `:249` (single-settle)
**Reached from:** `httpsRequest`
**Message:** `HTTPS_TIMEOUT (<host>:<port>)`
**Tests:** `tests/infrastructure/wireless-monitoring/collectors/AirOsHttpClient.test.ts`

### WLS-046 — A CSRF token is sent when the firmware issues one

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-03

`X-CSRF-ID` is captured from the authentication response and replayed on POSTs
when present. A missing token is not an error.

**Why:** Some 8.x firmwares do not issue one and accept POSTs without it.
Requiring it would make those radios unrebootable.

**Enforced at:** `src/infrastructure/wireless-monitoring/collectors/AirOsHttpClient.ts:196`, `:231`
**Reached from:** `authenticate`, `doPost`
**Tests:** `tests/infrastructure/wireless-monitoring/collectors/AirOsHttpClient.test.ts`

### WLS-047 — `status.cgi` must return parseable JSON

**Type:** Validation · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-03

A body that does not parse fails the collection with a fixed message rather than
throwing.

**Why:** A radio mid-reboot, or one that has redirected to a login page with
`200`, returns HTML. Failing the cycle is right — there are no metrics — but it
is an expected condition, not an exception.

**Enforced at:** `src/infrastructure/wireless-monitoring/collectors/AirOsHttpClient.ts:304`
**Reached from:** `fetchStatus`
**Message:** `Failed to parse status.cgi response as JSON`
**Tests:** `tests/infrastructure/wireless-monitoring/collectors/AirOsHttpClient.test.ts`

### WLS-048 — A missing or unreadable field becomes null, never a failure

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-03

`parseStatusCgi` reads through helpers that return `null` (or `{}`, or `[]`) for
anything absent, of the wrong type, or not coercible. No field is required and
no shape check runs against the payload.

**Why:** `status.cgi` differs by firmware version, hardware generation and radio
mode — an M5 running 6.x and an AC running 8.x do not report the same keys. A
strict parse would reject whole fleets over one missing field. Null flows
through to the alert rules, each of which skips a metric it cannot read
(WLS-082), so an absent field costs exactly the checks that needed it.

**Enforced at:** `src/infrastructure/wireless-monitoring/collectors/UbiquitiHttpCollector.ts:144` – `:204`
**Reached from:** `parseStatusCgi`, `parseClientEntry`
**Tests:** `tests/infrastructure/wireless-monitoring/collectors/UbiquitiHttpCollector.test.ts`

### WLS-049 — The collector converts units at the boundary

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-03

Four conversions happen while parsing, so nothing downstream sees a raw AirOS
unit:

| Field                       | Raw    | Stored                       |
| --------------------------- | ------ | ---------------------------- |
| `throughput.tx` / `.rx`     | kbps   | bps (×1000)                  |
| `wireless.ccq`              | 0–1000 | percent (÷10), null when ≤ 0 |
| `host.totalram` / `freeram` | bytes  | `memoryUsedPercent`          |
| `wireless.chanbw`           | MHz    | null when ≤ 0                |

**Why:** The domain layer defines these fields in one unit each
(`throughputTxBps`, `ccqPercent`), and the conversion has to live somewhere the
radio's quirks are already known. `ccq` and `chanbw` are guarded at zero because
AirOS reports `0` for "not measured" rather than omitting the key, and a zero
that reaches the rules is a breach of every threshold rather than a missing
reading.

**Enforced at:** `src/infrastructure/wireless-monitoring/collectors/UbiquitiHttpCollector.ts:70`, `:108`, `:110`, `:117`
**Reached from:** `parseStatusCgi`
**Tests:** `tests/infrastructure/wireless-monitoring/collectors/UbiquitiHttpCollector.test.ts`

### WLS-050 — Which fields are read depends on the radio mode

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-08-03

A `STATION` reads its link metrics from the first entry of `wireless.sta` — the
one access point it is associated with — and gets `signalRxDbm`, `signalTxDbm`,
`latencyMs`, `distanceM`, the remote AP identity and airMax capacities. An
`ACCESS_POINT` reads `wireless.count` for its client total and maps the whole
`sta` array into client entries; its station-only fields stay null.

**Why:** `sta` means "the peers on the other end", which for a station is one AP
and for an access point is every subscriber. Reading `sta[0]` on an access point
would report one arbitrary subscriber's signal as the device's own.

**Enforced at:** `src/infrastructure/wireless-monitoring/collectors/UbiquitiHttpCollector.ts:65`, `:115`, `:118` – `:135`
**Reached from:** `parseStatusCgi`
**Tests:** `tests/infrastructure/wireless-monitoring/collectors/UbiquitiHttpCollector.test.ts`

### WLS-051 — A snapshot links to the remote access point when it can be identified

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-03

When a station reports a remote AP MAC, the poll looks that MAC up in the device
inventory and stores the resulting device id on the snapshot. A MAC that matches
nothing leaves the link null; a failed lookup is ignored rather than failing the
poll.

**Why:** This is what turns per-device readings into a topology — the station's
snapshot names the inventory record of the AP it is associated with, so both
ends of a link can be found from either. It cannot be required, because the AP
end of a link is often not a managed device.

**Enforced at:** `src/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.ts:204`
**Reached from:** `poll`
**Tests:** `tests/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.test.ts`

---

## Metric and client-entry validation

### WLS-060 — Percentages are between 0 and 100

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

`ccqPercent`, `cpuLoadPercent` and `memoryUsedPercent` are range-checked when
not null. `dlLinkScore`, `ulLinkScore`, `dlAirtimePercent` and
`ulAirtimePercent` on a client entry are checked the same way.

**Why:** These are the values thresholds are compared against, and a reading
outside the range is a parse error rather than a device in trouble — rejecting
it stops one bad field from opening an alert.

**Enforced at:** `src/domain/wireless-monitoring/value-objects/WirelessMetrics.ts:168`, `:179`, `:190`; `src/domain/wireless-monitoring/value-objects/WirelessClientEntry.ts:145`, `:156`, `:176`, `:187`
**Reached from:** `WirelessMetrics.create`, `WirelessClientEntry.create`
**Tests:** `tests/domain/wireless-monitoring/value-objects/WirelessMetrics.test.ts`, `tests/domain/wireless-monitoring/value-objects/WirelessClientEntry.test.ts`

### WLS-061 — Frequency and channel width are positive when present

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

`frequencyMhz` and `channelWidthMhz` must be greater than zero if not null.

**Why:** Channel width selects the threshold table for
[WLS-094](#wls-094--link-capacity-below-the-floor-for-its-channel-width-is-a-warning)
and [WLS-095](#wls-095--a-link-longer-than-its-channel-width-supports-is-a-warning);
a zero would either miss the table or pick the wrong row.

**Enforced at:** `src/domain/wireless-monitoring/value-objects/WirelessMetrics.ts:222`, `:232`
**Reached from:** `WirelessMetrics.create`
**Tests:** `tests/domain/wireless-monitoring/value-objects/WirelessMetrics.test.ts`

### WLS-062 — LAN status and duplex are closed sets

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

`lanStatus` is `UP` or `DOWN`; `lanDuplex` is `FULL` or `HALF`. Either may be
null. Anything else is rejected with the offending value in the message.

**Why:** [WLS-088](#wls-088--a-down-lan-port-is-critical) and
[WLS-090](#wls-090--a-lan-duplex-change-is-a-warning) compare against these
literals, so a third value would silently never match.

**Enforced at:** `src/domain/wireless-monitoring/value-objects/WirelessMetrics.ts:242`, `:250`
**Reached from:** `WirelessMetrics.create`
**Message:** `lanStatus must be 'UP' or 'DOWN', got: <value>` / `lanDuplex must be 'FULL' or 'HALF', got: <value>`
**Tests:** `tests/domain/wireless-monitoring/value-objects/WirelessMetrics.test.ts`

### WLS-063 — MAC addresses are normalised on the way in

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

`remoteApMac` and `macAddress` on the metrics, and `macAddress` on a client
entry, are parsed through the shared `MACAddress` value object and stored in its
normalised form. A client entry with an unparseable MAC is rejected outright —
it is the entry's identity. On the metrics both fields are optional, but a
present-and-invalid value fails the whole snapshot.

**Why:** AirOS reports MACs in different cases and separators depending on the
field and firmware. Storing the raw form would make
[WLS-051](#wls-051--a-snapshot-links-to-the-remote-access-point-when-it-can-be-identified)'s
inventory lookup and
[WLS-098](#wls-098--a-change-of-identity-is-a-warning)'s change detection both
depend on formatting — the same radio would look like a different one after a
firmware upgrade.

**Enforced at:** `src/domain/wireless-monitoring/value-objects/WirelessMetrics.ts:258`, `:267`; `src/domain/wireless-monitoring/value-objects/WirelessClientEntry.ts:125`
**Reached from:** `WirelessMetrics.create`, `WirelessClientEntry.create`
**Tests:** `tests/domain/wireless-monitoring/value-objects/WirelessMetrics.test.ts`, `tests/domain/wireless-monitoring/value-objects/WirelessClientEntry.test.ts`

### WLS-064 — SNR is taken as reported, or derived from signal minus noise

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

`getSnr()` returns the stored `snrDb` when present, otherwise
`signalRxDbm − noiseFloorDbm` when both are present, otherwise null. The poll
computes the same subtraction when building the metrics, so `snrDb` is normally
already populated. `WirelessClientEntry.getSnr()` has the derivation only — it
has no stored field.

**Why:** AirOS does not report SNR directly on every firmware, but it reports
both terms. Deriving it means the SNR thresholds (WLS-084) work on hardware that
does not publish the value, and the priority order means a device that _does_
report it is believed over the arithmetic.

**Enforced at:** `src/domain/wireless-monitoring/value-objects/WirelessMetrics.ts:115`; `src/domain/wireless-monitoring/value-objects/WirelessClientEntry.ts:104`; computed at `src/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.ts:175`
**Reached from:** `SnrRule.evaluate`, `PollWirelessDeviceUseCase.poll`
**Tests:** `tests/domain/wireless-monitoring/value-objects/WirelessMetrics.test.ts`, `tests/domain/wireless-monitoring/value-objects/WirelessClientEntry.test.ts`

### WLS-065 — Client entries are kept only for access points

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-03

The poll builds client entries only when the configuration's radio mode is
`ACCESS_POINT`; a station stores an empty list even though its `sta` array
describes the AP it is attached to.

**Why:** For a station, `sta[0]` is the far end of its own link, and that
information is already on the snapshot as the remote-AP fields (WLS-050).
Storing it a second time as a one-element "client list" would make
`GET .../wireless/clients` answer with the station's own uplink dressed up as a
subscriber.

**Enforced at:** `src/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.ts:317`
**Reached from:** `poll`
**Tests:** `tests/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.test.ts`

### WLS-066 — An invalid client entry is dropped, not fatal

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-03

Client entries that fail `WirelessClientEntry.create` are filtered out. The
remaining entries are stored and the poll succeeds.

**Why:** One subscriber radio reporting a malformed MAC or an out-of-range link
score should not cost the access point's entire cycle — its own metrics, its
alerts and every other client's reading. The dropped entry reappears on the next
poll if the radio recovers.

The drop is currently silent, which is the reason
[G-3](#known-gaps) exists.

**Enforced at:** `src/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.ts:355`
**Reached from:** `poll`
**Tests:** `tests/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.test.ts`

### WLS-067 — A snapshot is never rejected

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

`WirelessSnapshot.create` returns the aggregate directly, not a `Result` — it
has no creation invariants.

**Why:** Everything a snapshot holds has already been validated by the value
object it is made of: metrics by WLS-060 – WLS-064, clients by WLS-066. A second
check would only be able to fail on states the type system already excludes, and
returning a `Result` would force every caller to handle an outcome that cannot
occur.

**Enforced at:** `src/domain/wireless-monitoring/aggregates/WirelessSnapshot.ts:51`
**Reached from:** `PollWirelessDeviceUseCase.poll`
**Tests:** `tests/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.test.ts`

---

## Alert evaluation

### WLS-080 — An alert is identified by its metric and severity together

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

Every rule keys its lookups on `<metric>:<severity>`, and the poll builds the
active-alert map with the same key. A WARNING and a CRITICAL on the same metric
are therefore two independent alerts that open, clear and notify separately —
a link degrading past both thresholds holds two open records at once.

**Why:** Severity is not a property that mutates on an open alert; it is part of
what the alert _is_. Keying on metric alone would mean a link crossing from
warning into critical either silently rewrites the open record's severity —
losing when the warning started — or refuses to open the critical one.

**Enforced at:** `src/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.ts:186`; every rule in `src/domain/wireless-monitoring/services/rules/`
**Reached from:** `WirelessAlertEvaluator.evaluate`
**Tests:** `tests/domain/wireless-monitoring/services/WirelessAlertEvaluator.test.ts`

### WLS-081 — Thresholds clear at a different value than they breach

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

Most numeric rules use a clear condition set inside the breach condition, so a
value hovering at the threshold does not flap:

| Metric                                     | Opens at  | Clears at  |
| ------------------------------------------ | --------- | ---------- |
| `signal_rx_dbm` / `signal_tx_dbm` WARNING  | < −70 dBm | > −68 dBm  |
| `signal_rx_dbm` / `signal_tx_dbm` CRITICAL | < −80 dBm | > −78 dBm  |
| `snr_db` WARNING                           | < 15 dB   | > 17 dB    |
| `snr_db` CRITICAL                          | < 10 dB   | > 12 dB    |
| `ccq_percent` WARNING                      | < 75 %    | > 78 %     |
| `ccq_percent` CRITICAL                     | < 50 %    | > 55 %     |
| `cpu_load_percent`                         | > 80 %    | < 75 %     |
| `memory_used_percent`                      | > 85 %    | < 80 %     |
| `lan_speed_mbps`                           | ≤ 10 Mbps | > 100 Mbps |

**Why:** A radio sitting exactly on a threshold crosses it in both directions
between polls. Without a dead band each crossing opens and closes an alert, and
the operator receives a notification every cycle for a link that is simply
marginal.

`latency_ms`, `capacity_kbps`, `distance_m`, `clock_drift_s`,
`throughput_saturation` and `clients_connected` have **no** dead band — they
clear at the same value they open at. See [G-4](#known-gaps).

**Enforced at:** `src/domain/wireless-monitoring/services/rules/SignalStrengthRule.ts:19`, `SnrRule.ts:17`, `CcqRule.ts:20`, `CpuMemoryRule.ts:18`, `LanHealthRule.ts:50`
**Reached from:** `WirelessAlertEvaluator.evaluate`
**Tests:** `tests/domain/wireless-monitoring/services/rules/SignalStrengthRule.test.ts`, `tests/domain/wireless-monitoring/services/rules/SnrRule.test.ts`, `tests/domain/wireless-monitoring/services/rules/CcqRule.test.ts`, `tests/domain/wireless-monitoring/services/rules/CpuMemoryRule.test.ts`

### WLS-082 — A metric with no reading is not evaluated

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

Every rule returns no decisions for a metric that is null. It does not open an
alert, and it does **not** clear one that is already open — an alert opened when
the value was readable stays open through a gap in readings.

**Why:** Null means "not reported by this firmware or not measured this cycle",
which is not evidence that the condition ended. Clearing on absence would
resolve a genuine alert the moment the radio stopped reporting the field — the
situation where the alert is most likely to be real.

**Enforced at:** every rule in `src/domain/wireless-monitoring/services/rules/`
**Reached from:** `WirelessAlertEvaluator.evaluate`
**Tests:** `tests/domain/wireless-monitoring/services/rules/SignalStrengthRule.test.ts`, `tests/domain/wireless-monitoring/services/rules/SnrRule.test.ts`

### WLS-083 — Weak receive or transmit signal is an alert

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

`signalRxDbm` and `signalTxDbm` are each checked at two levels: WARNING below
−70 dBm, CRITICAL below −80 dBm. Four independent alerts in total.

**Why:** −70 dBm is where an airMax link starts losing modulation rates and
throughput drops noticeably; −80 dBm is close to the noise floor of a typical
deployment, where the link is about to drop entirely. Receive and transmit are
separate because an asymmetry between them localises the fault — a good rx with
a bad tx points at the far end's radio rather than the path.

**Enforced at:** `src/domain/wireless-monitoring/services/rules/SignalStrengthRule.ts:19`
**Reached from:** `WirelessAlertEvaluator.evaluate`
**Message:** `Señal débil en equipo <name>: <v> dBm (umbral: -70 dBm)` and three siblings
**Tests:** `tests/domain/wireless-monitoring/services/rules/SignalStrengthRule.test.ts`

### WLS-084 — Low signal-to-noise ratio is an alert

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

WARNING below 15 dB, CRITICAL below 10 dB, evaluated against `getSnr()` so the
rule works whether the radio reports SNR or only its two terms (WLS-064).

**Why:** SNR predicts usable throughput better than absolute signal does: a
−75 dBm signal over a −95 dBm noise floor is a healthy link, while the same
signal in a noisy band is not. Below 10 dB airMax cannot hold its higher
modulation rates at all.

**Enforced at:** `src/domain/wireless-monitoring/services/rules/SnrRule.ts:17`
**Reached from:** `WirelessAlertEvaluator.evaluate`
**Message:** `Relación señal/ruido baja en <name>: <v> dB (umbral: 15 dB)` / `Relación señal/ruido crítica en <name>: <v> dB (umbral: 10 dB)`
**Tests:** `tests/domain/wireless-monitoring/services/rules/SnrRule.test.ts`

### WLS-085 — CCQ is only evaluated on M-series hardware

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

The rule runs only when the device model matches `/\bM[259]\d*\b/i` — M2, M5,
M900 and their variants. On anything else it returns nothing, whatever the
reported value. Thresholds are WARNING below 75 %, CRITICAL below 50 %.

**Why:** CCQ is an airMax M-series metric. AC-series radios either omit the
field or report a value that does not mean the same thing, so a fleet-wide
threshold would alert continuously on hardware where the number is not
comparable. Gating on the model is what lets the threshold stay meaningful for
the hardware that does report it.

**Enforced at:** `src/domain/wireless-monitoring/services/rules/CcqRule.ts:10`, `:45`
**Reached from:** `WirelessAlertEvaluator.evaluate`
**Message:** `Calidad de conexión degradada en <name>: <v>% (umbral: 75%)` / `Calidad de conexión crítica en <name>: <v>% (umbral: 50%)`
**Tests:** `tests/domain/wireless-monitoring/services/rules/CcqRule.test.ts`

### WLS-086 — High link latency is an alert

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

WARNING above 50 ms, CRITICAL above 150 ms, read from the station's `tx_latency`.

**Why:** Latency on a wireless link rises before throughput falls — retries and
queueing show up here first, which makes it the earliest warning of a degrading
path. 150 ms is where interactive traffic becomes unusable for the subscriber.
_(inferred)_

**Enforced at:** `src/domain/wireless-monitoring/services/rules/LatencyRule.ts:9`, `:10`
**Reached from:** `WirelessAlertEvaluator.evaluate`
**Message:** `Latencia elevada en <name>: <v> ms (umbral: 50 ms)` / `Latencia crítica en <name>: <v> ms (umbral: 150 ms)`
**Tests:** `tests/domain/wireless-monitoring/services/rules/LatencyRule.test.ts`

### WLS-087 — Sustained CPU or memory pressure is a warning

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

CPU above 80 %, memory above 85 %. WARNING only — neither has a critical level.

**Why:** A radio short of CPU or RAM starts dropping management traffic before
it drops user traffic, which is what makes the device stop answering polls. The
different ceilings reflect that AirOS runs steadily higher on memory than on
CPU, so 80 % memory is normal where 80 % CPU is not.

**Enforced at:** `src/domain/wireless-monitoring/services/rules/CpuMemoryRule.ts:18`
**Reached from:** `WirelessAlertEvaluator.evaluate`
**Message:** `Uso de CPU elevado en <name>: <v>% (umbral: 80%)` / `Uso de memoria elevado en <name>: <v>% (umbral: 85%)`
**Tests:** `tests/domain/wireless-monitoring/services/rules/CpuMemoryRule.test.ts`

### WLS-088 — A down LAN port is CRITICAL

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

`lanStatus` of `DOWN` opens a CRITICAL alert; `UP` clears it. This is the only
rule whose `currentValue` and `threshold` are positional rather than measured —
0 for down, 1 for up.

**Why:** The radio answered the poll, so its own link is fine; a down eth0 means
the subscriber behind it has no service regardless. That is a total outage for
that customer, which is what CRITICAL means here.

**Enforced at:** `src/domain/wireless-monitoring/services/rules/LanHealthRule.ts:23`
**Reached from:** `WirelessAlertEvaluator.evaluate`
**Message:** `Puerto LAN caído en equipo <name>` / `Puerto LAN recuperado en equipo <name>`
**Tests:** `tests/domain/wireless-monitoring/services/rules/LanHealthRule.test.ts`

### WLS-089 — A LAN port degrading below its own baseline speed is a warning

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03
**Revised:** 2026-09-04 (thresholds are now per-device, relative to a
baseline captured from the device's own first poll — see WLS-099 — instead of
the fixed 10/100 Mbps values every device shared before)

Once a device has a baseline (`provisionedLanSpeedMbps`), the rule opens the
moment negotiated speed drops below it, and clears only once negotiated speed
is back at or above the baseline for two consecutive polls. A device with no
baseline yet falls back to the original fixed thresholds — opens at 10 Mbps or
below, clears only above 100 Mbps — which should only be reached transiently,
since WLS-099 captures a baseline on the very poll that first reports a speed.

**Why:** A port that should run gigabit and a port that should run
fast-Ethernet fail differently — a gigabit port dropping to 100 Mbps is
already a serious fault, but the old fixed 10 Mbps floor would miss it
entirely. Comparing against each device's own baseline instead of one shared
number catches that. The two-poll clear debounce exists because a bad cable
or connector can cause a port to renegotiate up and down repeatedly in a short
span; clearing on the very first good poll would flap the alert open and
closed on every attempt.

**Enforced at:** `src/domain/wireless-monitoring/services/rules/LanHealthRule.ts:44`
**Reached from:** `WirelessAlertEvaluator.evaluate`
**Message:** `Velocidad LAN degradada en equipo <name>: <v> Mbps (esperado: <baseline> Mbps)` (baseline known) / `Velocidad LAN muy baja en equipo <name>: <v> Mbps (umbral: 10 Mbps)` (no baseline yet)
**Tests:** `tests/domain/wireless-monitoring/services/rules/LanHealthRule.test.ts`

### WLS-090 — A LAN duplex change is a warning

**Type:** Policy · **Status:** Dormant
**Layer:** Domain
**Since:** 2026-08-03

Opens when the duplex mode differs from the previous poll's, clears when two
consecutive polls agree.

**Status is `Dormant`, not `Active`:** the rule is wired into the evaluator and
fully tested, but `HttpCollectionResult` carries no `lanDuplex` field and
`PollWirelessDeviceUseCase.ts:226` passes a literal `null`. The condition
therefore never fires in production. It begins working with no change to this
rule the moment the collector extracts eth0's duplex mode.

**Why:** Half duplex on a link that should be full is a duplex mismatch — one of
the few faults that degrades throughput badly while every status light stays
green.

**Enforced at:** `src/domain/wireless-monitoring/services/rules/LanHealthRule.ts:78`
**Reached from:** `WirelessAlertEvaluator.evaluate`
**Message:** `Modo dúplex LAN cambiado en <name>: <previous> → <current>`
**Tests:** `tests/domain/wireless-monitoring/services/rules/LanHealthRule.test.ts`

### WLS-091 — More clients than provisioned is a warning

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

Opens when `clientsConnected` exceeds the configuration's
`clientsProvisionedLimit`, clears when it returns to the limit or below.
Skipped entirely when the limit is null, which for a station it always is
(WLS-005).

**Why:** The limit is what the access point was dimensioned for. Exceeding it
does not break anything immediately, but it is the leading indicator of the
sector degrading for everyone on it — which is why it warns rather than waits
for the throughput and CCQ alerts that follow.

**Enforced at:** `src/domain/wireless-monitoring/services/rules/ClientCountRule.ts:22`
**Reached from:** `WirelessAlertEvaluator.evaluate`
**Message:** `Clientes conectados superan el límite en <name>: <v> (límite: <limit>)`
**Tests:** `tests/domain/wireless-monitoring/services/rules/ClientCountRule.test.ts`

### WLS-092 — Losing half an access point's clients at once is a warning

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

Opens when the client count falls below half the previous poll's, and only when
the previous poll had more than three clients. The 50 % floor is stored as the
alert's threshold at open time; the clear compares against the record's own
`lastValue` and reports the stored threshold.

**Why:** A sector losing half its subscribers between two polls is an outage on
the AP, not thirty independent subscriber faults — and it is visible here before
any individual device is marked unreachable. The three-client minimum keeps a
lightly loaded AP from alerting when two of its four clients power down
overnight.

Storing the floor at open time is what lets the alert clear without
`previousMetrics`: by the time it recovers, "the previous poll" is the outage
itself, so a freshly computed floor would be half of the _dropped_ count and
would clear the moment a single client returned.

**Enforced at:** `src/domain/wireless-monitoring/services/rules/ClientCountRule.ts:52`
**Reached from:** `WirelessAlertEvaluator.evaluate`
**Message:** `Caída repentina de clientes en <name>: <previous> → <current> (umbral: <floor>)`
**Tests:** `tests/domain/wireless-monitoring/services/rules/ClientCountRule.test.ts`

### WLS-093 — Sustained throughput above 80% of link capacity is saturation

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

Combined tx + rx throughput at or above 80 % of the configuration's
`linkCapacityKbps` opens a warning. Skipped when the capacity is not configured,
which for an access point it always is (WLS-004).

**Why:** 80 % is where queueing delay on a wireless link starts rising sharply —
waiting for 100 % would alert only once the link is already unusable. The
threshold is against provisioned capacity rather than measured capacity because
the operator sold the former.

**Enforced at:** `src/domain/wireless-monitoring/services/rules/ThroughputSaturationRule.ts:9`
**Reached from:** `WirelessAlertEvaluator.evaluate`
**Message:** `Saturación de enlace en <name>: <v> Mbps de <capacity> Mbps (<pct>%)`
**Tests:** `tests/domain/wireless-monitoring/services/rules/ThroughputSaturationRule.test.ts`

### WLS-094 — Link capacity below the floor for its channel width is a warning

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

airMax-reported capacity is compared against a floor chosen by channel width —
20 MHz → 50 Mbps, 40 MHz → 100 Mbps, 80 MHz → 200 Mbps. The alert opens only
when **both** directions are below the floor and clears when **either** recovers.
A channel width outside the table is not evaluated.

**Why:** The floors are roughly half of what each channel width should deliver on
a healthy airMax link, so falling below one means the link is negotiating far
below its configured width. Requiring both directions avoids alerting on
asymmetric traffic, where one direction is legitimately idle; clearing on either
is the deliberately asymmetric counterpart, so a recovering link is not held open
by its quiet direction.

**Enforced at:** `src/domain/wireless-monitoring/services/rules/CapacityRule.ts:10`, `:36`, `:49`
**Reached from:** `WirelessAlertEvaluator.evaluate`
**Message:** `Capacidad de enlace baja en <name> (<width> MHz): <v> Mbps (mínimo esperado: <floor> Mbps)`
**Tests:** `tests/domain/wireless-monitoring/services/rules/CapacityRule.test.ts`

### WLS-095 — A link longer than its channel width supports is a warning

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

Reported distance is compared against a ceiling chosen by channel width —
20 MHz → 15 km, 40 MHz → 10 km, 80 MHz → 5 km. A width outside the table is not
evaluated.

**Why:** Wider channels need more signal for the same distance, so a link that
works at 20 MHz over 15 km will not work at 80 MHz. The alert catches a
misconfiguration — someone widening the channel on a long link to gain
throughput and losing the link instead — which otherwise shows up only as
unexplained capacity and CCQ alerts.

**Enforced at:** `src/domain/wireless-monitoring/services/rules/DistanceRule.ts:9`
**Reached from:** `WirelessAlertEvaluator.evaluate`
**Message:** `Distancia de enlace excesiva en <name>: <v> m (máximo recomendado para <width> MHz: <max> km)`
**Tests:** `tests/domain/wireless-monitoring/services/rules/DistanceRule.test.ts`

### WLS-096 — A clock more than five minutes out is a warning

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

The absolute difference between the radio's reported epoch and the collection
time is compared against 300 seconds.

**Why:** The message names the real diagnosis — NTP has failed on the radio.
Beyond the drift itself, a wrong clock makes the device's own logs
uncorrelatable with everything else during an incident, which is exactly when
they are needed.

**Enforced at:** `src/domain/wireless-monitoring/services/rules/ClockSyncRule.ts:9`
**Reached from:** `WirelessAlertEvaluator.evaluate`
**Message:** `Desfase de reloj detectado en <name>: <v> s de diferencia (máximo permitido: 300 s). Posible falla de NTP.`
**Tests:** `tests/domain/wireless-monitoring/services/rules/ClockSyncRule.test.ts`

### WLS-097 — A firmware version change is a warning

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

Opens when the reported firmware differs from the previous poll's, clears when
two consecutive polls agree — which is the next poll after the change.

**Why:** Nothing in this system upgrades firmware, so a version that changed by
itself is either an unrecorded maintenance visit or a device that has been
replaced without the inventory being updated. Both need a human to look.

**Enforced at:** `src/domain/wireless-monitoring/services/rules/FirmwareRule.ts:26`
**Reached from:** `WirelessAlertEvaluator.evaluate`
**Message:** `Versión de firmware cambió en <name>: "<previous>" → "<current>"`
**Tests:** `tests/domain/wireless-monitoring/services/rules/FirmwareRule.test.ts`

### WLS-098 — A change of identity is a warning

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

Four fields are watched for change between consecutive polls, each as its own
alert: `ssid_changed`, `mac_address_changed`, `device_model_changed` and
`remote_ap_mac_changed`. A field that is null on either side is skipped.

**Why:** The IP address is configuration, but the MAC, the model and the SSID
are what the hardware _is_. A device id whose MAC changed is pointing at
different equipment than the record says, which silently invalidates every
metric and alert already attributed to it. `remote_ap_mac_changed` catches the
same substitution at the far end — a station that reassociated to a different
access point, which changes what its signal readings mean.

These are change-detection rules, so they clear on the next poll by
construction. That interacts with WLS-123 — see the note there.

**Enforced at:** `src/domain/wireless-monitoring/services/rules/IdentityChangeRule.ts:15`
**Reached from:** `WirelessAlertEvaluator.evaluate`
**Message:** `<field> cambió en <name>: "<previous>" → "<current>"`
**Tests:** `tests/domain/wireless-monitoring/services/rules/IdentityChangeRule.test.ts`

### WLS-099 — A device's LAN-speed baseline is captured from its first poll, not configured up front

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-04

The first poll that reports a LAN speed for a device with no baseline yet
(`provisionedLanSpeedMbps` is `null`) stores that reading as the baseline used
by WLS-089. Every later poll is a no-op on this field. The baseline can still
be set or corrected by hand afterward through the wireless-config update
endpoint, e.g. if the very first poll happened to catch a port already
degraded.

**Why:** Requiring an operator to enter every device's rated LAN speed by hand
before this rule could do anything useful would have meant either it protects
nothing until someone fills in hundreds of fields, or every device silently
falls back to one shared guess. Capturing the first observed value instead
means the rule self-calibrates per device with no setup step, at the cost of
one known rollout risk: a device already degraded the moment this shipped
gets its degraded speed as its baseline, and won't warn until it drops even
further — correctable with the same manual override.

**Enforced at:** `src/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.ts`, `src/domain/wireless-monitoring/aggregates/WirelessDeviceConfig.ts` (`captureLanSpeedBaselineIfUnset`)
**Reached from:** `PollWirelessDeviceUseCase.poll`
**Tests:** `tests/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.test.ts`, `tests/domain/wireless-monitoring/aggregates/WirelessDeviceConfig.test.ts`

---

## Alert lifecycle and notification

### WLS-120 — An alert opens once and stays open until it clears

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

A rule returns `OPEN` only when no active record exists for its
`metric:severity`, and `CLEAR` only when one does. `clear()` refuses on a record
that is already cleared. `triggeredAt` is fixed at open time and never
rewritten; repeated breaches update `lastValue` only.

**Why:** The open record is the answer to "since when", which is what an
operator needs to tell a two-minute blip from a two-day outage. Re-opening on
each breaching poll would reset that clock every cycle and produce one
notification per poll for one continuous fault.

**Enforced at:** `src/domain/wireless-monitoring/aggregates/WirelessAlertRecord.ts:100`; `:86` (`updateValue`)
**Reached from:** `clear`, `PollWirelessDeviceUseCase.poll`
**Message:** `Alert is already cleared`
**Tests:** `tests/domain/wireless-monitoring/aggregates/WirelessAlertRecord.test.ts`

### WLS-121 — Clearing an alert raises an event; opening one does not

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

`WirelessAlertRecord.clear()` raises `WirelessAlertClearedEvent`. There is no
matching event on `open()` — the opening side is announced by the snapshot
instead (WLS-122).

**Why:** A clear is a single transition on a single record, and the record is
the only thing that knows it happened. An open, by contrast, is already carried
by the snapshot that caused it, together with the metrics that justify it —
raising a second event from the record would deliver the same fact twice with
less context.

**Enforced at:** `src/domain/wireless-monitoring/aggregates/WirelessAlertRecord.ts:106`
**Reached from:** `clear`
**Tests:** `tests/domain/wireless-monitoring/events/WirelessAlertCleared.test.ts`, `tests/domain/wireless-monitoring/aggregates/WirelessAlertRecord.test.ts`

### WLS-122 — A snapshot always announces itself, and announces alerts only when it carries them

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-03

`WirelessSnapshot.create` always raises `WirelessSnapshotCreatedEvent`, and
raises `WirelessAlertTriggeredEvent` only when the snapshot's alert list is
non-empty. The list holds the cycle's `OPEN` decisions — not every alert
currently active.

**Why:** The created event is the heartbeat: it fires on every successful cycle,
which is what lets a consumer notice that polling stopped. The triggered event
is deliberately conditional, so subscribing to it does not mean receiving an
event per device per interval forever.

**Enforced at:** `src/domain/wireless-monitoring/aggregates/WirelessSnapshot.ts:58`, `:68`
**Reached from:** `create`
**Tests:** `tests/domain/wireless-monitoring/events/WirelessSnapshotCreated.test.ts`, `tests/domain/wireless-monitoring/events/WirelessAlertTriggered.test.ts`

### WLS-123 — Only critical recoveries are announced

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-03

`WirelessAlertClearedNotificationHandler` returns immediately unless the cleared
alert was CRITICAL. Warnings clear silently — the record is updated and the
shared alert store is resolved (WLS-124), but nothing is sent.

**Why:** Recovery notices are only worth sending for faults whose onset was
worth waking someone for. There is a second reason the filter is drawn at
CRITICAL specifically: every change-detection rule (WLS-090, WLS-097, WLS-098)
is WARNING-only, and each of them clears on the poll after it opens by
construction. Announcing warning recoveries would mean a "resolved" message one
cycle after every firmware upgrade and every SSID change, saying nothing had
happened.

**Enforced at:** `src/application/wireless-monitoring/event-handlers/WirelessAlertClearedNotificationHandler.ts:20`
**Reached from:** `WirelessAlertClearedEvent`
**Tests:** `tests/application/wireless-monitoring/event-handlers/WirelessAlertClearedNotificationHandler.test.ts`

### WLS-124 — Wireless alerts are mirrored into the shared alert store

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-03

Triggered alerts are opened in the shared store under the type
`wireless:<metric>:<severity>`, and cleared ones resolved under the same key.
Both handlers are idempotent per key, and both swallow their failures into the
log rather than propagating.

**Why:** The store is what backs the unified alert list, where a wireless
degradation sits next to an unreachable device. The namespaced type keeps
wireless keys from colliding with any other context's, and makes the source
readable in the store itself. Idempotency matters because the triggered event
re-fires on every poll that still has active alerts, which is what makes a
missed write self-heal on the next cycle.

**Enforced at:** `src/application/wireless-monitoring/event-handlers/WirelessAlertTriggeredAlertRecordHandler.ts:34`; `src/application/wireless-monitoring/event-handlers/WirelessAlertClearedAlertRecordHandler.ts:21`
**Reached from:** `WirelessAlertTriggeredEvent`, `WirelessAlertClearedEvent`
**Tests:** `tests/application/wireless-monitoring/event-handlers/WirelessAlertTriggeredAlertRecordHandler.test.ts`, `tests/application/wireless-monitoring/event-handlers/WirelessAlertClearedAlertRecordHandler.test.ts`

### WLS-125 — An alert notification is retried until it is delivered

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-03

Each poll loads the device's active alerts with `notifiedAt` still null and
tries to publish them. A successful publish stamps `notifiedAt`; a failure logs
and leaves it null, so the next cycle tries again. `markNotified` refuses a
second stamp, so a delivered alert is never re-sent. When no publisher is
configured the step is skipped entirely.

**Why:** Alert delivery is the one part of the pipeline with an external
dependency that can be down independently of everything else. Stamping the
timestamp only on success turns `notifiedAt IS NULL` into the retry queue, with
no separate queue to keep consistent — and an alert opened during a WhatsApp
outage is delivered when the channel returns instead of being lost.

**Enforced at:** `src/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.ts:419`; `src/domain/wireless-monitoring/aggregates/WirelessAlertRecord.ts:92`
**Reached from:** `poll`
**Message:** `Alert has already been notified`
**Tests:** `tests/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.test.ts`, `tests/domain/wireless-monitoring/aggregates/WirelessAlertRecord.test.ts`

### WLS-126 — A device with no name is still identifiable in an alert

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-03

The evaluation context falls back to `Equipo desconocido` when the radio reports
no hostname. Every alert message interpolates that name.

**Why:** The alternative is a message reading `Señal débil en equipo null`. The
device id is still on the alert record, so the notification stays actionable —
the fallback only affects how it reads. _(inferred)_

**Enforced at:** `src/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.ts:196`
**Reached from:** `poll`
**Tests:** `tests/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.test.ts`

### WLS-127 — An operator can manually clear an active alert, idempotently

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-13

`ClearWirelessAlertUseCase` loads the record by id, rejects it if the id does
not belong to the requesting device (reported as not-found, not as a device
mismatch, so the response cannot be used to probe another device's alert
ids), and calls the same `WirelessAlertRecord.clear()` the poll cycle uses.
Calling it again on an already-cleared record is not an error — the use case
recognises `clear()`'s `'Alert is already cleared'` failure and returns the
current state as a success instead of propagating it.

**Why:** The clear path is the same one automatic clearing already uses, so a
manual clear leaves no observable difference in the record — same
`clearedAt`, same `WirelessAlertClearedEvent`, same downstream handlers. The
idempotency wrapper exists because an operator retrying a request (a flaky
connection, a double click) must not see an error for an action that already
succeeded.

**Enforced at:** `src/application/wireless-monitoring/use-cases/ClearWirelessAlertUseCase.ts`
**Reached from:** `POST /api/devices/:id/wireless/alerts/:alertId/clear`
**Message:** `Wireless alert not found for device`
**Tests:** `tests/application/wireless-monitoring/use-cases/ClearWirelessAlertUseCase.test.ts`, `tests/integration/use-cases/wireless-monitoring/ClearWirelessAlertUseCase.integration.test.ts`, `tests/integration/wireless.routes.test.ts`

### WLS-128 — Bulk clear accepts explicit ids or defaults to every active alert on the device

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-13

`BulkClearWirelessAlertsUseCase` takes an optional `ids` list scoped to one
device. When `ids` is omitted it clears every currently active alert for that
device; when given, each id is resolved and clearing is attempted
individually. The response buckets results into `cleared`, `skipped`
(already cleared) and `failed` (not found, or belongs to another device) —
one bad id in a batch does not fail the rest.

**Why:** Clearing alerts one at a time is unusable after an outage that trips
several metrics on the same device at once. Bucketing instead of
all-or-nothing failure means a storm cleanup does not stall on the one alert
id a stale UI still has cached.

**Enforced at:** `src/application/wireless-monitoring/use-cases/BulkClearWirelessAlertsUseCase.ts`
**Reached from:** `POST /api/devices/:id/wireless/alerts/clear`
**Tests:** `tests/application/wireless-monitoring/use-cases/BulkClearWirelessAlertsUseCase.test.ts`, `tests/integration/use-cases/wireless-monitoring/BulkClearWirelessAlertsUseCase.integration.test.ts`, `tests/integration/wireless.routes.test.ts`

---

## Queries and HTTP surface

### WLS-140 — Status and client queries need at least one snapshot

**Type:** Validation · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-03

`GET .../wireless/status` and `.../wireless/clients` both fail when the device
has never been polled. The message is about wireless data, not about the device.

**Why:** These endpoints report the last observation, and there is a real
difference between "polled and everything is fine" and "never polled" that an
empty success would hide. _(inferred)_

**Enforced at:** `src/application/wireless-monitoring/use-cases/GetWirelessDeviceStatusUseCase.ts`, `GetWirelessClientsUseCase.ts`
**Reached from:** `GET /api/devices/:id/wireless/status`, `GET /api/devices/:id/wireless/clients`
**Message:** `No wireless data found for device`
**Tests:** `tests/application/wireless-monitoring/use-cases/GetWirelessDeviceStatusUseCase.test.ts`, `tests/application/wireless-monitoring/use-cases/GetWirelessClientsUseCase.test.ts`

### WLS-141 — A station has no client list

**Type:** Validation · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-03

The client endpoint fails with a `NOT_AP:`-prefixed message when the latest
snapshot's radio mode is `STATION`. The check is on the snapshot's stored mode,
not on the configuration's.

**Why:** Distinguishing "this is the wrong kind of device" from "no data yet"
(WLS-140) is what lets the UI hide the tab rather than show an empty one; the
prefix is what makes that machine-readable. Reading the snapshot's mode keeps the
answer consistent with the data actually being returned.

**Enforced at:** `src/application/wireless-monitoring/use-cases/GetWirelessClientsUseCase.ts`
**Reached from:** `GET /api/devices/:id/wireless/clients`
**Message:** `NOT_AP: This device is a CPE and does not have a client list`
**Tests:** `tests/application/wireless-monitoring/use-cases/GetWirelessClientsUseCase.test.ts`

### WLS-163 — The expected-clients query diffs declared STATIONs against a live snapshot

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-09-05

`GET /api/devices/:id/wireless/clients/expected` is AP-only — it fails with
the same `NOT_AP:`-prefixed message as WLS-141 when the target's own
_configuration_ (not its snapshot) is `STATION`. For each STATION config
declaring this device as its [WLS-162](#wls-162--parentapdeviceid-is-a-station-only-self-reference-free-declared-link)
`parentApDeviceId`, the device's MAC (from device-inventory, not from any
wireless poll) is looked up and matched — case/separator-normalised — against
the MAC of every client entry in the AP's latest snapshot. A match marks the
CPE `connected: true` with its live stats attached; no match marks it missing.
Any live client whose MAC matches no declared CPE is reported separately as
`unexpectedConnected`, and the AP's own client-count-based rules
([WLS-091](#wls-091--more-clients-than-provisioned-is-a-warning),
`clients_sudden_drop`) are untouched by this — it is a query, not an alert. A
device with no MAC on file always reports `connected: false`, since there is
nothing to match against. An AP that has never been polled returns
`collectedAt: null` and every declared CPE as not connected, rather than
failing — the roster is still meaningful before the first poll lands.

**Why:** A live poll only ever reports who is connected right now — WLS-140
already covers that. Knowing who is *supposed* to be connected and isn't
requires a declared topology (WLS-162) to diff against; without it, an AP
losing a subscriber's link looks identical to that subscriber never having
been provisioned. Matching by device-inventory's MAC rather than a station's
self-reported `remoteApMac` keeps the answer stable even if a CPE is
mid-outage and hasn't reported anything itself.

**Enforced at:** `src/application/wireless-monitoring/use-cases/GetApExpectedClientsUseCase.ts`
**Reached from:** `GET /api/devices/:id/wireless/clients/expected`
**Message:** `NOT_AP: This device is a CPE and has no expected-client roster`
**Tests:** `tests/application/wireless-monitoring/use-cases/GetApExpectedClientsUseCase.test.ts`, `tests/integration/use-cases/wireless-monitoring/GetApExpectedClientsUseCase.integration.test.ts`, `tests/integration/wireless.routes.test.ts`

### WLS-142 — A history window must start before it ends

**Type:** Validation · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-03

`from` and `to` are both required on the snapshot history endpoint and rejected
when inverted. Alert history is looser: both are optional, defaulting to epoch
and now.

**Why:** An inverted window silently returns nothing, which reads as "no data"
rather than "bad request". The asymmetry with alert history is deliberate —
snapshots accumulate every interval and an unbounded query would scan the whole
retention period, while alerts are sparse enough to list without a window.

**Enforced at:** `src/application/wireless-monitoring/use-cases/GetWirelessDeviceHistoryUseCase.ts`; `GetWirelessAlertHistoryUseCase.ts`
**Reached from:** `GET /api/devices/:id/wireless/history`, `GET /api/devices/:id/wireless/alerts/history`
**Message:** `from must be before to`
**Tests:** `tests/application/wireless-monitoring/use-cases/GetWirelessDeviceHistoryUseCase.test.ts`, `tests/application/wireless-monitoring/use-cases/GetWirelessAlertHistoryUseCase.test.ts`

### WLS-143 — Listings are capped at the schema

**Type:** Validation · **Status:** Active
**Layer:** Presentation (not in domain)
**Since:** 2026-08-03

`limit` is capped at 500 for alert queries and 1000 for snapshot history, and
must be a positive integer. Device ids in path and query are UUIDs.

**Why:** These caps are the only bound on the response size — neither use case
applies a default page size, so an uncapped `limit` would let one request pull a
device's entire retention window into memory. _(inferred)_

**Enforced at:** `src/presentation/http/validation/wireless.schemas.ts:8`, `:20`
**Reached from:** every wireless route
**Tests:** `tests/integration/wireless.routes.test.ts`

### WLS-144 — Active alerts can be listed fleet-wide or per device

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-03

`GET /api/wireless/alerts` returns every active alert in the fleet; the same
endpoint with `?deviceId=` narrows it to one device, and an invalid id there is
an error rather than a silently ignored filter.

**Why:** The fleet-wide list is the operations dashboard — an operator opens it
to see what is wrong right now, without knowing which device to ask about first.

**Enforced at:** `src/application/wireless-monitoring/use-cases/GetActiveWirelessAlertsUseCase.ts`
**Reached from:** `GET /api/wireless/alerts`
**Tests:** `tests/application/wireless-monitoring/use-cases/GetActiveWirelessAlertsUseCase.test.ts`, `tests/integration/wireless.routes.test.ts`

### WLS-145 — Rebooting a radio needs only update permission

**Type:** Policy · **Status:** Active
**Layer:** Presentation (not in domain)
**Since:** 2026-08-03

Wireless routes bind to the shared permission set of DEV-141: reads to `read`,
configuration writes and manual polls to `create`, updates and **reboot** to
`update`, deletes to `delete`. Reboot is therefore available to OPERATOR.

**Why:** A reboot interrupts a customer's service for a minute or two, which is
more than any other `update` in the system does. It sits there because power-
cycling a radio is the first thing a field operator tries on a degraded link,
and routing it through an administrator would make the common repair need an
escalation.

Note the contrast with DEV-144, where credential writes were deliberately lifted
out of `update` into an administrator-only permission. The distinction being
drawn is durable damage, not disruption: a reboot is disruptive and reversible,
overwriting credentials is neither. _(inferred)_

**Enforced at:** `src/presentation/http/routes/wireless.routes.ts:128`
**Reached from:** `POST /api/devices/:id/wireless/reboot`
**Tests:** `tests/integration/wireless.routes.test.ts`

### WLS-146 — Live throughput is pushed on each stored poll, never on a timer

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-12

The two throughput endpoints are Server-Sent Event streams, not request/response
reads. A subscriber receives the current reading immediately on connect, then
one `throughput` frame per snapshot the poller stores for a device it is
watching. Nothing polls the database on the client's behalf — the push is driven
by `WirelessSnapshotCreatedEvent`, which every stored snapshot already raises.

The fleet stream's opening frame is different in kind from the ones that follow:
`throughput-snapshot` carries the whole fleet, and every later frame is a
single-device `throughput` delta on the same channel.

Nothing is read from the database when no one is subscribed. The handler checks
the connected-client count first and returns before touching a repository.

**Why:** Throughput only changes when a poll stores a new value, so a client
polling faster than the interval would re-read the same row and a client polling
slower would miss readings. Pushing on the event makes the stream exactly as
fast as the data, whatever the interval is set to. Sending deltas rather than a
replacement fleet list keeps a hundred-device dashboard from re-transmitting a
hundred rows because one radio reported. _(inferred)_

**Enforced at:** `src/application/wireless-monitoring/event-handlers/WirelessSnapshotCreatedThroughputHandler.ts`, `src/presentation/http/controllers/WirelessStreamController.ts`
**Reached from:** `GET /api/devices/:id/wireless/throughput/stream`, `GET /api/wireless/throughput/stream`
**Tests:** `tests/application/wireless-monitoring/event-handlers/WirelessSnapshotCreatedThroughputHandler.test.ts`, `tests/presentation/http/controllers/WirelessStreamController.test.ts`, `tests/integration/wireless-stream.routes.test.ts`

### WLS-147 — Utilisation is only reported when a link capacity is configured

**Type:** Validation · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-12

`utilisationPercent` is `(txBps + rxBps) / (linkCapacityKbps × 1000) × 100`,
rounded to two decimals. It is `null` whenever `linkCapacityKbps` is unset or
either throughput leg was not collected. Because `linkCapacityKbps` may only be
set on a `STATION` (WLS-004), an `ACCESS_POINT` always reports `null` here —
that is correct, not missing data.

The reading itself is still returned in every one of those cases; only the
percentage is withheld.

**Why:** A saturation figure is a comparison against what the customer pays for,
and there is no such number until an operator records the plan. Inventing a
denominator — the radio's negotiated airMAX capacity, say — would answer a
different question and answer it as though it were this one. The raw bits per
second are useful on their own, so withholding them too would be worse than
withholding the ratio. _(inferred)_

This is the same numerator WLS-093 uses to fire the 80% saturation alert, so a
stream showing 85% and an open saturation alert always agree.

**Enforced at:** `src/application/wireless-monitoring/mappers/WirelessThroughputMapper.ts`, via `WirelessMetrics.getLinkUtilizationPercent`
**Reached from:** both throughput streams
**Tests:** `tests/application/wireless-monitoring/mappers/WirelessThroughputMapper.test.ts`

### WLS-148 — A throughput reading carries its age and is stale past two intervals

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-12

Every reading reports `collectedAt`, `ageSeconds`, and a `stale` flag. `stale`
is true once `ageSeconds` exceeds twice the device's configured `intervalSecs`,
and always true when the device has no configuration at all. `ageSeconds` is
never negative — a radio whose clock runs ahead reports `0`.

**Why:** "Live" here means as live as the poll interval allows, and that
defaults to an hour. A reading with no age attached invites a support agent to
read a stale number as the current one and tell a customer their link is idle
during an outage. Two intervals rather than one is the threshold because a
single missed cycle is an ordinary transient — a timeout, a busy radio — while
two consistently means collection has stopped.

Missing configuration counts as stale because nothing is scheduled to refresh
that snapshot ever again. _(inferred)_

**Enforced at:** `src/application/wireless-monitoring/mappers/WirelessThroughputMapper.ts`
**Reached from:** both throughput streams
**Tests:** `tests/application/wireless-monitoring/mappers/WirelessThroughputMapper.test.ts`, `tests/integration/use-cases/wireless-monitoring/GetWirelessThroughputUseCase.integration.test.ts`

### WLS-149 — Stream connections may authenticate by query token

**Type:** Policy · **Status:** Active
**Layer:** Presentation (not in domain)
**Since:** 2026-08-12

The two stream routes accept `?token=<jwt>` as well as `Authorization: Bearer`.
Every other route in the system remains header-only.

The scoping is per route, not per router. Both streams are mounted above the
global authenticate middleware and attach their own guard in the route
definition itself — attaching it with `router.use` instead would apply it to
every `/api` request, because the stream router mounts at `/`.

**Why:** The browser `EventSource` API has no way to set a request header, so a
stream is simply unreachable from the frontend without this. The usual objection
to tokens in URLs is that they end up in access logs; both request loggers here
print `req.path`, which excludes the query string, so they do not.

The alternative — a cookie — would have meant introducing cookie auth to a
system that is otherwise entirely Bearer-based, for two endpoints. _(inferred)_

**Enforced at:** `src/presentation/http/middleware/authenticateStream.ts`, wired per route in `src/presentation/http/routes/wireless-stream.routes.ts`
**Reached from:** `GET /api/devices/:id/wireless/throughput/stream`, `GET /api/wireless/throughput/stream`
**Message:** `Authentication required` / `Invalid token`
**Tests:** `tests/integration/wireless-stream.routes.test.ts`

### WLS-150 — Streams are capped by connection count, not rate-limited

**Type:** Policy · **Status:** Active
**Layer:** Presentation (not in domain)
**Since:** 2026-08-12

Neither stream route carries `createRateLimiter`. Instead one user may hold at
most `SSE_MAX_CONNECTIONS_PER_USER` streams (default 5) and the process at most
`SSE_MAX_CONNECTIONS` (default 200). Exceeding either is a `429`. Both streams
require only `read`, so every role including VIEWER can open one.

**Why:** `express-rate-limit` counts requests per window, which is the wrong
unit for a connection that is opened once and held for hours — a single stream
consuming a socket indefinitely never trips it, and a browser reconnecting after
a network blip trivially could. Sockets and file descriptors are the resource
actually at risk, so they are what is counted.

The per-user cap is the one that matters in practice: a few dashboard tabs are
legitimate, dozens are a leaking reconnect loop. _(inferred)_

**Enforced at:** `src/presentation/http/controllers/WirelessStreamController.ts`, `src/presentation/http/routes/wireless-stream.routes.ts`
**Reached from:** both throughput streams
**Message:** `Too many streams`
**Tests:** `tests/presentation/http/controllers/WirelessStreamController.test.ts`

---

## Retention

### WLS-160 — Wireless snapshots are kept for 30 days

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-03

`PurgeOldWirelessSnapshotsUseCase` deletes snapshots collected before the
cutoff. The window is `WIRELESS_SNAPSHOT_RETENTION_DAYS`, defaulting to 30, and
the purge is driven by the shared data-retention orchestrator.

**Why:** A snapshot per device per interval is the highest-volume table in the
system — at the default hourly interval, 24 rows per device per day, each with
an embedded client list. 30 days is enough to investigate a link that has been
degrading for a month, which is the longest a subscriber complaint realistically
looks back. It matches the ping-history window in MON-040.

**Enforced at:** `src/application/wireless-monitoring/use-cases/PurgeOldWirelessSnapshotsUseCase.ts:10`; default at `src/infrastructure/di/container.ts:925`
**Reached from:** `TriggerDataRetentionUseCase`
**Tests:** `tests/application/wireless-monitoring/use-cases/PurgeOldWirelessSnapshotsUseCase.test.ts`

### WLS-161 — Cleared alert records are kept for 90 days; active ones are never purged

**Type:** Policy · **Status:** Active
**Layer:** Application + infrastructure
**Since:** 2026-08-03

`deleteClearedOlderThan` removes only records that have been cleared. An alert
still active is retained regardless of age. The window is
`WIRELESS_ALERT_RECORD_RETENTION_DAYS`, defaulting to 90.

**Why:** Alert records are far sparser than snapshots and are the evidence
behind a service-quality dispute, so they outlive the metrics that produced them
— three times over. Excluding active alerts is the important half: an alert open
for more than 90 days is a fault nobody has fixed, and deleting it would resolve
it in the UI without anyone touching the device.

**Enforced at:** `src/application/wireless-monitoring/use-cases/PurgeOldWirelessAlertRecordsUseCase.ts:10`; `src/infrastructure/wireless-monitoring/repositories/PrismaWirelessAlertRecordRepository.ts`
**Reached from:** `TriggerDataRetentionUseCase`
**Tests:** `tests/application/wireless-monitoring/use-cases/PurgeOldWirelessAlertRecordsUseCase.test.ts`

---

## Known gaps

Where the code and the intent do not quite meet. Each is a real finding, not a
style objection.

### G-1 — ~~The orchestrator has no test suite~~ (closed 2026-08-03)

`WirelessPollingOrchestrator` held the concurrency ceiling (WLS-023), the
`57P03` suppression (WLS-026) and the drain-on-shutdown behaviour (WLS-027) with
no test covering any of it — there was no
`tests/infrastructure/wireless-monitoring/orchestrator/` directory at all. The
suite was written when this rule book was, and all three rules are now covered.
Kept here because the gap is what the suite exists to prevent recurring.

### G-2 — The concurrency guards are per-process

WLS-022 prevents a device being polled twice **by one process**. Both guards are
in-memory sets, so a second application instance polls the same radio on its own
schedule, and the two writes race on `lastPolledAt`. Nothing in the deployment
currently runs two instances; the rule is worth stating because scaling out is
what breaks it, and it will not fail loudly when it does.

### G-3 — Dropped client entries are silent

WLS-066 filters out client entries that fail validation, with no counter and no
log line. An access point whose subscribers all report malformed MACs after a
firmware upgrade reports an empty client list and a perfectly successful poll.

### G-4 — Six alert rules have no dead band

WLS-081's hysteresis is absent from `latency_ms`, `capacity_kbps`, `distance_m`,
`clock_drift_s`, `throughput_saturation` and `clients_connected`: each clears at
the same value it opens at. A metric sitting on the threshold opens and clears
on alternating polls, and for `latency_ms` CRITICAL that means a notification
every cycle — it is the one of the six that notifies (WLS-123). The pattern is
already in the codebase; these six predate it.

### G-5 — `WirelessAlert` validates on `create` but the poll uses `reconstitute`

`WirelessAlert.create` checks that the metric and message are non-empty and the
severity is one of two values. `PollWirelessDeviceUseCase.ts:359` builds the
snapshot's embedded alerts with `reconstitute`, which bypasses all of it. The
values come from the evaluator rather than from input, so nothing invalid
reaches it today — but the validation is dead code as wired, and the safety it
describes is not actually in force.

### G-6 — `throughputTxPps` and `throughputRxPps` are never populated

`WirelessMetrics` declares both, the persistence layer stores them, and
`PollWirelessDeviceUseCase.ts:222` passes literal `null` for each. The collector
reads per-client `tx_pps`/`rx_pps` but never the device-level pair. No rule
consumes them, so nothing is broken — the fields are simply unreachable.
