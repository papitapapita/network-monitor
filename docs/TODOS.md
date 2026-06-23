# TODOs

## Priority 1 — Foundation
_These block or constrain everything else. Do in order._

- [ ] **Authentication & authorization module**
  - New bounded context (`identity` or `auth`): login use case, JWT middleware, user/role persistence
  - JWT: HS256, 24h expiry, payload `{ userId, email, role }`, secret from `JWT_SECRET` env var
  - Middleware stack order (per route): audit log → `authenticate` → `authorize` → rate limit → validate → controller
  - `authenticate.ts` — extract Bearer token, `jwt.verify`, attach `req.user`
  - `authorize.ts` — `ROLE_PERMISSIONS` map + `Permission` type; check all required permissions
  - Roles: Admin (full), Operator (create/read/update/activate/bulk-import), Viewer (read-only)
  - Rate limiting (token bucket): read 100/min, write 20/min, delete 10/min, bulk-import 5/hr
  - `auditLog.ts` middleware — log `userId`, `role`, `action`, `ip`, `statusCode`, `duration` via Winston
  - Helmet + CORS (`ALLOWED_ORIGINS` env var) wired on app startup
  - bcrypt (cost 10) for password hashing at persistence layer

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

- [ ] **Clear wireless device alerts** — allow operators to manually clear (acknowledge) active wireless alerts
  - New use case: `ClearWirelessAlertUseCase` — finds alert by ID, calls `WirelessAlertRecord.clear(now)`
  - Endpoint: `DELETE /wireless/:deviceId/alerts/:alertId` or `POST /wireless/:deviceId/alerts/:alertId/clear`
  - Guards: alert must belong to the device; only active alerts can be cleared

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
  - Prerequisite: subscriber/customer bounded context

- [x] **Network map view (backend)** — `GET /api/locations/map` returns all geolocated locations as `MapPinDTO[]` with nested devices
  - Backend complete: `GetMapLocationsUseCase`, `findAllWithCoordinates`, `findByLocationIds`
  - Frontend still needed: render pins on map, `LocationType` drives icon, click opens device list
  - Future: when `ServiceInstallation` BC exists, map queries both sources and merges into the same `MapPinDTO` shape; frontend rendering is unchanged

- [ ] **Device categories** — allow creating and assigning categories (e.g. "STA Mimosa Cocuy")

- [ ] **Model manufacturers** — allow creating vendor/manufacturer records

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

- [ ] **Wireless alert notification tracking** — add `notifiedAt` and `recoveryNotifiedAt` to `WirelessAlertRecord`
  - `AlertEvent` already has these fields; `WirelessAlertRecord` does not
  - Prerequisite: decide whether wireless alerts share the same notification pipeline as ping alerts

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

- [ ] **Update README.md**

---

## Decisions Made

- **pingCount (multiple pings per poll cycle):** Skipped for now. The existing `failuresBeforeDown` retry loop already covers "confirm device is truly down". Add `pingCount` only when latency-based alert rules exist that need averaged data.

---

## Done

- [x] Make the backend run (2026-04-06)
- [x] Frontend sorting for IP addresses
