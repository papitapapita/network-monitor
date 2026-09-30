# ADR 0002 — On-Site Probe Agent

## Status

Accepted — 2026-09-28

## Context

The system is being offered to other ISPs as a monthly subscription. The first
customer is a pilot: monitoring only, medium size (~200–1000 subscribers),
equipment not yet inventoried, and a paid-but-discounted design-partner deal.

Today every probe runs **inside the backend process**:

```
PollingOrchestrator → ExecutePollingCycleUseCase → IPingService → PingService
WirelessPollingOrchestrator → PollWirelessDeviceUseCase → IWirelessCollector
```

That works only because the backend sits on Insetel's own network. A backend
on a VPS cannot reach a customer's private addresses (`10.x`, `192.168.x`).

Constraints that shaped the decision:

- **Cost.** The vendor's running cost must stay near zero for the pilot and
  one small VPS after it. The customer will not buy dedicated hardware (a
  ~US$150 Raspberry Pi kit was rejected).
- **The customer's machine is Windows.** Installation must be a normal
  `setup.exe` with almost nothing to configure — no Docker, no new OS.
- **Real latency.** Measurements must be taken from inside the customer's
  network, not from the VPS through a tunnel.
- **The vendor keeps control of billing.** The software is a service; the
  customer never receives the backend.

## Decision

Split monitoring into two processes: an **on-site agent that only measures**
and the **backend that decides**. The agent runs on the customer's Windows PC
(Linux supported from the same code) and talks to the backend over one
outbound WebSocket.

```
Customer's network                          Vendor server (one backend per customer)
┌─────────────────────────┐   outbound WSS  ┌──────────────────────────────────┐
│ Agent (Windows service) │────────────────▶│ Ingest use cases                 │
│  scheduler              │ results,        │  → DeviceState, history, alerts  │
│  PingService            │ heartbeats      │ Agent registry (heartbeat,       │
│  wireless collectors    │                 │  enrollment, revocation)         │
│  24 h disk buffer       │◀────────────────│ Config snapshots + commands      │
│  no DB, no domain logic │ config,         │                                  │
└─────────────────────────┘ commands        └──────────────────────────────────┘
```

### Responsibilities

| Concern                                    | Agent |     Backend      |
| ------------------------------------------ | :---: | :--------------: |
| Knowing which devices to poll, how often   |       | ✓ (sends config) |
| Scheduling and running probes              |   ✓   |                  |
| Intra-cycle retries (`failuresBeforeDown`) |   ✓   |                  |
| Buffering while disconnected               |   ✓   |                  |
| DeviceState transitions, `downSince`       |       |        ✓         |
| Alerts, quiet hours, mutes, delayed down   |       |        ✓         |
| History, retention, dashboards             |       |        ✓         |

The agent reports **one result per poll cycle** (reachable, latency, attempts
used, or "probe could not run"), so `DeviceState` semantics stay exactly as
they are. The existing distinction between an unreachable device and a probe
that failed to run (`handleProbeUnavailable`) carries over unchanged.

### Rules

These become permanent business-rule IDs in `docs/business-rules/` when
implemented.

**Enrollment and identity**

- **R1 — Pairing key.** An admin creates an agent in the dashboard and gets a
  single pasteable pairing key that bundles the backend's domain and a one-time
  code. The code expires after 24 hours and works once. It is the only thing
  the installer asks for.
- **R2 — Agent token.** Enrollment exchanges the pairing code for a long-lived
  random token. The backend stores only its hash. The agent stores it with the
  OS's protection (DPAPI on Windows, a `0600` file on Linux).
- **R3 — Revocation.** An admin can revoke an agent. The backend rejects its
  token and closes the connection; the agent holds nothing sensitive
  afterwards.
- **R4 — The backend derives identity from the token.** Messages never carry
  an agent or tenant id the backend trusts. This keeps the protocol unchanged
  when a shared multi-tenant backend arrives (token → agent → tenant).

**Liveness**

- **R5 — Heartbeat.** The agent sends a heartbeat every 30 seconds with its
  version and current clock.
- **R6 — Agent offline.** With no heartbeat for **5 minutes**, the agent is
  OFFLINE. One alert goes to the install's operational channel **and** to the
  vendor's own Telegram chat; one recovery message follows when it reconnects.
  The vendor chat receives only agent-health alerts (offline, back online,
  clock warning, update required) — never device alerts.
- **R7 — Offline means unknown, not down.** While an agent is OFFLINE, its
  devices display as UNKNOWN and **no device-level alert is raised or
  escalated** — including overdue delayed-down alerts. Stored `DeviceState` is
  not rewritten.

**Results**

- **R8 — Idempotent results.** Each result carries an agent-generated id. A
  result already stored is acknowledged and ignored.
- **R9 — Live vs. stale.** A result changes `DeviceState` only if it is newer
  than the device's `lastCheckedAt` **and** was measured (clock-corrected) at
  most **2 minutes** before it arrived. Anything older is saved as history
  only. The window is fixed, not tied to the poll interval: a live result is
  sent seconds after it is measured whatever the interval, so only buffered
  results are ever that old.
- **R10 — Replay after reconnect: history only, no past alerts.** Buffered
  results fill graphs and uptime. Device state and alerts come from live
  results only, so an outage that began and ended while the agent was offline
  is recorded but never alerted. A device still down now alerts through the
  normal live path.
- **R11 — Live first.** On reconnect the agent polls every assigned device
  immediately and sends those live results before the backlog, so state is
  current within seconds even for devices with long poll intervals.
- **R12 — Clock correction.** The backend computes each agent's clock offset
  from heartbeats and corrects `measuredAt`. An offset over 1 minute raises a
  warning telling the operator to fix the PC's clock.
- **R13 — 24-hour buffer.** The agent buffers up to 24 hours of results on
  disk while disconnected. Beyond that the oldest are dropped.

**Configuration and secrets**

- **R14 — Config snapshots.** On connect and on every relevant change, the
  backend sends a versioned snapshot: the agent's devices, intervals,
  `failuresBeforeDown` and credentials. The agent acknowledges the version it
  applied.
- **R15 — Credentials in memory only.** Device credentials stay encrypted in
  the backend database and reach the agent over TLS. The agent never writes
  them to disk or logs.

**Assignment**

- **R16 — Every monitored device belongs to exactly one agent.** The
  assignment is an `agentId` on `Device`, so ping and wireless polling can
  never disagree about which agent reaches a device. The model supports many
  agents per install (towers/POPs that one PC cannot reach). The pilot runs
  one; with a single agent, new devices are assigned to it automatically.

**Subscription**

- **R17 — Non-payment is read-only, never deletion.** After the grace period,
  the backend refuses agent results with a distinct close reason, alerts stop,
  and the dashboard shows history with an "expired subscription" notice. The
  agent idles and retries hourly. Paying again resumes everything; nothing is
  deleted. (How subscriptions are recorded is a separate decision.)
  *Revised 2026-09-29:* escalated in stages — grace (full service, daily
  reminders), then read-only (writes refused, every poller and background job
  stopped, no alerts), then locked (dashboard closed except sign-in and the
  subscription status). Still nothing is deleted. Rules `INS-020` …
  `INS-027`.

**Compatibility**

- **R18 — Versioned protocol.** The agent announces its protocol version on
  connect; the backend declares the minimum it accepts and rejects older agents
  with an "update required" reason shown on the agent and the dashboard.

### Placement in the architecture

- **Agent** — `src/agent/`, its own composition root (`src/agent/main.ts`). It
  reuses the probe adapters as they are (`PingService`, `AirOsHttpClient`,
  `UbiquitiHttpCollector`, `MimosaSnmpCollector`) and must not import Prisma,
  Express, the DI container, or any domain/application use case. A lint rule
  enforces that.
- **Protocol types** — `src/agent/protocol/`, imported by both the agent and
  the backend's WebSocket adapter. Plain types, no behavior.
- **New bounded context `probe-agents`** — the `Agent` aggregate (name, token
  hash, status, last seen, version, clock offset), enrollment, heartbeat,
  revocation, and the liveness orchestrator. `AgentWentOffline` /
  `AgentCameBack` events.
- **Ingest use cases stay with the context that owns the state** —
  `IngestPingResultsUseCase` in device-monitoring (the "decide" half of today's
  `ExecutePollingCycleUseCase`), wireless ingest in wireless-monitoring.
- **Device → agent assignment** — `Device.agentId: AgentId | null` in
  device-inventory, referencing the agent by identity only, the same way
  `Device.locationId` references a `Location`. `AgentId` lives in
  `domain/shared/ids/`, so device-inventory never imports `probe-agents`.
  Which agent can reach a device is a fact about where the device sits on the
  network, which inventory already owns (IP, location). Checking that the
  agent exists and is not revoked, and choosing the default agent, are
  application-layer steps through a port — not aggregate invariants. `null`
  means polled in-process, and exists only until Insetel finishes migrating.
- **R7 suppression** — device-monitoring and notifications read agent status
  through a read-only `IAgentStatusQuery` port, never by importing the
  `probe-agents` domain.
- **Agent-offline alert** goes through `IAlertPublisher` (ADR 0001). The
  envelope's `deviceId` is required today; it must become optional or
  generalize to a subject id. That change is part of phase 1.

### Packaging

- **Windows:** the agent is bundled into one `.exe` (Node single-executable
  application), run as a service by WinSW (starts at boot, restarts on crash,
  no logged-in user needed), and shipped as an Inno Setup `setup.exe`. The
  installer asks only for the pairing key, sets the power plan to never sleep,
  and adds a Defender exclusion.
- **Linux:** the same bundle with a systemd unit and an install script.
- **Ping** must not depend on the language of `ping.exe`'s output (Spanish
  Windows prints `Respuesta desde … tiempo=`). Either parse it
  language-independently or call the ICMP API directly; tested on a Spanish
  Windows before the pilot.

### Alert delivery for customers

Each customer install sends its operational alerts through Telegram, as
Insetel's does today: one product-branded bot (not Insetel's) shared by all
customer installs, with each install configured with its customer's chat id.
The vendor chat for R6 is a separate chat id on the same bot.
*Revised 2026-09-30:* the vendor chat may use its own bot
(`TELEGRAM_VENDOR_BOT_TOKEN`, falling back to the install's bot). Insetel's
install keeps its own bot for its network's alerts and reaches the vendor
chat through the product bot, which is never added to Insetel's group.

A future customer app with in-app notifications is another delivery adapter
behind the path ADR 0001 established (`IAlertPublisher` →
`SendAlertNotificationUseCase` → `INotificationService`). It is out of scope
here and needs no change to the agent.

### Traffic and storage

Only agent messages cross the internet; the backend and its database always
run on the same machine, so database traffic stays on `localhost`. This is the
lesson from Neon: its free tier ran out within days because the backend on the
laptop sent every query of every poll cycle (the due-device scan every second,
~8 round trips per ping) over the internet to a remote database.

Estimated agent traffic for a ~250-device customer at the current defaults
(ping every 60 s, wireless every 3600 s):

| Traffic                  | Per month                                |
| ------------------------ | ---------------------------------------- |
| Ping results             | ~2 GB as naive JSON; ~0.2–0.5 GB compact |
| Heartbeats               | ~40 MB                                   |
| Wireless reads (phase 3) | ~0.3–0.4 GB                              |
| Config and commands      | negligible                               |

Negligible for an ISP's uplink and far inside any VPS transfer allowance. The
agent keeps it at the low end:

- **R19 — Compact messages.** Results are sent in batches every few seconds,
  not one message per probe; WebSocket compression (`permessage-deflate`) is
  on; results reference devices by a short numeric index assigned in the
  config snapshot (R14), not the 36-character UUID.

Disk, not bandwidth, is what grows: ~250 devices pinged every minute produce
~10.8 M `ping_results` rows a month. Measured on the dev database a row costs
~290 bytes with indexes (small sample); ~150 bytes is assumed at scale, so
~1.6 GB/month of pings plus ~0.4 GB/month of wireless snapshots (~2.8 KB each,
hourly) — **~2 GB/month per 250-device customer**. The existing
`DataRetentionOrchestrator` purges old rows; each install's retention period is
set from its disk size.

### Capacity of one VPS

Estimate for a 2 vCPU / 8 GB RAM / 100 GB NVMe / 8 TB VPS (Hostinger KVM 2
class), per 250-device customer:

| Resource  | Per customer                    | Fits                                                   |
| --------- | ------------------------------- | ------------------------------------------------------ |
| Disk      | ~2 GB/month                     | ~85 GB usable → ~14 at 90-day retention, ~40 at 30-day |
| RAM       | ~200–250 MB per backend process | 8 GB − ~3 GB (OS + one Postgres) → ~20                 |
| CPU       | ~4 results/s of ingest          | ~20, with headroom for dashboards and purges           |
| Bandwidth | ~0.5–3 GB/month                 | thousands — not a factor                               |

**~12–15 medium customers comfortably**; customers of 50–100 devices use about
half. The dev backend measured ~250 MB RSS under `tsx`. Rules for running
several installs on one host:

- **One Postgres server, one database per customer** — never one Postgres
  container per customer.
- **Cap each backend's pool** (Prisma `connection_limit=3`) so 20 backends stay
  under Postgres' default 100 connections.
- **Backups leave the VPS**; never stored on its disk.
- **Warn at 70% disk or RAM** and upgrade before a customer notices.
- Re-measure with real installs (`docker stats`, database size per customer)
  and replace these estimates.

Later levers, not planned work: downsampling pings older than 7 days to hourly
aggregates (~60× less disk), and the shared multi-tenant backend (one process
instead of one per customer, ~50+ customers on the same VPS).

### Hosting

One backend and database per customer. A shared multi-tenant backend is the
intended future (`docs/TODOS.md`); R4 and R16 keep the agent side ready for
it, so that move changes the backend only.

**Pilot: the vendor's laptop.** Production already runs there. Requirements:

- **Cloudflare Tunnel** (free) exposes the backend over HTTPS/WSS with no
  public IP or port forwarding, and avoids WSL2 port-forwarding.
- **A domain from day one** (e.g. `api.<product>.com`). The pairing key (R1)
  and the agent only know this name, never a machine address.
- **External uptime check** (UptimeRobot or Healthchecks.io, free) alerting
  the vendor's Telegram when the backend stops answering. If the backend is
  down, nothing else alerts: the agent keeps buffering (R13) but alerts stop.
- **UPS**, sleep disabled, Windows update restarts scheduled.
- **Disk encryption** (BitLocker): the laptop holds customer data (Ley 1581).
- **Backups off the laptop**, extending the existing nightly cron.
- A spare always-on PC at Insetel's NOC, on its UPS and static IP, is a better
  host than the personal laptop if one is available.

**After the pilot: a small VPS**, before full price or a second customer —
Hetzner CX22 (~€4–5/month) or Hostinger KVM 1 (~US$5–7/month). Not AWS EC2
(complex, egress billed) and not Oracle Always Free (idle-account reclamation
risk for a paying customer).

- **R20 — Moving hosts is a DNS change.** Because agents only know the domain,
  migrating the backend is: restore the database backup on the new host, start
  the backend, point the domain at it. Agents reconnect on their own, the
  buffer covers the gap, and customers reinstall nothing.

## Phases

Each numbered slice below is one commit (or a short series) that leaves every
suite green. A slice is done when it has: unit tests, the integration tests
`CLAUDE.md` requires (one per new use case, one per new route file), its rules
added to `docs/business-rules/` with permanent IDs, and `docs/BACKEND_API.md`
updated for any route change. Run only the suites the slice touches.

### Step 0 — Lock the design

- Mark this ADR **Accepted** and commit it on a new branch
  `feature/probe-agent` off `develop`.

### Phase 0 — Make one install safe for a monitoring-only customer

**0.1 Module switches.** One explicit setting (e.g.
`ENABLED_MODULES=monitoring`) that skips the routes, event handlers and
orchestrators of billing, quoting, customers, tickets and service enforcement.

- Today suspension enforcement is wired only when
  `ENFORCEMENT_ROUTER_DEVICE_ID` is set (`src/infrastructure/di/container.ts`,
  the enforcement block) and started with `?.start()` in `src/main.ts` —
  implicit and easy to enable by accident. The switch makes it explicit; with
  enforcement off it must not be wired at all, whatever the router variable
  says.
- **Start read-only:** map which contexts depend on which in `container.ts`,
  `src/main.ts` and `src/presentation/http/routes/index.ts`. Known example:
  wireless monitoring reads contracted capacity through
  `ContractedCapacityAdapter` (customers/billing data). Report the map and the
  proposal (what a disabled module's dependents receive instead) before
  changing code.
- Done when a monitoring-only install boots, serves monitoring routes, returns
  404 for disabled modules' routes, and runs no disabled orchestrator — covered
  by a route test.

**0.2 Per-install settings.** `Insetel` appears only in
`src/infrastructure/billing/config/collectionAccountIssuerConfig.ts`; move the
issuer to configuration. Alert chat ids are already per-install through `.env`
(`TELEGRAM_CHAT_ID`); add the vendor chat id used by R6.

**0.3 Non-code (vendor).** Product-branded Telegram bot (@BotFather), vendor
chat, domain on Cloudflare.

### Phase 1 — Ping agent (enough to start the pilot)

Updates are a manual reinstall in this phase.

**1.1 Split `ExecutePollingCycleUseCase` — behavior unchanged.** The riskiest
refactor, done first and alone, with no agent yet.

- "Measure": the attempt loop over `IPingService` bounded by
  `failuresBeforeDown`, producing one cycle result (reachable, latency,
  attempts, or probe-could-not-run).
- "Decide": new `IngestPingResultsUseCase` in `application/device-monitoring`
  applying that result — ping history, `DeviceState.applyPingResult`,
  `markPolled`, the probe-unavailable path (`applyPollFailure`), and the
  in-flight disable re-check.
- The in-process `PollingOrchestrator` calls both, so production behavior is
  identical. All existing device-monitoring tests stay green unmodified except
  where they construct the use case.

**1.2 Shared groundwork.** `AgentId` in `domain/shared/ids/`. Make `deviceId`
optional (or generalize to a subject id) in `AlertNotification`
(`application/shared/interfaces/IAlertPublisher.ts`), and make every publisher
decorator (`QuietHoursAlertPublisher`, `MutedTypeAlertPublisher`) handle an
alert with no device.

**1.3 `probe-agents` bounded context.** `Agent` aggregate (name, token hash,
status PENDING/ACTIVE/REVOKED, last seen, version, clock offset), repository,
Prisma model and migration (also `prisma migrate deploy` on the test DB), and
use cases: create agent + issue pairing key (R1), enroll (R2), revoke (R3),
list/get. Admin routes under `/api/agents`. New
`docs/business-rules/probe-agents.md`.

**1.4 `Device.agentId`.** `AgentId | null` on `Device` (see Placement), mapper
and migration. Creating a monitored device assigns the only active agent
automatically (application layer, through a port); with several agents the
caller chooses. Expose it in device DTOs and routes.

**1.5 Agent gateway.** WebSocket endpoint on the existing HTTP server, outside
`/api` (agents authenticate by token, not JWT — R4). Protocol types in
`src/agent/protocol/`. Messages: hello (version — R18), heartbeat (R5), config
snapshot and ack (R14, without credentials yet; includes the numeric device
index for R19), result batches and acks. A liveness orchestrator marks agents
OFFLINE after 5 minutes (R6), raising `AgentWentOffline` / `AgentCameBack`;
the alert goes through `IAlertPublisher` to the install chat and the vendor
chat. R7 via `IAgentStatusQuery`: devices of an offline agent show UNKNOWN and
no device alert is raised or escalated (including
`OverdueDeviceDownAlertOrchestrator`). R17 read-only refusal lives here.

**1.6 Ingest correctness.** In `IngestPingResultsUseCase`: result ids
idempotent (R8), live vs. stale by the fixed 2-minute window (R9), history-only
replay (R10), clock-offset correction and the >1-minute warning (R12). This is
where most integration tests go: duplicate batch, out-of-order batch, a
buffered outage that began and ended while offline (recorded, never alerted),
a device still down after reconnect (alerts once, through the live path).

**1.7 The agent app — `src/agent/`.** Own composition root
`src/agent/main.ts`; imports only the probe adapters and protocol types (add
the lint rule forbidding Prisma, Express, the DI container and
domain/application use cases). Pairing, token storage (DPAPI / `0600` file),
config sync, per-device scheduler with the intra-cycle retries, immediate full
poll on reconnect with live-first sending (R11), 24-hour disk buffer (R13),
batched compressed uploads (R19), reconnect with backoff. Ping must not depend
on `ping.exe`'s output language.

**1.8 Packaging.** Node single-executable build, WinSW service, Inno Setup
`setup.exe` asking only for the pairing key, setting the power plan to never
sleep and adding a Defender exclusion. Linux: systemd unit + install script.
Tested on a Spanish-language Windows.

**1.9 Insetel's own agent.** Insetel installs an agent as the first live site
and runs it alongside in-process polling until confidence is high; then the
pilot customer is installed.

### Phase 2 — Auto-update (before a second customer)

The agent downloads a new version, a helper stops the service, swaps the files,
restarts, and **rolls back** if no heartbeat arrives within a minute.

### Phase 3 — Wireless collection through the agent

AirOS and SNMP reads run on the agent with credentials delivered per R15;
wireless ingest in `application/wireless-monitoring`, same R8–R12 rules.

### Phase 4 — On-demand commands

Live link diagnosis, force-poll and the network scanner as commands over the
same connection, behind their existing ports (e.g. a remote
`ILinkDiagnosisRunner` adapter).

**Insetel's in-process path** stays until phase 4 so Insetel loses no feature;
it is then removed. There is no permanent second code path.

## Pilot rollout checklist

Not architecture, but recorded here so the pilot is launched as decided.

**The customer's network**

- Visit or call to inventory their equipment. Ping works with any brand;
  wireless metrics and link diagnosis only cover Ubiquiti AirOS (and Mimosa
  SNMP) until more collectors exist — their other brands guide the roadmap.
- Pick the always-on Windows PC for the agent; confirm it reaches every
  management IP and the internet.
- Test the agent's ping on that Spanish-language Windows before go-live.

**The commercial deal**

- Design-partner pilot: full price stated up front, charged at a discount
  (e.g. 50%) for a fixed period (e.g. 6 months), then full price. Something is
  charged from day one.
- Price in tiers by device count (e.g. up to 100 / 300 / 1000 devices).
- The pitch is what free tools (UISP, Zabbix, LibreNMS) do not offer: delayed
  down alerts, quiet hours, live link diagnosis, alerts in Spanish, support
  from someone who runs an ISP.
- One-page agreement: the vendor owns the software and every improvement,
  including those the customer suggests; the customer gets a service, not a
  copy; suspension after a grace period for non-payment (R17); downtime is
  possible during the pilot; their data is exported to them if they leave.
- Invoicing as a natural person (RUT): confirm with a contador whether DIAN
  electronic invoicing and IVA apply, since both affect the price.

## Consequences

**Positive**

- Latency is measured from inside the customer's network.
- The customer installs one `setup.exe`; no ports opened, no public IP, no
  tunnel.
- An internet cut or a PC turned off produces one "agent offline" alert
  instead of an alert for every device.
- No history gaps for outages under 24 hours.
- The domain layer does not change; probe adapters are reused.
- The protocol is already shaped for a shared multi-tenant backend.
- Running cost for the pilot is a domain (~US$10–15/year); later one small VPS.

**Negative / accepted trade-offs**

- Monitoring now depends on a PC the vendor does not control. A PC shut down
  every night means blind nights; R6 makes that visible but cannot prevent it.
- While hosted on the laptop, the vendor's power or internet failure silences
  the customer's alerts too; the external uptime check makes it visible.
- Distributed correctness (R8–R12) is new work with no equivalent today and
  needs thorough integration tests.
- On-demand features are unavailable for agent-backed installs until phase 4.
- The `.exe` is unsigned at first: Windows SmartScreen will warn on install,
  and antivirus may flag it. Code signing is deferred until there are several
  customers.
- `ExecutePollingCycleUseCase` is split; its behavior must be preserved
  exactly, especially the probe-unavailable path and the in-flight disable
  re-check.

## Alternatives considered

**Reaching the customer's network**

- **WireGuard tunnel from the customer's router to the VPS.** Cheapest to
  build. Rejected: latency is measured from the VPS and includes the tunnel,
  and a tunnel drop makes every device look down.
- **Backend-scheduled RPC** (the backend keeps the orchestrators and asks the
  agent to ping each device). Smallest change — swap the `IPingService`
  adapter. Rejected: no buffering, every probe depends on the connection, and
  latency includes the round trip.
- **Dedicated Raspberry Pi or mini PC.** Most reliable host. Rejected for the
  pilot on cost (~US$150 kit); the Linux build still allows it for customers
  who want it.
- **Docker on Windows.** Rejected: too much for a customer to install and
  keep running.

**Device → agent assignment**

- **`agentId` on each polling configuration.** Rejected: ping and wireless each
  have their own configuration, so the same fact would be stored twice and
  could diverge.
- **The `Agent` aggregate holds its list of device ids.** Rejected: an
  unbounded collection inside the aggregate, and every device create or delete
  in inventory would have to modify an aggregate in another context.

**Hosting**

- **A remote managed database (Neon) with the backend elsewhere.** Rejected:
  every query crosses the internet; exhausted the free tier within days.
- **AWS EC2.** Rejected for now: more setup, and outbound traffic is billed.
