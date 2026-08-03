# Business Rules — Device Monitoring

Whether a device is reachable, and what the system does about it: the polling
configuration that schedules the checks (PollingConfiguration), the current
reachability of each device (DeviceState), and the ping history behind it.

Conventions, rule types and the ID scheme are in [README.md](README.md).

**ID ranges**

| Range                 | Subject                                 |
| --------------------- | --------------------------------------- |
| `MON-001` – `MON-019` | Reachability state                      |
| `MON-020` – `MON-039` | Polling configuration and scheduling    |
| `MON-040` – `MON-059` | Ping history and retention              |

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

The transition is reached from two places, both of which delegate to the same use
case: the explicit toggle (`DeviceMonitoringToggledEvent`) and a status change
into INVENTORY or DAMAGED (`DeviceStatusChangedEvent`).

**Why:** Once polling stops, nothing will ever correct the stored reading, so the
last value freezes and is shown as current indefinitely — a device paused while
down still reads "down" months later. Blanking it to UNKNOWN is the only honest
answer, and keeping `lastSeen` means the operator can still tell how stale the
last real observation is.

An in-flight poll cannot undo this: `ExecutePollingCycleUseCase` re-reads the
configuration after its ping attempts and before writing, and skips the write if
monitoring was turned off meanwhile. Without that re-read the race is real, since
a cycle runs for several seconds and the suspension is dispatched without being
awaited.

**Enforced at:** `src/domain/device-monitoring/aggregates/DeviceState.ts` (`markUnknown`); orchestrated by `src/application/device-monitoring/use-cases/SuspendDeviceMonitoringUseCase.ts`
**Reached from:** `DeviceMonitoringToggledHandler` (monitoring off), `DeviceStatusChangedHandler` (INVENTORY or DAMAGED)
**Tests:** `tests/application/device-monitoring/use-cases/SuspendDeviceMonitoringUseCase.test.ts`, `tests/integration/use-cases/device-monitoring/SuspendDeviceMonitoringUseCase.integration.test.ts`

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
deletes only *resolved* alerts, so the row would also become unpurgeable — a
permanent entry in the alert list and in the database. Notifying would be worse
than silent: "✅ Alerta resuelta" for a device that was never fixed, only stopped
being watched, is good news that did not happen.

**Enforced at:** `src/application/device-monitoring/use-cases/SuspendDeviceMonitoringUseCase.ts`, delegating to `ResolveAlertUseCase`
**Tests:** `tests/integration/use-cases/device-monitoring/SuspendDeviceMonitoringUseCase.integration.test.ts`

### MON-005 — The first result after UNKNOWN is not a recovery

**Type:** Policy · **Status:** Active
**Since:** 2026-08-03

When a poll follows an UNKNOWN state, a successful ping raises no
`DeviceCameOnlineEvent`; a failed one still raises `DeviceWentOfflineEvent`.

**Why:** Coming back from UNKNOWN is not the same as coming back from an outage.
The device may never have been down — nobody was looking — so a recovery notice
would report the end of an outage that was never reported, and never happened.
The asymmetry is deliberate: a device that is dead the first time it is seen has
to alert, or a unit that has been down since installation would stay silent until
its first recovery.

Previously this was decided by an `isFirstPoll` argument the caller computed from
whether a state row existed, so it covered a brand-new device but not a paused
one. With UNKNOWN persisted (MON-001) the aggregate reads its own state and both
cases are covered by the same rule.

**Enforced at:** `src/domain/device-monitoring/aggregates/DeviceState.ts` (`applyPingResult`)
**Tests:** `tests/domain/device-monitoring/aggregates/DeviceState.test.ts`, `tests/integration/use-cases/device-monitoring/SuspendDeviceMonitoringUseCase.integration.test.ts`

A probe that could not be executed at all is a separate case and deliberately
does **not** move the status: `applyPollFailure` advances `lastCheckedAt` only. A
local fault says nothing about the device, and demoting a known-DOWN device to
UNKNOWN would silently end the outage it is already in.

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

---

## Ping history and retention

### MON-040 — Ping history is kept for 30 days, independent of monitoring state

**Type:** Policy · **Status:** Active
**Since:** 2026-08-03

Raw `ping_results` rows are deleted once they are older than
`PING_RESULT_RETENTION_DAYS` (default 30). The sweep runs daily. Pausing a device
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
