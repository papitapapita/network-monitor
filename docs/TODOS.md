# TODOs

## Priority 1 — Foundation
_These block or constrain everything else. Do in order._

- [ ] **Device activation workflow** — full lifecycle + soft-delete + replacement
  - COMMISSIONING status implemented: INVENTORY → COMMISSIONING (IP required, monitoring auto-on) → ACTIVE (IP + location required)
  - Soft-delete: `deletedAt` / `deletedBy` + 7-day grace period before hard removal
  - Replacement: `replacedByDeviceId` + `replacedAt` to track hardware swaps
  - Emit `DeviceDeletedEvent` on soft-delete so the polling and notification pipelines can react (no such event exists yet)
  - Scope: schema migration + domain invariant (monitoring only runs on `ACTIVE` and `COMMISSIONING` devices)

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

- [ ] **Stop asking for SNMP credentials** — nothing reads them, so the form is asking operators for secrets the system never uses
  - Verified: `snmpCommunity` / `snmpV3AuthUser` appear only in storage and validation plumbing (`SetDeviceCredentialsUseCase`, `DeviceCredentialsMapper`, `PrismaDeviceCredentialsRepository`, the DTOs) — **no collector consumes them**; all polling today is ICMP ping plus AirOS HTTP
  - Hide the SNMP section in the frontend credentials form; make HTTP username + password the only required pair
  - Backend: relax `SetDeviceCredentialsUseCase.beforeExecute` so HTTP-only is the normal path, not one of two branches — the current error ("Provide either HTTP credentials or SNMP credentials") describes a choice that no longer exists
  - Keep the schema columns and the encryption path — this is hiding an unused input, not dropping the capability. Re-enable when "SNMP system metrics" (Priority 3) lands
  - Do not delete stored SNMP rows; they are encrypted and harmless, and re-entry would be tedious

- [ ] **HTTP credential port defaults to 443, not 80** — the frontend sends the wrong default
  - Backend is already correct: `DeviceCredentialsMapper.extractCreateData` does `httpPort: dto.httpPort ?? 443`
  - The frontend credentials form still defaults the field to 80, so an operator who leaves it alone stores 80 and AirOS collection fails against an HTTPS-only radio
  - Fix in the frontend form default; consider also making the backend reject 80 with a clear message, or at least log it, so a stale client cannot silently write a broken port
  - Check existing rows for `http_port = 80` and decide whether to migrate them to 443

- [ ] **Device categories** — allow creating and assigning categories (e.g. "STA Mimosa Cocuy")

- [ ] **Scan multiple network segments at once**

- [ ] **Multi-tenancy** — `tenant_id` FK on all tenant-specific entities (devices, locations, device models)
  - PostgreSQL RLS: `ALTER TABLE devices ENABLE ROW LEVEL SECURITY; CREATE POLICY tenant_isolation ON devices USING (tenant_id = current_setting('app.current_tenant_id')::uuid)`
  - Set tenant context per request: `await prisma.$executeRawUnsafe("SET LOCAL app.current_tenant_id = '${tenantId}'")`
  - `Protocol` stays a global reference table (shared across tenants, no `tenant_id`)
  - Prerequisite: auth module (tenant resolved from JWT)

---

## Priority 3 — Monitoring Enhancements

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
  - Distinct from `DeviceCredentials` (secrets); this is the *how-to-connect* metadata
  - Needed for future collectors that auto-select protocol

- [ ] **Device energy / power tracking** — `DeviceEnergy` (1:1 with Device)
  - Fields: `sourceType` (SOLAR, BATTERY, MAINS, GENERATOR, POE, OTHER), `backupEnergySource`, `powerConsumptionWatts`, `voltageV`, `currentA`
  - Relevant for tower/rooftop sites on solar or battery

- [ ] **Maintenance log module**
  - Models: `Technician` (`name`, `contactInfo`) and `DeviceMaintenanceLog` (`deviceId`, `technicianId`, `date`, `type`, `description`)
  - Types: PREVENTIVE, CORRECTIVE, PREDICTIVE, EMERGENCY
  - Bounded context: Device Inventory

- [ ] **Procurement module** — link hardware purchases to devices
  - Models: `Supplier` (`name`, `contactInfo`, `location`) and `PurchaseOrder` (`orderNumber`, `date`, `totalPrice`, `observations`, `supplierId`, devices relation)
  - Bounded context: new `procurement` context or extend Device Inventory if scope stays small

---

## Priority 5 — Housekeeping

- [ ] **Automatic backup module** — scheduled config backups for access points and routers

- [ ] **Normalize timestamps** — use NTP for consistent log timestamps across devices

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

- [x] Make the backend run (2026-04-06)
- [x] Frontend sorting for IP addresses
- [x] Model manufacturers — `Vendor` aggregate + full CRUD under `/api/vendors` (2026-05-07)
- [x] Authentication & authorization module — `identity` BC, JWT, `ROLE_PERMISSIONS`, rate limiting, audit log, Helmet/CORS, bcrypt (2026-06-08)
- [x] Network map view (backend) — `GET /api/locations/map` returns `MapPinDTO[]`; frontend rendering tracked in the frontend repo (2026-06-10)
- [x] Update README.md (2026-07-06)
