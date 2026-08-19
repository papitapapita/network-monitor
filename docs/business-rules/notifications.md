# Notifications — Business Rules

Two different jobs under one context. **Alerts** are the durable record that
something was wrong with a device and for how long. **Notifications** are the
messages that go out about it — to the operations team over Telegram, and to
subscribers over WhatsApp.

The split matters: an alert that nobody could be told about is still an alert,
and a delivery failure never loses the record of the fault.

Format and conventions: [README.md](README.md).

## ID ranges

| Range                 | Area                                      |
| --------------------- | ----------------------------------------- |
| `NOT-001` … `NOT-029` | Alert identity and content                |
| `NOT-030` … `NOT-059` | Alert lifecycle — open, resolve, notified |
| `NOT-060` … `NOT-089` | Deduplication and the shared alert store  |
| `NOT-090` … `NOT-109` | Operator notifications (Telegram)         |
| `NOT-110` … `NOT-129` | Subscriber notifications (WhatsApp)       |
| `NOT-130` … `NOT-149` | Retention, listing and deletion           |
| `NOT-150` … `NOT-169` | Cross-cutting (access control)            |

## Layer coverage

| Layer                     | Rules |
| ------------------------- | ----- |
| Application               | 21    |
| Domain (aggregate)        | 13    |
| Presentation              | 2     |
| Infrastructure (database) | 1     |

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

### NOT-090 — A device going offline opens a CRITICAL availability alert

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Raised from `DeviceWentOfflineEvent`, with source `Disponibilidad` and type
`device_unreachable`. The alert records the consecutive failure count and the
device's IP.

**Why:** Unreachable is the one condition that means the subscriber has no
service at all, so it is never a warning. The failure count is carried because
the threshold that declared the device down is a monitoring policy (`MON-`) — an
operator reading the alert needs to see how many attempts it took.

**Enforced at:** `src/application/notifications/use-cases/SendDeviceDownAlertUseCase.ts`,
`src/application/notifications/event-handlers/DeviceWentOfflineNotificationHandler.ts`
**Tests:** `tests/application/notifications/event-handlers/DeviceWentOfflineNotificationHandler.test.ts`,
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

Every interpolated value — device name, source, metric, detail, timestamp — is
run through `escapeMd` before it reaches the message body.

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
**Since:** 2026-08-05

Duration is formatted `1h 5m 3s`, dropping empty leading units; an unknown
duration reads `desconocido` and an unknown latency `N/A`.

**Why:** "It is back" is not actionable on its own. How long it was gone is what
tells the operator whether this was a blip or an outage worth a ticket, and the
latency says whether it came back healthy.

**Enforced at:** `src/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.ts` (`formatDuration`)
**Tests:** `tests/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.test.ts`

### NOT-094 — Times in operator messages are Bogotá local time

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Formatted `es-CO`, 24-hour, in `America/Bogota`, regardless of where the server
runs.

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

### NOT-096 — A missing device name degrades to `Unknown Device`

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

The same applies to a missing IP, which is simply omitted from the message.

**Why:** The message is worth sending with a missing label; it is not worth
losing over one. The lookup is a convenience on top of the device id that is
already in the metadata, so failing it costs nothing that matters.

**Enforced at:** `src/application/notifications/use-cases/SendAlertNotificationUseCase.ts` (`resolveDeviceName`)
**Tests:** `tests/application/notifications/use-cases/SendAlertNotificationUseCase.test.ts`

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
in one pass, each with its own configured window, each returning its own count.
Any one failing fails the run.

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

**Known gap — the reported total is the page size, not the row count.**
`toListDTO` is handed `alerts.length`, so a caller asking for 50 rows is told
there are 50 in total even when there are thousands. Unlike the customer and
bill listings, this use case never issues a `count`. A client paging on the
reported total will stop after one page.

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
