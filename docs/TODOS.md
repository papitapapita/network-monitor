# TODOs

## Priority 1 — Foundation

_These block or constrain everything else. Do in order._

- [ ] **Device activation workflow** — full lifecycle + soft-delete + replacement

  - COMMISSIONING status implemented: INVENTORY → COMMISSIONING (IP required, monitoring auto-on) → ACTIVE (IP + location required)
  - Soft-delete: `deletedAt` / `deletedBy` + 7-day grace period before hard removal
  - Emit `DeviceDeletedEvent` on soft-delete so the polling and notification pipelines can react (no such event exists yet)
  - Scope: schema migration + domain invariant (monitoring only runs on `ACTIVE` and `COMMISSIONING` devices)
  - **Hardware replacement — `ReplaceDeviceUseCase`** (the remaining half of "device model change"; the correction half shipped as DEV-063)
    - The problem: a unit gets damaged and is swapped for a physically different box, often of a **different model**. That is not an update to the `Device` row — a `Device` is one physical unit, and `pingResults` / `wirelessSnapshots` / `alertEvents` / `deviceState` all hang off its id. Editing `deviceModelId` in place would retroactively re-attribute months of metrics to hardware that never produced them, with no record that a swap happened. DEV-063 therefore restricts model corrections to `INVENTORY` devices, which deliberately leaves this case with **no path at all** today
    - Interim workaround for operators: retire the old device (→ `DAMAGED`) and create a new one by hand. Loses the lineage link and requires manually re-pointing credentials and the contracted service
    - Schema: `replacesDeviceId` / `replacedByDeviceId` self-relation on `Device` + `replacedAt`. Without the lineage link a replacement is indistinguishable from an unrelated device appearing, and the dashboard cannot say "this CPE, current unit since March" while keeping the old unit's history on the old row
    - Orchestration (this is what makes it a use case and not something an operator can do correctly by hand):
      1. old device → `DAMAGED` (note: there is no `DECOMMISSIONED` status — decide whether replacement needs one, since `DAMAGED` also means "broken but still ours")
      2. create the new `Device` with the new model, inheriting location, category, owner, and the IP released by the old unit
      3. re-point `DeviceCredentials` (1:1) and `ContractedService.deviceId` (1:1 `@unique`, `prisma/schema.prisma:491`) to the new device — miss this and the customer's billing link silently detaches
      4. emit `DeviceReplacedEvent`
    - Wireless: if old and new models differ in `isWireless`, the old unit's `WirelessPollingConfiguration` must not be copied blindly — a non-wireless replacement should end wireless polling. Nothing does this for you: DEV-027 now _refuses_ to make a model non-wireless while configs exist rather than deleting them, so the orchestrator has to delete the old unit's config explicitly and say so in its result
    - Testing: no HTTP-only surface covers an orchestrator, so per `docs/rules/TESTING-INTEGRATION-STANDARD.md` this needs a thorough integration suite of its own — lineage, credential/contract transfer, IP handover, and the wireless-mismatch case
    - Also worth deciding here: whether `POST /api/devices/:id/replace` or a top-level `POST /api/devices/replacements` better reflects that the operation creates a new aggregate

- [ ] **Status & capability guards** — centralise eligibility checks in a `DeviceEligibilityService`
  - Only `ACTIVE`, non-deleted, non-replaced devices are polled (ping, SNMP, wireless)
  - Wireless polling requires `isWireless = true`; SNMP polling requires valid `DeviceCredentials`
  - Alerts and notifications must check device state at dispatch time (device may have been deleted between poll and notify)
  - Surface violations as named `Result` errors so each use case delegates rather than duplicates guards

---

## Priority 2 — Core Product

_Main user-facing features still missing._

- [ ] **Live throughput view** — real-time bandwidth consumption per device/link for support and capacity planning

  - Surface `throughputTxBps` / `throughputRxBps` from `WirelessSnapshot` via SSE or a polling endpoint
  - Show as % of `linkCapacityBps` (already stored on `WirelessPollingConfiguration`) for utilisation context
  - Useful for confirming a customer is actually saturating their plan in real time

- [ ] **Clear alerts — all types, not just wireless** — allow operators to manually clear (acknowledge) any active alert

  - Two separate aggregates today with no shared clearing path: `WirelessAlertRecord` (wireless-monitoring) and `AlertEvent` (notifications, used by the ping/device-down pipeline)
  - Wireless: `ClearWirelessAlertUseCase` — finds alert by ID, calls `WirelessAlertRecord.clear(now)`; endpoint `POST /wireless/:deviceId/alerts/:alertId/clear`
  - Ping/device-down: equivalent clear path for `AlertEvent`; endpoint `POST /alerts/:alertId/clear`
  - Guards for both: alert must belong to the device; only active alerts can be cleared; clearing is idempotent
  - Also needs a bulk path — clearing alerts one at a time is unusable after an outage storm (e.g. `POST /alerts/clear` taking a list of IDs, or a per-device "clear all")
  - Decide whether a manual clear differs from an automatic (rule-driven) clear — an operator acknowledging a still-breaching metric should probably not be re-opened on the next poll, which needs a suppressed-until timestamp rather than a plain clear

- [ ] **Real-time alerts via SSE** — push alerts to the browser without manual reload

  - `GET /alerts/stream` endpoint; keep a `clients` Set; push to all connected clients on alert fire
  - Frontend: `new EventSource('/alerts/stream')` — reconnects automatically
  - Steps: (1) endpoint + clients Set, (2) wire `send(alert)` at alert creation, (3) frontend EventSource listener

- [ ] **Address on network devices** — add physical address to Device

  - Belongs in Device Inventory bounded context
  - For now: accept plain strings for city/province (clients are in one province)
  - Address mutability: TBD

- [ ] **ServiceInstallation bounded context** — replace `LocationType.CUSTOMER_PREMISES` with a proper `ServiceInstallation` aggregate

  - A `CUSTOMER_PREMISES` location is really where a contracted internet service is delivered, not a generic place
  - One customer can have multiple service installations (home + business)
  - `ServiceInstallation` fields: `serviceAddress` (required: street + coordinates), `subscriberId`, `contractId`, installed device references
  - When introduced: `WIRELESS_CPE` devices reference `serviceInstallationId` instead of `locationId`; `LocationType.CUSTOMER_PREMISES` is retired
  - `GET /api/locations/map` then queries both sources and merges them into the same `MapPinDTO` shape; frontend rendering is unchanged
  - Prerequisite: subscriber/customer bounded context

- [ ] **Live map refresh notification (SSE/WebSocket)** — notify the frontend map that a device's location changed so a refresh affordance can appear instead of requiring a manual reload

  - Wire a handler for `DeviceLocationAssignedEvent` — currently raised in `Device.assignLocation` (`src/domain/device-inventory/aggregates/Device.ts`) but has no registered consumer in `container.ts`
  - Push a lightweight "changed" signal only (not the full pin payload); frontend re-fetches `GET /api/locations/map` when the operator clicks refresh
  - Delivery mechanism: reuse the SSE pattern from "Real-time alerts via SSE" below if that lands first (`clients` Set + broadcast); otherwise a small dedicated `GET /locations/stream` endpoint
  - Prerequisite: none — can be built ahead of the SSE alerts item, whichever lands first should establish the shared SSE broadcast helper

- [ ] **Reject or flag an HTTP credential port of 80** — a stale client can still silently write a port AirOS collection cannot use

  - `DeviceCredentialsMapper.extractCreateData` already does `httpPort: dto.httpPort ?? 443`, and the frontend now sends 443 as well, so newly written rows are correct
  - Remaining: decide whether to reject 80 outright with a clear message or merely log it — an HTTPS-only radio fails collection silently today
  - Check existing rows for `http_port = 80` and decide whether to migrate them to 443

- [ ] **Extend device list filtering — vendor + multi-value status/category** — filtering already happens in SQL end-to-end (`listDevicesSchema` → `ListDevicesUseCase` → `PrismaDeviceRepository.buildFilterWhere`, DEV-145), covering `status`, `category`, `owner`, `locationId`, `deviceModelId`, `monitoringEnabled`, and free-text `search`. Two gaps worth closing:

  - No `vendorId` filter — only `deviceModelId`, one level removed from vendor, even though `Vendor` is a first-class aggregate with its own listing use case
  - `status`/`category`/`owner` each accept a single value only — no CSV/array support for something like "ACTIVE or COMMISSIONING"
  - (Frontend-side filtering was considered and rejected for this list — dataset grows with the fleet, so filtering belongs in the `where` clause, not client-side)

- [ ] **Device categories** — allow creating and assigning categories (e.g. "STA Mimosa Cocuy")

- [ ] **Scan multiple network segments at once**

- [ ] **Multi-tenancy** — `tenant_id` FK on all tenant-specific entities (devices, locations, device models)
  - PostgreSQL RLS: `ALTER TABLE devices ENABLE ROW LEVEL SECURITY; CREATE POLICY tenant_isolation ON devices USING (tenant_id = current_setting('app.current_tenant_id')::uuid)`
  - Set tenant context per request: `await prisma.$executeRawUnsafe("SET LOCAL app.current_tenant_id = '${tenantId}'")`
  - `Protocol` stays a global reference table (shared across tenants, no `tenant_id`)
  - Prerequisite: auth module (tenant resolved from JWT)

---

## Priority 3 — Monitoring Enhancements

- [ ] **Turning monitoring off does not stop wireless/SNMP polling** — the two pipelines run on separate flags

  - `Device.monitoringEnabled` governs ICMP only. The wireless orchestrator selects on `wireless_device_configs.enabled` (`PrismaWirelessDeviceConfigRepository.findAllDue`, `WHERE enabled = true`) and no handler links `DeviceMonitoringToggledEvent` to it
  - Consequence: a device paused in the UI keeps collecting SNMP snapshots and keeps raising wireless alerts, which contradicts what the button appears to mean. MON-002 sets its ping reachability to UNKNOWN while wireless data keeps flowing
  - Deliberately left as-is on 2026-08-03 when MON-002 was built — the decision was to keep the pipelines independent for now, not that the split is right
  - Fix, when wanted: have the suspension also disable the device's `WirelessDeviceConfig`, and decide whether re-enabling monitoring restores it (it should, symmetrically with MON-020)

- [ ] **Event dispatch is fire-and-forget, so a dead handler diverges silently** — no outbox, no retry

  - `EventDispatcher.dispatch` does not await handlers and only reports rejections to a logger (`src/domain/shared/core/EventDispatcher.ts`); repositories call `dispatchEventsForAggregate` after the write has already committed
  - Consequence: if a handler dies outright, the aggregate write stands and the reaction never happens — e.g. `devices.monitoring_enabled = false` commits while polling keeps running, with only a log line to show for it. Nothing detects or repairs it
  - `SuspendDeviceMonitoringUseCase` mitigates the case it owns by ordering its writes so a partial failure self-heals (MON-002), and by being idempotent — but that is a local workaround, not a fix
  - Real fix is a transactional outbox: persist events in the same transaction as the aggregate, dispatch from a worker with retries. Large enough to be its own project; it also supersedes the per-use-case ordering tricks
  - Note that a plain DB transaction would not be enough on its own — no repository accepts a transaction client today, so that is a prerequisite either way

- [ ] **Multi-vendor polling** — Mikrotik (RouterOS API) and Ubiquiti (UISP / SSH)

  - Currently only ICMP ping; vendor-specific collectors unlock richer metrics
  - Abstract behind `IVendorPoller` — V1 ping adapter already exists as reference

- [ ] **Materialize `next_poll_at` on polling configs** — the due-device query does not scale past a few thousand devices

  - `PrismaPollingConfigurationRepository.findAllDue` computes due-ness inline: `ds.last_checked_at + (pc.interval_seconds || ' seconds')::interval <= now`
  - That predicate is a computed expression across a `LEFT JOIN`, so **no index can serve it** — Postgres seq-scans `polling_configurations` and `device_states` and hash-joins them on every orchestrator tick
  - Cost is linear in device count and runs once per tick; the ICMP orchestrator ticks at 1s (`container.ts`), so this is ~1 full scan/sec
  - Fine at the current ~300-device target (both tables sit in `shared_buffers`); becomes a real load source around 10k devices
  - Fix: store `next_poll_at` on `polling_configurations`, write it on each poll (`last_checked_at + interval_seconds`), add an index, and reduce the query to `WHERE enabled AND next_poll_at <= now()` — a cheap index range scan
  - Same applies to `WirelessPollingConfiguration` / `WirelessPollingOrchestrator`, though it ticks at 10s with a 60s floor so the pressure is ~6× lower
  - Do **not** address this by slowing the tick — the tick is the polling resolution, and a tick coarser than `PollingInterval.MIN_SECONDS` makes short intervals unenforceable

- [ ] **Define which alerts actually notify, and set their thresholds** — right now every rule that fires becomes an alert, and every threshold is a hardcoded constant

  - 14 rules exist in `src/domain/wireless-monitoring/services/rules/`: Ccq, Capacity, ClientCount, ClockSync, CpuMemory, Distance, Firmware, IdentityChange, LanHealth, Latency, SignalStrength, Snr, ThroughputSaturation
  - Every threshold is a module-level literal inside its rule file — e.g. `CcqRule` hardcodes WARNING < 75 (clear > 78) and CRITICAL < 50 (clear > 55). Changing a threshold currently means editing and redeploying code
  - Two separate decisions to make explicit: (1) which rules raise an **alert record**, and (2) which of those escalate to an **outbound notification** — today the two are conflated, so every rule is implicitly notify-worthy
  - Some rules are clearly informational rather than pageable (ClockSync, Firmware, IdentityChange, Distance) and should record without notifying
  - Move thresholds to configuration: per-device override on `WirelessDeviceConfig` falling back to a global default per rule; keep the hysteresis pattern (separate breach/clear values) since it already prevents flapping
  - Prerequisite for the notification split: decide whether wireless alerts share the ping alert notification pipeline (see the item below — same open question)

- [ ] **Wireless alert notification tracking** — add `notifiedAt` and `recoveryNotifiedAt` to `WirelessAlertRecord`

  - `AlertEvent` already has these fields; `WirelessAlertRecord` does not
  - Prerequisite: decide whether wireless alerts share the same notification pipeline as ping alerts

- [ ] **Fix the CCQ reading for non-M-series devices** — the collector applies an M-series scaling factor to every device

  - `UbiquitiHttpCollector` (line ~117) stores `ccqPercent: ccqRaw > 0 ? ccqRaw / 10 : null` unconditionally
  - The `/10` is correct for airMAX M-series (M2/M5/M900), which report CCQ on a 0–1000 scale. AC-series radios do not report CCQ the same way, so the stored percentage is wrong — silently, since no error is raised
  - `CcqRule` already guards correctly (`M_SERIES_PATTERN = /\bM[259]\d*\b/i`, returns no decisions for non-M models), so **alerting is unaffected** — the bug is in the persisted snapshot value and anything that reads it (history charts, the device status view)
  - Fix: gate the scaling on device model the same way the rule does, and store `null` for models that do not report a usable CCQ rather than a misscaled number
  - Better: move the M-series check into one shared place so the collector and `CcqRule` cannot drift apart — right now the knowledge lives in two files
  - Backfill question: existing `wireless_snapshots.ccq_percent` rows for AC devices hold bad values; decide whether to null them out or leave them

- [ ] **Verify the declared radio role against what the radio reports** — an access point cannot also be a wireless CPE, and nothing checks it after a poll

  - `WirelessDeviceConfig.deviceType` (`STATION` | `ACCESS_POINT`) is derived **once**, at config creation, from `Device.category` (`CreateWirelessConfigUseCase:70` — `isAccessPoint() ? 'ACCESS_POINT' : 'STATION'`). It is a claim by the operator, never re-verified against the hardware
  - The radio's real role **is already collected and then thrown away**: `UbiquitiHttpCollector` parses `wireless.mode` into `'ap-ptmp' | 'sta-ptmp' | 'ap-ptp' | 'sta-ptp'`, but `PollWirelessDeviceUseCase` never reads `http.mode` — it is not persisted, not compared, not logged. The `ap-*`/`sta-*` prefix is exactly the answer to "is this actually an AP or a CPE"
  - Consequence is silent bad data, not an error, because the declared type drives how the response is _parsed_ (`UbiquitiHttpCollector:65,116,135`):
    - declared `STATION`, really an AP → `clientsConnected` and the client roster are forced to `null`/`[]`, and `signalRxDbm` / `latencyMs` / `remoteApMac` are read from `sta[0]`, which on an AP is an arbitrary **client**. The AP's metrics get attributed to whichever subscriber happens to sit first in the list
    - declared `ACCESS_POINT`, really a station → `clientsConnected` comes from `wireless.count` and the roster from the station's own uplink entry, so a CPE reports itself as an AP serving one client
  - `WirelessSnapshot.deviceType` stores `config.deviceType` (`PollWirelessDeviceUseCase:372`) — the claim, not the observation — so history cannot be used to detect this after the fact either
  - Second drift source: `UpdateDeviceUseCase` can change `Device.category` at any time and `UpdateWirelessConfigUseCase` has no `deviceType` path, so flipping a device between `ACCESS_POINT` and `WIRELESS_CPE` leaves `wireless_device_configs.device_type` stale permanently
  - Fix: carry `mode` through to the poll result, persist it on the snapshot, and on each successful poll compare the `ap-*`/`sta-*` prefix with `config.deviceType`. On mismatch — do **not** silently self-correct, since the parse already ran under the wrong assumption and that poll's metrics are unusable: discard or flag the snapshot and raise a `role_mismatch` alert naming both values
  - Also decide whether the mismatch should block the write outright (a wrong role poisons every rule downstream) and whether `DeviceCategory` should be corrected by an operator action rather than by the collector
  - Related: the "Status & capability guards" item in Priority 1 is where a `DeviceEligibilityService` would own "is this device really pollable as the role it claims"

- [ ] **Wireless alert for a station missing from its AP's client list** — a CPE that should be associated is simply absent from the AP's station table

  - Today the only client-side signal is `ClientCountRule`: it fires on "more clients than provisioned" and on a ≥50% sudden drop (`clients_sudden_drop`). Both are aggregate counts — losing one station out of twenty trips neither, so a single customer can be disassociated for hours with no wireless alert at all. ICMP only catches it if that CPE is itself a monitored, pingable device
  - The data is already collected: `WirelessSnapshot.clientsJson` stores the full roster as `WirelessClientEntry[]` with a `macAddress` per entry, and `Device.macAddress` is a unique column — so matching an expected station to a roster entry is a MAC comparison, no new collection work
  - New rule (e.g. `MissingClientRule`) in `src/domain/wireless-monitoring/services/rules/`: metric `client_missing`, one alert per absent station keyed by MAC so the alerts do not collapse into one, OPEN when the station is gone from N consecutive polls, CLEAR when it reappears (hysteresis as in every other rule — a single missed poll must not page)
  - **The open question is where the expected roster comes from.** Two options:
    1. Explicit — an AP→station parent link on `Device`, which is the "Network topology" item in this same section. Correct and auditable, but blocked on that item
    2. Inferred — treat a MAC seen in the AP's last K snapshots as expected, and alert when it vanishes. Needs no schema change and can ship first, but cannot distinguish "customer cancelled / device retired" from "link down", so it needs a suppression path (skip stations whose matching `Device` is `DAMAGED`, soft-deleted, or has monitoring off)
  - Prefer inferred first, then swap the roster source for the topology link when that lands — the rule itself does not change, only how it gets its expected list
  - Interacts with "Notification severity tiers by device type": when the AP itself is down every station goes missing at once, so this rule must be suppressed wholesale rather than firing one alert per customer

- [ ] **High-latency alerting** — fire an alert when a device's ICMP round-trip time exceeds a configurable threshold

  - New alert type: `HIGH_LATENCY`; threshold stored per-device or as a global default (e.g. 150 ms)
  - `PingAlertService` checks `latencyMs` after each successful poll; opens alert when threshold breached, auto-resolves when latency returns below threshold (with hysteresis to avoid flapping)
  - Reuse the existing alert-open / alert-resolve flow used by the device-down path
  - Prerequisite: a device must be `ACTIVE` and have a valid ping result (not a timeout) for the check to apply

- [ ] **Advanced ping metrics** — enrich `PingResult` with `jitter`, `packetLoss`, `minLatencyMs`, `maxLatencyMs`, `ttl`, `packetsSent`, `packetsReceived`

  - Prerequisite: revisit `pingCount` decision — these only pay off with `pingCount > 1`
  - Unlocks: latency-trend graphs, packet-loss alerting, SLA reports

- [ ] **DeviceInterface entity** — child entities per device for per-interface traffic metrics

  - Fields: `name`, `snmpIndex` (ifIndex), `isMonitored`, `type` (ethernet, wireless, bridge, VLAN, loopback…)
  - SNMP polls `ifHCInOctets.{snmpIndex}` / `ifHCOutOctets.{snmpIndex}` for throughput; also errors/drops
  - `isMonitored = false` lets operators exclude loopback or management VLANs from polling
  - Prerequisite for per-interface SNMP metrics below

- [ ] **SNMP system metrics** — poll CPU, memory, disk, temperature, interface counters from managed devices

  - Extends wireless SNMP infra; targets any device exposing standard MIBs
  - New time-series model (or extend `PingResult`): `cpuUsage`, `memoryUsage`, `diskUsage`, `temperature`, `uptime`, `interfaceStats`, `bandwidthStats`, `errorCounters`
  - Requires `DeviceCredentials` to exist for the device
  - Requires `DeviceInterface` entities with `snmpIndex` for per-interface counters

- [ ] **Throughput cap alerting** — alert when a device is consuming more bandwidth than its provisioned link capacity

  - Source throughput from Mikrotik (RouterOS API) for all managed devices, not just wireless
  - Compare `throughputTxBps + throughputRxBps` against a per-device `linkCapacityBps` limit stored on the device (Device Inventory BC, not Wireless Monitoring)
  - Prerequisite: multi-vendor polling (Mikrotik collector); `linkCapacityBps` belongs on the Device aggregate or a `DeviceLink` entity, not on `WirelessDeviceConfig`
  - When built, migrate the existing wireless channel-utilization alert (`linkCapacityBps` on `WirelessDeviceConfig`) into this module so all throughput cap logic lives in one place

- [ ] **Link model** — represent RF links between two radios

  - Fields: `name`, `description`, `rxThroughput`, `txThroughput`, `rxSignalStrength`, `txSignalStrength`, `latency`, `distance`, source device, destination device
  - Prerequisite: confirm Device-to-Device is enough (no separate AccessPoint/RadioAntenna entity needed)
  - Unlocks: link-health dashboard, link-level alerting

- [ ] **Notification severity tiers by device type** — emit higher-severity alerts for infrastructure devices to reduce noise from downstream disconnections

  - When an AP goes down every station under it appears offline; suppress those station-level notifications and escalate the AP alert instead
  - Severity map (highest → lowest): Provider link down → Backhaul down → PoE switch down → AP/Antenna down → Station/client disconnected
  - `NotificationSeverity` enum: `CRITICAL` (backhaul / provider), `HIGH` (AP / antenna), `MEDIUM` (PoE switch), `LOW` (station / client)
  - `DeviceWentOfflineNotificationHandler`: resolve severity from device role/type before dispatching; downstream station alerts are demoted or suppressed when the parent AP alert is already active
  - Prerequisite: device activation workflow; network topology (to know which stations belong to which AP)

- [ ] **Network topology & notification suppression** — prevent alert storms when an upstream device fails
  - Topology is a strict parent-pointer tree: `Provider → RouterBoard → Backhaul → Distribution Switch → Hex PoE → Antenna → Clients/Nodes`
  - `NetworkTopology` aggregate in `domain/device-inventory`; stores edges as `Map<DeviceId, DeviceId>` (child → upstream parent)
  - `TopologyRootCauseService` domain service: given an offline device, walk up the cascade chain (AP → PoE switch → backhaul → provider) and return the topmost offline ancestor
  - Suppression rule: if any ancestor in the chain is already offline → suppress notification for the descendant; otherwise the device is the root cause → notify
  - Cascade check order per `DeviceWentOfflineNotificationHandler`: (1) is the AP offline? (2) is the PoE switch offline? (3) is the backhaul offline? (4) is the provider link down? — first match wins as root cause
  - Suppression cascades naturally: one upstream failure silences all descendants in a single hop check per device
  - RouterBoard is the topology root (ISPs / provider links are upstream of it but modelled as provider-type devices, not managed infrastructure)
  - Prerequisite: device activation workflow (only `ACTIVE` devices participate in topology); notification severity tiers (above)

---

## Priority 4 — Asset & Inventory

- [ ] **Firmware / software tracking** — `DeviceSoftware` model or flatten into Device

  - Fields: `version`, `releaseDate`, `lastUpdateDate`, `backupLink`
  - `WirelessSnapshot.firmwareVersion` already collects a raw string — decide whether to promote it to Device or keep snapshot-only

- [ ] **OS / firmware catalog** — replace free-text `firmwareVersion` with a structured OS record

  - `OperatingSystem`: `name` (enum — RouterOS, AirOS, MimosaOS, FortiOS …), `version`, `releaseDate`, `eolDate`, `releaseNotesUrl`
  - Enables EOL alerting; enum is safer than free-text for alerting rules

- [ ] **Device management protocol config** — protocols as M:N (not a single column)

  - `ModelProtocol`: what the hardware model supports out of the box (e.g., hAP ac² → SNMP, SSH, Winbox, HTTP, HTTPS, RouterOS API)
  - `DeviceProtocol`: what's actually enabled on a specific device, with optional port overrides
  - Auto-populate `DeviceProtocol` from model's `ModelProtocol` on device creation; operator disables/overrides as needed
  - Distinct from `DeviceCredentials` (secrets); this is the _how-to-connect_ metadata
  - Needed for future collectors that auto-select protocol

- [ ] **Device energy / power tracking** — `DeviceEnergy` (1:1 with Device)

  - Fields: `sourceType` (SOLAR, BATTERY, MAINS, GENERATOR, POE, OTHER), `backupEnergySource`, `powerConsumptionWatts`, `voltageV`, `currentA`
  - Relevant for tower/rooftop sites on solar or battery

- [ ] **Maintenance log module** — _partly superseded by the Tickets context (2026-08-04)_

  - `Technician` now lives in `domain/tickets` with `fullName` / `phone` / `email` and an optional `userId` link — do **not** add a second one here
  - Still outstanding: `DeviceMaintenanceLog` (`deviceId`, `technicianId`, `date`, `type`, `description`), types PREVENTIVE / CORRECTIVE / PREDICTIVE / EMERGENCY
  - Open question: a resolved ticket already records who did what and when, so the log may be a projection over `tickets` rather than a table of its own
  - Bounded context: Device Inventory

- [ ] **Procurement module** — link hardware purchases to devices
  - Models: `Supplier` (`name`, `contactInfo`, `location`) and `PurchaseOrder` (`orderNumber`, `date`, `totalPrice`, `observations`, `supplierId`, devices relation)
  - Bounded context: new `procurement` context or extend Device Inventory if scope stays small

---

## Priority 5 — Housekeeping

- [ ] **Automatic backup module** — scheduled config backups for access points and routers

- [ ] **Normalize timestamps** — use NTP for consistent log timestamps across devices

- [ ] **Business rules catalogue — remaining contexts + CI** — finish `docs/business-rules/`

  - Device Inventory is done: `DEV-001`–`DEV-146` (72 rules), every rule tagged in unit + integration tests, `npm run test:rules DEV` reports 72/72
  - Remaining nine contexts, each its own file and ID prefix: `CUS` (customers), `BIL` (billing), `MON` (device-monitoring), `WLS` (wireless-monitoring), `SVC` (service-enforcement), `NOT` (notifications), `IDN` (identity), `TKT` (tickets), `SHR` (shared kernel). Declared but not yet tagged in test names, so `npm run test:rules <prefix>` reports every rule in them as uncovered — that is drift in the tagging, not a real gap; see the README's Adoption checklist
  - `WLS` is the big one — the 14 rule files in `src/domain/wireless-monitoring/services/rules/` are all Policy with hardcoded thresholds and hysteresis bands; overlaps with the "Define which alerts actually notify" item in Priority 3, and writing the rules down first would make that decision concrete
  - ~20 rationales in `device-inventory.md` are marked `_(inferred)_` — reconstructed from code, not stated by the business. Worth a pass to confirm or correct; a wrong "why" justifies the wrong future change

- [ ] **Wire remaining `test:rules:<prefix>` contexts into CI as they get tagged** — `rules-dev` (see Done) only runs `test:rules:dev`; `CUS`, `BIL`, `MON`, `WLS`, `SVC`, `NOT`, `IDN`, `TKT`, `SHR` have npm commands (`test:rules:cus`, …) but aren't called from `.github/workflows/ci.yml` yet, because none of them are `[ID]`-tagged in test names. Add one `- run: npm run test:rules:<prefix>` line to the `rules-dev` job (rename it once it's not DEV-only) per context, in the same PR that finishes tagging it — not before, or the job goes red for a context nobody has reviewed yet

- [ ] **Guard against rule-book drift** — the DeviceType / LocationType / DeviceCategory refactors each silently invalidated a written rule before anyone noticed

  - The coverage script will **not** catch this — it checks that a test cites a rule, never that the rule still describes the code. `DEV-024`, `DEV-043` and `DEV-091` all sat wrong for a while: the first two described a set the code had replaced, the third pointed at a deleted file
  - Line references (`Foo.ts:47`) rot fastest and are the least useful part to hand-maintain. Worth deciding whether they earn their keep, or whether anchoring on a symbol name is enough
  - Cheapest real check: assert that each set a rule enumerates matches the value object's exported list, so a recast fails a test instead of quietly ageing the prose

- [ ] **Make the rule book navigable** — `device-inventory.md` is 1,677 lines of 72 rules read top-to-bottom; there is no index and no way to get from a rule to the ones it depends on

  - Feasible in plain Markdown, checked 2026-08-03: an index table at the top (ID · rule · Type · Layer · Status, each ID linking to its section — GitHub's ☰ outline gives a heading list but can't carry columns); `Related:` cross-links between rules; `<details>` folds for the noisy fields; `> [!WARNING]` callouts for the gaps and `Status: Removed` entries
  - Anchors: heading-slug links (`#dev-003--vendor-slugs-are-unique`) work in every renderer but break on retitling; explicit `<a id="DEV-003"></a>` survives retitling but relies on GitHub rewriting the id to `user-content-*` and shimming the scroll — a renderer behaviour, not a Markdown guarantee
  - Not possible in Markdown at all: filtering by Type or Layer, sortable tables, search-as-you-type, auto-generated backlinks. Every table stays hand-maintained and rots silently. Those want a generated doc (rules as YAML, `.md` as build artefact) or a static site (MkDocs Material) — both were left undecided
  - `<details>` caveat worth weighing before committing: browser Ctrl+F does not find text inside a collapsed block, and wrapping 72 rules in HTML adds noise to every future diff. Folding only the `Tests:` lists and `Enforced at:`/`Reached from:` block avoids both
  - Overlaps the drift item above — the highest-value half of this is a checker that parses the doc and fails when an `Enforced at:` or `Tests:` path no longer exists, which is what makes the doc JSDoc-like in the way that matters

- [ ] **Two route suites never authenticate, and one route file has no suite at all** — found while verifying the known-gaps work on 2026-08-01

  - `tests/integration/device.routes.test.ts` and `location.routes.test.ts` send no `Authorization` header, so all 29 assertions in them get `401` instead of the status they expect. They predate `createAuthenticateMiddleware` covering `/api`; every other route suite already uses `seedAndGetToken` from `tests/integration/helpers/auth.ts`. Mechanical fix, but 29 tests have been reporting nothing since auth landed
  - `credentials.routes.ts` has no integration suite, against the "one per route file, always" rule in `docs/rules/TESTING-INTEGRATION-STANDARD.md`. It is now also the only route file with a permission of its own (DEV-144), so the `403`-for-OPERATOR case has no HTTP-level test — only the middleware unit test
  - Same shape as the `bill.routes` suite already tracked in the billing notes: a suite that exists is assumed to be covering something

- [ ] **Rate limiter — make limits configurable and the store shared** — the two things the 2026-08-01 fix deliberately left alone

  - Limits are module-level literals in `src/presentation/http/middleware/rateLimiter.ts`. Tuning one means editing and redeploying; dev and prod want different numbers (a developer clicking through a seeded list is not an attacker)
  - The store is `express-rate-limit`'s default in-memory one, so counters are per-process and reset on restart. With more than one instance behind a load balancer the effective limit is `max × instances`, and it silently varies with how the balancer spreads requests — a Redis store fixes both; `docs/rules/PRESENTATION-MIDDLEWARE-STANDARD.md` already sketches one
  - Prerequisite for anything that trusts `req.ip` for unauthenticated routes: Express `trust proxy` is not set anywhere, so behind a reverse proxy every request keys to the proxy's address. Only matters for the IP fallback path (login is not rate-limited today), but it is a footgun waiting for whoever adds a public endpoint

- [ ] **OpenAPI spec + typed frontend client** — replace the hand-maintained `docs/BACKEND_API.md` with a generated contract
  - Generate `openapi.json` from Express controllers using `tsoa` or `zod-to-openapi`
  - Frontend consumes it via `openapi-typescript` to get fully typed fetch calls with zero manual sync
  - `BACKEND_API.md` becomes a generated artefact (or is retired entirely)
  - Alternative if repos are ever consolidated into a monorepo: migrate to tRPC (router type IS the contract, no codegen step)

---

## Decisions Made

- **pingCount (multiple pings per poll cycle):** Skipped for now. The existing `failuresBeforeDown` retry loop already covers "confirm device is truly down". Add `pingCount` only when latency-based alert rules exist that need averaged data.

---

## Done

- [x] CI pipeline — `.github/workflows/ci.yml` (2026-08-11)

  - Six independent jobs on every PR/push to `main`/`develop`, each its own GitHub status check rather than one bundled pass/fail: `lint`, `typecheck` (new `npm run typecheck` → `tsc --noEmit`), `unit` (`npm test`), `rules-dev` (`npm run test:rules:dev`), `integration-usecases`, `integration-routes`
  - **Integration split.** `npm run test:integration` used to run the whole `tests/integration/` tree — use-case suites and route suites — as one command with one pass/fail. Split into `test:integration:usecases` (`--testPathPattern="tests/integration/use-cases/"`) and `test:integration:routes` (`--testPathPattern="\.routes\.test\.ts$"`), verified partition-complete against `jest --listTests` (53 + 17 = 70, no file matches neither). `test:integration` still exists unsplit for a full local run
  - Both integration jobs bring up a `postgres:16` service container and run `prisma migrate deploy` before the tests — CI has no persistent test DB, so the schema is applied fresh every run. `DATABASE_URL` is set directly as a job env var (not `.env.test`, which holds a local dev username/password) — `tests/integration/setup.ts`'s `dotenv.config()` never overwrites an already-set `DATABASE_URL`, so this takes precedence safely
  - **Rule coverage split per bounded context, not one repo-wide gate.** Added `test:rules:<prefix>` npm commands for all ten contexts (`dev`, `cus`, `bil`, `mon`, `wls`, `svc`, `not`, `idn`, `tkt`, `shr`) alongside the existing prefix-filtered `scripts/check-rule-coverage.mjs`. CI's `rules-dev` job only calls `test:rules:dev` (75/75) — the other nine contexts have commands available locally but nothing wired into CI yet, since none of them are `[ID]`-tagged in test names. See the Priority 5 item for adding them one context at a time as each gets tagged
  - **Frontend E2E is out of scope for this workflow.** It lives in a separate repo and needs its own pipeline; nothing here runs it
  - Known gap surfaced, not fixed here: `npm run lint` currently fails (26 errors) against the working tree's in-progress changes — pre-existing, unrelated to the CI setup itself, left for whoever lands that work
  - No `engines` field existed to pin a Node version; workflow hardcodes Node 20 in `env.NODE_VERSION`

- [x] Make the backend run (2026-04-06)
- [x] Model manufacturers — `Vendor` aggregate + full CRUD under `/api/vendors` (2026-05-07)
- [x] Authentication & authorization module — `identity` BC, JWT, `ROLE_PERMISSIONS`, rate limiting, audit log, Helmet/CORS, bcrypt (2026-06-08)
- [x] Network map view (backend) — `GET /api/locations/map` returns `MapPinDTO[]`; frontend rendering tracked in the frontend repo (2026-06-10)
- [x] Update README.md (2026-07-06)
- [x] SNMP credentials are no longer required — HTTP-only is the normal path (2026-07-27)
  - Verified nothing reads them: `snmpCommunity` / `snmpV3AuthUser` appear only in storage and validation plumbing (`SetDeviceCredentialsUseCase`, `DeviceCredentialsMapper`, `PrismaDeviceCredentialsRepository`, the DTOs) — no collector consumes them; all polling is ICMP ping plus AirOS HTTP
  - `SetDeviceCredentialsUseCase.beforeExecute` relaxed: `httpUsername` + `httpPassword` are the required pair; SNMP validation runs only when the request actually carries an SNMP field, and `snmpVersion` is required as soon as one is sent
  - Schema columns and the encryption path untouched. `extractCreateData` carries stored SNMP values forward when a request omits them (only an explicit `null` clears one), so an HTTP-only save cannot wipe keys that would be tedious to re-enter
  - Hiding the SNMP section in the credentials form is frontend-only work — tracked in the frontend repo's `TODOS.md`, to be re-enabled when "SNMP system metrics" (Priority 3) lands
- [x] Tickets module — field work orders (2026-08-04)
  - New `tickets` bounded context: `Ticket` aggregate owning the `OPEN → ASSIGNED → IN_PROGRESS → RESOLVED` machine (with `CANCELLED` reachable from any non-terminal state), plus a `Technician` aggregate with an optional `userId` link to `identity`
  - **`GET /api/tickets/my-day?technicianId=&date=`** is the headline: a technician's tasks for a day, ordered most-urgent-first, each carrying the customer's name and phone, the suspected failure, the related device, and an address snapshot
  - Address is snapshotted onto the ticket — there is still no customer address anywhere else, and a closed ticket must keep the address it was worked at. Revisit when the planned `ServiceInstallation` context lands
  - Auto-opens tickets from alerts: `OpenAlertUseCase` calls the `ITicketOpener` port after recording a new alert, which covers both the ICMP device-down and the wireless pipelines because wireless alerts already funnel through `IAlertRecorder`. `Alert` raises no domain events, so this is the only available seam
  - Deduped twice: one live ticket per alert id, and one per device — a device breaching five metrics is one site visit, not five jobs
  - `UserRole` and `Permission` untouched. **Known gap:** `authorize()` has no resource-ownership check, so `/my-day` is a dispatcher view keyed by an explicit `technicianId`; `Technician.userId` is the seam for closing this
  - Rule book at `docs/business-rules/tickets.md` — `TKT-001` … `TKT-114`, 39 rules, 100% test-cited
- [x] Business rules catalogue — Device Inventory (2026-07-28)

  - `docs/business-rules/` — one file per bounded context, permanent `<CTX>-<NNN>` IDs, each rule tagged Invariant / Validation / Policy with its rationale, enforcement site, failure message and call paths
  - `device-inventory.md` — 63 rules (`DEV-001`–`DEV-143`) covering Vendor, DeviceModel, Device, Location, Credentials, and cross-cutting access/listing/discovery
  - Rule IDs in every device-inventory test name, unit and integration (`it('[DEV-054] …')`), so `npx jest -t "DEV-054"` selects one rule's tests
  - `npm run test:rules` — cross-checks the rule book against the suite; fails on a rule with no test **and** on a test citing an ID no rule declares. Device Inventory is at 63/63
  - The check found four rules nothing verified: `DEV-025`, `DEV-028`, `DEV-062` (an invariant), `DEV-129` (secrets in logs). Tests written for all four
  - The loose bullet list that used to sit at the bottom of this file is superseded by `device-inventory.md`, which carries the same rules plus rationale, IDs and enforcement anchors

- [x] Device-inventory known gaps closed — G-5 through G-12 (2026-08-01)

  - **G-8 / G-9** — the two "raw Prisma error where a sentence belongs" cases. `CreateVendorUseCase` / `UpdateVendorUseCase` now check `Vendor.name` against the `@unique` the schema always had (DEV-007, new `findByName` + `existsByName` on `IVendorRepository`); `CreateDeviceUseCase` takes `IDeviceModelRepository` and verifies the model exists before anything else, matching what the correction path already did (DEV-066)
  - **G-6** — credential writes moved off the generic `update` permission onto a dedicated `manage-credentials`, ADMIN only (DEV-144). **This is the one judgment call in the batch**: OPERATORs can no longer set device passwords. If they should, granting it is one line in `ROLE_PERMISSIONS`
  - **G-7** — filtered device listings paginate in SQL. `findByFilters` now receives `limit`/`offset` and a new `countByFilters` supplies the true total; both build their `where` from one private helper so page and count cannot drift (DEV-145)
  - **G-5** — `installedDate` is checked against ISO 8601 for real, calendar included (`2024-02-31` no longer becomes 2 March). New `parseIso8601Date` helper in `application/shared/utils`, used by both device use cases (DEV-050 revised)
  - **G-12** — every repository that branched on `errorMessage.includes('P2002')` now calls `isUniqueViolation(error)`. The `P2003` and `P2025` branches sitting beside them were broken identically and never fired either, so `isForeignKeyViolation` / `isRecordNotFound` were added and wired the same way. Nine repositories, plus their unit tests, which had encoded the bug by putting the code in the mocked error's _message_
  - **G-13** stays open on purpose — it is a documented non-rule, not a defect. See its entry in `docs/business-rules/device-inventory.md`
  - Rule book: `DEV-001`–`DEV-146`, 72 rules, `npm run test:rules DEV` reports 72/72

- [x] Deleting more than ten objects in a row no longer 429s (2026-08-01)
  - Not a batch-size cap — the `delete` rate limiter in `src/presentation/http/middleware/rateLimiter.ts` allowed 10 requests/minute, so the 11th deletion returned `429 Too many requests`. Raised to 60/min; `write` raised 20 → 60 for the same reason (bulk edits hit it one click at a time)
  - Requests now key on the authenticated `userId`, falling back to `ipKeyGenerator(req.ip)`. Before, every operator behind one office NAT drew from a single shared budget. Safe because `createAuthenticateMiddleware` runs ahead of every rate-limited route (`src/presentation/http/routes/index.ts:51`)
  - `max` → `limit` (the v7+ option name; `max` is deprecated in express-rate-limit 8)
  - `read` (100/min) and `bulk-import` (5/hour) unchanged. Covered by `tests/presentation/http/middleware/rateLimiter.test.ts`
  - Follow-ups deliberately not done here — see "Rate limiter — make limits configurable and the store shared" in Priority 5

> **Business rules live in [`docs/business-rules/`](business-rules/README.md), not here.**
> Any code change touching an invariant, validation or policy updates the matching
> entry in the same change — see the standing rule in that README.
