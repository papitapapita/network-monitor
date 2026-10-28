# Notifications — Business Rules

Two different jobs under one context. **Alerts** are the durable record that
something was wrong with a device and for how long. **Notifications** are the
messages that go out about it — to the operations team over Telegram, and to
subscribers over WhatsApp, and as push notifications to the staff's phones.

The split matters: an alert that nobody could be told about is still an alert,
and a delivery failure never loses the record of the fault.

Format and conventions: [README.md](README.md).

## ID ranges

| Range                 | Area                                                     |
| --------------------- | -------------------------------------------------------- |
| `NOT-001` … `NOT-029` | Alert identity and content                               |
| `NOT-030` … `NOT-059` | Alert lifecycle — open, resolve, notified                |
| `NOT-060` … `NOT-089` | Deduplication and the shared alert store                 |
| `NOT-090` … `NOT-109` | Operator notifications (Telegram)                        |
| `NOT-110` … `NOT-129` | Subscriber notifications (WhatsApp)                      |
| `NOT-130` … `NOT-149` | Retention, listing and deletion                          |
| `NOT-150` … `NOT-169` | Cross-cutting (access control)                           |
| `NOT-170` … `NOT-189` | Device notification policy (quiet hours, delay override) |
| `NOT-190` … `NOT-199` | Global alert-type muting                                 |
| `NOT-200` … `NOT-219` | Install notification settings (dashboard)                |
| `NOT-220` … `NOT-239` | Phone notifications (Web Push)                           |
| `NOT-240` … `NOT-259` | Outages behind an upstream device (topology)             |
| `NOT-260` … `NOT-279` | In-app inbox                                             |

## Layer coverage

| Layer                        | Rules |
| ---------------------------- | ----- |
| Application                  | 54    |
| Domain (aggregate/entity/VO) | 24    |
| Presentation                 | 7     |
| Infrastructure (database)    | 2     |
| Infrastructure (composition) | 4     |

`Alert` is a deliberately thin aggregate — it holds one three-flag lifecycle
(`resolvedAt`, `notifiedAt`, `recoveryNotifiedAt`) and refuses to move any of
them backwards. Everything else is application-layer, and for one reason worth
stating plainly: **`Alert` raises no domain events** (`NOT-020`). Every reaction
to an alert is wired through a use case rather than an event handler, which is
why so much of this context lives one layer out.

Authentication, roles and rate limiting are declared in
[identity.md](identity.md). `NOT-150` records this context's permission map.

---

## Alert identity and content

### NOT-001 — An alert must name a device

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

**Why:** Every alert in this system is about a piece of equipment. The device is
what deduplication keys on (`NOT-060`), what the notification names, and what a
technician is dispatched to.

**Enforced at:** `src/domain/notifications/aggregates/Alert.ts` (`open`)
**Message:** `deviceId is null or undefined`
**Tests:** `tests/domain/notifications/aggregates/Alert.test.ts`

### NOT-002 — An alert must name a source

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

Non-empty after trimming. The ICMP pipeline uses `Disponibilidad`; wireless
producers use their own.

**Why:** The source is what tells an operator reading a mixed list whether the
ping loop or the antenna poller raised this. Without it, two alerts on the same
device are indistinguishable in the feed.

**Enforced at:** `src/domain/notifications/aggregates/Alert.ts` (`open`)
**Message:** `source is required`
**Tests:** `tests/domain/notifications/aggregates/Alert.test.ts`

### NOT-003 — An alert must have a type

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

Non-empty after trimming. Wireless producers use `wireless:<metric>:<severity>`;
the ICMP path uses `device_unreachable`.

**Why:** The type is the other half of the deduplication key (`NOT-060`). It is
also what `NOT-091` reads to decide whether a new alert becomes a wireless
ticket or a device ticket, so it is a routing decision as much as a label.

**Enforced at:** `src/domain/notifications/aggregates/Alert.ts` (`open`)
**Message:** `type is required`
**Tests:** `tests/domain/notifications/aggregates/Alert.test.ts`

### NOT-004 — An alert is WARNING or CRITICAL

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

**Why:** Two levels because there are two operator behaviours: something to look
at, and something to act on now. A third would need a third behaviour to justify
it, and the Telegram formatting (`NOT-092`) would need a third icon.

**Enforced at:** `src/domain/shared/enums/AlertSeverity.ts`
**Backed by:** `AlertSeverity` enum in `prisma/schema.prisma`
**Tests:** `tests/domain/notifications/aggregates/Alert.test.ts`

### NOT-005 — An alert carries a free-form details object

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

Defaults to `{}` and is never `null` when read.

**Why:** Different producers have different evidence — consecutive ping failures
for the ICMP path, signal readings for wireless. A JSON bag keeps the schema
from having to grow a column each time a new producer appears, and the
never-null getter means no consumer has to guard.

**Enforced at:** `src/domain/notifications/aggregates/Alert.ts` (`details`)
**Backed by:** `AlertEvent.details Json @default("{}")` in `prisma/schema.prisma`
**Tests:** `tests/domain/notifications/aggregates/Alert.test.ts`

### NOT-006 — An alert's start time is the moment it was opened

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

`startedAt` is set by the aggregate, not supplied by the caller.

**Why:** The caller could otherwise backdate a fault, which would make the
outage duration in `NOT-032` a number the caller chose rather than one the
system observed.

**Enforced at:** `src/domain/notifications/aggregates/Alert.ts` (`open`)
**Tests:** `tests/domain/notifications/aggregates/Alert.test.ts`

### NOT-020 — Alert raises no domain events

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

Opening, resolving and notifying an alert emit nothing. `Alert` is an
`AggregateRoot` that never calls `addDomainEvent`.

**Why:** Recorded because it explains the shape of everything else here, and
because it looks like an omission. Alerts are themselves the reaction to events
raised elsewhere (`DeviceWentOfflineEvent`, the wireless alert events) — putting
events on them too would build a second hop where anything listening would fire
once per alert per producer. The consequence is that ticket creation
(`NOT-091`) has to hang off the use case, because there is no event to hang it
off.

**Enforced at:** `src/domain/notifications/aggregates/Alert.ts`
**Tests:** `tests/domain/notifications/aggregates/Alert.test.ts`

---

## Alert lifecycle

### NOT-030 — An alert is open until it is resolved

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

`isOpen` is exactly `resolvedAt === null`. There is no separate status field.

**Why:** One nullable timestamp cannot disagree with itself the way a status
plus a date can. It is also what the deduplication query filters on, so "is this
open" and "when did it end" are answered by the same column.

**Enforced at:** `src/domain/notifications/aggregates/Alert.ts` (`isOpen`)
**Tests:** `tests/domain/notifications/aggregates/Alert.test.ts`

### NOT-031 — An alert cannot be resolved twice

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

**Why:** The second resolution would move the end time and silently rewrite the
outage duration. Producers re-emit their state every cycle (`NOT-061`), so this
is reached routinely rather than exceptionally.

**Enforced at:** `src/domain/notifications/aggregates/Alert.ts` (`resolve`)
**Message:** `Alert already resolved`
**Tests:** `tests/domain/notifications/aggregates/Alert.test.ts`

### NOT-032 — An alert's duration is computed, and only once it is resolved

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

`durationSecs` is `null` while the alert is open, and the whole seconds between
start and resolution afterwards.

**Why:** An open alert has no duration yet — reporting the time so far would
give a number that changes every time it is read and looks like a settled fact.
`null` says "still happening", which is what the recovery message needs to know
before it can quote an outage length (`NOT-093`).

**Enforced at:** `src/domain/notifications/aggregates/Alert.ts` (`durationSecs`)
**Tests:** `tests/domain/notifications/aggregates/Alert.test.ts`

### NOT-033 — An alert records that it was notified, once

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

`markNotified` fails if `notifiedAt` is already set.

**Why:** The flag is the evidence someone was told. Letting it be re-stamped
would lose the time of the message that actually went out, which is the one that
matters when reconstructing who knew what and when.

**Enforced at:** `src/domain/notifications/aggregates/Alert.ts` (`markNotified`)
**Message:** `Alert already notified`
**Tests:** `tests/domain/notifications/aggregates/Alert.test.ts`

### NOT-034 — Recovery cannot be notified on an alert that is still open

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

**Why:** A recovery message says the fault ended. Sending one while the alert is
open would tell the operations team the device is back when nothing has recorded
that it is.

**Enforced at:** `src/domain/notifications/aggregates/Alert.ts` (`markRecoveryNotified`)
**Message:** `Cannot mark recovery notification on an open alert`
**Tests:** `tests/domain/notifications/aggregates/Alert.test.ts`

### NOT-035 — Recovery is notified once

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

**Why:** Same reasoning as `NOT-033`, on the other end of the lifecycle. A flapping
device would otherwise announce its own recovery repeatedly.

**Enforced at:** `src/domain/notifications/aggregates/Alert.ts` (`markRecoveryNotified`)
**Message:** `Recovery notification already sent`
**Tests:** `tests/domain/notifications/aggregates/Alert.test.ts`

### NOT-036 — A delivery failure never loses the alert

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

If the publisher fails, the error is logged, `notifiedAt` is left unset, and the
alert is saved anyway. The use case still succeeds.

**Why:** This is the central decision of the context. Telegram being down is not
the same as the device being fine — losing the alert because the message failed
would make an outage invisible precisely when the monitoring path is degraded.
The unset `notifiedAt` is what preserves the distinction between "recorded and
announced" and "recorded only".

**Enforced at:** `src/application/notifications/use-cases/SendDeviceDownAlertUseCase.ts`,
`src/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.ts`
**Tests:** `tests/application/notifications/use-cases/SendDeviceDownAlertUseCase.test.ts`,
`tests/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.test.ts`

### NOT-037 — An operator can manually clear an open alert, identical to an automatic resolve

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-13

`ClearAlertUseCase` loads an alert by id and calls the same `Alert.resolve()`
every producer's auto-resolve path already uses — there is no separate
"acknowledged" state and no suppression window. Clearing an alert that is
already resolved is not an error: the use case recognises `resolve()`'s
`'Alert already resolved'` failure and returns the current state as a success
instead of propagating it, matching `NOT-061`'s idempotency for the automatic
path.

**Why:** A manual clear that only hides the alert while the underlying fault
is still breaching would be undone by the very next producer cycle re-opening
it (`NOT-060`/`NOT-061`), so a plain resolve is the honest behaviour: it means
"this is fixed," not "stop telling me." This deliberately supersedes the
`NOT-150` framing below, which predates any client-facing write on `Alert`.

**Enforced at:** `src/application/notifications/use-cases/ClearAlertUseCase.ts`
**Reached from:** `POST /api/alerts/:id/clear`
**Message:** `Alert not found`
**Tests:** `tests/application/notifications/use-cases/ClearAlertUseCase.test.ts`, `tests/integration/use-cases/notifications/ClearAlertUseCase.integration.test.ts`, `tests/integration/alert.routes.test.ts`

### NOT-038 — Bulk clear accepts explicit ids or every open alert for one device, never both

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-13

`BulkClearAlertsUseCase` takes exactly one of `ids` (a list of alert ids,
possibly spanning devices) or `deviceId` (clear everything currently open for
that device). Supplying both, or neither, fails validation before any lookup
runs. As with `NOT-037`, results are bucketed into `cleared`, `skipped`
(already resolved) and `failed` (not found) rather than aborting the whole
request on the first bad id.

**Why:** An outage storm trips alerts across many devices at once, which the
device-scoped wireless bulk-clear (`WLS-128`) cannot express — this is the
cross-device counterpart. Requiring exactly one selector keeps the request
unambiguous: "these specific alerts" and "everything for this device" are
different intents that should not silently merge if a caller sends both.

**Enforced at:** `src/application/notifications/use-cases/BulkClearAlertsUseCase.ts`
**Reached from:** `POST /api/alerts/clear`
**Message:** `Exactly one of ids or deviceId is required`
**Tests:** `tests/application/notifications/use-cases/BulkClearAlertsUseCase.test.ts`, `tests/integration/use-cases/notifications/BulkClearAlertsUseCase.integration.test.ts`, `tests/integration/alert.routes.test.ts`

### NOT-039 — Bulk delete is bucketed the same way, and never deletes an open alert

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-13

`BulkDeleteAlertsUseCase` extends the single `DELETE /api/alerts/:id` guard
(`NOT-132`) to a required list of ids. Each id is resolved independently: an
open alert is bucketed as `skipped` with the same `'Cannot delete an alert
that is still open'` reason the single-delete path already uses, a missing
id is `failed`, and everything else is deleted and bucketed under `deleted`.
There is no "delete every resolved alert" shortcut — the caller must name
what it is deleting.

**Why:** Deleting alert history is destructive and, unlike a clear, not
reversible by re-running the same producer cycle. Requiring explicit ids
(rather than an implicit "all resolved" filter) keeps one careless bulk call
from wiping the operational history an operator might still want for a
post-mortem.

**Enforced at:** `src/application/notifications/use-cases/BulkDeleteAlertsUseCase.ts`
**Reached from:** `DELETE /api/alerts`
**Tests:** `tests/application/notifications/use-cases/BulkDeleteAlertsUseCase.test.ts`, `tests/integration/use-cases/notifications/BulkDeleteAlertsUseCase.integration.test.ts`, `tests/integration/alert.routes.test.ts`

### NOT-229 — A device's down alert closes when the device is back, even if the recovery was missed

**Type:** Invariant · **Status:** Active
**Layer:** Application, Infrastructure (persistence)
**Since:** 2026-10-26

A `device_unreachable` alert stays open only while its device is down. Four
mechanisms keep it that way:

1. Saving an alert never clears `resolvedAt`, `notifiedAt` or
   `recoveryNotifiedAt` once they are set. A copy that was loaded before
   another path set one of them leaves it as stored.
2. Just before the down-alert scan raises an alert, it re-reads the device's
   state. It skips the device if the device is no longer down, or if
   `downSince` differs from the scan's snapshot (a new streak, which the next
   scan judges on its own delay).
3. A scan tick that finds the previous scan still running is skipped.
4. Every scan tick also closes any open down alert whose device is `UP` and
   was last seen after the alert started. These are closed silently: no
   recovery notification is sent, and a warning is logged.

**Why:** The down alert is opened and closed on separate paths: the
went-offline handler, the scan, and the came-online handler. They run
concurrently and are not awaited. On a night when many devices drop, the scan
walks a long list, publishing one alert at a time. A device that recovered in
the meantime could:
- have its resolved alert written back as open, by a scan holding a stale copy
  across a slow or quiet-hours-suppressed publish;
- get a brand-new alert from the stale snapshot after its recovery had already
  run;
- get two alerts from overlapping scans, of which the recovery closes only one.

Nothing closed such an alert. The next outage reused it through the
(device, type) dedupe, and the recovery then reported the device "offline for 3
days", counting from the night the alert was stranded. Rule 4 also cleans up
alerts stranded before this fix.

**Known gap:** a recovery that lands while the "down" message is still being
sent gets no "back up" message. The recovery path skips that message for an
alert that was never notified (the NOT-097 blip rule), and at that moment the
scan has not yet recorded its send. The scan then finishes sending "X no
responde" and records it, so the team is told the device is down and never that
it came back. The alert itself still closes correctly. The window is the
duration of one Telegram call, about a second. It was left as is on
2026-10-26 as too unlikely to justify more code. The fix, if it is ever needed,
is for the sweep in rule 4 to send the recovery message for an alert that was
notified, has no recovery notification and is only minutes old.

**Enforced at:** `src/infrastructure/persistence/PrismaAlertRepository.ts` (`save`), `src/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase.ts` (`stillInSameDownStreak`), `src/infrastructure/notifications/orchestrator/OverdueDeviceDownAlertOrchestrator.ts` (`isScanning`), `src/application/notifications/use-cases/ResolveStrandedDeviceDownAlertsUseCase.ts`
**Tests:** `tests/application/notifications/use-cases/ResolveStrandedDeviceDownAlertsUseCase.test.ts`, `tests/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase.test.ts`, `tests/infrastructure/notifications/orchestrator/OverdueDeviceDownAlertOrchestrator.test.ts`, `tests/infrastructure/persistence/PrismaAlertRepository.test.ts`, `tests/integration/use-cases/notifications/ResolveStrandedDeviceDownAlertsUseCase.integration.test.ts`

---

## Deduplication and the shared alert store

### NOT-060 — At most one alert is open per device and type

**Type:** Invariant · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Opening one when an open alert already exists for that `(device, type)` returns
the existing alert instead of creating a second.

**Why:** Producers poll. The ping loop re-reports an unreachable device every
cycle and the wireless poller re-reports a bad signal every cycle — without
deduplication a device down overnight would produce hundreds of alerts and as
many Telegram messages. One open alert per fault is what makes the list
readable and the duration in `NOT-032` meaningful.

**Enforced at:** `src/application/notifications/use-cases/OpenAlertUseCase.ts`,
`src/application/notifications/use-cases/SendDeviceDownAlertUseCase.ts`
**Tests:** `tests/application/notifications/use-cases/OpenAlertUseCase.test.ts`,
`tests/integration/use-cases/notifications/UnifiedAlertRecording.integration.test.ts`

### NOT-061 — Opening and resolving an alert are both idempotent

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Opening one that is already open succeeds and changes nothing. Resolving one
that is not open succeeds and changes nothing.

**Why:** Producers re-emit their whole state every cycle rather than tracking
what they have already reported. Idempotence on both ends is what lets them do
that — a producer never has to know whether this is the first cycle of a fault
or the fiftieth.

**Enforced at:** `src/application/notifications/use-cases/OpenAlertUseCase.ts`,
`src/application/notifications/use-cases/ResolveAlertUseCase.ts`
**Tests:** `tests/application/notifications/use-cases/OpenAlertUseCase.test.ts`,
`tests/application/notifications/use-cases/ResolveAlertUseCase.test.ts`

### NOT-062 — Every context records its alerts in one store

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Device monitoring and wireless monitoring both write through the `IAlertRecorder`
port into the same `alert_events` table, rather than each keeping its own.

**Why:** The operator wants one list of what is wrong right now, not one per
subsystem. Recording through a port rather than a shared repository keeps the
producing contexts from depending on the notifications domain — they know how to
report a fault, not how alerts are stored.

**Enforced at:** `src/application/shared/interfaces/IAlertRecorder.ts`,
`src/application/notifications/use-cases/OpenAlertUseCase.ts`
**Tests:** `tests/integration/use-cases/notifications/UnifiedAlertRecording.integration.test.ts`

### NOT-063 — Recording an alert is separate from delivering a notification

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

`IAlertRecorder` persists; `IAlertPublisher` delivers. `OpenAlertUseCase` does
the first and never the second.

**Why:** The two have different failure modes and different audiences — the
store must never lose a fault (`NOT-036`), while a message is best-effort. One
port doing both would force the stricter guarantee onto the looser job, or the
looser onto the stricter.

**Enforced at:** `src/application/shared/interfaces/IAlertRecorder.ts`,
`src/application/shared/interfaces/IAlertPublisher.ts`
**Tests:** `tests/infrastructure/notifications/AlertPublisher.test.ts`

### NOT-064 — Deleting a device deletes its alerts

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (database)
**Since:** 2026-08-05

**Why:** The one cascade in the schema aimed at operational rather than
commercial data. An alert is a statement about a device that no longer exists —
unlike a bill (`BIL-011`), it has no independent meaning to preserve, and
keeping it would leave the alert list with rows pointing at nothing.

**Backed by:** `AlertEvent.device … onDelete: Cascade` in `prisma/schema.prisma`
**Tests:** `tests/integration/alert.routes.test.ts`

---

## Operator notifications

### NOT-090 — A device that goes unreachable opens a CRITICAL availability alert immediately; the outbound notification waits for the alert delay

**Type:** Policy · **Status:** Active
**Layer:** Application · Domain
**Since:** 2026-08-05 · **Revised:** 2026-09-04

`DeviceState.applyPingResult` raises `DeviceWentOfflineEvent` the instant a
device transitions from UP/UNKNOWN to DOWN. `DeviceWentOfflineAlertRecordHandler`
records the alert through `IAlertRecorder` on that event — source
`Disponibilidad`, type `device_unreachable` — with `notifiedAt` unset. The
alert is visible on `GET /api/alerts` from that moment, whether or not it
ever gets announced (`NOT-097`). A periodic scan
(`RaiseOverdueDeviceDownAlertsUseCase`) separately decides when to actually
notify: once a device has been continuously DOWN for at least its effective
alert delay — the per-device override on `DeviceNotificationPolicy`
(`NOT-173`) if one is set, otherwise the install's down-alert delay from its
notification settings (`NOT-201`; `DEVICE_DOWN_ALERT_DELAY_MINUTES`, default 60,
until saved from the dashboard). `SendDeviceDownAlertUseCase` refreshes the alert's details
(consecutive failure count, IP) to their current value right before
publishing, so a fault recorded hours before it is announced still shows an
accurate failure count.

**Why:** Unreachable is the one condition that means the subscriber has no
service at all, so it is never a warning. The failure count is carried because
the threshold that declared the device down is a monitoring policy (`MON-`) — an
operator reading the alert needs to see how many attempts it took, as of when
they were actually told.

**History — this rule previously delayed opening the alert itself, not just
the notification.** Before 2026-09-04, no alert existed at all until the scan
found a device down past the delay, which meant a blip that self-resolved
inside the delay window left no trace anywhere in the alert list — only in
the raw ping-result history. Splitting record from notify (mirroring the
wireless pattern, `NOT-062`/`NOT-063`) keeps the "don't page on a blip"
guarantee while giving every outage, however short, a row in `GET /api/alerts`.

**Enforced at:** `src/domain/device-monitoring/aggregates/DeviceState.ts` (`applyPingResult`),
`src/application/notifications/event-handlers/DeviceWentOfflineAlertRecordHandler.ts`,
`src/application/notifications/use-cases/SendDeviceDownAlertUseCase.ts`,
`src/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase.ts`
**Tests:** `tests/domain/device-monitoring/aggregates/DeviceState.test.ts`,
`tests/application/notifications/event-handlers/DeviceWentOfflineAlertRecordHandler.test.ts`,
`tests/application/notifications/use-cases/SendDeviceDownAlertUseCase.test.ts`,
`tests/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase.test.ts`,
`tests/integration/use-cases/notifications/SendDeviceDownAlertUseCase.integration.test.ts`

### NOT-091 — A newly opened alert may become a ticket, best effort

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

`OpenAlertUseCase` asks the ticket opener to raise a work order. A type prefixed
`wireless:` becomes a `WIRELESS_ALERT` ticket, anything else a `DEVICE_ALERT`
one. If the ticket fails — or the opener is not wired in at all — the alert
still succeeds.

**Why:** The alert is the record of the fault; the ticket is the follow-up work.
Failing the alert because a work order could not be created would trade the
thing that must not be lost for the thing that can be raised later by hand. The
optional dependency exists so the notifications context still functions in a
deployment without tickets.

**Enforced at:** `src/application/notifications/use-cases/OpenAlertUseCase.ts` (`openTicketFor`)
**Tests:** `tests/application/notifications/use-cases/OpenAlertUseCase.test.ts`

### NOT-092 — Operator messages are Telegram Markdown, escaped

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Every interpolated value — summary, detail, device name, IP, source,
timestamp — is run through `escapeMd` before it reaches the message body. A
link's label is escaped the same way; its target escapes only `)` and `\`,
the two characters MarkdownV2 treats as special there (`TelegramFormatting.link`).

**Why:** Device names are operator-supplied and routinely contain characters
Telegram treats as markup (`-`, `.`, `_`). Unescaped, a name like
`Torre_Norte-2` either renders wrong or is rejected by the API, which would turn
a naming choice into a silent notification outage.

**Enforced at:** `src/application/notifications/shared/TelegramFormatting.ts`,
`src/application/notifications/use-cases/SendAlertNotificationUseCase.ts` (`formatBody`)
**Tests:** `tests/application/notifications/use-cases/SendAlertNotificationUseCase.test.ts`

### NOT-093 — A recovery message quotes the latency and the outage length

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05 · **Revised:** 2026-10-05

The summary reads `<device> volvió a responder tras 1 hora y 5 minutos sin conexión`,
the duration worded per `NOT-104`; an unknown duration drops the
`tras … sin conexión` clause. The detail reads `Latencia: 42 ms`, or
`Latencia: N/A` when unknown. `<device>` is the device's name, `El
dispositivo` when it cannot be loaded.

**Why:** "It is back" is not actionable on its own. How long it was gone is what
tells the operator whether this was a blip or an outage worth a ticket, and the
latency says whether it came back healthy.

**Enforced at:** `src/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.ts`, `src/domain/shared/utils/formatDuration.ts`
**Tests:** `tests/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.test.ts`

### NOT-094 — Times in operator messages are Bogotá local time

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Formatted `es-CO`, 24-hour, in `America/Bogota`, regardless of where the server
runs. A time inside a summary line (`formatSince`) is `las 14:05` when it falls
on the current Bogotá day and `el 04/10 a las 14:05` otherwise.

**Why:** The people reading these messages are in one place. A UTC timestamp
would need mental arithmetic during an incident, which is exactly when nobody
should be doing any.

**Enforced at:** `src/application/notifications/shared/TelegramFormatting.ts` (`formatLocalTime`)
**Tests:** `tests/application/notifications/use-cases/SendAlertNotificationUseCase.test.ts`

### NOT-095 — A recovery with no open alert is refused, not invented

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Logged as a warning and returned as a failure.

**Why:** A recovery for a device nobody recorded as down means the two sides
disagree about state — usually a restart that lost the open alert, or a resolve
that already ran. Announcing recovery anyway would tell the team a fault ended
that was never reported starting.

**Enforced at:** `src/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.ts`
**Message:** `No open alert found for device — recovery skipped`
**Tests:** `tests/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.test.ts`

### NOT-098 — A recovery for an alert that was never notified resolves silently, without a recovery notice

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-04

Distinct from `NOT-095`: the open alert exists (it was recorded the instant
the device went down, `NOT-097`), but `notifiedAt` is still `null` because
the outage self-resolved before the alert delay elapsed — a blip. In that
case `SendDeviceRecoveryAlertUseCase` sets `resolvedAt` and saves, then
returns without calling `IAlertPublisher` or `Alert.markRecoveryNotified()`
at all — no IP lookup, no message.

**Why:** Nobody was told the device went down, so nobody needs to be told it
came back — the exact reasoning `NOT-097` already applies to the down side,
mirrored on the recovery side. A recovery notice for a fault that was never
announced would be a non sequitur to whoever read it.

**Enforced at:** `src/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.ts`
**Tests:** `tests/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.test.ts`

### NOT-099 — Ticketing a device-down alert is deferred to the moment it is actually notified

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-04

`DeviceWentOfflineAlertRecordHandler` opens its alert with `skipTicket: true`
(`AlertRecordInput.skipTicket`, threaded through `OpenAlertUseCase`), so
recording an outage never opens a ticket by itself. `SendDeviceDownAlertUseCase`
opens the ticket instead, from `notifyAndSave`, immediately after the first
successful `Alert.markNotified()` — never on a retry, never when the publish
is suppressed or fails. Wireless alerts are unaffected: `OpenAlertUseCase`
still tickets immediately for any caller that does not set `skipTicket`
(`NOT-091`), since wireless has no equivalent record/notify delay to defer to.
Both paths open a ticket only in `AUTOMATIC` ticket mode (`NOT-205`).

**Why:** A ticket is a bigger interruption than a Telegram message — it is a
work order someone is expected to act on. Ticketing every blip the moment it
is recorded (`NOT-090`) would reintroduce exactly the noise the alert delay
exists to prevent, just in the ticketing system instead of the phone.

**Enforced at:** `src/application/notifications/shared/AlertTicketing.ts`,
`src/application/notifications/use-cases/SendDeviceDownAlertUseCase.ts`,
`src/application/notifications/event-handlers/DeviceWentOfflineAlertRecordHandler.ts`,
`src/application/notifications/use-cases/OpenAlertUseCase.ts`
**Tests:** `tests/application/notifications/use-cases/SendDeviceDownAlertUseCase.test.ts`,
`tests/application/notifications/use-cases/OpenAlertUseCase.test.ts`,
`tests/application/notifications/event-handlers/DeviceWentOfflineAlertRecordHandler.test.ts`

### NOT-096 — A missing device name degrades to `Unknown Device`

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

The same applies to a missing IP, whose link line is simply left out
(`NOT-103`).

**Why:** The message is worth sending with a missing label; it is not worth
losing over one. The lookup is a convenience on top of the device id that is
already in the metadata, so failing it costs nothing that matters.

**Enforced at:** `src/application/notifications/use-cases/SendAlertNotificationUseCase.ts` (`resolveDevice`)
**Tests:** `tests/application/notifications/use-cases/SendAlertNotificationUseCase.test.ts`

### NOT-097 — The down alert is recorded on transition; only the notification waits for the outage to outlast the alert delay

**Type:** Policy · **Status:** Active
**Layer:** Application · Domain
**Since:** 2026-08-24 · **Revised:** 2026-09-25

`DeviceState` records `downSince` — the start of the current DOWN streak —
and, as of 2026-09-04, raises `DeviceWentOfflineEvent` on that same
transition (`NOT-090`). `DeviceWentOfflineAlertRecordHandler` records the
alert immediately, unnotified. A periodic scan
(`RaiseOverdueDeviceDownAlertsUseCase`, run every 60s by
`OverdueDeviceDownAlertOrchestrator`) loads every currently-down device
(`IDeviceStateRepository.findAllDown`, unfiltered by time — the delay is no
longer uniform across devices, see `NOT-173`) and, for each one, calls
`SendDeviceDownAlertUseCase` once `now - downSince` has reached that device's
effective delay — which now only decides whether to _notify_ the already-open
alert, not whether to create it. `SendDeviceDownAlertUseCase` already dedupes
against an existing open alert (`NOT-060`), so re-selecting a still-down
device on every scan is safe. A device that recovers before its delay elapses
keeps its alert record (visible on `GET /api/alerts` from the moment it
opened) but never gets notified, and `SendDeviceRecoveryAlertUseCase` resolves
it silently rather than reporting the end of a fault nobody was told about
(`NOT-098`).

The notification reports `downSince` as the time the outage occurred, not
the moment the scan sends it — a message delivered after a 15-minute delay
(or held back by quiet hours) still says when the device actually went
down (revised 2026-09-25).

The scan is independent of any device's own poll interval — a device polled
once a day is not stuck waiting a day for its alert to be reconsidered.

**Why:** A ping failure that resolves in minutes is not an outage a technician
needs paged for, so it stays out of Telegram/WhatsApp — but it is still a real
fact about the device's history, worth seeing on the alert list if someone
goes looking. Alerting on every blip trains the team to stop trusting the
channel, which is worse than a real outage arriving a little late; hiding
every blip from the record entirely was the cost paid for that, until this
revision removed it.

**Enforced at:** `src/domain/device-monitoring/aggregates/DeviceState.ts` (`applyPingResult`),
`src/application/notifications/event-handlers/DeviceWentOfflineAlertRecordHandler.ts`,
`src/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase.ts`,
`src/application/notifications/use-cases/SendDeviceDownAlertUseCase.ts`,
`src/infrastructure/notifications/orchestrator/OverdueDeviceDownAlertOrchestrator.ts`
**Tests:** `tests/domain/device-monitoring/aggregates/DeviceState.test.ts`,
`tests/application/notifications/event-handlers/DeviceWentOfflineAlertRecordHandler.test.ts`,
`tests/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase.test.ts`,
`tests/application/notifications/use-cases/SendDeviceDownAlertUseCase.test.ts`,
`tests/infrastructure/notifications/orchestrator/OverdueDeviceDownAlertOrchestrator.test.ts`

### NOT-100 — An alert about something other than a device is sent without a device line

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-28

`AlertNotification.deviceId` is `null` when the alert is not about a device
— an on-site probe agent going offline (ADR 0002, R6) is the first case. Such
an alert is rendered the same way as any other except that no device is looked
up and the device lines (name, IP link, app link — `NOT-103`) are left out;
the summary names what the alert is about. The field is nullable, not optional, so every producer must
state which kind of alert it is sending.

**Why:** An agent going offline leaves a whole site blind, and its alert has to
travel the same path as device alerts (ADR 0001) to reach the same chat. Faking
a device id for it would print `Unknown Device` (`NOT-096`) and let per-device
policy apply to something that is not a device.

**Enforced at:** `src/application/shared/interfaces/IAlertPublisher.ts`, `src/application/notifications/use-cases/SendAlertNotificationUseCase.ts`
**Tests:** `tests/application/notifications/use-cases/SendAlertNotificationUseCase.test.ts`, `tests/infrastructure/notifications/AlertPublisher.test.ts`

### NOT-101 — No down alert is raised for a device nobody is measuring

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-28 · **Revised:** 2026-09-30 (off site, devices with no agent too)

The overdue down-alert scan (`NOT-097`) skips every device whose agent is not
reporting: offline, pending or revoked — and, on a server hosted off site,
every device with no agent (`MON-006`, `MON-023`). No alert is opened, no
notification is sent and no ticket is opened for it. Once the agent reports
again, a device still DOWN past its delay is alerted on the next scan as
usual. If the agents' status cannot be read, the scan raises nothing that
minute and tries again on the next one.

**Why:** ADR 0002, R7. While the agent is gone the device's DOWN is only the
last thing the agent saw. The agent-offline message (`AGT-023`) already tells
the operator that the whole site is unwatched; one down alert per device on
top of it would bury that message and could open work orders for devices that
are fine.

**Enforced at:** `src/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase.ts`, `src/infrastructure/probe-agents/queries/PrismaAgentStatusQuery.ts`
**Tests:** `tests/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase.test.ts`, `tests/integration/use-cases/notifications/RaiseOverdueDeviceDownAlertsUseCase.integration.test.ts`

### NOT-102 — An operator message leads with a one-line summary, not a title

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-05

Every producer writes `AlertNotification.summary`: one sentence saying what
happened, to what, and since when (`AP Norte no responde desde las 12:00`,
`Señal crítica en equipo AP Norte: -83 dBm (umbral: -80 dBm)`). The message
opens with the severity icon and the summary in bold — 🔴 critical, 🟡 warning,
✅ resolved — then `detail` on the next line when the producer has one
(`null` when the summary says it all), then the device lines (`NOT-103`), and
ends with `🕐 <time> · <source>`. There is no title line and no severity,
source or metric field block. A summary is required; an empty one fails the
send.

Wireless summaries are the rule's own sentence: `WirelessAlertRecord.message`
when an alert opens, and the clearing rule's sentence (`WLS-121`) when it
clears.

**Why:** A phone shows the first line of a message in its notification preview.
A title like `ALERTA CRÍTICA` spends that line on something the icon already
says; the summary lets whoever is on call decide from the lock screen whether
to get up. The detail that used to close the message moved to the top for the
same reason.

**Enforced at:** `src/application/shared/interfaces/IAlertPublisher.ts`, `src/application/notifications/use-cases/SendAlertNotificationUseCase.ts` (`formatBody`), each producer (`SendDeviceDownAlertUseCase`, `SendDeviceRecoveryAlertUseCase`, the agent-health handlers, `PollWirelessDeviceUseCase`, `WirelessAlertClearedNotificationHandler`)
**Tests:** `tests/application/notifications/use-cases/SendAlertNotificationUseCase.test.ts`, `tests/application/notifications/use-cases/SendDeviceDownAlertUseCase.test.ts`, `tests/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.test.ts`, `tests/application/notifications/event-handlers/AgentHealthNotificationHandlers.test.ts`, `tests/application/wireless-monitoring/event-handlers/WirelessAlertClearedNotificationHandler.test.ts`

### NOT-103 — A device message links to the device's own page and to the device in the app

**Type:** Policy · **Status:** Active
**Layer:** Application · Infrastructure (composition)
**Since:** 2026-10-05

Under the summary, a message about a device carries `📛 <name>`, then
`🌐 <ip>` linked to `http://<ip>` when the device has an IP, then
`📱 Ver en la app` linked to `<APP_PUBLIC_URL>/devices/<id>` when
`APP_PUBLIC_URL` is set. This covers every device alert — availability and
wireless alike, since all are rendered by the one `SendAlertNotificationUseCase`.
The IP is the device's inventory IP. `APP_PUBLIC_URL` must be an http(s) URL
with no query or fragment; a trailing slash is dropped, and a malformed value
stops the boot.

**Why:** The first thing an operator does with an alert is open the antenna's
own web interface or the device in the dashboard; a link saves looking up
either. The IP link is plain `http://` because AirOS and RouterOS redirect to
their HTTPS port themselves. The app's address depends on how each install is
reached (LAN IP, tunnel hostname), so it is configured per install rather than
derived, and an unset value simply drops the link.

**Enforced at:** `src/application/notifications/use-cases/SendAlertNotificationUseCase.ts` (`deviceLines`), `src/application/notifications/shared/TelegramFormatting.ts` (`link`), `src/infrastructure/notifications/config/appPublicUrl.ts`, `src/infrastructure/di/container.ts`
**Tests:** `tests/application/notifications/use-cases/SendAlertNotificationUseCase.test.ts`, `tests/application/notifications/shared/TelegramFormatting.test.ts`, `tests/infrastructure/notifications/config/appPublicUrl.test.ts`

### NOT-104 — Durations in operator messages are worded in their two largest units

**Type:** Policy · **Status:** Active
**Layer:** Domain (shared kernel) · Application
**Since:** 2026-10-05

Any length of time a message quotes — an outage (`NOT-093`), an agent's clock
offset (`AGT-025`), a radio's clock drift (`WLS` clock rule) — goes through
`formatDuration`: Spanish, singular or plural, years / days / hours / minutes
/ seconds, at most the two largest units joined by `y`. 318 hours reads
`13 días y 6 horas`; a zero or non-adjacent second unit is dropped (`1 hora`,
`2 días`); zero reads `0 segundos`.

**Why:** `312 horas` or `1123200 s` has to be divided in someone's head before
it means anything; `13 días` does not. Past the second unit the precision is
noise — nobody acts differently on `13 días, 6 horas y 4 minutos`.

**Enforced at:** `src/domain/shared/utils/formatDuration.ts`, used by `SendDeviceRecoveryAlertUseCase`, `AgentClockNotificationHandlers`, `ClockSyncRule`
**Tests:** `tests/domain/shared/utils/formatDuration.test.ts`, `tests/application/notifications/event-handlers/AgentClockNotificationHandlers.test.ts`, `tests/domain/wireless-monitoring/services/rules/ClockSyncRule.test.ts`

---

## Subscriber notifications

### NOT-110 — Suspending a service notifies the subscriber

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Triggered by `ContractedServiceStatusChangedEvent` when the new status is
SUSPENDED and the previous one was not.

**Why:** A subscriber whose line stops working needs to know it was a
suspension, not a fault — otherwise the first the ISP hears is a support call
reporting an outage. Checking the previous status is what keeps a re-suspension
from sending the notice twice, and complements `CUS-072` at the handler level.

**Enforced at:** `src/application/notifications/event-handlers/ContractedServiceSuspendedNotificationHandler.ts`
**Tests:** `tests/application/notifications/event-handlers/ContractedServiceSuspendedNotificationHandler.test.ts`

### NOT-111 — A suspension notice goes to the subscriber's phone, by name

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Sent over WhatsApp as a pre-approved template with the customer's full name as
its only parameter.

**Why:** WhatsApp only permits business-initiated messages from approved
templates, so the message body is not ours to compose at send time. The name is
the one variable that makes it clear whose account is affected — which matters
when one phone number covers a household.

**Enforced at:** `src/application/notifications/use-cases/SendSuspensionNoticeUseCase.ts`
**Tests:** `tests/application/notifications/use-cases/SendSuspensionNoticeUseCase.test.ts`

### NOT-112 — A suspension notice needs both the subscription and the customer

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

**Why:** The phone number lives on the customer, not the subscription, so the
notice cannot be addressed without loading both. Failing loudly rather than
skipping means an unreachable subscriber shows up as an error somebody sees.

**Enforced at:** `src/application/notifications/use-cases/SendSuspensionNoticeUseCase.ts`
**Message:** `Contracted service not found` / `Customer not found`
**Tests:** `tests/application/notifications/use-cases/SendSuspensionNoticeUseCase.test.ts`

### NOT-113 — A failed subscriber notice never fails the suspension

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

The handler logs the failure and returns. The service stays suspended.

**Why:** The suspension is a commercial decision that has already been made and
enforced on the router (`SVC-`). Rolling it back because WhatsApp was
unreachable would restore service to a subscriber who is not entitled to it, on
the strength of an unrelated outage.

**Enforced at:** `src/application/notifications/event-handlers/ContractedServiceSuspendedNotificationHandler.ts`
**Tests:** `tests/application/notifications/event-handlers/ContractedServiceSuspendedNotificationHandler.test.ts`

### NOT-114 — A notification handler never throws

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

All three handlers wrap their use case in `try`/`catch` and log rather than
propagate.

**Why:** These handlers run inside the dispatch of a domain event raised by
something else — a ping result, a status change. An exception escaping would
abort whatever raised the event, letting a notification problem break monitoring
or billing.

**Enforced at:** `src/application/notifications/event-handlers/`
**Tests:** `tests/application/notifications/event-handlers/DeviceCameOnlineNotificationHandler.test.ts`,
`tests/application/notifications/event-handlers/DeviceWentOfflineNotificationHandler.test.ts`,
`tests/application/notifications/event-handlers/ContractedServiceSuspendedNotificationHandler.test.ts`

### NOT-115 — WhatsApp notices run on the env token and the vendor's settings

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (composition)
**Since:** 2026-09-30

`WHATSAPP_ACCESS_TOKEN` in the environment turns subscriber and technician
notices on; without it they are not wired and the boot logs it. The phone
number id, template name, template language and API version are the vendor's
settings (`INS-028`; `WHATSAPP_*` until saved), read on every send. With the
token but no phone number or template set, each send fails with `WhatsApp is
not configured` and, like any failed notice, never fails the suspension
(`NOT-113`).

**Why:** The token is a secret that lets anyone message from the business
number, so it stays where only the vendor sees it; the rest is ordinary
configuration the vendor adjusts per install — a new template, a newer API
version — without a restart.

**Enforced at:** `src/infrastructure/notifications/WhatsAppNotificationService.ts`, `src/infrastructure/di/container.ts`
**Message:** `WhatsApp is not configured`
**Tests:** `tests/infrastructure/notifications/WhatsAppNotificationService.test.ts`, `tests/infrastructure/di/vendorSettingsDefaults.test.ts`

---

## Retention, listing and deletion

### NOT-130 — Only resolved alerts are purged, and only past the retention window

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

An open alert is never deleted by retention, no matter how old.

**Why:** An old open alert is not stale data — it is a fault nobody has fixed,
and it is the most important row in the table. Age-based deletion that ignored
the open flag would quietly erase the longest-running problems.

**Enforced at:** `src/application/notifications/use-cases/PurgeOldAlertsUseCase.ts`
**Tests:** `tests/application/notifications/use-cases/PurgeOldAlertsUseCase.test.ts`

### NOT-131 — Retention runs across every context at once, and reports each

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Ping results, alerts, wireless snapshots and wireless alert records are purged
in one pass, each with its own window — the vendor's settings, read at the
start of each run (INS-028) — each returning its own count. Any one failing
fails the run; settings that cannot be read fail it before anything is
deleted.

**Why:** One scheduled job is easier to reason about than four, and the separate
counts are what make it possible to tell an empty window from a purge that never
ran. Failing the whole run on any part means a silently-not-purging table cannot
hide behind three that worked.

**Enforced at:** `src/application/shared/use-cases/TriggerDataRetentionUseCase.ts`
**Tests:** `tests/application/shared/use-cases/TriggerDataRetentionUseCase.test.ts`

### NOT-132 — An open alert cannot be deleted by hand

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

`DELETE /api/alerts/:id` refuses while the alert is open.

**Why:** The same reasoning as `NOT-130`, at the manual door. Deleting an open
alert would not fix the fault — it would remove the record while the device is
still broken, and the next producer cycle would open a new one anyway
(`NOT-060`), losing the original start time.

**Enforced at:** `src/application/notifications/use-cases/DeleteAlertUseCase.ts`
**Message:** `Cannot delete an alert that is still open`
**Tests:** `tests/application/notifications/use-cases/DeleteAlertUseCase.test.ts`

### NOT-133 — Alert listings return 50 rows by default

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Optionally filtered to one device.

**Why:** A higher default than the 20 used for customers and bills (`CUS-120`,
`BIL-120`), because the alert list is read as a live feed during an incident
rather than paged through.

**Enforced at:** `src/application/notifications/use-cases/ListAlertsUseCase.ts`
**Tests:** `tests/integration/use-cases/notifications/ListAlertsUseCase.integration.test.ts`

### NOT-134 — An alert listing's total counts every matching alert, not the page

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-26

`total` comes from a second count query over the same filters as the page,
without `limit`/`offset`, and `hasMore` is derived from it.

**Why:** Until 2026-09-26 `total` was the length of the page returned, so
`hasMore` was false on every page and a client paging on it stopped after the
first one. This was the known gap recorded under NOT-133.

**Enforced at:** `src/application/notifications/use-cases/ListAlertsUseCase.ts`, backed by `PrismaAlertListQuery.list`/`count` (one `buildWhere`)
**Tests:** `tests/application/notifications/use-cases/ListAlertsUseCase.test.ts`, `tests/integration/use-cases/notifications/ListAlertsUseCase.integration.test.ts`

### NOT-135 — Alert listings filter by status and severity, and name the device

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-26

`GET /api/alerts` accepts `status=OPEN|RESOLVED` and
`severity=WARNING|CRITICAL`, alongside `deviceId`. Filters combine with AND,
and any other value is a `400`. `OPEN` means no `resolvedAt`, the same test
as `Alert.isOpen`. Every alert carries `deviceName`, the device's **current**
name.

**Why:** The dashboard asks for "open critical alerts" and used to fetch
every device separately just to label rows. The name belongs to
device-inventory, so it is joined in a read-only query (`IAlertListQuery`)
instead of being stored on the `Alert` aggregate, where it would go stale on
the first rename.

Wireless-link alerts are recorded into the same store (`source` "Enlace
inalámbrico"), so the filters cover them too.

**Enforced at:** `src/application/notifications/use-cases/ListAlertsUseCase.ts` (value check), `src/infrastructure/persistence/PrismaAlertListQuery.ts`, `src/presentation/http/validation/alert.schemas.ts`
**Tests:** `tests/application/notifications/use-cases/ListAlertsUseCase.test.ts`, `tests/integration/use-cases/notifications/ListAlertsUseCase.integration.test.ts`, `tests/integration/alert.routes.test.ts`

---

## Cross-cutting

### NOT-150 — Alerts can be read by anyone, cleared by an operator, deleted only by an administrator

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-08-05 · **Revised:** 2026-08-13

| Endpoint                                 | Permission |
| ---------------------------------------- | ---------- |
| `GET /api/alerts`, `GET /api/alerts/:id` | `read`     |
| `POST /api/alerts/:id/clear`             | `update`   |
| `POST /api/alerts/clear`                 | `update`   |
| `DELETE /api/alerts/:id`                 | `delete`   |
| `DELETE /api/alerts`                     | `delete`   |

There is still no endpoint that _creates_ an alert — only the monitoring loops
open one. `NOT-037`/`NOT-038` are the client-facing exception to "never
resolved by hand": clearing was added because an operator manually
acknowledging a fault is a real workflow, and it reaches `Alert.resolve()`
through the exact same call the automatic path uses.

**Why:** Clear sits on `update` (available to OPERATOR) because it is the
alert-triage equivalent of every other day-to-day operational action, and
gating it behind an administrator would make the common "yes I saw this,
it's handled" case need an escalation. Deletion stays administrator-only
under `IDN-030` because, with `NOT-132`/`NOT-039` already protecting open
alerts, the only thing left to delete is history — and bulk deletion widens
the blast radius of a mistake, not the judgment call needed to make it.

**Enforced at:** `src/presentation/http/routes/alert.routes.ts` (`authorize`)
**Tests:** `tests/integration/alert.routes.test.ts`

### NOT-151 — Alert writes are metered on the write budget, not the stricter delete one

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-08-05 · **Revised:** 2026-08-13

`DELETE /api/alerts/:id`, `DELETE /api/alerts`, `POST /api/alerts/:id/clear`
and `POST /api/alerts/clear` all use the `write` rate limiter rather than the
`delete` one used by customers and devices.

**Why:** Recorded because it is inconsistent with `CUS-140` and
`DEV-146` rather than because it is principled. Alert deletion is a routine
tidy-up of resolved history, not the destructive act that the stricter `delete`
budget exists to slow down — and clearing needs to survive an outage-storm
burst of clicks without an operator hitting a tighter budget than every other
write in the system.

**Enforced at:** `src/presentation/http/routes/alert.routes.ts` (`createRateLimiter`)
**Tests:** `tests/integration/alert.routes.test.ts`

---

## Device notification policy

A `DeviceNotificationPolicy` is an optional, 1:1-with-device settings row —
same shape as `PollingConfiguration` (`MON-` context), not an `AggregateRoot`
and raises no domain events. It answers two independent questions: should
this device page anyone right now (quiet hours), and how long should it wait
before opening a down alert at all (delay override). Both default to "off":
no window, no override.

### NOT-170 — A device inherits the install's quiet hours unless it sets its own or opts out

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-09-02 · **Revised:** 2026-10-26

`DeviceNotificationPolicy.quietHoursMode` is one of three values:

| Mode            | Quiet hours that apply                                   |
| --------------- | -------------------------------------------------------- |
| `INHERIT`       | The install's window (`NOT-207`), or none if it has none |
| `CUSTOM`        | The device's own `quietHours`, ignoring the install's    |
| `ALWAYS_NOTIFY` | None — the device is never silenced by quiet hours       |

`quietHours` is set exactly when the mode is `CUSTOM`; any other pairing is
refused by `create` and `setQuietHours`, by the request schema, and by the
`device_notification_policies_quiet_hours_only_when_custom` CHECK constraint.
A device with no policy row behaves as `INHERIT`, and so does one reset with
`DELETE`. When a request omits the mode, it is `CUSTOM` if a window is sent and
`INHERIT` if not — what a dashboard that predates the mode meant by each.

**Why:** A null window used to mean "always notify", which left no way to say
"follow the install's window". With an install-wide window, the device needs
both "inherit" and "never silence me", and a boolean next to the window could
contradict it — an "always notify" flag on a device still carrying a window.
One mode with the window tied to `CUSTOM` keeps that contradiction
unrepresentable, the same reasoning `NOT-030` applies to a single nullable
timestamp over a status-plus-date pair. Rows from before the mode existed
became `CUSTOM` if they had a window and `INHERIT` otherwise; with no install
window saved yet, both behave exactly as before.

**Enforced at:** `src/domain/notifications/entities/DeviceNotificationPolicy.ts` (`validateQuietHours`, `effectiveQuietHours`),
`src/application/notifications/use-cases/UpsertDeviceNotificationPolicyUseCase.ts`,
`src/presentation/http/validation/notification-policy.schemas.ts`
**Backed by:** `device_notification_policies_quiet_hours_only_when_custom` CHECK constraint, migration `20261026120000`
**Message:** `quietHoursStart and quietHoursEnd must be set when quietHoursMode is CUSTOM, and only then`
**Tests:** `tests/domain/notifications/entities/DeviceNotificationPolicy.test.ts`,
`tests/application/notifications/use-cases/GetDeviceNotificationPolicyUseCase.test.ts`,
`tests/application/notifications/use-cases/UpsertDeviceNotificationPolicyUseCase.test.ts`,
`tests/application/notifications/use-cases/DeleteDeviceNotificationPolicyUseCase.test.ts`,
`tests/infrastructure/mappers/DeviceNotificationPolicyMapper.test.ts`,
`tests/infrastructure/persistence/PrismaDeviceNotificationPolicyRepository.test.ts`,
`tests/infrastructure/notifications/QuietHoursAlertPublisher.test.ts`,
`tests/integration/use-cases/notifications/GetDeviceNotificationPolicyUseCase.integration.test.ts`,
`tests/integration/use-cases/notifications/UpsertDeviceNotificationPolicyUseCase.integration.test.ts`,
`tests/integration/use-cases/notifications/DeleteDeviceNotificationPolicyUseCase.integration.test.ts`,
`tests/integration/notification-policy.routes.test.ts`

### NOT-171 — Quiet hours are both-or-neither, and each bound is a 24-hour HH:mm time

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-09-02

`TimeOfDay.create` rejects anything but a zero-padded `HH:mm` string with
hours `00`–`23` and minutes `00`–`59`. `QuietHours.create` additionally
rejects an equal start and end — ambiguous between "the whole day" and "no
window", so the caller must be explicit. The same both-or-neither rule is
checked again in `UpsertDeviceNotificationPolicyUseCase` and the request
validation schema before either bound reaches the domain, and once more by a
database `CHECK` constraint for a row written outside the domain layer
entirely.

**Why:** A start with no end (or the reverse) is not a partial window, it is
an invalid one — there is no sensible default for the missing side.
Rejecting it at four layers (schema, use case, domain, database) is cheaper
than ever having to decide what a one-sided window would mean.

**Enforced at:** `src/domain/shared/value-objects/TimeOfDay.ts`,
`src/domain/notifications/value-objects/QuietHours.ts`,
`src/application/notifications/use-cases/UpsertDeviceNotificationPolicyUseCase.ts`,
`src/presentation/http/validation/notification-policy.schemas.ts`
**Backed by:** `device_notification_policies_quiet_hours_both_or_neither` CHECK constraint, migration `20260902120000`
**Message:** `quietHoursStart and quietHoursEnd must both be set, or both be null`
**Tests:** `tests/domain/shared/value-objects/TimeOfDay.test.ts`,
`tests/domain/notifications/value-objects/QuietHours.test.ts`,
`tests/application/notifications/use-cases/UpsertDeviceNotificationPolicyUseCase.test.ts`,
`tests/integration/use-cases/notifications/UpsertDeviceNotificationPolicyUseCase.integration.test.ts`,
`tests/integration/notification-policy.routes.test.ts`

### NOT-172 — Quiet hours are evaluated against server-local wall-clock time, with overnight wraparound

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-09-02

`TimeOfDay.fromDate` reads `Date#getHours()`/`getMinutes()` — the process's
local timezone, not UTC and not a per-device or system-wide stored zone.
`QuietHours.contains` treats a window whose start is after its end (e.g.
`22:00`–`07:00`) as crossing midnight: "now" is inside when it is at or
after start, or before end — never a plain `start <= now < end` comparison.

**Why:** No timezone concept exists anywhere else in this system, and the
person typing "22:00" into the policy is reading their own local clock —
matching that removes a configuration axis (which timezone?) the feature
does not need. Overnight is the common case this feature exists for; nobody
scheduled a "customers asleep" window that starts and ends the same
calendar day.

**Enforced at:** `src/domain/shared/value-objects/TimeOfDay.ts` (`fromDate`),
`src/domain/notifications/value-objects/QuietHours.ts` (`contains`)
**Tests:** `tests/domain/shared/value-objects/TimeOfDay.test.ts`,
`tests/domain/notifications/value-objects/QuietHours.test.ts`,
`tests/domain/notifications/entities/DeviceNotificationPolicy.test.ts`,
`tests/infrastructure/notifications/QuietHoursAlertPublisher.test.ts`

### NOT-173 — The down-alert delay can be overridden per device, and falls back to the system default

**Type:** Policy · **Status:** Active
**Layer:** Application · Domain
**Since:** 2026-09-02

`DeviceNotificationPolicy.alertDelayMinutes` is `null` unless explicitly
set; `effectiveAlertDelayMs(defaultMs)` returns the override in
milliseconds when present, otherwise `defaultMs`
(the install's down-alert delay, `NOT-090`, `NOT-201`). `RaiseOverdueDeviceDownAlertsUseCase`
looks up each currently-down device's policy independently and compares its
own `downSince` against its own effective delay (`NOT-097`), so a device
with a 5-minute override and one on the 60-minute system default are both
handled correctly inside the same scan. A negative override is rejected at
the same layers as `NOT-171`.

**Why:** The single global env var this extends could not express "page me
for the core switch in 5 minutes, but a customer's home router in an hour"
— the asymmetry that motivated this feature.

**Enforced at:** `src/domain/notifications/entities/DeviceNotificationPolicy.ts` (`setAlertDelayMinutes`, `effectiveAlertDelayMs`),
`src/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase.ts`
**Tests:** `tests/domain/notifications/entities/DeviceNotificationPolicy.test.ts`,
`tests/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase.test.ts`,
`tests/application/notifications/use-cases/UpsertDeviceNotificationPolicyUseCase.test.ts`,
`tests/integration/use-cases/notifications/UpsertDeviceNotificationPolicyUseCase.integration.test.ts`

### NOT-174 — Quiet hours suppress the outbound notification, never the alert record

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-02 · **Revised:** 2026-09-04

`MutedTypeAlertPublisher` (`NOT-190`) sits in the same composition chain and
follows the identical principle for a different axis — muted by alert type
rather than by device/time — so this entry's reasoning covers both.

`QuietHoursAlertPublisher` wraps the single shared `IAlertPublisher` every
alert-producing path uses — device down, device recovery, wireless open and
cleared alerts (`NOT-063`, `NOT-090`). During a device's configured window
it returns `Result.fail(QUIET_HOURS_SUPPRESSED)` without forwarding to the
real publisher. The window is the device's effective one (`NOT-170`): its
own for `CUSTOM`, the install's (`NOT-207`) for `INHERIT` or no policy row,
none for `ALWAYS_NOTIFY`. It never touches `Alert` or `WirelessAlertRecord` creation,
which happens earlier in each producing use case and is unaffected — a
device still opens its alert on schedule (`NOT-090`/`NOT-097`) and it
remains visible on `GET /api/alerts` regardless of quiet hours. Only the
Telegram push is muted. A failure to load the device's policy, or the
install's settings, fails open — the real publisher is still called — so an
infrastructure hiccup in either table never silently swallows a real alert.

**Why:** The alert is the operational record of the fault; the notification
is a best-effort page (`NOT-036`/`NOT-063` already separate these).
Suppressing the record itself during quiet hours would hide a real outage
from the dashboard, not just from the phone in someone's pocket at 3am — a
far larger consequence than what this feature asks for.

**Enforced at:** `src/infrastructure/notifications/QuietHoursAlertPublisher.ts`
**Tests:** `tests/infrastructure/notifications/QuietHoursAlertPublisher.test.ts`,
`tests/integration/notification-policy.routes.test.ts`

### NOT-175 — Suppressed down and open-wireless alerts retry once quiet hours end; suppressed recovery and cleared notifications are dropped

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-02 · **Revised:** 2026-09-04

Applies identically whether the suppression came back as `QUIET_HOURS_SUPPRESSED`
or `TYPE_MUTED_SUPPRESSED` (`NOT-190`) — both leave `notifiedAt` unset, and
both are excluded from the four call sites' error logging.

A publish failure — real or quiet-hours-suppressed — already means "don't
mark notified" everywhere in this context (`NOT-036`). Two paths already
rescan for exactly that state on their own schedule and so retry
automatically once a window ends: `PollWirelessDeviceUseCase.deliverPendingAlertNotifications`
re-queries `findActiveUnnotifiedByDevice` every poll cycle, and
`SendDeviceDownAlertUseCase` now does the same for its own alert type — when
`RaiseOverdueDeviceDownAlertsUseCase` re-selects a device with an existing
but unnotified open alert (`NOT-060`), the use case retries delivery instead
of handing the alert back untouched, closing a gap that also existed for
genuine Telegram outages before this change. `SendDeviceRecoveryAlertUseCase`
and `WirelessAlertClearedNotificationHandler` have no such record to
rescan — a resolved alert or a cleared condition is a one-shot transition,
so a notification suppressed there is simply not sent. All four call sites
compare the publish error against `QUIET_HOURS_SUPPRESSED` before logging,
so a device muted every night does not spam the error log the way a real
delivery failure would.

**Why:** Deferring a down alert matters because the fault might still be
true, and worth knowing, once quiet hours end. Deferring a "here's what
already got fixed" message does not — there is no morning-after value in
being told a metric that already recovered once recovered, so building a
redelivery queue for it would be unused machinery.

**Enforced at:** `src/application/notifications/use-cases/SendDeviceDownAlertUseCase.ts` (`notifyAndSave`),
`src/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.ts`,
`src/application/wireless-monitoring/event-handlers/WirelessAlertClearedNotificationHandler.ts`,
`src/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.ts` (`deliverPendingAlertNotifications`)
**Tests:** `tests/application/notifications/use-cases/SendDeviceDownAlertUseCase.test.ts`,
`tests/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.test.ts`,
`tests/application/wireless-monitoring/event-handlers/WirelessAlertClearedNotificationHandler.test.ts`,
`tests/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.test.ts`

### NOT-176 — Bulk policy updates apply one window/delay to an explicit device list, bucketed like other bulk actions

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-02

`BulkUpsertDeviceNotificationPoliciesUseCase` takes a required, non-empty
`deviceIds` list plus the same `quietHoursStart`/`quietHoursEnd`/`alertDelayMinutes`
fields as the single-device upsert, and delegates to
`UpsertDeviceNotificationPolicyUseCase` once per id. A device that fails
validation or does not exist is bucketed into `failed` with its error
message; every other device is bucketed into `updated`. One bad id in a
large batch never aborts the rest.

**Why:** The bucketed-response shape already established for bulk alert
actions (`NOT-038`/`NOT-039`) fits here too — an operator turning on quiet
hours for an entire location's worth of devices needs to see which ones
actually took the change, not an all-or-nothing failure that leaves them
guessing which id had the typo.

**Enforced at:** `src/application/notifications/use-cases/BulkUpsertDeviceNotificationPoliciesUseCase.ts`
**Reached from:** `PUT /api/notification-policies/bulk`
**Tests:** `tests/application/notifications/use-cases/BulkUpsertDeviceNotificationPoliciesUseCase.test.ts`,
`tests/integration/use-cases/notifications/BulkUpsertDeviceNotificationPoliciesUseCase.integration.test.ts`,
`tests/integration/notification-policy.routes.test.ts`

### NOT-177 — Notification policy reads and writes sit on the same permission tier as device configuration

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-09-02

| Endpoint                                      | Permission |
| --------------------------------------------- | ---------- |
| `GET /api/devices/:id/notification-policy`    | `read`     |
| `PUT /api/devices/:id/notification-policy`    | `update`   |
| `DELETE /api/devices/:id/notification-policy` | `update`   |
| `PUT /api/notification-policies/bulk`         | `update`   |

**Why:** This is device configuration, not alert triage — the same tier as
polling config (`PATCH /api/devices/:id/polling/config`, also `update`), not
the alert-specific split in `NOT-150`. There is no delete-tier permission
here at all: `DELETE` only resets a device to inheriting the install's quiet
hours (`NOT-170`), it
does not destroy history the way alert deletion does — gating it behind
administrator-only would mismatch the permission against what the action
actually risks.

**Enforced at:** `src/presentation/http/routes/notification-policy.routes.ts` (`authorize`)
**Tests:** `tests/integration/notification-policy.routes.test.ts`

### NOT-178 — Quiet hours never apply to an alert with no device

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-09-28

`QuietHoursAlertPublisher` forwards an alert whose `deviceId` is `null`
(`NOT-100`) without looking up a policy.

This holds for the install's window (`NOT-207`) too: an alert with no device
inherits nothing.

**Why:** Quiet hours are decided per device (`NOT-170`); an alert about an
agent has no device to carry a policy. An offline agent silences every device behind
it, so there is nothing a quiet window would be protecting.

**Enforced at:** `src/infrastructure/notifications/QuietHoursAlertPublisher.ts`
**Tests:** `tests/infrastructure/notifications/QuietHoursAlertPublisher.test.ts`

---

## Global alert-type muting

Quiet hours (`NOT-170`–`177`) and the delay override answer "when" and "for
which device." This answers a third, independent question: "which kind of
condition, ever." An operator drowning in wireless CPU/distance warnings
wants those off their phone permanently and everywhere, not on a schedule or
per radio — a `MutedAlertType` row is a standing, global decision, not a
per-device setting.

### NOT-190 — A muted alert type suppresses the outbound notification, never the alert record

**Type:** Policy · **Status:** Active
**Layer:** Application · Infrastructure
**Since:** 2026-09-04

`MutedTypeAlertPublisher` wraps the same shared `IAlertPublisher` instance
`QuietHoursAlertPublisher` wraps (composed around it — the mute check runs
first, since it is an in-memory-cheap lookup against a small table rather
than quiet hours' per-device query). It extracts the bare metric from
`AlertNotification.type` (`wireless:<metric>:<severity>` → `<metric>`; any
other type — `device_unreachable` — used verbatim) and, if that metric is in
the muted set, returns `Result.fail(TYPE_MUTED_SUPPRESSED)` without
forwarding. It never touches `Alert`/`WirelessAlertRecord` creation, which
happens earlier in each producing use case — a muted condition is still
fully visible on `GET /api/alerts`, only silent on Telegram. A failure to
load the muted set fails open, same reasoning as `NOT-174`.

**Why:** The alert record and the notification already have different jobs
(`NOT-063`) — muting is a delivery-side preference, and collapsing it into
the record would make a metric the operator doesn't want paged for
disappear from the dashboard too, which nobody asked for.

**Enforced at:** `src/infrastructure/notifications/MutedTypeAlertPublisher.ts`
**Tests:** `tests/infrastructure/notifications/MutedTypeAlertPublisher.test.ts`

### NOT-191 — Muting is by bare metric name, not by metric-and-severity

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-09-04

Muting `cpu_load_percent` silences both its `WARNING` and `CRITICAL` pushes.
There is no way to mute one severity of a metric and keep the other.

**Why:** The feature exists for "I don't need to be told about CPU at all,"
not "only page me for CPU at CRITICAL" — the latter is what `NOT-004`'s two
severities already express at the point a rule decides which one to raise.
A finer-grained mute would double the configuration surface for a
distinction the request that motivated this feature never asked for.

**Enforced at:** `src/infrastructure/notifications/MutedTypeAlertPublisher.ts` (`extractMetric`)
**Tests:** `tests/infrastructure/notifications/MutedTypeAlertPublisher.test.ts`

### NOT-192 — The muted-type list is global, not per-device

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-09-04

`MutedAlertType` has no `deviceId` — it is a standing, system-wide list, in
contrast to `DeviceNotificationPolicy` (`NOT-170`–`173`), which is 1:1 with a
device.

**Why:** Deliberate scope choice over a per-device mute: CPU or distance
noise is a property of the metric, not of any one radio, and the request
this feature answers ("I don't need CPU/distance alerts anywhere") is a
blanket preference. A per-device override can be added later without
changing this table's shape if a narrower need ever appears.

**Enforced at:** `src/domain/notifications/entities/MutedAlertType.ts`
**Tests:** `tests/domain/notifications/entities/MutedAlertType.test.ts`

### NOT-193 — A muted-type value is lowercase letters, digits and underscores, and is not validated against a fixed metric list

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-09-04

`MutedAlertType.create` rejects anything outside `^[a-z][a-z0-9_]*$` (empty
after trimming included) but does not check the value against the wireless
evaluator's actual rule set.

**Why:** A whitelist would make this context depend on wireless-monitoring's
metric vocabulary — the exact coupling ADR-0001 rejected for the alert
envelope itself. Rejecting the shape but not the specific value costs
nothing when a caller mistypes a real metric (it simply never matches
anything and mutes nothing, silently) but keeps this table decoupled from
the rule set that names the metrics.

**Enforced at:** `src/domain/notifications/entities/MutedAlertType.ts`,
`src/presentation/http/validation/notification-mute.schemas.ts`
**Tests:** `tests/domain/notifications/entities/MutedAlertType.test.ts`,
`tests/integration/notification-mute.routes.test.ts`

### NOT-194 — Replacing the muted-type list is wholesale, not incremental

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-04

`PUT /api/notification-mutes` replaces the entire set with the array sent —
there is no add/remove-one endpoint. `IMutedAlertTypeRepository.replaceAll`
deletes every row and reinserts the new set inside one transaction,
deduplicating and validating each entry first so a bad transaction never
partially applies.

**Why:** The list is short (on the order of the wireless evaluator's metric
count) and read as a settings screen an operator edits as a whole, the same
shape decision `NOT-176`'s bulk endpoint already made for notification
policies — a client re-sends the full desired state rather than diffing it
itself.

**Enforced at:** `src/application/notifications/use-cases/SetMutedAlertTypesUseCase.ts`,
`src/infrastructure/persistence/PrismaMutedAlertTypeRepository.ts`
**Reached from:** `PUT /api/notification-mutes`
**Tests:** `tests/application/notifications/use-cases/SetMutedAlertTypesUseCase.test.ts`,
`tests/infrastructure/persistence/PrismaMutedAlertTypeRepository.test.ts`,
`tests/integration/notification-mute.routes.test.ts`

### NOT-195 — Muted-type reads and writes sit on the same permission tier as notification policy

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-09-04

| Endpoint                      | Permission |
| ----------------------------- | ---------- |
| `GET /api/notification-mutes` | `read`     |
| `PUT /api/notification-mutes` | `update`   |

**Why:** Same reasoning as `NOT-177`: this is standing configuration of what
pages an operator, not alert triage, so it sits at the device-configuration
tier rather than the alert-specific split in `NOT-150`.

**Enforced at:** `src/presentation/http/routes/notification-mute.routes.ts` (`authorize`)
**Tests:** `tests/integration/notification-mute.routes.test.ts`

### NOT-196 — An alert with no device is never muted

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure
**Since:** 2026-09-28

`MutedTypeAlertPublisher` forwards an alert whose `deviceId` is `null`
(`NOT-100`) without consulting the muted set, even if its type is on it.

**Why:** These alerts are about the monitoring itself — an agent offline means
the whole site is unwatched and no device alert can reach anyone (ADR 0002,
R7). Muting it would hide the one message that says monitoring has stopped.
The vendor copy of the same alert must go out regardless of any install's
preferences.

**Enforced at:** `src/infrastructure/notifications/MutedTypeAlertPublisher.ts`
**Tests:** `tests/infrastructure/notifications/MutedTypeAlertPublisher.test.ts`

---

## Install notification settings

### NOT-200 — The install's Telegram chat, down-alert delay and wireless switch are edited from the dashboard

**Type:** Invariant · **Status:** Active
**Layer:** Domain · Application · Infrastructure
**Since:** 2026-09-30

Four settings are stored per install and replaced together:

| Setting                 | Allowed values                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `telegramChatId`        | a numeric chat id (groups are negative) or a public `@channel` name; `null` = none |
| `downAlertDelayMinutes` | a whole number from 0 to 1440                                                      |
| `wirelessAlertsEnabled` | `true` or `false`                                                                  |
| `alertTicketMode`       | `SUGGEST` or `AUTOMATIC` (`NOT-205`)                                               |

`alertTicketMode` alone may be left out of a save, which keeps the saved mode,
so a dashboard that predates it can still save the other three.

Spaces around the chat id are trimmed and an empty one means `null`. A save
takes effect on the next alert, with no restart: the chat is looked up on
every send, the delay on every overdue scan (`NOT-097`), and the wireless
switch on every wireless notification (`NOT-203`). With no chat, alerts are
still recorded and listed; the send fails and they stay unnotified. The bot
token never leaves the server's environment.

**Why:** Until now each of these needed the vendor to edit the server's env
and restart it. They are the customer's own preferences — where their alerts
go and how patient the system is — so the customer's administrator sets them.
The token is a secret that lets anyone post as the bot; it stays where only the
vendor can see it.

**Enforced at:** `src/domain/notifications/value-objects/NotificationSettings.ts`, `src/application/notifications/use-cases/UpdateNotificationSettingsUseCase.ts`, `src/infrastructure/persistence/PrismaNotificationSettingsRepository.ts`, `src/infrastructure/notifications/TelegramNotificationService.ts`, `src/infrastructure/di/container.ts`
**Reached from:** `GET`, `PUT /api/notification-settings`
**Tests:** `tests/domain/notifications/value-objects/NotificationSettings.test.ts`, `tests/application/notifications/use-cases/NotificationSettingsUseCases.test.ts`, `tests/infrastructure/notifications/TelegramNotificationService.test.ts`, `tests/integration/use-cases/notifications/UpdateNotificationSettingsUseCase.integration.test.ts`, `tests/integration/notification-settings.routes.test.ts`

### NOT-201 — Until the administrator saves them, the settings come from the env

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (composition)
**Since:** 2026-09-30

With nothing saved, the settings are `TELEGRAM_CHAT_ID` (unset = no chat),
`DEVICE_DOWN_ALERT_DELAY_MINUTES` (unset = 60) and
`WIRELESS_ALERT_NOTIFICATIONS_ENABLED` (anything but `false` = on), and
`alertTicketMode` is `SUGGEST` — no env value predates it. An env
value that `NOT-200` would refuse stops the boot. Once saved, the stored values
win and the env ones are ignored. The table holds at most one row.

**Why:** Every install ran on these env values before the dashboard could edit
them; reading them as defaults means an upgrade changes nothing until someone
saves. Refusing a bad env value at boot keeps the defaults inside the same
rules as a save, instead of failing quietly at the first alert.

**Enforced at:** `src/infrastructure/di/notificationSettingsDefaults.ts`, `src/infrastructure/persistence/PrismaNotificationSettingsRepository.ts`, `src/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase.ts`
**Tests:** `tests/infrastructure/di/notificationSettingsDefaults.test.ts`, `tests/integration/use-cases/notifications/GetNotificationSettingsUseCase.integration.test.ts`, `tests/integration/use-cases/notifications/RaiseOverdueDeviceDownAlertsUseCase.integration.test.ts`, `tests/integration/notification-settings.routes.test.ts`

### NOT-202 — A test message checks a chat before relying on it

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-30

`POST /api/notification-settings/test` sends one message, in Spanish, to the
chat given in the body — or the saved chat when none is given — and stores
nothing. The given chat must pass the same check as a save (`400`). With no
chat at all it answers `409`; when Telegram refuses the message it answers
`502` with Telegram's reason (for example, the bot is not in that group).

**Why:** A wrong chat id, or a group the bot was never added to, is the usual
way alerts silently go nowhere. Trying the chat from the form, before saving,
lets the administrator see the message arrive and fix it on the spot.

**Enforced at:** `src/application/notifications/use-cases/SendTestNotificationUseCase.ts`, `src/infrastructure/notifications/TelegramTestMessageSender.ts`
**Reached from:** `POST /api/notification-settings/test`
**Tests:** `tests/application/notifications/use-cases/NotificationSettingsUseCases.test.ts`, `tests/integration/use-cases/notifications/SendTestNotificationUseCase.integration.test.ts`, `tests/integration/notification-settings.routes.test.ts`

### NOT-203 — Switching wireless alert notifications off withholds the message, never the alert

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (composition)
**Since:** 2026-09-30

While `wirelessAlertsEnabled` is `false`, every wireless alert and clear
notification is withheld, the same way quiet hours withhold one (`NOT-174`):
the alert record is created and listed as usual and stays unnotified. Alerts
still open when the switch goes back on are sent then. Device down and
recovery alerts are not affected. If the settings cannot be read, the message
goes out.

**Why:** Wireless polling is worth running before its thresholds are tuned,
and paging staff during that time teaches them to ignore the chat. Keeping the
records means nothing is lost while it is off. Failing open matches mutes
(`NOT-190`): a lost alert costs more than an unwanted one.

**Enforced at:** `src/infrastructure/notifications/SwitchedOffAlertPublisher.ts`, `src/application/shared/interfaces/IAlertPublisher.ts` (`WIRELESS_ALERTS_OFF_SUPPRESSED`), `src/infrastructure/di/container.ts`
**Tests:** `tests/infrastructure/notifications/SwitchedOffAlertPublisher.test.ts`

### NOT-204 — Everyone reads the notification settings; the administrator changes them

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-09-30

| Endpoint                               | Permission        |
| -------------------------------------- | ----------------- |
| `GET /api/notification-settings`       | `read`            |
| `PUT /api/notification-settings`       | `manage-settings` |
| `POST /api/notification-settings/test` | `manage-settings` |

**Why:** Staff may want to know where alerts go, but redirecting them is a
decision for whoever answers for the install (`IDN-034`). The test message is
on the same permission because it posts to a chat of the caller's choosing.

**Enforced at:** `src/presentation/http/routes/notification-settings.routes.ts` (`authorize`)
**Tests:** `tests/integration/notification-settings.routes.test.ts`

### NOT-205 — A new alert suggests a ticket unless the administrator chose automatic tickets

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (composition)
**Since:** 2026-10-14

In `SUGGEST` mode, the default, a new alert opens no ticket: it is recorded,
notified and listed as usual, and the alert list offers a ticket for it
(`NOT-206`), which a person accepts or ignores (`TKT-115`). In `AUTOMATIC` mode
every alert that opened a ticket before still does, folded per device
(`TKT-113`). The mode is read on every alert, so a save applies from the next
one. If the settings cannot be read, nothing is opened and the alert still
offers its ticket.

**Why:** Opening a ticket for every alert filled the technicians' day sheets
with faults that cleared on their own. A person looking at the alert knows
whether it is worth a visit. Failing towards a suggestion loses nothing — the
alert still offers the ticket — whereas a wrong automatic ticket lands on
someone's day.

**Enforced at:** `src/infrastructure/notifications/TicketModeGatedOpener.ts`, `src/domain/notifications/value-objects/NotificationSettings.ts`, `src/infrastructure/di/container.ts`
**Tests:** `tests/infrastructure/notifications/TicketModeGatedOpener.test.ts`, `tests/domain/notifications/value-objects/NotificationSettings.test.ts`, `tests/integration/use-cases/notifications/UnifiedAlertRecording.integration.test.ts`

### NOT-206 — An open alert with no ticket of its own offers one

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-14

Each alert in `GET /api/alerts` carries `ticket` — its own live ticket (open,
assigned or in progress) with id, code and status, or `null` — and
`ticketSuggested`, which is `true` when the alert is open and `ticket` is
`null`. A ticket opened for another alert on the same device does not count,
and neither does a resolved or cancelled one. On an install without the
tickets module nothing is suggested. The suggestion is the same in both ticket
modes.

**Why:** A device can be failing in two unrelated ways — poor radio
performance and a disconnected LAN — and each may be its own job. Showing the
suggestion even in automatic mode lets a person split an alert out of the
device's folded ticket. A resolved alert stops nagging, though a person can
still raise a ticket for it (`TKT-115`).

**Enforced at:** `src/application/notifications/use-cases/ListAlertsUseCase.ts`, `src/infrastructure/persistence/PrismaAlertListQuery.ts`
**Reached from:** `GET /api/alerts`
**Tests:** `tests/application/notifications/use-cases/ListAlertsUseCase.test.ts`, `tests/integration/alert.routes.test.ts`

### NOT-207 — The administrator can set install-wide quiet hours, which every inheriting device follows

**Type:** Policy · **Status:** Active
**Layer:** Domain · Application · Infrastructure
**Since:** 2026-10-26

`NotificationSettings.quietHours` is an optional `HH:mm` window, saved with
the other settings from `PUT /api/notification-settings` as `quietHoursStart`
and `quietHoursEnd`. The pair is sent together or not at all — omitted, the
saved window is kept; both `null` clears it. The bounds follow `NOT-171` and
`NOT-172`. It starts empty on every install (no env predates it), so nothing
is silenced until the administrator sets it. Every device in `INHERIT` mode,
and every device with no policy row, follows it from the next alert
(`NOT-170`); a `CUSTOM` device uses its own window and an `ALWAYS_NOTIFY`
device is never silenced. A suppressed notification behaves as any other
quiet-hours suppression (`NOT-174`, `NOT-175`).

**Why:** Setting the same window on every device one bulk update at a time
(`NOT-176`) copied it per device, so a device added later had none and moving
the window meant re-running the bulk update. One install-wide window that
devices inherit by default is what "the network sleeps at night, except the
core" actually means.

**Enforced at:** `src/domain/notifications/value-objects/NotificationSettings.ts`,
`src/application/notifications/use-cases/UpdateNotificationSettingsUseCase.ts`,
`src/presentation/http/validation/notification-settings.schemas.ts`,
`src/infrastructure/notifications/QuietHoursAlertPublisher.ts`
**Backed by:** `notification_settings_quiet_hours_both_or_neither` CHECK constraint, migration `20261026120000`
**Reached from:** `PUT /api/notification-settings`
**Tests:** `tests/application/notifications/use-cases/NotificationSettingsUseCases.test.ts`,
`tests/infrastructure/notifications/QuietHoursAlertPublisher.test.ts`,
`tests/integration/use-cases/notifications/UpdateNotificationSettingsUseCase.integration.test.ts`,
`tests/integration/notification-settings.routes.test.ts`

---

## Phone notifications (Web Push)

The dashboard can be installed on a phone as an app (a PWA). Once a user turns
notifications on, every alert that would go to the install's Telegram chat also
shows up on that phone as a notification. These rules cover who receives
notifications and how a phone's subscription is kept.

### NOT-220 — A phone is subscribed by the push service's https address and its two keys

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-10-13

A subscription is what the phone's browser hands over when the user allows
notifications: an `endpoint` (the push service's address for that browser) and
two keys, `p256dh` and `auth`, which encrypt every message to it. The endpoint
must be an `https` URL of at most 2048 characters. Each key must be base64url
and at most 255 characters. The browser's user agent is kept so the user can
tell their phones apart. It is cut to 255 characters, and a blank one is
stored as none.

**Why:** The server makes a request to whatever endpoint it is given. Real push
services (Google, Apple, Mozilla) are only ever on https, so refusing anything
else stops a forged subscription from pointing the server at an address inside
the network.

**Enforced at:** `src/domain/notifications/entities/PushSubscription.ts`, `src/presentation/http/validation/push.schemas.ts`
**Reached from:** `POST /api/push/subscriptions`
**Tests:** `tests/domain/notifications/entities/PushSubscription.test.ts`, `tests/integration/use-cases/notifications/SubscribePushUseCase.integration.test.ts`, `tests/integration/push.routes.test.ts`

### NOT-221 — One phone, one subscription: the latest user to subscribe it owns it

**Type:** Invariant · **Status:** Active
**Layer:** Infrastructure (database)
**Since:** 2026-10-13

The endpoint is unique. If the same phone subscribes again, the existing row is
updated with the new keys. If a different user signs in on that phone and
subscribes, the row moves to them.

**Why:** A browser has one endpoint, so two rows for it would deliver every
alert twice. A shared phone belongs to whoever is using it now.

**Enforced at:** `prisma/schema.prisma` (`PushSubscription.endpoint @unique`), `src/infrastructure/persistence/PrismaPushSubscriptionRepository.ts` (`save`)
**Tests:** `tests/integration/use-cases/notifications/SubscribePushUseCase.integration.test.ts`

### NOT-222 — Every subscribed phone gets every alert the Telegram chat gets, and push never holds Telegram back

**Type:** Policy · **Status:** Active
**Layer:** Application · Infrastructure (composition)
**Since:** 2026-10-13

Push sits next to the install's Telegram chat, inside the same filters:
expired subscription (`R17`), quiet hours (`NOT-174`), muted types
(`NOT-190`) and the wireless switch (`NOT-203`). If one of those holds an
alert back from Telegram, the phones don't get it either. Every user's phones
receive it, whatever their role. A phone that fails costs only its own copy.
Push failures are logged and never reported to the alert, so the alert does not
stay unnotified and the Telegram message is not sent a second time. The
vendor's chat (`AGT-023`) and subscriber WhatsApp notices are not pushed.

**Why:** The phone is a second way of reaching the same people the chat
reaches, so it follows the same rules. Telegram remains the delivery that
counts. A phone switched off for the night must not make Telegram resend.

**Enforced at:** `src/application/notifications/use-cases/SendPushAlertUseCase.ts`, `src/application/notifications/shared/PushDelivery.ts`, `src/infrastructure/notifications/PushAlertPublisher.ts`, `src/infrastructure/di/container.ts`
**Tests:** `tests/application/notifications/use-cases/PushUseCases.test.ts`, `tests/infrastructure/notifications/PushAlertPublisher.test.ts`, `tests/integration/use-cases/notifications/SendPushAlertUseCase.integration.test.ts`

### NOT-223 — A disabled user's phones stop receiving alerts; a deleted user's phones are forgotten

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (database)
**Since:** 2026-10-13

Alerts skip the phones of a disabled account (`IDN-013`). Its subscriptions
are kept, so re-enabling the account brings its notifications back. Deleting a
user deletes their subscriptions.

**Why:** Someone who has left the company must stop seeing the network's
faults on their personal phone the moment they are disabled.

**Enforced at:** `src/infrastructure/persistence/PrismaPushSubscriptionRepository.ts` (`listActive`), `prisma/schema.prisma` (`onDelete: Cascade`)
**Tests:** `tests/integration/use-cases/notifications/SendPushAlertUseCase.integration.test.ts`, `tests/integration/use-cases/notifications/SubscribePushUseCase.integration.test.ts`

### NOT-224 — A subscription the push service reports gone is deleted

**Type:** Policy · **Status:** Active
**Layer:** Application · Infrastructure
**Since:** 2026-10-13

When the push service answers `404` or `410`, the subscription is deleted. That
happens when the user uninstalled the app, revoked permission, or the
subscription expired. Any other failure (a `5xx`, a timeout) keeps it for the
next alert.

**Why:** A gone endpoint never comes back. Trying it on every alert wastes a
request and fills the log. A temporary outage at the push service is no reason
to drop someone's phone.

**Enforced at:** `src/infrastructure/notifications/WebPushSender.ts`, `src/application/notifications/shared/PushDelivery.ts`
**Tests:** `tests/infrastructure/notifications/WebPushSender.test.ts`, `tests/application/notifications/use-cases/PushUseCases.test.ts`, `tests/integration/use-cases/notifications/SendPushAlertUseCase.integration.test.ts`

### NOT-225 — Any signed-in user turns notifications on or off for their own phones only

**Type:** Policy · **Status:** Active
**Layer:** Presentation · Application
**Since:** 2026-10-13

| Endpoint                         | Permission |
| -------------------------------- | ---------- |
| `GET /api/push/public-key`       | `read`     |
| `POST /api/push/subscriptions`   | `read`     |
| `DELETE /api/push/subscriptions` | `read`     |
| `POST /api/push/test`            | `read`     |

A subscription is always saved for the caller. Unsubscribing removes only the
caller's own subscription. If nothing of theirs was subscribed at that
endpoint, the request still succeeds and changes nothing.

**Why:** Getting notifications on your own phone changes nothing for anyone
else, so even a viewer may do it. Unsubscribing succeeding without a match
lets the phone's switch always settle, even after the subscription has expired.

**Enforced at:** `src/presentation/http/routes/push.routes.ts`, `src/presentation/http/controllers/PushController.ts`, `src/application/notifications/use-cases/UnsubscribePushUseCase.ts`
**Tests:** `tests/integration/push.routes.test.ts`, `tests/integration/use-cases/notifications/UnsubscribePushUseCase.integration.test.ts`

### NOT-226 — A test notification reaches only the caller's own phones

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-13

The test is sent in Spanish to each phone the caller has subscribed. It fails
when they have none (`409`) or when none of them received it (`502`).
Nothing is stored, except that phones reported gone are deleted
(`NOT-224`).

**Why:** The user needs to see a notification arrive before trusting the phone
with real alerts. Other people's phones must not buzz for someone else's test.

**Enforced at:** `src/application/notifications/use-cases/SendTestPushUseCase.ts`
**Tests:** `tests/application/notifications/use-cases/PushUseCases.test.ts`, `tests/integration/use-cases/notifications/SendTestPushUseCase.integration.test.ts`, `tests/integration/push.routes.test.ts`

### NOT-227 — A recovery replaces the outage notification it ends

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-13

Each notification carries a tag, `<alert type>:<device id>` (or
`<alert type>:install` for alerts not about a device). The phone replaces an
earlier notification with the same tag instead of stacking a new one. Open
alerts are sent as urgent. Recoveries are sent at normal urgency. A message the
phone could not receive within 24 hours is dropped. Tapping a device alert
opens that device's page. Any other alert opens the alert list.

**Why:** "Torre Norte caída" followed by "Torre Norte en línea" should leave
one line on the lock screen, not two. An alert more than a day old belongs in
the dashboard's history, not in a notification.

**Enforced at:** `src/application/notifications/use-cases/SendPushAlertUseCase.ts`, `src/infrastructure/notifications/WebPushSender.ts`
**Tests:** `tests/application/notifications/use-cases/PushUseCases.test.ts`, `tests/infrastructure/notifications/WebPushSender.test.ts`

### NOT-228 — Phone notifications are on only when the server has its VAPID keys

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (composition)
**Since:** 2026-10-13

`VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` turn push on. Generate them with
`npx web-push generate-vapid-keys`, once per install. If both are unset, push
is off: the public-key endpoint reports `enabled: false`, subscribing and
testing answer `503`, and alerts go to Telegram alone. One key without the
other stops the boot. So does a contact the push services would refuse:
`VAPID_SUBJECT` must be a `mailto:` or `https://` address, and when it is
unset, `APP_PUBLIC_URL` is used, which then must be https.

**Why:** Phones only accept messages signed with the key they subscribed with.
Changing the keys silently disconnects every phone, so they belong in the
server's env, set once. A half-configured server would otherwise fail every
alert later instead of failing at startup.

**Enforced at:** `src/infrastructure/notifications/config/webPushConfig.ts`, `src/infrastructure/di/container.ts`, `src/presentation/http/controllers/PushController.ts`
**Tests:** `tests/infrastructure/notifications/config/webPushConfig.test.ts`, `tests/integration/push.routes.test.ts`

---

## Outages behind an upstream device

Every device can hang off an upstream device (DEV-180). When an AP, a switch or
a backhaul goes down, everything behind it stops answering too. These rules make
that one page for the device that actually failed, naming everything that went
down with it, instead of one page per client.

The order of events for a typical outage: the AP and its clients go down, and
each gets its alert record at once (NOT-097). The scan finds the clients past
their delay first and attaches them to the AP's record without paging. When
the AP's own delay runs out, it pages once, naming every client down behind it.
Clients that drop later join silently. When the AP comes back, one message says
who came back with it and who did not.

### NOT-240 — A device down behind a device that is also down is not paged on its own

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-29

When a device's down alert is due, the scan walks its upstream chain (DEV-180)
to the root. If any device on the chain is down, this device is *affected*:
its alert is recorded, but no Telegram message, phone notification or ticket
goes out for it, now or later. A device on the chain that is not down, or whose
state nobody is measuring (behind an agent that is not reporting, NOT-101), is
walked past rather than blamed.

If a read the decision needs fails (the device's own alert, or the chain),
the device pages as before. A stray page is cheaper than a missed outage.

**Why:** An AP with 40 clients that loses power used to send 41 messages. The
one that matters, the AP, was buried among the rest.

**Enforced at:** `src/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase.ts` (`attributedUpstream`), `src/infrastructure/persistence/PrismaOutageTopologyQuery.ts`
**Tests:** `tests/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase.test.ts`, `tests/integration/use-cases/notifications/RaiseOverdueDeviceDownAlertsUseCase.integration.test.ts`

### NOT-241 — An affected device's alert joins the alert of the highest device down above it

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-10-29

The affected device's alert is linked (`causedByAlertId`) to the open alert of
the **highest** down device on its chain, the *root*. With a switch and the AP
below it both down, the AP and its clients all join the switch's alert. An alert
can be linked only while it is open and has not been notified, and never to
itself. Deleting the root alert unlinks the alerts that joined it.

**Why:** The highest device down is the real fault. The AP below a dead switch
is down only because the switch is.

**Enforced at:** `src/domain/notifications/services/OutageAttribution.ts` (`rootCause`), `src/domain/notifications/aggregates/Alert.ts` (`attachTo`), `prisma/migrations/20261029120000_alert_caused_by`
**Tests:** `tests/domain/notifications/services/OutageAttribution.test.ts`, `tests/domain/notifications/aggregates/Alert.test.ts`, `tests/integration/use-cases/notifications/RaiseOverdueDeviceDownAlertsUseCase.integration.test.ts`, `tests/integration/use-cases/notifications/GetAlertByIdUseCase.integration.test.ts`

### NOT-242 — An affected device waits while its root has no alert yet

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-10-29

If the root is down but has no open alert yet, the affected device is neither
paged nor linked. It is decided again on the next scan. The root's alert record
opens the moment it goes down (NOT-097), so in practice the wait is a few
seconds. A root that is down with a longer alert delay than its clients does
not let them page: they are linked to its record and stay silent until it
pages.

**Why:** Which device the scan notices first must not decide who pages.

**Enforced at:** `src/domain/notifications/services/OutageAttribution.ts` (`decide`)
**Tests:** `tests/domain/notifications/services/OutageAttribution.test.ts`, `tests/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase.test.ts`, `tests/integration/use-cases/notifications/RaiseOverdueDeviceDownAlertsUseCase.integration.test.ts`

### NOT-243 — The root's message names the devices down behind it

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-29

Just before the root pages, every device in its subtree that has an open,
unnotified down alert is linked to it, even one whose own delay has not run out.
The message then names them. Each channel gets a different amount of detail:

| Channel                       | What it names                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| Telegram                      | Up to 30, one line per device hanging off the root, with what is behind it after an arrow; then `…y N más (ver panel)` |
| Phone notification            | The first 3, then `y N más`                                                                |
| Ticket                        | All of them, each with the device it hangs from                                            |
| `GET /api/alerts/:id`         | All of them, each with whether it is still down; the list shows `affectedCount`            |

A device that already paged on its own before the root went down keeps its own
alert and is not named. If the list cannot be read, the root still pages,
without it.

**Why:** "AP Torre Norte caído" alone does not tell the team which customers
are affected. A bare count ("23 afectados") does not either.

**Enforced at:** `src/application/notifications/shared/OutageRollup.ts`, `src/application/notifications/shared/OutageMessages.ts`, `src/application/notifications/use-cases/SendDeviceDownAlertUseCase.ts`, `src/application/notifications/use-cases/GetAlertByIdUseCase.ts`, `src/infrastructure/notifications/PushAlertPublisher.ts`, `src/infrastructure/persistence/PrismaAlertListQuery.ts`
**Reached from:** `GET /api/alerts`, `GET /api/alerts/:id`
**Tests:** `tests/application/notifications/shared/OutageRollup.test.ts`, `tests/application/notifications/shared/OutageMessages.test.ts`, `tests/application/notifications/use-cases/SendDeviceDownAlertUseCase.test.ts`, `tests/application/notifications/use-cases/GetAlertByIdUseCase.test.ts`, `tests/infrastructure/notifications/PushAlertPublisher.test.ts`, `tests/integration/use-cases/notifications/SendDeviceDownAlertUseCase.integration.test.ts`, `tests/integration/use-cases/notifications/GetAlertByIdUseCase.integration.test.ts`, `tests/integration/alert.routes.test.ts`

### NOT-244 — A device that goes down after the root paged joins silently

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-29

A device behind the root that goes down after the root's page is linked to it
when its own delay runs out. It shows under the root on the dashboard, but
nothing new is sent.

**Why:** One page per outage. A client losing power ten minutes into an AP
outage is not news.

**Enforced at:** `src/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase.ts`
**Tests:** `tests/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase.test.ts`, `tests/integration/use-cases/notifications/RaiseOverdueDeviceDownAlertsUseCase.integration.test.ts`

### NOT-245 — The root's recovery says who is still down; they page on their own once their delay passes again

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-10-29

The root's recovery message adds who came back and who did not:
`Volvieron 6 de 7. Siguen caídos: Cliente Ruiz` (or `Volvieron los 7
afectados.`). Devices still down stay linked to the resolved root until their
own alert delay has passed since the root came back. Then they are unlinked and
judged like any other device: they page on their own, or join a new root if one
is down above them.

**Why:** A CPE takes a minute or two to reconnect after its AP boots. Paging
for it on the next scan would bring back the flood this was meant to stop. A
client still down a full delay after its AP is back is a separate fault.

**Enforced at:** `src/domain/notifications/services/OutageAttribution.ts` (`stillHeld`), `src/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase.ts`, `src/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.ts`
**Tests:** `tests/domain/notifications/services/OutageAttribution.test.ts`, `tests/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase.test.ts`, `tests/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.test.ts`, `tests/application/notifications/shared/OutageMessages.test.ts`, `tests/integration/use-cases/notifications/RaiseOverdueDeviceDownAlertsUseCase.integration.test.ts`, `tests/integration/use-cases/notifications/SendDeviceRecoveryAlertUseCase.integration.test.ts`

### NOT-246 — An affected device that recovers is closed silently

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-29

An affected device was never paged, so its recovery closes its alert without a
message, the same as a blip shorter than the delay (NOT-098). It is reported in
the root's recovery message instead (NOT-245).

**Why:** Nobody was told it went down, so a message saying it is back would
make no sense.

**Enforced at:** `src/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.ts`
**Tests:** `tests/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.test.ts`, `tests/integration/use-cases/notifications/SendDeviceRecoveryAlertUseCase.integration.test.ts`

### NOT-247 — Quiet hours and mutes apply to the root alert only

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-29

The root's page goes through quiet hours (NOT-170) and muted types (NOT-190)
like any other down alert, and is sent once they lift. Affected devices are
never paged, so there is nothing of theirs to hold back. While the root's page
waits out quiet hours, the devices behind it stay linked and silent.

**Why:** An outage at 3 a.m. under quiet hours should wake nobody. Neither
should the 40 clients behind it.

**Enforced at:** `src/application/notifications/use-cases/SendDeviceDownAlertUseCase.ts`, `src/infrastructure/notifications/QuietHoursAlertPublisher.ts`
**Tests:** `tests/application/notifications/use-cases/SendDeviceDownAlertUseCase.test.ts`

## In-app inbox

Inside the dashboard, each user has an inbox: a list of what the install told its
staff, with a bell showing how many they haven't read yet. Telegram and phone
notifications reach people outside the app. The inbox keeps a copy that's still
there when they come back. These rules cover how a user reads their inbox. Which
notices land in it is covered by later rules in this range.

### NOT-260 — Every user has their own inbox and reaches only their own

**Type:** Policy · **Status:** Active
**Layer:** Application · Presentation
**Since:** 2026-10-27

Each recipient gets their own copy of a notification, so reading it marks it read
for that user alone. Every role can open its inbox. Listing, counting and
marking only ever touch the caller's own notifications. Asking to mark another
user's notification as read answers "not found", the same as for an id that
doesn't exist. A deleted user's inbox goes with them.

**Why:** One operator reading a notice doesn't mean the others have seen it.
Answering "not found" rather than "forbidden" doesn't reveal that someone else
has that notification.

**Enforced at:** `src/domain/notifications/repository/IInboxNotificationRepository.ts`, `src/infrastructure/persistence/PrismaInboxNotificationRepository.ts`, `src/application/notifications/use-cases/MarkInboxNotificationReadUseCase.ts`, `src/presentation/http/routes/inbox-notification.routes.ts`, `prisma/schema.prisma` (`InboxNotification.user`, `onDelete: Cascade`)
**Reached from:** `GET /api/notifications`, `GET /api/notifications/unread-count`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`
**Tests:** `tests/integration/inbox-notification.routes.test.ts`, `tests/integration/use-cases/notifications/ListInboxNotificationsUseCase.integration.test.ts`, `tests/integration/use-cases/notifications/MarkInboxNotificationReadUseCase.integration.test.ts`, `tests/integration/use-cases/notifications/MarkAllInboxNotificationsReadUseCase.integration.test.ts`

### NOT-261 — The inbox lists newest first, 20 at a time, optionally unread only

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-27

The list is ordered by when each notification arrived, newest first. A page
holds 20 by default and at most 100. The list can be limited to unread
notifications. Every page also reports the total for the current filter, whether
more pages follow, and the user's unread count.

**Why:** The newest notice is the one that matters. Including the unread count
with each page keeps the bell in step without a second request.

**Enforced at:** `src/application/notifications/use-cases/ListInboxNotificationsUseCase.ts`, `src/infrastructure/persistence/PrismaInboxNotificationRepository.ts` (`listForUser`), `src/presentation/http/validation/inbox-notification.schemas.ts`
**Reached from:** `GET /api/notifications`
**Tests:** `tests/application/notifications/use-cases/InboxNotificationUseCases.test.ts`, `tests/integration/use-cases/notifications/ListInboxNotificationsUseCase.integration.test.ts`, `tests/integration/inbox-notification.routes.test.ts`

### NOT-262 — A notification remembers when it was first read

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-10-27

Reading a notification records the time. Reading it again, or marking all as
read, keeps the original time. There is no way to mark a notification unread.

**Why:** The first read is when the user learned about it. Overwriting that time
would lose it.

**Enforced at:** `src/domain/notifications/entities/InboxNotification.ts` (`markRead`), `src/infrastructure/persistence/PrismaInboxNotificationRepository.ts` (`markAllRead`)
**Reached from:** `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`
**Tests:** `tests/domain/notifications/entities/InboxNotification.test.ts`, `tests/integration/use-cases/notifications/MarkInboxNotificationReadUseCase.integration.test.ts`, `tests/integration/use-cases/notifications/MarkAllInboxNotificationsReadUseCase.integration.test.ts`

### NOT-263 — "Mark all as read" covers only the caller's unread notifications

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-27

Every unread notification of the caller is marked read at once, and the answer
says how many there were. Other users' inboxes are untouched.

**Why:** After an incident with dozens of notices, nobody should have to clear
them one by one.

**Enforced at:** `src/application/notifications/use-cases/MarkAllInboxNotificationsReadUseCase.ts`
**Reached from:** `POST /api/notifications/read-all`
**Tests:** `tests/application/notifications/use-cases/InboxNotificationUseCases.test.ts`, `tests/integration/use-cases/notifications/MarkAllInboxNotificationsReadUseCase.integration.test.ts`, `tests/integration/inbox-notification.routes.test.ts`

### NOT-264 — A notification is filed under a category taken from its alert type

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-10-27 · **Revised:** 2026-10-27 (`device_discovered`, DEV-206)

| Alert type                               | Category   |
| ---------------------------------------- | ---------- |
| `device_unreachable`, `device_discovered` | `device`   |
| `wireless:<metric>:<severity>`           | `wireless` |
| `agent_offline`, `agent_clock`, …        | `agent`    |
| `backup_failing`                         | `backup`   |
| `sign_in_paused`, `two_factor_reset`     | `security` |
| anything else                            | `other`    |

**Why:** The inbox shows an icon for each kind of notice. The category is
worked out from the type when the notification is created, so a producer cannot
file one in the wrong place.

**Enforced at:** `src/domain/notifications/entities/InboxNotification.ts` (`categoryFor`)
**Tests:** `tests/domain/notifications/entities/InboxNotification.test.ts`

### NOT-265 — An open dashboard tab sees its user's unread count change live

**Type:** Policy · **Status:** Active
**Layer:** Application · Presentation
**Since:** 2026-10-27

Each open tab can hold a live stream of its user's own inbox. The stream opens
with the user's unread count and sends the new count whenever it changes, such
as when the user reads a notification in another tab. A user holds at most 10
inbox streams at once. These count toward the install-wide limit of 200 live
streams of any kind. A stream carries only the signed-in user's own inbox.

**Why:** The bell badge must stay right in every open tab without each one
asking the server every few seconds. Each tab keeps its stream open the whole
time, so the per-user limit is higher than the 5 that the other live screens
share.

**Enforced at:** `src/application/notifications/shared/InboxStream.ts`, `src/application/notifications/use-cases/MarkInboxNotificationReadUseCase.ts`, `src/application/notifications/use-cases/MarkAllInboxNotificationsReadUseCase.ts`, `src/presentation/http/controllers/InboxStreamController.ts`, `src/presentation/http/routes/inbox-stream.routes.ts`
**Reached from:** `GET /api/notifications/stream`
**Tests:** `tests/application/notifications/shared/InboxStream.test.ts`, `tests/presentation/http/controllers/InboxStreamController.test.ts`, `tests/integration/inbox-stream.routes.test.ts`, `tests/integration/use-cases/notifications/MarkInboxNotificationReadUseCase.integration.test.ts`, `tests/integration/use-cases/notifications/MarkAllInboxNotificationsReadUseCase.integration.test.ts`

### NOT-266 — Every active account gets each notice; security notices go to administrators only

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-27

Each notice the install sends its staff is added to the inbox of every account
that is not disabled. The exception is security notices (`sign_in_paused`,
`two_factor_reset`): only `ADMIN` and `VENDOR` accounts get those. The copy keeps
the notice's first line as its title, the full detail as its body, and the
device it is about. A device outage or recovery also links to its alert, so
the inbox can open it. To make that link possible, a new outage alert is stored
before its notice goes out. Deleting the device or the alert unlinks the copy
and leaves the notice itself in the inbox.

**Why:** Everyone on staff can act on a fault, so everyone gets the notice.
Notices about who is locked out of an account are for the people who manage
accounts. A disabled account cannot sign in, so filling its inbox would only
store rows nobody reads.

**Enforced at:** `src/application/notifications/use-cases/RecordInboxNotificationUseCase.ts`, `src/application/notifications/interfaces/IInboxRecipientsQuery.ts`, `src/infrastructure/persistence/PrismaInboxRecipientsQuery.ts`, `src/application/notifications/use-cases/SendDeviceDownAlertUseCase.ts`, `src/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.ts`
**Tests:** `tests/application/notifications/use-cases/InboxNotificationUseCases.test.ts`, `tests/application/notifications/use-cases/SendDeviceDownAlertUseCase.test.ts`, `tests/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.test.ts`, `tests/integration/use-cases/notifications/RecordInboxNotificationUseCase.integration.test.ts`

### NOT-267 — The inbox records what Telegram and phones are kept quiet about, once each

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (composition)
**Since:** 2026-10-27

The inbox is recorded before any filter that silences a delivery. A notice still
reaches the inbox during a device's quiet hours (NOT-170), for a muted type
(NOT-190), with an expired subscription, and for a wireless alert while wireless
notifications are switched off (NOT-203). It reaches the inbox even when
Telegram is down. A silenced notice is retried on every cycle. All attempts for
the same condition starting at the same moment share one inbox copy, so a retry
adds nothing new, and a copy the user has read stays read. A recovery, or a
later outage of the same device, is a new notice. Notices meant only for the
vendor's chat, such as a failed agent update, never reach the inbox. A failure
to record is logged and never holds up delivery.

A recovery whose outage was held back still reaches the inbox (NOT-270).

**Why:** Quiet hours and mutes decide who gets woken up. They don't decide
what happened. Someone checking the inbox in the morning should see the night's
outages that nobody was paged about.

**Enforced at:** `src/infrastructure/notifications/InboxAlertPublisher.ts`, `src/infrastructure/di/container.ts`, `src/domain/notifications/entities/InboxNotification.ts` (`dedupKeyFor`), `src/infrastructure/persistence/PrismaInboxNotificationRepository.ts` (`addMany`)
**Tests:** `tests/infrastructure/notifications/InboxAlertPublisher.test.ts`, `tests/integration/use-cases/notifications/RecordInboxNotificationUseCase.integration.test.ts`

### NOT-268 — Inbox notifications are deleted after 90 days

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-27

The nightly retention run deletes every inbox notification that arrived more
than 90 days ago, read or unread, from every inbox. The window is fixed and is
not one of the vendor's retention settings (INS-028). The manual retention run
(NOT-131) leaves the inbox alone. If the purge fails, the error is logged and
the next night's run tries again.

**Why:** The inbox is a list of recent notices. The lasting record of each fault
is the alert. After three months a notice no longer helps anyone.

**Enforced at:** `src/application/notifications/use-cases/PurgeOldInboxNotificationsUseCase.ts`, `src/infrastructure/retention/DataRetentionOrchestrator.ts`
**Tests:** `tests/application/notifications/use-cases/InboxNotificationUseCases.test.ts`, `tests/infrastructure/retention/DataRetentionOrchestrator.test.ts`, `tests/integration/use-cases/notifications/PurgeOldInboxNotificationsUseCase.integration.test.ts`

### NOT-269 — An open dashboard tab is shown each new notification as it arrives

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-27

When a notice is added to a user's inbox, each of that user's open inbox
streams (NOT-265) receives it along with the new unread count. A retried
delivery that adds nothing sends nothing. Each user's stream carries only their
own copy.

**Why:** The dashboard shows a new notice as a pop-up card the moment it
arrives, and updates the bell in the same step.

**Enforced at:** `src/application/notifications/shared/InboxStream.ts` (`notificationAdded`), `src/application/notifications/use-cases/RecordInboxNotificationUseCase.ts`
**Reached from:** `GET /api/notifications/stream`
**Tests:** `tests/application/notifications/shared/InboxStream.test.ts`, `tests/integration/use-cases/notifications/RecordInboxNotificationUseCase.integration.test.ts`

### NOT-270 — A device recovery follows its outage into the inbox, even when nobody was paged

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-27

A device recovery reaches the inbox exactly when its outage notice did. Usually
both go out to everyone. Sometimes the outage notice was held back: quiet hours,
a muted type, an expired subscription, or Telegram being down. The outage still
reached the inbox (NOT-267), so its recovery is added there too. It is not sent
to Telegram or phones, because nobody was told about the outage
(NOT-097), and the alert keeps no recovery-notified time. Two kinds of outage
never reach the inbox: a blip that ended inside the alert delay, and a device
that went down behind its upstream (NOT-246). Their recoveries are left out as
well. The match is by alert, so an outage already deleted after 90 days
(NOT-268) gets no recovery either.

**Why:** An outage in the inbox with no recovery next to it reads as a device
that is still down. Someone catching up in the morning needs to see the device
came back without opening the alert.

**Enforced at:** `src/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.ts`, `src/application/notifications/use-cases/RecordInboxNotificationUseCase.ts`, `src/infrastructure/persistence/PrismaInboxNotificationRepository.ts` (`hasOutageNotice`), `src/infrastructure/di/container.ts`
**Tests:** `tests/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.test.ts`, `tests/application/notifications/use-cases/InboxNotificationUseCases.test.ts`, `tests/integration/use-cases/notifications/SendDeviceRecoveryAlertUseCase.integration.test.ts`
