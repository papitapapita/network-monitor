# Business Rules — Device Monitoring

Whether a device is reachable, and what the system does about it: the polling
configuration that schedules the checks (PollingConfiguration), the current
reachability of each device (DeviceState), and the ping history behind it.

Conventions, rule types and the ID scheme are in [README.md](README.md).

**ID ranges**

| Range                 | Subject                              |
| --------------------- | ------------------------------------ |
| `MON-001` – `MON-019` | Reachability state                   |
| `MON-020` – `MON-039` | Polling configuration and scheduling |
| `MON-040` – `MON-059` | Ping history and retention           |

This file covers the reachability lifecycle only. The rules that decide **which**
devices may be monitored at all live with the device itself — see DEV-057
(monitoring requires ACTIVE or COMMISSIONING), DEV-058 and DEV-059 (when
monitoring is switched on by default) in
[device-inventory.md](device-inventory.md).

---

## Reachability state

### MON-001 — A device's reachability is three-valued: UP, DOWN or UNKNOWN

**Type:** Invariant · **Status:** Active
**Since:** 2026-08-03

`UP` and `DOWN` are observations: the device answered, or it did not. `UNKNOWN`
is the absence of one — nobody is watching this device, because it has never been
polled or because monitoring was turned off. A device with no `device_states` row
is also UNKNOWN.

**Why:** DOWN drives alerts, dashboards and, indirectly, the service-suspension
picture. Treating "we have not looked" as "it is down" produces false outages for
warehouse stock and paused devices; treating it as "it is up" leaves a permanent
green light on equipment nobody is checking. Both are worse than admitting the
system does not know. Before 2026-08-03 the column was a boolean `is_online` and
the distinction was carried by a transient `isFirstPoll` flag computed from row
absence, so it existed only for the duration of a single call.

**Enforced at:** `src/domain/device-monitoring/value-objects/ReachabilityStatus.ts`
**Backed by:** the `reachability_status` Postgres enum on `device_states.status` (`prisma/schema.prisma`)
**Message:** `Invalid reachability status: <value>. Must be one of: UP, DOWN, UNKNOWN`
**Tests:** `tests/domain/device-monitoring/value-objects/ReachabilityStatus.test.ts`, `tests/domain/device-monitoring/aggregates/DeviceState.test.ts`

A stored value is held to a stricter standard than an incoming one, exactly as
DEV-043 is: `DeviceStateMapper.toDomain` checks `ReachabilityStatus.isValid` on
the raw column with no trimming or case-folding, and fails with
`Data integrity violation: unrecognised ReachabilityStatus "<value>" in device_states`
on a miss. A row that only matches after normalisation means the database and the
domain have drifted, which is a defect to surface rather than paper over.

### MON-002 — Turning monitoring off sets the device's reachability to UNKNOWN

**Type:** Policy · **Status:** Active
**Since:** 2026-08-03

Disabling monitoring marks the state UNKNOWN and resets the consecutive-failure
count. `lastSeen` and the last measured latency are kept — they are facts about
the past and remain true. `lastCheckedAt` is cleared, which also makes the device
due on the first scheduler tick after monitoring returns.

Every route that stops polling reaches this same transition, all four delegating
to one use case: the explicit toggle (`DeviceMonitoringToggledEvent`), a status
change into INVENTORY or DAMAGED (`DeviceStatusChangedEvent`), and the two
polling-configuration endpoints that accept `enabled: false`
(`ConfigureDevicePollingUseCase`, `CreateDevicePollingUseCase`). The rule is
about the _effect_ — polling stopped — not about which door it came through, so
a path that only flipped the config flag would reintroduce the stale reading this
rule exists to prevent.

**Why:** Once polling stops, nothing will ever correct the stored reading, so the
last value freezes and is shown as current indefinitely — a device paused while
down still reads "down" months later. Blanking it to UNKNOWN is the only honest
answer, and keeping `lastSeen` means the operator can still tell how stale the
last real observation is.

An in-flight poll cannot undo this: `IngestPingResultsUseCase`, which applies
every measured result, re-reads the configuration before writing and skips the
result if monitoring was turned off meanwhile. Without that re-read the race is
real, since a cycle runs for several seconds and the suspension is dispatched
without being awaited. The re-read lives in ingest, not in the poll, so it covers
a result from any source — including one measured by an on-site agent (ADR 0002)
before its configuration caught up.

**Enforced at:** `src/domain/device-monitoring/aggregates/DeviceState.ts` (`markUnknown`); orchestrated by `src/application/device-monitoring/use-cases/SuspendDeviceMonitoringUseCase.ts`
**Reached from:** `DeviceMonitoringToggledHandler` (monitoring off), `DeviceStatusChangedHandler` (INVENTORY or DAMAGED), `ConfigureDevicePollingUseCase` and `CreateDevicePollingUseCase` (`enabled: false`)
**Tests:** `tests/application/device-monitoring/use-cases/SuspendDeviceMonitoringUseCase.test.ts`, `tests/integration/use-cases/device-monitoring/SuspendDeviceMonitoringUseCase.integration.test.ts`; the in-flight re-read in `tests/application/device-monitoring/use-cases/IngestPingResultsUseCase.test.ts` and `tests/integration/use-cases/device-monitoring/IngestPingResultsUseCase.integration.test.ts`

The suspension writes state, then the alert, then the configuration, and the
order is deliberate: no repository in this codebase accepts a transaction client,
so if the sequence breaks part way through, leaving polling enabled means the
next cycle repairs the half-applied state. Disabling the configuration first
would strand a device that nothing can ever correct. The use case is idempotent,
so re-running it finishes an interrupted transition.

### MON-003 — Turning monitoring off closes the device's open availability alert, silently

**Type:** Policy · **Status:** Active
**Since:** 2026-08-03

An open `device_unreachable` alert is resolved as part of the same transition. No
WhatsApp or e-mail resolution notice is sent.

**Why:** The alert is only ever closed by observing a recovery, and no poll will
run again to observe one, so it would stay open forever. `PurgeOldAlertsUseCase`
deletes only _resolved_ alerts, so the row would also become unpurgeable — a
permanent entry in the alert list and in the database. Notifying would be worse
than silent: "✅ Alerta resuelta" for a device that was never fixed, only stopped
being watched, is good news that did not happen.

**Enforced at:** `src/application/device-monitoring/use-cases/SuspendDeviceMonitoringUseCase.ts`, delegating to `ResolveAlertUseCase`
**Tests:** `tests/integration/use-cases/device-monitoring/SuspendDeviceMonitoringUseCase.integration.test.ts`

### MON-005 — The first result after UNKNOWN is not a recovery

**Type:** Policy · **Status:** Active
**Since:** 2026-08-03 · **Revised:** 2026-08-24

When a poll follows an UNKNOWN state, a successful ping raises no
`DeviceCameOnlineEvent`; a failed one still starts the DOWN streak
(`downSince`, see notifications `NOT-097`) as if it were a genuine transition.

**Why:** Coming back from UNKNOWN is not the same as coming back from an outage.
The device may never have been down — nobody was looking — so a recovery notice
would report the end of an outage that was never reported, and never happened.
The asymmetry is deliberate: a device that is dead the first time it is seen has
to start counting toward an alert, or a unit that has been down since
installation would stay silent forever.

Previously this was decided by an `isFirstPoll` argument the caller computed from
whether a state row existed, so it covered a brand-new device but not a paused
one. With UNKNOWN persisted (MON-001) the aggregate reads its own state and both
cases are covered by the same rule.

`applyPingResult` no longer raises a domain event on the online→offline
transition itself — `DeviceWentOfflineEvent` was deleted along with the
immediate-alert path it fed. See `NOT-097` for what replaced it.

**Enforced at:** `src/domain/device-monitoring/aggregates/DeviceState.ts` (`applyPingResult`)
**Tests:** `tests/domain/device-monitoring/aggregates/DeviceState.test.ts`, `tests/integration/use-cases/device-monitoring/SuspendDeviceMonitoringUseCase.integration.test.ts`

A probe that could not be executed at all is a separate case and deliberately
does **not** move the status: `applyPollFailure` advances `lastCheckedAt` only. A
local fault says nothing about the device, and demoting a known-DOWN device to
UNKNOWN would silently end the outage it is already in. The attempt loop
(`PingCycleProbe`) reports this as `probe-unavailable` only when no attempt ran;
`IngestPingResultsUseCase` then advances `lastCheckedAt` of an already-known
device and records no history sample.

---

### MON-006 — A device nobody is measuring shows as UNKNOWN

**Type:** Policy · **Status:** Active
**Layer:** Application · Infrastructure (read model)
**Since:** 2026-09-28 · **Revised:** 2026-09-30 (off site, devices with no agent too)

A device placed behind an on-site agent (`MON-022`) is shown as UNKNOWN while
that agent is not reporting: offline (`AGT-021`), paired but never connected
(pending) or revoked. On a server hosted off site, which pings nothing
(`MON-023`), a device with no agent is shown as UNKNOWN too. This covers the
device list (`connectivity.status` is
`UNKNOWN`, `downSince` is `null`, `lastSeen` is kept; the `UNKNOWN` filter
includes it and the `UP`/`DOWN` filters leave it out) and the polling status
(`currentStatus` is `UNKNOWN`). The stored `DeviceState` is not touched: when
the agent reports again the device shows whatever it measures next. If the
agent's status cannot be read, the polling status falls back to the stored
state.

**Why:** ADR 0002, R7: offline means unknown, not down. Nobody is measuring
the device, so its last state is only what the agent saw before it went
silent; showing it as DOWN would send a technician to a site whose only
problem may be a PC that was switched off. A pending or revoked agent measures
nothing either, so its devices are no better known; neither is a device with
no agent on a server that never pings it. Leaving the stored state alone keeps
the history honest and lets the next live result decide.

**Enforced at:** `src/application/device-monitoring/use-cases/GetDevicePollingStatusUseCase.ts`, `src/application/device-monitoring/mappers/PollingMapper.ts`, `src/infrastructure/persistence/PrismaDeviceListQuery.ts`, `src/infrastructure/probe-agents/queries/PrismaAgentStatusQuery.ts`
**Tests:** `tests/application/device-monitoring/use-cases/GetDevicePollingStatusUseCase.test.ts`, `tests/infrastructure/persistence/PrismaDeviceListQuery.test.ts`, `tests/integration/use-cases/device-monitoring/GetDevicePollingStatusUseCase.integration.test.ts`, `tests/integration/use-cases/device-inventory/ListDevicesUseCase.integration.test.ts`

---

### MON-007 — A result sent in by an agent is stored once, however many times it arrives

**Type:** Invariant · **Status:** Active
**Layer:** Application · Infrastructure (database)
**Since:** 2026-09-29

A result from an on-site agent carries the agent's own id for it. The history
sample is stored under that id first, and only once: a second copy — a batch
resent because its acknowledgement was lost — is recognised, acknowledged
again and changes nothing else. If the sample cannot be stored, the whole
result fails and is left unacknowledged, so the agent keeps it and sends it
again. Results polled in-process have no such id and are stored as before.

**Why:** ADR 0002, R8. An agent resends whatever it has not seen acknowledged,
so duplicates are normal, not an error. Storing first and failing loudly means
a result is either fully handled or not handled at all; a unique column, not
a lookup, makes that hold even when two copies arrive at once.

**Enforced at:** `src/application/device-monitoring/use-cases/IngestPingResultsUseCase.ts`, `src/infrastructure/persistence/PrismaPingResultRepository.ts` (`saveOnce`), `ping_results.source_result_id` (unique)
**Tests:** `tests/application/device-monitoring/use-cases/IngestPingResultsUseCase.test.ts`, `tests/integration/use-cases/device-monitoring/IngestPingResultsUseCase.integration.test.ts`, `tests/integration/use-cases/probe-agents/AcceptAgentResultsUseCase.integration.test.ts`

### MON-008 — Only a live result newer than the last one changes a device's state

**Type:** Policy · **Status:** Active
**Layer:** Domain · Application
**Since:** 2026-09-29

A result changes the device's state — and so can raise or resolve an outage —
only if it was measured after the last result applied and, when sent in by an
agent, at most 2 minutes before it arrived. Anything else is kept as history
only: it fills graphs and uptime but changes no state and raises nothing. A
probe failure that old is dropped, having no history to fill. This holds for
in-process polls too: one overtaken by a newer poll becomes history.

**Why:** ADR 0002, R9 and R10. An agent that was offline replays its backlog
when it reconnects. Applying it would re-run an outage that began and ended
while nobody was watching, alerting about something already over — so a
backlog is history, and a device still down now alerts once, from the live
result the agent sends first (R11). The window is fixed rather than tied to
the poll interval because a live result arrives within seconds whatever the
interval; only a backlog is ever that old.

**Enforced at:** `src/domain/device-monitoring/aggregates/DeviceState.ts` (`isNewerThanLastCheck`), `src/application/device-monitoring/use-cases/IngestPingResultsUseCase.ts` (`LIVE_RESULT_WINDOW_MS`)
**Tests:** `tests/domain/device-monitoring/aggregates/DeviceState.test.ts`, `tests/application/device-monitoring/use-cases/IngestPingResultsUseCase.test.ts`, `tests/integration/use-cases/device-monitoring/IngestPingResultsUseCase.integration.test.ts`, `tests/integration/use-cases/probe-agents/AcceptAgentResultsUseCase.integration.test.ts`

---

## Polling configuration and scheduling

### MON-004 — A device whose monitoring is off cannot be polled on demand

**Type:** Policy · **Status:** Active
**Since:** 2026-08-03

The manual "poll now" endpoint refuses a device whose polling configuration is
disabled, answering `409`. The `forceExecution` flag overrides the schedule, not
the monitoring switch.

**Why:** Monitoring off means the device is not tracked (MON-002). A manual poll
would write a real UP/DOWN reading over the UNKNOWN state with nothing scheduled
to correct it afterwards, restoring the stale-reading problem through a different
door — and could raise an outage alert for a device nobody is watching.

**Enforced at:** `src/application/device-monitoring/use-cases/ExecutePollingCycleUseCase.ts`
**Reached from:** `POST /api/polling/:id/poll` via `PollingController.poll`
**Message:** `Monitoring is disabled for device <id> — enable monitoring before polling it`
**Tests:** `tests/application/device-monitoring/use-cases/ExecutePollingCycleUseCase.test.ts`, `tests/integration/use-cases/device-monitoring/ExecutePollingCycleUseCase.integration.test.ts`

### MON-020 — Disabling monitoring keeps the polling configuration

**Type:** Policy · **Status:** Active
**Since:** 2026-08-03

The `polling_configurations` row survives a pause with `enabled = false`. The
interval, failure threshold and IP address are all retained, and re-enabling
reuses them.

**Why:** A pause is temporary by intent. Discarding the configuration would mean
a resumed device silently reverts to defaults, quietly changing how often it is
checked and how many failures it tolerates.

**Enforced at:** `src/application/device-monitoring/use-cases/SuspendDeviceMonitoringUseCase.ts`
**Backed by:** `polling_configurations.enabled`; the due-devices query filters on `enabled = true` (`src/infrastructure/persistence/PrismaPollingConfigurationRepository.ts`)
**Tests:** `tests/integration/use-cases/device-monitoring/SuspendDeviceMonitoringUseCase.integration.test.ts`

### MON-021 — A manual poll makes at most 3 ping attempts

**Type:** Policy · **Status:** Active
**Since:** 2026-09-25

A scheduled poll declares a device unreachable only after all
`failuresBeforeDown` attempts fail. A manual poll ("poll now") uses the smaller of
that threshold and 3, so a threshold of 100 still answers after 3 attempts. A
threshold below 3 is not raised. The result is written like any other poll, so
a manual poll of an unreachable device marks it down after 3 failed attempts,
earlier than the configured tolerance would allow on the schedule.

**Why:** Each attempt can wait 5 seconds for a reply, so a threshold of 100 keeps
an operator waiting about ten minutes, far longer than the HTTP proxy in front of
the API lets a request run (30 seconds), which surfaced as a raw proxy error
instead of a result. Three attempts answer in under 20 seconds.

**Enforced at:** `src/application/device-monitoring/use-cases/ExecutePollingCycleUseCase.ts` (`MANUAL_POLL_MAX_ATTEMPTS`)
**Reached from:** `POST /api/devices/:id/poll` via `PollingController.poll`
**Tests:** `tests/application/device-monitoring/use-cases/ExecutePollingCycleUseCase.test.ts`

### MON-022 — A device behind an on-site agent is polled by that agent only

**Type:** Policy · **Status:** Active
**Since:** 2026-09-28 · **Revised:** 2026-10-01

A device with an `agentId` (DEV-164) leaves the in-process scheduler's due
query; its agent polls it and its results arrive through the agent gateway
(AGT-043). A manual poll of such a device asks that agent to ping it now
(AGT-103), with the same attempt cap as any manual poll (MON-021), and the
answer is applied as a live reading, timed on this server's clock (AGT-104).
This works whether the server is on the monitored network or not (MON-023).
The server never pings the device itself.

When the agent gives no reading, nothing is recorded and the poll fails:

| Agent                                             | Status | Message ends with                                          |
| ------------------------------------------------- | ------ | ---------------------------------------------------------- |
| Not connected                                     | `409`  | `its on-site agent is not connected`                       |
| Connected, but older than `0.3.0` (AGT-100)       | `409`  | `its on-site agent must be updated to poll it on demand`   |
| No answer within 25 seconds                       | `504`  | `its on-site agent did not answer in time`                 |
| Answered with an error, or its ping could not run | `502`  | `its on-site agent could not poll it: <the agent's error>` |

An agent whose ping program cannot run is the agent's fault, not this
server's: it does not count towards this server's probe health.

Wireless polling stays with the server while it is on the monitored network;
a server hosted off site reads a radio only through its agent (WLS-029).

**Why:** One writer per device. Two sources applying results to the same
`DeviceState` would flip it between their views and raise alerts from
whichever is wrong. Running an agent alongside in-process polling (ADR 0002,
1.9) therefore means moving devices over in groups (DEV-168) and moving them
back if needed, not polling each device twice. A manual poll through the
agent keeps that single writer: the reading is the agent's, measured from the
customer's network, like its scheduled ones. The 25-second limit stays under
the 30 seconds the HTTP proxy in front of the API allows.

**Enforced at:** `src/infrastructure/persistence/PrismaPollingConfigurationRepository.ts` (`findAllDue`), `src/application/device-monitoring/use-cases/ExecutePollingCycleUseCase.ts` (`checkEligibility`, `AGENT_POLL_FAILURES`), `src/infrastructure/probe-agents/adapters/AgentChannelPingProbe.ts`, `src/presentation/http/controllers/PollingController.ts`
**Reached from:** `POST /api/devices/:id/poll` via `PollingController.poll`
**Message:** see the table above
**Tests:** `tests/application/device-monitoring/use-cases/ExecutePollingCycleUseCase.test.ts`, `tests/integration/use-cases/device-monitoring/ExecutePollingCycleUseCase.integration.test.ts`, `tests/integration/polling.routes.test.ts`, `tests/presentation/http/controllers/PollingController.test.ts`, `tests/infrastructure/probe-agents/adapters/AgentChannelPingProbe.test.ts`

---

### MON-023 — A server hosted off site pings nothing

**Type:** Policy · **Status:** Active
**Layer:** Application · Infrastructure
**Since:** 2026-09-30

When the install says its server is not on the monitored network
(`SERVER_ON_SITE=false`, INS-041), the in-process scheduler polls no device at
all: the due query is empty, so a device left with no agent is not pinged
either. A manual poll of such a device is refused with `409`; a device behind
an agent is polled through that agent (`MON-022`). The device is shown as UNKNOWN
(`MON-006`) and raises no down alert (`NOT-101`) until it is moved behind an
agent. A server on the monitored network (the default) keeps pinging every
device that has no agent.

**Why:** Off site, every device is on the customer's private network, out of
the server's reach. Pinging it anyway would mark the whole network DOWN, send
an alert for every device and spend the host's CPU on pings that can only time
out — on a host that may serve several customers. The vendor's own on-site
install keeps pinging its network from the server, as before.

**Enforced at:** `src/infrastructure/persistence/PrismaPollingConfigurationRepository.ts` (`findAllDue`), `src/application/device-monitoring/use-cases/ExecutePollingCycleUseCase.ts` (`checkEligibility`)
**Reached from:** `POST /api/devices/:id/poll` via `PollingController.poll`, and the in-process polling scheduler
**Message:** `Cannot poll device <id> — this server is not on the monitored network`
**Tests:** `tests/application/device-monitoring/use-cases/ExecutePollingCycleUseCase.test.ts`, `tests/infrastructure/persistence/PrismaPollingConfigurationRepository.test.ts`, `tests/presentation/http/controllers/PollingController.test.ts`, `tests/integration/use-cases/device-monitoring/ExecutePollingCycleUseCase.integration.test.ts`, `tests/integration/polling.routes.test.ts`

---

## Ping history and retention

### MON-040 — Ping history is kept for 30 days, independent of monitoring state

**Type:** Policy · **Status:** Active
**Since:** 2026-08-03

Raw `ping_results` rows are deleted once they are older than
the vendor's `pingResultRetentionDays` (INS-028; `PING_RESULT_RETENTION_DAYS`,
default 30, until saved). The sweep runs daily. Pausing a device
does not delete its history, and re-enabling does not restore anything, because
nothing was removed.

**Why:** The table is the highest-volume in the system — roughly 430k rows a day
at 300 devices on a one-minute interval — so unbounded retention is not an
option. Tying the purge to age rather than to monitoring state keeps a paused
device's recent history available for diagnosis, which is often exactly why it
was paused.

`lastSeen` on the device state is a scalar, not history, and may therefore point
at a moment whose ping rows have already been purged. That is accepted: the
question "when did we last reach this device" outlives the samples that answered
it.

**Enforced at:** `src/application/device-monitoring/use-cases/PurgeOldPingResultsUseCase.ts`, scheduled by `src/infrastructure/retention/DataRetentionOrchestrator.ts`
**Tests:** `tests/application/device-monitoring/use-cases/PurgeOldPingResultsUseCase.test.ts`, `tests/integration/use-cases/device-monitoring/PurgeOldPingResultsUseCase.integration.test.ts`

### MON-041 — An administrator can delete a device's ping history on demand, scoped by device and optionally by date range

**Type:** Policy · **Status:** Active
**Since:** 2026-08-13

`DELETE /api/devices/:id/polling/history` deletes `ping_results` rows for one
device, optionally bounded by `fromDate`/`toDate`; omitting both deletes the
device's entire history. This does not change `PING_RESULT_RETENTION_DAYS` or
the daily sweep in `MON-040` — it is a scoped, immediate version of the same
deletion, gated on the `delete` permission (ADMIN only) rather than the
`update`/`write` tier used for alert-clearing, since it destroys diagnostic
data at a scale (tens of thousands of rows per device) nothing else in this
context reaches with one call.

**Why:** The automatic sweep and the admin's blanket "purge stale data now"
endpoint are both age-cutoff-only and apply globally — neither lets an
operator clear one problem device's noisy history (e.g. after a known bad
cable is replaced) without waiting out the retention window or affecting
every other device's data at the same time.

**Enforced at:** `src/application/device-monitoring/use-cases/DeleteDevicePingHistoryUseCase.ts`, `src/presentation/http/routes/polling.routes.ts`
**Reached from:** `DELETE /api/devices/:id/polling/history`
**Tests:** `tests/application/device-monitoring/use-cases/DeleteDevicePingHistoryUseCase.test.ts`, `tests/integration/use-cases/device-monitoring/DeleteDevicePingHistoryUseCase.integration.test.ts`, `tests/integration/polling.routes.test.ts`

### MON-042 — Ping history can be sorted by check time or latency, ordered in the database

**Type:** Policy · **Status:** Active
**Since:** 2026-09-03

`GET /api/devices/:id/polling/history` accepts `sortBy` (`checkedAt` |
`latencyMs`) and `sortOrder` (`ASC` | `DESC`), defaulting to `checkedAt DESC`
when omitted. The value is pushed into the query's `ORDER BY`, ahead of
`skip`/`take`, so a page is ordered against the device's whole ping history —
not just the rows the page happens to contain.

**Why:** Before 2026-09-03 the endpoint had no `sortBy` parameter at all — every
page came back `checkedAt desc` regardless of what a client asked for, which
pushed any other ordering onto the client sorting whatever page it already had
in hand. That only ever looks correct within one page.

**Enforced at:** `src/application/device-monitoring/use-cases/GetDevicePollingHistoryUseCase.ts`, backed by `PrismaPingResultRepository.findByDevice`
**Reached from:** `GET /api/devices/:id/polling/history`
**Tests:** `tests/application/device-monitoring/use-cases/GetDevicePollingHistoryUseCase.test.ts`, `tests/infrastructure/persistence/PrismaPingResultRepository.test.ts`
