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
| `MON-060` – `MON-079` | Live router traffic                  |
| `MON-080` – `MON-099` | Network sweep                        |
| `MON-100` – `MON-119` | Internet speed test                  |
| `MON-120` – `MON-139` | Ping tool                            |
| `MON-140` – `MON-159` | MikroTik port speeds                 |

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
**Since:** 2026-09-28 · **Revised:** 2026-09-30 (off site, devices with no agent too), 2026-10-13 (the all-devices status list)

A device placed behind an on-site agent (`MON-022`) is shown as UNKNOWN while
that agent is not reporting: offline (`AGT-021`), paired but never connected
(pending) or revoked. On a server hosted off site, which pings nothing
(`MON-023`), a device with no agent is shown as UNKNOWN too. This covers the
device list (`connectivity.status` is
`UNKNOWN`, `downSince` is `null`, `lastSeen` is kept; the `UNKNOWN` filter
includes it and the `UP`/`DOWN` filters leave it out) and the polling status
(`currentStatus` is `UNKNOWN`, for one device or the dashboard's list of all
of them). The stored `DeviceState` is not touched: when
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

**Enforced at:** `src/application/device-monitoring/use-cases/GetDevicePollingStatusUseCase.ts`, `src/application/device-monitoring/use-cases/ListDevicePollingStatusesUseCase.ts`, `src/application/device-monitoring/mappers/PollingMapper.ts`, `src/infrastructure/persistence/PrismaDeviceListQuery.ts`, `src/infrastructure/probe-agents/queries/PrismaAgentStatusQuery.ts`
**Tests:** `tests/application/device-monitoring/use-cases/GetDevicePollingStatusUseCase.test.ts`, `tests/application/device-monitoring/use-cases/ListDevicePollingStatusesUseCase.test.ts`, `tests/infrastructure/persistence/PrismaDeviceListQuery.test.ts`, `tests/integration/use-cases/device-monitoring/GetDevicePollingStatusUseCase.integration.test.ts`, `tests/integration/use-cases/device-monitoring/ListDevicePollingStatusesUseCase.integration.test.ts`, `tests/integration/use-cases/device-inventory/ListDevicesUseCase.integration.test.ts`

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
**Tests:** `tests/application/device-monitoring/use-cases/ExecutePollingCycleUseCase.test.ts`, `tests/integration/use-cases/device-monitoring/ExecutePollingCycleUseCase.integration.test.ts`, `tests/integration/polling.routes.test.ts`, `tests/presentation/http/controllers/PollingController.test.ts`, `tests/infrastructure/probe-agents/adapters/AgentChannelPingProbe.test.ts`, `tests/integration/agent-probes.test.ts`

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

### MON-024 — Editing a device's details touches its polling only when the IP changes

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-10-14

A device update that sets a new IP address moves the polling configuration to
it. An update that clears the IP also turns polling off, since there is nothing
left to ping. Any other edit — name, description, MAC, serial, category,
installed date, owner — leaves the polling configuration exactly as it was.

**Why:** Until 2026-10-14 an edit that did not mention the IP was read as one
that cleared it, so renaming a monitored device switched its polling off and
blanked the polling IP while the device still showed monitoring on. Polling
stopped with no alert and no UNKNOWN state to give it away.

**Enforced at:** `src/application/device-monitoring/event-handlers/DeviceIPAddressChangedHandler.ts`
**Reached from:** `PATCH /api/devices/:id` via `DeviceController.update`
**Tests:** `tests/application/device-monitoring/event-handlers/DeviceIPAddressChangedHandler.test.ts`, `tests/integration/use-cases/device-inventory/UpdateDeviceUseCase.integration.test.ts`

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

### MON-043 — Ping history statistics describe the whole date window, not the page

**Type:** Policy · **Status:** Active
**Layer:** Application, Infrastructure (persistence)
**Since:** 2026-10-26

The `statistics` returned by `GET /api/devices/:id/polling/history` are
computed in the database over every ping for the device inside
`fromDate`–`toDate`. `limit` and `offset` do not affect them:

- `successRate` is pings that answered over all pings in the window, `0` for an
  empty window.
- `averageResponseTime`, `minResponseTime` and `maxResponseTime` cover the pings
  that answered with a latency, and are `0` when there are none.
- `uptimePercentage` equals `successRate`.

The `status` filter narrows the listed rows and `totalCount` only. The
statistics ignore it.

**Why:** Before this rule the figures were derived from the returned page but
divided by the whole window's count, so they mixed two scopes. A device that
answered all 1,440 pings in a day reported 3.5 % at `limit=50` and 35 % at
`limit=500`, and the latency figures changed from page to page. The status
filter is left out of the statistics because applying it makes them say
nothing: with `status=FAILED`, the success rate would always be 0 % and there
would be no latency to report. Kept to the window, the figures stay a true
summary of the device's period, whichever rows are being listed.

**Enforced at:** `src/application/device-monitoring/use-cases/GetDevicePollingHistoryUseCase.ts`, `src/application/device-monitoring/mappers/PollingMapper.ts` (`toHistoryDTO`), `src/infrastructure/persistence/PrismaPingResultRepository.ts` (`statsByDevice`)
**Reached from:** `GET /api/devices/:id/polling/history`
**Tests:** `tests/application/device-monitoring/use-cases/GetDevicePollingHistoryUseCase.test.ts`, `tests/application/device-monitoring/mappers/PollingMapper.test.ts`, `tests/infrastructure/persistence/PrismaPingResultRepository.test.ts`, `tests/integration/use-cases/device-monitoring/GetDevicePollingHistoryUseCase.integration.test.ts`

## Live router traffic

What the main routers carry right now, per interface, read from the router
itself while someone is looking. Nothing here is stored.

### MON-060 — Live traffic shows the in-service GATEWAY devices

**Type:** Policy · **Status:** Active
**Since:** 2026-10-14

`GET /api/routers/traffic/stream` lists every device whose category is
`GATEWAY`, whose status is `ACTIVE` or `COMMISSIONING`, and which is not in the
recycle bin, ordered by name. Every role may open it (`read`).

**Why:** The category already says "this device routes" (see the
`DeviceCategory` note in `BACKEND_API.md`). Picking the routers by it needs
nothing new to configure: a router appears the moment it is categorised.

**Enforced at:** `src/infrastructure/monitoring/router-traffic/PrismaRouterTrafficTargetsQuery.ts`, `src/presentation/http/routes/wireless-stream.routes.ts`
**Reached from:** `GET /api/routers/traffic/stream`
**Tests:** `tests/integration/use-cases/device-monitoring/WatchRouterTrafficUseCase.integration.test.ts`, `tests/integration/wireless-stream.routes.test.ts`

### MON-061 — A main router that cannot be read is listed with the reason

**Type:** Policy · **Status:** Active
**Since:** 2026-10-14

Only a MikroTik is read: its vendor's slug must be `mikrotik`. A router from
another vendor, one with no IP address, or one with no username and password
saved is still listed, with no interfaces and an `error` that says which:
`"Live traffic is read from MikroTik routers only"`,
`"The router has no IP address"`,
`"The router has no username and password saved"`. Nothing is sent to it.

**Why:** A router missing from the page reads as "the page is broken"; a router
listed with the reason tells the operator what to fix.

**Enforced at:** `src/application/device-monitoring/services/resolveRouterTrafficTarget.ts`
**Tests:** `tests/application/device-monitoring/services/resolveRouterTrafficTarget.test.ts`, `tests/integration/use-cases/device-monitoring/WatchRouterTrafficUseCase.integration.test.ts`

### MON-062 — Routers are read every 2 seconds, only while someone watches

**Type:** Policy · **Status:** Active
**Since:** 2026-10-14

The first viewer to open the stream starts one loop that reads every readable
router every 2 seconds. Each answer goes to every viewer as one router's
`router-traffic` frame, success or failure. A later viewer opens with the
newest reading of each router. A read still out when the next one is due is
skipped, not stacked. On the first tick with no viewer left the loop stops and
the router logins close (`MON-064`). The list of routers is read again every
minute while the loop runs, so a router added or edited shows up without
reopening the page.

**Why:** A router asked every 2 s by nobody is load for nothing. One shared
loop means a second open page costs the routers nothing.

**Enforced at:** `src/infrastructure/monitoring/router-traffic/RouterTrafficMonitor.ts`
**Reached from:** `GET /api/routers/traffic/stream`
**Tests:** `tests/integration/use-cases/device-monitoring/WatchRouterTrafficUseCase.integration.test.ts`, `tests/presentation/http/controllers/WirelessStreamController.test.ts`

### MON-063 — Only a router's static, enabled interfaces are shown, at most 64

**Type:** Policy · **Status:** Active
**Since:** 2026-10-14

The interfaces read are the ones RouterOS lists as not disabled and not
dynamic: ethernet, SFP, bridges, VLANs, bonding and the like. Each comes with
its type, whether it is running, and the receive and transmit rate in bits per
second as RouterOS computes it (`/interface/monitor-traffic once`). At most
the first 64 are read.

**Why:** A gateway serving PPPoE has one dynamic interface per connected
customer, hundreds of them. Those are subscribers, not the router's links, and
would bury the WAN uplink the page exists to show.

**Enforced at:** `src/infrastructure/monitoring/router-traffic/RouterOsTrafficReader.ts`, `src/agent/protocol/messages.ts` (`MAX_TRAFFIC_INTERFACES`)
**Tests:** `tests/infrastructure/monitoring/router-traffic/RouterOsTrafficReader.test.ts`

### MON-064 — The router login stays open between reads and closes after 30 s unused

**Type:** Policy · **Status:** Active
**Since:** 2026-10-14

The reader logs in to a router once and keeps the connection for the next
read. A read that fails or gets no answer within 5 seconds drops the
connection, and the next read logs in again. A connection unused for 30
seconds is closed, and when the last viewer leaves every connection is closed
at once.

**Why:** RouterOS writes every API login to its log. Logging in every 2 s would
put 1,800 lines an hour in the router's log while the page is open.

**Enforced at:** `src/infrastructure/monitoring/router-traffic/RouterOsTrafficReader.ts`
**Tests:** `tests/infrastructure/monitoring/router-traffic/RouterOsTrafficReader.test.ts`

### MON-065 — Off site, a router is read through the agent it sits behind

**Type:** Policy · **Status:** Active
**Since:** 2026-10-14

With the server on site it reads every router itself. Off site it reads
nothing itself: a router assigned to an agent is read through that agent
(`AGT-116` … `AGT-118`), and one behind no agent is listed with
`"The router is not behind an agent"`. An agent that is offline, too old to
read traffic (`"The agent must be updated to read router traffic"`), or that
does not answer within 8 seconds shows that as the router's error.

**Why:** As `MON-023`: a server off site cannot reach the network it manages.

**Enforced at:** `src/infrastructure/di/container.ts`, `src/infrastructure/probe-agents/adapters/AgentChannelTrafficReader.ts`
**Tests:** `tests/infrastructure/probe-agents/adapters/AgentChannelTrafficReader.test.ts`, `tests/integration/agent-traffic.test.ts`

### MON-066 — A router is read with its HTTP login on its RouterOS API port

**Type:** Policy · **Status:** Active
**Since:** 2026-10-14

The login is the device's saved HTTP username and password, the same one
RouterOS backups use over SSH (`BKP-055`), on the credentials' `apiPort`
(default 8728, `DEV-127`). The router's API service must be enabled for it.

**Why:** One login per device, as everywhere else. The API answers rates
directly, where SSH would need the command's text parsed.

**Enforced at:** `src/application/device-monitoring/services/resolveRouterTrafficTarget.ts`, `src/infrastructure/monitoring/router-traffic/PrismaRouterTrafficTargetsQuery.ts`
**Tests:** `tests/application/device-monitoring/services/resolveRouterTrafficTarget.test.ts`, `tests/integration/wireless-stream.routes.test.ts`

## Network sweep

An on-demand ping of every in-service device at once, to see what is up and
what is down right now, typically after a large outage. Nothing here is stored.

### MON-080 — A network sweep only reports; it changes nothing

**Type:** Policy · **Status:** Active
**Since:** 2026-10-17

`GET /api/network/sweep/stream` pings the devices once, now, and streams what
answered. It writes no ping history, does not touch any device's reachability
(`MON-001`) or its last-polled time, and raises, closes and delays no alert. A
device the sweep finds down stays UP on the dashboard until the scheduler
says otherwise. Only the user who started it sees the results, and they are
not kept on the server. Operators and administrators may start one (`create`,
the same as a manual poll); a viewer may not.

**Why:** A sweep pings each device once, briefly. If one dropped packet counted
as a failed poll, a sweep could mark devices down, start their down-alert
delay (`NOT-101`) and send a burst of alerts during the very outage the
operator is already looking at. The scheduler stays the one writer of
reachability, with its own thresholds.

**Enforced at:** `src/application/device-monitoring/use-cases/RunNetworkSweepUseCase.ts`, `src/presentation/http/routes/network-sweep.routes.ts`
**Reached from:** `GET /api/network/sweep/stream` via `NetworkSweepController.stream`
**Tests:** `tests/integration/use-cases/device-monitoring/RunNetworkSweepUseCase.integration.test.ts`, `tests/integration/network-sweep.routes.test.ts`

### MON-081 — A sweep covers the in-service devices and says why it skipped any

**Type:** Policy · **Status:** Active
**Since:** 2026-10-17

The sweep covers every device whose status is `ACTIVE` or `COMMISSIONING` and
that is not in the recycle bin, optionally narrowed to one `locationId` and/or
one `category`. Stock and retired units are left out entirely. Of the devices
covered, these are reported as skipped, with no ping sent, checked in this
order:

| Reason                     | When                                                                       |
| -------------------------- | -------------------------------------------------------------------------- |
| `MONITORING_DISABLED`      | The device's monitoring is off, or it has no enabled polling configuration |
| `NO_IP_ADDRESS`            | Its polling configuration has no IP address                                |
| `NOT_ON_MONITORED_NETWORK` | The server is hosted off site and the device has no agent (`MON-023`)      |

A device behind an on-site agent is never skipped for where the server runs:
its agent pings it (`MON-084`). The address pinged is the polling
configuration's, the same one the scheduler pings.

**Why:** The same devices the scheduler watches, so a sweep answers the same
question as the dashboard, only fresher. Every covered device appears in the
results, skipped or not, so the totals add up and a missing device is never
mistaken for a dead one.

**Enforced at:** `src/infrastructure/monitoring/network-sweep/PrismaNetworkSweepTargetsQuery.ts`, `src/application/device-monitoring/use-cases/RunNetworkSweepUseCase.ts` (`skipReason`)
**Message:** `NETWORK_SWEEP_SKIP_DETAILS` in the use case, sent as `detail`
**Tests:** `tests/application/device-monitoring/use-cases/RunNetworkSweepUseCase.test.ts`, `tests/integration/use-cases/device-monitoring/RunNetworkSweepUseCase.integration.test.ts`

### MON-082 — A sweep ping waits 1 second, tries 3 times, and asks the backbone first

**Type:** Policy · **Status:** Active
**Since:** 2026-10-17

Each device gets up to 3 pings, back to back, each waiting 1 second for a
reply. The first reply makes it `UP` and the rest are not sent; it is `DOWN`
only when all 3 go unanswered. A ping program that cannot run at all is
reported as `ERROR`, not `DOWN`. Up to 64 devices are pinged at a time. The
order is gateways, then aggregation switches, then access points, then
everything else, each by name.

**Why:** A scheduled poll waits up to 5 seconds per attempt and pauses a second
between attempts, which would make a sweep of a few hundred devices take
minutes. Live devices answer in milliseconds, so a 1-second wait costs
nothing for them; 3 misses in a row keep one lost packet from showing a live
device as down. A sweep of 500 devices takes a few seconds when most are up
and about half a minute in the worst case. The backbone goes first because
its answer decides what the rest mean: a dead gateway explains every dead
device behind it.

**Enforced at:** `src/application/device-monitoring/use-cases/RunNetworkSweepUseCase.ts` (`DEFAULT_NETWORK_SWEEP_OPTIONS`, `CATEGORY_ORDER`), `src/infrastructure/di/container.ts` (the 1-second probe)
**Tests:** `tests/application/device-monitoring/use-cases/RunNetworkSweepUseCase.test.ts`, `tests/application/device-monitoring/services/PingCycleProbe.test.ts`, `tests/integration/use-cases/device-monitoring/RunNetworkSweepUseCase.integration.test.ts`

### MON-083 — One sweep at a time; closing the stream stops it

**Type:** Policy · **Status:** Active
**Since:** 2026-10-17

While a sweep is running, starting another is refused with `409`
`"A network sweep is already running"`, whoever started the first. When the
caller closes the stream, no further ping is started; the few already out
finish and their results are dropped. The next sweep may start as soon as
the last one has finished, whether it completed, was stopped or failed.

**Why:** Two sweeps at once double the pings sent into a network that may
already be struggling, for the same answer. Leaving a page should not leave
the server pinging for nobody.

**Enforced at:** `src/application/device-monitoring/use-cases/RunNetworkSweepUseCase.ts` (`running`, `pingAll`, `sweepAgent`), `src/presentation/http/controllers/NetworkSweepController.ts`
**Reached from:** `GET /api/network/sweep/stream`
**Message:** `A network sweep is already running`
**Tests:** `tests/application/device-monitoring/use-cases/RunNetworkSweepUseCase.test.ts`, `tests/integration/network-sweep.routes.test.ts`

### MON-084 — Devices behind an on-site agent are swept by their agent

**Type:** Policy · **Status:** Active
**Since:** 2026-10-17

A device with an `agentId` is pinged by its agent, never by this server, as
for any poll (`MON-022`), and whether this server runs on site or not
(`MON-023`). Each agent is sent its devices in batches of 32, backbone first
(`MON-082`), with 2 batches out at a time, so it has up to 64 pings in flight
like the server. Every agent is asked at the same time, alongside the
server's own pings. The agent pings the same way: 3 tries, 1 second each
(`AGT-119`). Each result names the agent (`agentName`).

When a batch cannot be asked, every device in it is reported as `ERROR`, with
the reason as `detail`, never as `DOWN`:

| Situation                               | `detail`                                         |
| --------------------------------------- | ------------------------------------------------ |
| The agent is not connected              | `The agent is not connected`                     |
| The agent runs a version before `0.7.0` | `The agent must be updated to sweep the network` |
| The agent did not answer within 20 s    | `The agent did not answer in time`               |
| The agent answered with an error        | the agent's message                              |

Closing the stream stops the agents' sweeps too (`MON-083`): no new batch is
sent, and batches already out finish and are dropped.

**Why:** Only the agent can reach a customer's network. One request per batch
instead of one per device keeps a sweep of hundreds of devices to a handful
of messages. Each batch is answered within a few seconds even if every device
in it is dead. A device whose agent cannot be asked is unknown, not dead: after
an outage, "agent offline" is itself the answer the operator needs.

**Enforced at:** `src/application/device-monitoring/use-cases/RunNetworkSweepUseCase.ts` (`skipReason`, `sweepThroughAgents`, `sweepAgent`), `src/infrastructure/probe-agents/adapters/AgentChannelSweepProbe.ts`, `src/presentation/ws/agent/ConnectedAgents.ts` (`sweep`)
**Tests:** `tests/application/device-monitoring/use-cases/RunNetworkSweepUseCase.test.ts`, `tests/integration/use-cases/device-monitoring/RunNetworkSweepUseCase.integration.test.ts`, `tests/infrastructure/probe-agents/adapters/AgentChannelSweepProbe.test.ts`, `tests/integration/agent-sweep.test.ts`

## Internet speed test

An on-demand measure of the ISP's own internet connection, from its on-site
server, to tell whether the upstream provider is delivering. Results are kept
as a history.

### MON-100 — A speed test measures the server's internet connection, and only on demand

**Type:** Policy · **Status:** Active
**Since:** 2026-10-27

`GET /api/network/speed-test/stream` measures this server's connection to
the nearest Cloudflare speed-test server (speed.cloudflare.com): latency and
jitter, then download, then upload, streaming the speed as it goes. It runs
only when a user starts it, never on a schedule. Operators and administrators
may start one (`create`); a viewer may not. It measures the server's link to
the internet, not any device or customer: nothing about devices is read or
changed.

**Why:** It answers "is our upstream provider giving us what we pay for?"
from inside the ISP's network. A test fills the line while it runs, so it
must never run by itself, and only staff who can act on the result start
it.

**Enforced at:** `src/application/device-monitoring/use-cases/RunSpeedTestUseCase.ts`, `src/infrastructure/monitoring/speed-test/CloudflareSpeedTester.ts`, `src/presentation/http/routes/speed-test.routes.ts`
**Reached from:** `GET /api/network/speed-test/stream` via `SpeedTestController.stream`
**Tests:** `tests/application/device-monitoring/use-cases/SpeedTestUseCases.test.ts`, `tests/integration/speed-test.routes.test.ts`

### MON-101 — One speed test at a time; closing the stream stops it and keeps nothing

**Type:** Policy · **Status:** Active
**Since:** 2026-10-27

While a test is running, starting another is refused with `409`
`"A speed test is already running"`, whoever started the first. When the
caller closes the stream, the test stops and nothing is kept. The next test
may start as soon as the last one has ended, however it ended.

**Why:** Two tests at once split the same line between them, so both would
report about half the real speed. A test stopped part-way has no complete
answer worth keeping, and leaving the page should not leave the server
filling the line for nobody.

**Enforced at:** `src/application/device-monitoring/use-cases/RunSpeedTestUseCase.ts` (`running`), `src/presentation/http/controllers/SpeedTestController.ts`
**Reached from:** `GET /api/network/speed-test/stream`
**Message:** `A speed test is already running`
**Tests:** `tests/application/device-monitoring/use-cases/SpeedTestUseCases.test.ts`, `tests/integration/use-cases/device-monitoring/RunSpeedTestUseCase.integration.test.ts`, `tests/integration/speed-test.routes.test.ts`

### MON-102 — Latency is the median of 10 samples; each direction runs 10 s over 4 connections

**Type:** Policy · **Status:** Active
**Since:** 2026-10-27

Latency: two empty requests open the connection and are dropped, then 10
more are timed one after another. Each sample is the time to the answer less
the processing time Cloudflare reports for it (`Server-Timing`). Latency is
the median of the samples, and jitter the average change from one sample to
the next. Download, then upload: 4 connections transfer back to back for 10
seconds each, and the speed is the data moved after the first 2 seconds,
over the time after them. While running, the speed over the last second is
reported every second. A whole test takes about 25 seconds.
Each download request asks for 8 MB: Cloudflare blocks an address for about
an hour, with `429`, once it asks for 10 MB or more at a time too often.
A `429` is reported as `"Cloudflare is limiting tests from this connection,
try again in N min"`, the wait taken from its `Retry-After`.

**Why:** The first requests pay for setting up the encrypted connection and
would overstate latency; the median ignores a stray slow sample. One TCP
connection rarely fills a fast line, and every connection starts slow, so
several run at once and the slow start is left out: the same approach the
public speed-test sites use, so the numbers can be compared with them.

**Enforced at:** `src/infrastructure/monitoring/speed-test/CloudflareSpeedTester.ts` (`DEFAULT_CLOUDFLARE_SPEED_TEST_OPTIONS`)
**Tests:** `tests/infrastructure/monitoring/speed-test/CloudflareSpeedTester.test.ts`

### MON-103 — Every finished speed test is kept, failed ones with what they measured

**Type:** Invariant · **Status:** Active
**Since:** 2026-10-27

A test that runs to its end is kept as `COMPLETED` with all four measures
(download, upload, latency, jitter). A test that fails part-way is kept as
`FAILED`, with the measures taken before the failure and the reason, naming
the phase (`"Upload failed: the server answered 503"`). A result without a
reason must have every measure. Each keeps who started it: the user's email as
it was then, and the user's id until that user is deleted. Results are
listed newest first, to every role (`GET /api/network/speed-tests`), and are
not purged: each is a few hundred bytes. When a result cannot be saved, the
person who ran it still sees it.

**Why:** A history is what turns one number into evidence: "upload has been
half of what we pay for all week" is something to take to the provider. A
failure is part of that history: a test that cannot reach the internet is
itself a finding.

**Enforced at:** `src/domain/device-monitoring/entities/SpeedTestResult.ts` (`create`), `src/application/device-monitoring/use-cases/RunSpeedTestUseCase.ts`, `src/application/device-monitoring/use-cases/ListSpeedTestsUseCase.ts`
**Reached from:** `GET /api/network/speed-test/stream`, `GET /api/network/speed-tests` via `SpeedTestController.list`
**Message:** `a speed test without an error must have every measure`
**Tests:** `tests/domain/device-monitoring/entities/SpeedTestResult.test.ts`, `tests/integration/use-cases/device-monitoring/RunSpeedTestUseCase.integration.test.ts`, `tests/integration/use-cases/device-monitoring/ListSpeedTestsUseCase.integration.test.ts`

### MON-104 — A server hosted off site runs no speed test

**Type:** Policy · **Status:** Active
**Since:** 2026-10-27

When the server is not on the ISP's network (`SERVER_ON_SITE=false`), a
speed test is refused with `409`
`"This server is not on the ISP's network, so its speed test would not measure it"`,
and nothing is measured or kept.

**Why:** Off site, the test would measure the hosting provider's connection,
not the ISP's, and a number that looks right but means something else is
worse than none. Running it from the on-site agent is possible later.

**Enforced at:** `src/application/device-monitoring/use-cases/RunSpeedTestUseCase.ts`
**Reached from:** `GET /api/network/speed-test/stream`
**Message:** `This server is not on the ISP's network, so its speed test would not measure it`
**Tests:** `tests/application/device-monitoring/use-cases/SpeedTestUseCases.test.ts`, `tests/integration/use-cases/device-monitoring/RunSpeedTestUseCase.integration.test.ts`

## Ping tool

A ping of any address, from the app, like a terminal's `ping`: from this
server or from an on-site agent. Nothing is stored.

### MON-120 — The ping tool pings any address once a second and changes nothing

**Type:** Policy · **Status:** Active
**Since:** 2026-10-27

`GET /api/network/ping/stream` pings one IPv4 or IPv6 address (not a host
name) 4 times by default, at most 100, one ping a second, and streams each
answer as it comes: `REPLY` with its time, `NO_REPLY`, or `ERROR` when the
ping could not be sent at all. It ends with the totals: sent, received, loss
and minimum, average and maximum time. Pings that could not be sent count
neither as sent nor as lost. The address need not belong to any device.
Nothing is written: no ping history, no device state, no alert. Operators
and administrators may use it (`create`, the same as a manual poll); a
viewer may not. Closing the stream stops it.

**Why:** Staff need to check addresses that are not devices: a customer's
router, a new antenna before it is added, the provider's gateway, `8.8.8.8`.
Like the network sweep (`MON-080`), a one-off check must not move the
monitored state. A ping that could not be sent says nothing about the
address, so it must not look like loss. Only addresses are accepted, so
nothing typed is ever handed to the ping program as anything else.

**Enforced at:** `src/application/device-monitoring/use-cases/RunPingToolUseCase.ts`, `src/presentation/http/validation/ping-tool.schemas.ts`, `src/presentation/http/routes/ping-tool.routes.ts`
**Reached from:** `GET /api/network/ping/stream` via `PingToolController.stream`
**Tests:** `tests/application/device-monitoring/use-cases/RunPingToolUseCase.test.ts`, `tests/integration/use-cases/device-monitoring/RunPingToolUseCase.integration.test.ts`, `tests/integration/ping-tool.routes.test.ts`

### MON-121 — A ping can be sent from an agent; without one, from the server

**Type:** Policy · **Status:** Active
**Since:** 2026-10-27

With `agentId`, every ping is sent by that agent, which must be enrolled and
not revoked; otherwise the answer is `404` `"Agent not found"`. Each ping is
its own single-attempt request to the agent, waiting the agent's usual 5
seconds for a reply. If the agent is not connected or is too old to answer,
the first ping reports it as `ERROR` and the run ends there, with the reason
in `stoppedEarly`. An agent that does not answer one ping in time is
reported as `ERROR` for that ping, and the run goes on. Without `agentId` the
server pings, waiting 2 seconds for each reply.

**Why:** The agent sees the customer's network from inside, which is often
the question ("can the tower reach the client?"). One attempt per request
keeps each line one real ping, as in a terminal. A missing agent fails
every ping the same way, so it is said once rather than a hundred times. Any
agent version that answers manual polls (`0.3.0` and later) can do this, so
none needs updating.

**Enforced at:** `src/application/device-monitoring/use-cases/RunPingToolUseCase.ts` (`pingFromAgent`, `pingFromServer`), `src/infrastructure/monitoring/ping-tool/PrismaPingToolAgentQuery.ts`
**Message:** `Agent not found`
**Tests:** `tests/application/device-monitoring/use-cases/RunPingToolUseCase.test.ts`, `tests/integration/use-cases/device-monitoring/RunPingToolUseCase.integration.test.ts`, `tests/integration/ping-tool.routes.test.ts`

### MON-122 — At most 10 ping runs at once

**Type:** Policy · **Status:** Active
**Since:** 2026-10-27

While 10 runs are going, from anyone and from any source, another is refused
with `409` `"Too many pings are running, try again in a moment"`. A run
frees its place as soon as it ends, however it ended.

**Why:** Several staff may troubleshoot at once, so one run at a time would
be too strict. A cap still keeps a forgotten or scripted stream from piling
up ping processes on the server or requests on an agent.

**Enforced at:** `src/application/device-monitoring/use-cases/RunPingToolUseCase.ts` (`running`, `DEFAULT_PING_TOOL_OPTIONS`)
**Message:** `Too many pings are running, try again in a moment`
**Tests:** `tests/application/device-monitoring/use-cases/RunPingToolUseCase.test.ts`

### MON-123 — Off site, the ping tool needs an agent

**Type:** Policy · **Status:** Active
**Since:** 2026-10-27

When the server is hosted off site (`SERVER_ON_SITE=false`), a ping without
`agentId` is refused with `409`
`"This server is not on the ISP's network: choose an agent to ping from"`.
Pinging through an agent works the same as on site.

**Why:** Off site the server cannot reach the ISP's private addresses, so its
answer would be a misleading `NO_REPLY` (`MON-023`).

**Enforced at:** `src/application/device-monitoring/use-cases/RunPingToolUseCase.ts`
**Message:** `This server is not on the ISP's network: choose an agent to ping from`
**Tests:** `tests/application/device-monitoring/use-cases/RunPingToolUseCase.test.ts`, `tests/integration/use-cases/device-monitoring/RunPingToolUseCase.integration.test.ts`

## MikroTik port speeds

Each Ethernet port of the company's MikroTiks, the speed it linked at, and
whether that is the speed it should run at. A port that comes up at 100 Mbps
where it should be at 1 Gbps usually means a bad cable or connector.

### MON-140 — Port speeds cover the company's MikroTik routers and switches in service

**Type:** Policy · **Status:** Active
**Since:** 2026-10-28

`GET /api/routers/port-speeds` lists, by name, every device that is not
deleted, belongs to the company (`owner` `COMPANY`), is `ACTIVE` or
`COMMISSIONING`, is a MikroTik (vendor `mikrotik`), and either has a model of
type `ROUTERBOARD`, `ROUTER` or `SWITCH` or is categorised `GATEWAY` or
`AGGREGATION_SWITCH`. A model marked as running SwOS is left out. Every
router is read live and at the same time. A router that does not answer is
still listed, with `readable: true` and the `error`, and the others are
shown as usual. Any role may look; nothing is stored by looking.

**Why:** The question is the ISP's own wiring, so a customer's router is not
part of it. SwOS has no RouterOS API to read the ports from. One router
that is down must not hide the rest of the network.

**Enforced at:** `src/infrastructure/monitoring/port-speeds/PrismaPortSpeedTargetsQuery.ts`, `src/application/device-monitoring/services/RouterPortInspector.ts`
**Reached from:** `GET /api/routers/port-speeds` via `PortSpeedController.list`
**Tests:** `tests/integration/use-cases/device-monitoring/ListRouterPortSpeedsUseCase.integration.test.ts`, `tests/application/device-monitoring/services/RouterPortInspector.test.ts`, `tests/integration/port-speed.routes.test.ts`

### MON-141 — A router's enabled Ethernet ports are read once, and nothing on it changes

**Type:** Policy · **Status:** Active
**Since:** 2026-10-28

The router is read over the RouterOS API with the device's saved HTTP
username and password, on its API port (`MON-066`). The read gets the
router's own name (`/system identity`), every enabled Ethernet or SFP port
with its comment, and, for each port, whether it has a link, the rate it
negotiated (10 Mbps up to 100 Gbps) and whether it runs at full duplex. Each
read logs in once and logs out at the end. A router that has not answered
within 10 seconds counts as not answering. If the router refuses to report
all ports in one request, each port is asked for on its own, so one odd port
does not hide the others.

**Why:** Only read commands are sent, so checking can never disturb a
router. Disabled ports are left out because nobody expects them to link.

**Enforced at:** `src/infrastructure/monitoring/port-speeds/RouterOsPortReader.ts`
**Tests:** `tests/infrastructure/monitoring/port-speeds/RouterOsPortReader.test.ts`

### MON-142 — An operator sets the speed each port should link at

**Type:** Invariant · **Status:** Active
**Since:** 2026-10-28

Each port of a router can be given one expected speed, which must be one of
10, 100, 1000, 2500, 5000, 10000, 25000, 40000 or 100000 Mbps. The port is
named as the router names it (at most 64 characters, spaces around it
ignored). Setting it again replaces it, and `null` clears it. A port with no
expected speed is listed but never judged. The router is not read when the
speed is set, so it can be set while the router is down. The expected
speeds go when the device itself is removed from the database.

**Why:** Only the ISP knows what is plugged into each port: an old 100 Mbps
radio on one port is fine, a gigabit backhaul at 100 Mbps is a fault.
Guessing would give false alarms, so the expected speed is stated, not
inferred.

**Enforced at:** `src/domain/device-monitoring/value-objects/PortSpeed.ts`, `src/domain/device-monitoring/entities/PortExpectedSpeed.ts`, `src/application/device-monitoring/use-cases/SetPortExpectedSpeedUseCase.ts`
**Reached from:** `PUT /api/routers/:id/port-speeds/expected` via `PortSpeedController.setExpected`
**Message:** `expected speed must be one of 10, 100, 1000, 2500, 5000, 10000, 25000, 40000, 100000 Mbps`, `Router not found`
**Tests:** `tests/domain/device-monitoring/value-objects/PortSpeed.test.ts`, `tests/domain/device-monitoring/entities/PortExpectedSpeed.test.ts`, `tests/integration/use-cases/device-monitoring/SetPortExpectedSpeedUseCase.integration.test.ts`

### MON-143 — A linked port below its expected speed, or at half duplex, is SLOW

**Type:** Policy · **Status:** Active
**Since:** 2026-10-28

Each port is given one verdict:

| Verdict          | When                                                                            |
| ---------------- | ------------------------------------------------------------------------------- |
| `NO_LINK`        | The port has no link, whether or not it has an expected speed                   |
| `NO_EXPECTATION` | Linked, but nobody set an expected speed                                        |
| `UNKNOWN`        | Linked and expected, but the router did not report a rate                       |
| `SLOW`           | Linked below the expected speed, or at half duplex                              |
| `OK`             | Linked at or above the expected speed, at full duplex                           |
| `PORT_MISSING`   | An expected speed is set for a port the router has no enabled port by that name |

A router that does not say whether a port is at full duplex is taken to be at
full duplex.

**Why:** A port with no link is usually something unplugged on purpose, and
the far end being down is already reported by reachability alerts. Half
duplex is a negotiation failure just like a dropped speed. A renamed or
disabled port would otherwise silently stop being checked, so it is shown.

**Enforced at:** `src/domain/device-monitoring/entities/PortExpectedSpeed.ts` (`isMetBy`), `src/application/device-monitoring/services/RouterPortInspector.ts` (`judgePort`)
**Tests:** `tests/application/device-monitoring/services/RouterPortInspector.test.ts`, `tests/domain/device-monitoring/entities/PortExpectedSpeed.test.ts`

### MON-144 — "Accept current" makes each linked port's rate its expected speed

**Type:** Policy · **Status:** Active
**Since:** 2026-10-28

`POST /api/routers/:id/port-speeds/accept-current` reads the router now and,
for every port that has a link and reports a rate, stores that rate as its
expected speed, replacing any it had. Ports without a link keep what they
had. The answer is the router as `GET /api/routers/port-speeds` shows it,
judged against the new speeds. If the router does not answer, nothing is
changed and the answer is `502`.

**Why:** Setting every port by hand is slow on a 24-port switch. When the
network is known to be right, one click records it, and the operator then
only corrects the exceptions.

**Enforced at:** `src/application/device-monitoring/use-cases/AcceptCurrentPortSpeedsUseCase.ts`
**Reached from:** `POST /api/routers/:id/port-speeds/accept-current` via `PortSpeedController.acceptCurrent`
**Message:** `The router did not answer: <error>`
**Tests:** `tests/application/device-monitoring/use-cases/PortSpeedUseCases.test.ts`, `tests/integration/use-cases/device-monitoring/AcceptCurrentPortSpeedsUseCase.integration.test.ts`

### MON-145 — Only a router this server or its agent reaches, with an address and a login, is read

**Type:** Policy · **Status:** Active
**Since:** 2026-10-28

A router with no IP address, or no saved username and password, is listed
with `readable: false` and the reason, and is not tried. When the server is
on site it reads every router itself, including one behind an agent. Off
site (`SERVER_ON_SITE=false`) a router behind an agent is read through that
agent (`AGT-122`), for the list, "accept current" and the scheduled check
alike; any other is listed as not reached. An agent that is offline or too
old to read ports gives the router an `error` (it was tried), not a
`reason`, and the scheduled check skips it (`MON-147`). "Accept current" on
a router that cannot be read answers `409`.

**Why:** Off site the server cannot reach the ISP's private addresses
(`MON-023`); the agent on the ISP's network can, as for live traffic
(`MON-065`).

**Revised:** 2026-10-28 — off site, routers behind an agent are read through
it; before, they were listed as not supported yet.

**Enforced at:** `src/application/device-monitoring/services/resolvePortSpeedTarget.ts`, `src/infrastructure/monitoring/port-speeds/PrismaPortSpeedTargetsQuery.ts`, `src/infrastructure/probe-agents/adapters/AgentChannelPortReader.ts`, `src/infrastructure/di/container.ts`
**Message:** `The router has no IP address`, `The router has no username and password saved`, `This server is off site and no agent reaches the router`, `The agent must be updated to read port speeds`, `The router cannot be read: <reason>`
**Tests:** `tests/application/device-monitoring/services/resolvePortSpeedTarget.test.ts`, `tests/infrastructure/probe-agents/adapters/AgentChannelPortReader.test.ts`, `tests/integration/use-cases/device-monitoring/ListRouterPortSpeedsUseCase.integration.test.ts`, `tests/integration/agent-ports.test.ts`

### MON-146 — Administrators and operators set expected speeds; anyone may look

**Type:** Policy · **Status:** Active
**Since:** 2026-10-28

Setting, clearing and accepting expected speeds needs the `update`
permission (administrators and operators); a viewer gets `403`. Listing
needs only `read`.

**Why:** It is the same level of trust as editing a device. Operators wire
the network, so they keep its expected speeds up to date.

**Enforced at:** `src/presentation/http/routes/port-speed.routes.ts`
**Tests:** `tests/integration/port-speed.routes.test.ts`

### MON-147 — A port slow on two checks in a row raises one alert, and its recovery is announced

**Type:** Policy · **Status:** Active
**Since:** 2026-10-28

Every `PORT_SPEED_CHECK_INTERVAL_MINUTES` (1–1440, default 10; any other
value stops the boot) the server reads each router of MON-140 that has at
least one expected speed. Routers with none are not read. Each port with an
expected speed is judged as in MON-143:

- **SLOW** adds one to the port's streak. On the second SLOW check in a row
  the port raises an alert. It does not raise again while it stays slow.
- **OK** ends the streak. If the port had raised an alert, a recovery is
  sent and the alert is closed.
- **No link, no rate, or no such port on the router** ends the streak but
  leaves a raised alert open: nothing is sent either way. An unplugged port
  may be on purpose, and the device-down alerts cover the far end. A port
  set to alert on no link counts no link as SLOW instead (MON-149).
- **A router that cannot be read** (no answer, no address, no login, off
  site) changes nothing for its ports. It is logged.

The streak and the open alert are kept with the expected speed, so a
restart neither repeats an alert nor forgets one. Changing the expected
speed keeps them, so lowering it to the speed the port runs at sends the
recovery on the next check. Clearing it drops them, with no recovery sent.
The check writes only that state, so an expected speed an operator saves
while a check runs is kept.

**Why:** One slow reading can be a port that is still negotiating. Two in a
row, ten minutes apart, is a real fault, usually a damaged cable or a
connector with a bad pair. Saying it once, and once more when it is fixed,
keeps the alert from becoming noise.

**Enforced at:** `src/domain/device-monitoring/entities/PortExpectedSpeed.ts` (`recordCheck`), `src/application/device-monitoring/use-cases/CheckPortSpeedsUseCase.ts`, `src/infrastructure/monitoring/orchestrator/PortSpeedCheckOrchestrator.ts`, `src/infrastructure/persistence/PrismaPortExpectedSpeedRepository.ts` (`saveCheckState`)
**Tests:** `tests/domain/device-monitoring/entities/PortExpectedSpeed.test.ts`, `tests/application/device-monitoring/use-cases/PortSpeedUseCases.test.ts`, `tests/infrastructure/monitoring/orchestrator/PortSpeedCheckOrchestrator.test.ts`, `tests/integration/use-cases/device-monitoring/CheckPortSpeedsUseCase.integration.test.ts`

### MON-148 — Port speed alerts are one notice per router, of type `port_speed_low`

**Type:** Policy · **Status:** Active
**Since:** 2026-10-28

Alerts and recoveries go through the same publisher as every other alert,
so the device's quiet hours, the muted alert types, an expired subscription,
Telegram, phones and the inbox all apply. They are notices only and do not
appear in `GET /api/alerts`.

- Type `port_speed_low` (a recovery has the same type, `resolved: true`),
  severity WARNING, source `Velocidad de puertos`. Muting
  `port_speed_low` silences both.
- One notice per router per check. With a single port it names it:
  `El puerto ether3 (Backhaul) de "Core" está a 100 Mbps, debería estar a 1 Gbps`
  (`… a 1 Gbps en half duplex, …` for half duplex, `… está sin enlace, …`
  for a lost link, MON-149). With several it says
  `2 puertos de "Core" están más lentos de lo que deberían` (`… están sin
  enlace o más lentos …` when one of them has no link) and lists each.
  A recovery reads `El puerto ether3 de "Core" volvió a 1 Gbps`.
- A notice held back (quiet hours, muted) or that fails to send is not
  retried: the alert counts as raised, and the inbox still has it.

**Why:** A switch with a bad uplink can drop several ports at once; one
message per router says so without a burst of pages. Not retrying matches
the backup alerts (BKP-061): a slow port is a repair to schedule, not an
outage to page someone about at night.

**Enforced at:** `src/application/device-monitoring/use-cases/CheckPortSpeedsUseCase.ts`
**Tests:** `tests/application/device-monitoring/use-cases/PortSpeedUseCases.test.ts`, `tests/integration/use-cases/device-monitoring/CheckPortSpeedsUseCase.integration.test.ts`

### MON-149 — A port can be set to alert when it loses its link

**Type:** Policy · **Status:** Active
**Since:** 2026-10-28

Each expected speed has an "alert on no link" switch, off unless an
operator turns it on with `alertOnNoLink: true` when setting the speed
(MON-142). A new expected speed, including one stored by "accept current",
starts with it off; changing only the speed keeps it as it was; clearing the
speed drops it.

With it on, the scheduled check (MON-147) counts a port with no link as
SLOW: two checks in a row without link raise one `port_speed_low` alert,
`El puerto ether3 (Backhaul) de "Core" está sin enlace, debería estar a 1 Gbps`,
and the recovery is sent once the port links at its speed again. A link
that comes back slower than expected keeps the alert open, as any slow port.
A port the router no longer has still sends nothing. The list keeps showing
such a port as `NO_LINK`; the switch is shown beside it.

Turning it off while a no-link alert is open leaves that alert open until
the port links at its speed again; the streak ends at the next check.

**Why:** An unplugged port is often on purpose, so no link stays silent by
default. On a backhaul or an uplink to another tower, a lost link is the
fault itself, and the device-down alert for the far end may come late or
name the wrong device.

**Enforced at:** `src/domain/device-monitoring/entities/PortExpectedSpeed.ts` (`alertOnNoLink`, `changeAlertOnNoLink`), `src/application/device-monitoring/use-cases/CheckPortSpeedsUseCase.ts`, `src/application/device-monitoring/use-cases/SetPortExpectedSpeedUseCase.ts`, `src/presentation/http/validation/port-speed.schemas.ts`
**Tests:** `tests/domain/device-monitoring/entities/PortExpectedSpeed.test.ts`, `tests/application/device-monitoring/use-cases/PortSpeedUseCases.test.ts`, `tests/integration/use-cases/device-monitoring/SetPortExpectedSpeedUseCase.integration.test.ts`, `tests/integration/use-cases/device-monitoring/CheckPortSpeedsUseCase.integration.test.ts`, `tests/integration/port-speed.routes.test.ts`

### MON-150 — One router's ports can be read on their own, now

**Type:** Policy · **Status:** Active
**Since:** 2026-10-28

`GET /api/routers/:id/port-speeds` reads one router of MON-140 live and
answers it exactly as the list shows it, with the time it was read, without
waiting for the other routers. A router that cannot be read is answered with
its reason (MON-145), one that does not answer with its error, both `200`.
A device that is not one of those routers is `404 Router not found`. Anyone
may look (MON-146).

It only reads: the scheduled check's streaks and open alerts are not
touched, so checking a port again and again after changing a cable neither
raises nor recovers an alert. The next scheduled check does that.

**Why:** After swapping a cable the operator wants to see that port now. The
list reads every router and waits for the slowest one.

**Enforced at:** `src/application/device-monitoring/use-cases/GetRouterPortSpeedsUseCase.ts`, `src/presentation/http/routes/port-speed.routes.ts`
**Tests:** `tests/application/device-monitoring/use-cases/PortSpeedUseCases.test.ts`, `tests/integration/use-cases/device-monitoring/GetRouterPortSpeedsUseCase.integration.test.ts`, `tests/integration/port-speed.routes.test.ts`
