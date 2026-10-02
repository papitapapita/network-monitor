# Probe Agents — Business Rules

An agent is the small program an ISP runs on a PC inside its own network. It
measures that network and reports to this backend, which a VPS could not reach
directly (ADR 0002). These rules cover how an agent gets its identity: an
administrator creates it, the installer pairs it with a one-time key, and an
administrator can revoke it.

The connection rules cover the agent's one WebSocket: how it authenticates,
what configuration it receives and how its results reach the devices. The
liveness rules cover when an agent counts as offline, when its clock is
wrong, and who is told. How a result is judged once it reaches a device —
duplicates, backlog, out-of-order — is device-monitoring's (`MON-007`,
`MON-008`).

The update rules cover how a new version of the agent is packaged, signed,
offered and installed without anyone visiting the PC (ADR 0002, phase 2).

The agent program rules cover the agent's own side (`src/agent/`): pairing,
polling, buffering while offline and reacting to what the backend tells it.
The agent is a separate program with its own composition root
(`src/agent/main.ts`); it reuses the backend's ping probe but never its
database, HTTP server, DI container or use cases, which ESLint and
`tests/agent/importBoundary.test.ts` both check. It keeps its files in one data
directory — `%ProgramData%\NmsAgent` on Windows, `/var/lib/nms-agent` on Linux,
or `NMS_AGENT_DATA_DIR`.

Format and conventions: [README.md](README.md).

## ID ranges

| Range                 | Area                    |
| --------------------- | ----------------------- |
| `AGT-001` … `AGT-019` | Enrollment and identity |
| `AGT-020` … `AGT-039` | Liveness                |
| `AGT-040` … `AGT-059` | Connection and protocol |
| `AGT-060` … `AGT-079` | The agent program       |
| `AGT-080` … `AGT-099` | Updates                 |

## Layer coverage

A rule enforced in two layers counts in both.

| Layer                        | Rules |
| ---------------------------- | ----- |
| Domain                       | 11    |
| Application                  | 19    |
| Infrastructure (composition) | 13    |
| Presentation                 | 10    |
| Agent program                | 14    |

---

## Enrollment and identity

An agent is `PENDING` from creation until it enrolls, `ACTIVE` once enrolled,
and `REVOKED` for good once an administrator revokes it. Whether an active
agent is currently connected is a separate question, answered by liveness.

### AGT-001 — A pairing key bundles the backend's address and a one-time code, and expires 24 hours after it is issued

**Type:** Invariant · **Status:** Active
**Layer:** Domain · Application
**Since:** 2026-09-28

Creating an agent returns a single pasteable pairing key,
`pk1.<base64url of the backend URL>.<code>`. The code is 256 random bits. The
key stops working 24 hours after it was issued, measured by the server's
clock; enrolling at or after the expiry fails.

**Why:** The installer asks for one thing only (ADR 0002, R1). A customer who
pastes a key must not also have to type a server address, and the vendor must
be able to move the backend without reissuing anything (R20), so the address
travels inside the key. The short lifetime bounds the damage of a key pasted
into the wrong chat.

**Enforced at:** `src/domain/probe-agents/aggregates/Agent.ts` (`PAIRING_KEY_TTL_MS`, `enroll`), `src/agent/protocol/pairingKey.ts`
**Reached from:** `POST /api/agents`, `POST /api/agents/:id/pairing-key`
**Tests:** `tests/domain/probe-agents/aggregates/Agent.test.ts`, `tests/agent/protocol/pairingKey.test.ts`, `tests/integration/use-cases/probe-agents/CreateAgentUseCase.integration.test.ts`

### AGT-002 — A pairing code works once, and only its hash is stored

**Type:** Invariant · **Status:** Active
**Layer:** Domain · Infrastructure
**Since:** 2026-09-28

The pairing key is returned in the response that creates it and never again.
The backend keeps a SHA-256 hash of the code. A successful enrollment clears
it, so the same key cannot enroll a second installation. When two
installations present the same code at the same moment, exactly one succeeds:
the enrollment is written only if the stored hash is still the one presented.

**Why:** A key that could be reused, or read back from the database, would let
anyone who saw it attach a second PC to the customer's account and receive its
device list. A plain hash is enough because the code is random and cannot be
guessed; it also lets enrollment find the agent in one indexed lookup.

**Enforced at:** `src/domain/probe-agents/aggregates/Agent.ts` (`enroll`), `src/infrastructure/probe-agents/repositories/PrismaAgentRepository.ts` (`saveEnrollment`)
**Tests:** `tests/domain/probe-agents/aggregates/Agent.test.ts`, `tests/integration/use-cases/probe-agents/EnrollAgentUseCase.integration.test.ts`

### AGT-003 — Enrollment exchanges the code for a long-lived token, and only its hash is stored

**Type:** Invariant · **Status:** Active
**Layer:** Domain · Application
**Since:** 2026-09-28

`POST /agent/v1/enroll` with a valid code turns the agent `ACTIVE` and returns
a 256-bit token once, with the agent's name. The backend keeps only the
token's SHA-256 hash; the agent stores the token itself under OS protection
(ADR 0002, R2). The token carries no agent or tenant id: the backend works out
which agent is talking from the token alone (R4).

**Why:** The token is the agent's only credential from then on. Keeping just a
hash means a leaked database backup does not let anyone impersonate an agent.

**Enforced at:** `src/domain/probe-agents/aggregates/Agent.ts` (`enroll`), `src/application/probe-agents/use-cases/EnrollAgentUseCase.ts`
**Reached from:** `POST /agent/v1/enroll`
**Tests:** `tests/application/probe-agents/use-cases/EnrollAgentUseCase.test.ts`, `tests/integration/use-cases/probe-agents/EnrollAgentUseCase.integration.test.ts`, `tests/integration/agent-enrollment.routes.test.ts`

### AGT-004 — Only a pending agent can be given a new pairing key, and the new key replaces the old one

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-09-28

A new key restarts the 24 hours and the previous code stops working at once.
An agent that has already enrolled, or has been revoked, is refused (`409`).

**Why:** Keys expire (`AGT-001`), and an installation that slipped a day must
not force the administrator to delete and recreate the agent. Re-pairing an
enrolled agent would silently hand its identity to another machine; replacing
a PC is done by revoking the old agent and creating a new one.

**Enforced at:** `src/domain/probe-agents/aggregates/Agent.ts` (`reissuePairingCode`)
**Reached from:** `POST /api/agents/:id/pairing-key`
**Tests:** `tests/domain/probe-agents/aggregates/Agent.test.ts`, `tests/integration/use-cases/probe-agents/ReissuePairingKeyUseCase.integration.test.ts`

### AGT-005 — Revocation is final and leaves the agent holding nothing

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-09-28

Revoking clears the token hash and any pairing code, so neither can be used
again. A revoked agent cannot be re-enrolled or revoked a second time (`409`).
The agent's record is kept, not deleted.

A connected agent is cut off within a minute of being revoked: the gateway
re-checks every session's agent on each configuration refresh and closes a
revoked one with code `4001`.

**Why:** ADR 0002, R3: a lost or retired PC must be cut off without touching
the customer's other agents. Keeping the record keeps its name and history
attributable.

**Enforced at:** `src/domain/probe-agents/aggregates/Agent.ts` (`revoke`)
**Reached from:** `POST /api/agents/:id/revoke`
**Tests:** `tests/domain/probe-agents/aggregates/Agent.test.ts`, `tests/integration/use-cases/probe-agents/RevokeAgentUseCase.integration.test.ts`, `tests/integration/agent-gateway.test.ts`

### AGT-006 — Agent names are unique, including revoked agents

**Type:** Policy · **Status:** Active
**Layer:** Domain · Infrastructure
**Since:** 2026-09-28

A name is 1–60 characters after trimming. Creating an agent with a name any
agent already has, revoked or not, is refused (`409`).

**Why:** The name is how an operator tells agents apart in alerts ("Agente
Torre Norte sin conexión"). Reusing a revoked agent's name would make old
alerts and the new agent indistinguishable.

**Enforced at:** `src/domain/probe-agents/value-objects/AgentName.ts`, unique index `probe_agents_name_key`
**Tests:** `tests/domain/probe-agents/value-objects/AgentName.test.ts`, `tests/integration/use-cases/probe-agents/CreateAgentUseCase.integration.test.ts`

### AGT-007 — Pairing needs `AGENT_PUBLIC_URL`; without it the rest of the install runs normally

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (composition)
**Since:** 2026-09-28

`AGENT_PUBLIC_URL` is the origin agents use to reach this backend (for
example `https://api.example.com`). Unset, creating an agent or issuing a key
answers `503` and nothing is created. Set to something that is not an http(s)
origin (a bare hostname, another scheme, a path), it stops the boot.

**Why:** A key with a wrong address is useless, and the customer only finds
out after installing, so a malformed value must fail loudly and early. An
install that runs no agents, like Insetel's until it migrates, should not need
a new setting to keep booting.

**Enforced at:** `src/infrastructure/probe-agents/config/agentPublicUrl.ts`, `src/application/probe-agents/use-cases/CreateAgentUseCase.ts`
**Message:** `Agent pairing is not available: AGENT_PUBLIC_URL is not configured`
**Tests:** `tests/infrastructure/probe-agents/config/agentPublicUrl.test.ts`, `tests/application/probe-agents/use-cases/CreateAgentUseCase.test.ts`

### AGT-008 — Every rejected enrollment gets the same answer, and attempts are rate limited per address

**Type:** Policy · **Status:** Active
**Layer:** Application · Presentation
**Since:** 2026-09-28

An unknown, already-used, expired or revoked code is answered `401` with the
same message. The real reason is logged. The endpoint allows 10 attempts per
IP address per 15 minutes (`429` beyond that).

**Why:** Enrollment is reachable without any login. Distinct answers would let
a caller learn which codes exist or were used. The code is 256 random bits, so
guessing is not a practical threat; the limit is there to stop a
misconfigured installer from hammering the backend.

Behind a reverse proxy or Cloudflare Tunnel every request arrives from the
proxy's address unless Express is told to trust it, and all installers would
then share one budget. This must be settled before the pilot is exposed
through the tunnel.

**Enforced at:** `src/application/probe-agents/use-cases/EnrollAgentUseCase.ts` (`INVALID_PAIRING_CODE`), `src/presentation/http/routes/agent-enrollment.routes.ts`
**Message:** `Invalid or expired pairing code`
**Tests:** `tests/integration/agent-enrollment.routes.test.ts`, `tests/integration/use-cases/probe-agents/EnrollAgentUseCase.integration.test.ts`

### AGT-009 — Only the vendor creates, re-keys or revokes agents; every role can read them

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-09-28 · **Revised:** 2026-09-30

| Endpoint                           | Permission            |
| ---------------------------------- | --------------------- |
| `POST /api/agents`                 | `manage-installation` |
| `GET /api/agents`                  | `read`                |
| `GET /api/agents/:id`              | `read`                |
| `GET /api/agents/:id/outages`      | `read`                |
| `POST /api/agents/:id/pairing-key` | `manage-installation` |
| `POST /api/agents/:id/revoke`      | `manage-installation` |
| `POST /agent/v1/enroll`            | none (pairing code)   |

**Why:** A pairing key puts a machine on the customer's network with access to
its measurements, and installing agents is the vendor's work, so writes sit on
the vendor's permission (`IDN-033`); the customer's administrator gets `403`.
Agent status is operational information everyone who watches the network needs,
the customer included.

**Enforced at:** `src/presentation/http/routes/agent.routes.ts` (`authorize`)
**Tests:** `tests/integration/agent.routes.test.ts`

### AGT-010 — An agent reports how many live devices sit behind it

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-29

Every agent in a response carries `deviceCount`: the devices whose `agentId`
is this agent and that are not in the recycle bin. Retired devices still count,
because they are still placed behind the agent. A new agent has 0. The count is
read when the response is built, never stored.

**Why:** The agent screen shows how much of the network each PC is
responsible for, and an operator deciding whether to revoke one needs to see
what would be left behind. Deleted devices are not in service, so counting
them would overstate it. Devices live in inventory, so the count is a
read-only query across contexts, not a field of the agent.

**Enforced at:** `src/infrastructure/probe-agents/queries/PrismaAgentDeviceCountQuery.ts`, `src/application/probe-agents/mappers/AgentMapper.ts`
**Reached from:** `GET /api/agents`, `GET /api/agents/:id`, `POST /api/agents`, `POST /api/agents/:id/pairing-key`, `POST /api/agents/:id/revoke`
**Tests:** `tests/application/probe-agents/use-cases/ListAgentsUseCase.test.ts`, `tests/integration/use-cases/probe-agents/ListAgentsUseCase.integration.test.ts`

---

## Liveness

### AGT-020 — Every hello and heartbeat records when the agent was last heard from, its version and its clock offset

**Type:** Policy · **Status:** Active
**Layer:** Domain · Application
**Since:** 2026-09-28

The agent says hello once per connection and sends a heartbeat every 30
seconds; the backend tells it the interval in its welcome. Each one sets
`lastSeenAt` to the arrival time, stores the version the agent reports (1–32
characters) and its clock offset: the agent's clock minus the backend's at
arrival, in milliseconds, positive when the agent runs ahead. Only an enrolled
agent can report in.

**Why:** ADR 0002, R5. `lastSeenAt` is what the OFFLINE rule (AGT-021) measures,
the version is what support needs first, and the offset is what result
timestamps will be corrected by (R12). The offset includes the message's
transit time, which on a live connection is milliseconds against a warning
threshold of a minute.

**Enforced at:** `src/domain/probe-agents/aggregates/Agent.ts` (`recordContact`), `src/application/probe-agents/use-cases/RecordAgentContactUseCase.ts`
**Tests:** `tests/domain/probe-agents/aggregates/Agent.test.ts`, `tests/integration/use-cases/probe-agents/RecordAgentContactUseCase.integration.test.ts`, `tests/integration/agent-gateway.test.ts`

---

### AGT-021 — An active agent silent for 5 minutes goes offline, once

**Type:** Policy · **Status:** Active
**Layer:** Domain · Application · Infrastructure (composition)
**Since:** 2026-09-28

Once a minute the backend checks every agent. An `ACTIVE` agent that has not
been heard from for 5 minutes or more is marked offline: `offlineSince` is set
to the moment it was noticed and `AgentWentOffline` is raised. Silence is
measured from `lastSeenAt`, or from `enrolledAt` for an agent that was paired
but never connected. An agent already offline is not marked again, so the
alert goes out once per outage. `PENDING` agents have never run and `REVOKED`
agents are finished, so neither is ever offline; revoking an offline agent
clears `offlineSince`.

**Why:** ADR 0002, R6. Five minutes is ten missed heartbeats — a service
restart or a short network blip reconnects well within it and pages no one.
Measuring from enrollment catches the installer who pairs the agent and then
switches the PC off, which would otherwise never be noticed. The state is
stored rather than derived from `lastSeenAt`, so the alert fires once and the
suppression rule (R7) has one field to read.

**Enforced at:** `src/domain/probe-agents/aggregates/Agent.ts` (`isOverdue`, `markOffline`, `revoke`), `src/application/probe-agents/use-cases/MarkSilentAgentsOfflineUseCase.ts`, `src/infrastructure/probe-agents/orchestrator/AgentLivenessOrchestrator.ts`
**Tests:** `tests/domain/probe-agents/aggregates/Agent.test.ts`, `tests/application/probe-agents/use-cases/MarkSilentAgentsOfflineUseCase.test.ts`, `tests/infrastructure/probe-agents/orchestrator/AgentLivenessOrchestrator.test.ts`, `tests/integration/use-cases/probe-agents/MarkSilentAgentsOfflineUseCase.integration.test.ts`, `tests/integration/agent.routes.test.ts`

---

### AGT-022 — The next contact brings an offline agent back, with one recovery message

**Type:** Policy · **Status:** Active
**Layer:** Domain · Application
**Since:** 2026-09-28

A hello or heartbeat from an offline agent clears `offlineSince` and raises
`AgentCameBack`, carrying when the agent had been marked offline. A contact
from an agent that is online raises nothing.

**Why:** ADR 0002, R6: one alert when it goes, one message when it returns.
Tying the recovery to a stored offline state means a blip that never reached
the threshold produces neither.

**Enforced at:** `src/domain/probe-agents/aggregates/Agent.ts` (`recordContact`), `src/application/probe-agents/use-cases/RecordAgentContactUseCase.ts`
**Tests:** `tests/domain/probe-agents/aggregates/Agent.test.ts`, `tests/integration/use-cases/probe-agents/RecordAgentContactUseCase.integration.test.ts`

---

### AGT-023 — Offline and back-online messages go to the install's chat and to the vendor's

**Type:** Policy · **Status:** Active
**Layer:** Application · Infrastructure (composition)
**Since:** 2026-09-28 · **Revised:** 2026-10-01

Both events are published through the shared `IAlertPublisher` as alerts with
no device (`NOT-100`): critical when the agent goes offline, resolved when it
comes back, type `agent_offline`, naming the agent. When
the vendor has a chat set (`vendorTelegramChatId`, INS-028; `TELEGRAM_VENDOR_CHAT_ID`
until saved), the same message also goes to that chat,
with the install's host (from `AGENT_PUBLIC_URL`) added to the source,
through the bot in `TELEGRAM_VENDOR_BOT_TOKEN` — or the install's own bot
when that is unset (revised 2026-09-30). One
chat failing does not stop delivery to the other. Neither copy is subject to
quiet hours or mutes (`NOT-196`). These messages are not recorded in the alert
list: an alert record belongs to a device.

**Why:** ADR 0002, R6. The customer needs to know its monitoring has stopped;
the vendor needs to know first, because a silent agent looks like a broken
product. The vendor chat hears from every customer's install, so each message
says which one. The vendor chat receives only agent-health messages, never
device alerts. A separate vendor bot lets an install keep its own bot for its
network's alerts without the vendor's bot joining that chat. A failed
self-update goes to the vendor's chat alone (`AGT-084`).

**Enforced at:** `src/application/notifications/event-handlers/AgentWentOfflineNotificationHandler.ts`, `src/application/notifications/event-handlers/AgentCameBackNotificationHandler.ts`, `src/infrastructure/notifications/FanOutAlertPublisher.ts`, `src/infrastructure/notifications/InstallLabelAlertPublisher.ts`, `src/infrastructure/notifications/TelegramNotificationService.ts`, `src/infrastructure/di/container.ts`
**Tests:** `tests/application/notifications/event-handlers/AgentHealthNotificationHandlers.test.ts`, `tests/infrastructure/notifications/FanOutAlertPublisher.test.ts`, `tests/infrastructure/notifications/TelegramNotificationService.test.ts`

---

### AGT-024 — The offline check and a heartbeat never overwrite each other

**Type:** Invariant · **Status:** Active
**Layer:** Application · Infrastructure (composition)
**Since:** 2026-09-28

Both writes succeed only if the agent's row is unchanged since it was read
(`updatedAt` still matches). If a heartbeat lands between the check reading an
agent and marking it offline, the check skips it: the agent is not silent any
more. If the check marks the agent offline between a heartbeat's read and its
write, the heartbeat reads again and brings the agent back, raising the
recovery. After a second conflict the heartbeat is dropped and logged; the
next one, 30 seconds later, records the contact.

**Why:** Without this, an agent reconnecting at the moment of the check could
end up online in the database after an offline alert with no recovery message,
or offline in the database while connected.

**Enforced at:** `src/infrastructure/probe-agents/repositories/PrismaAgentRepository.ts` (`saveIfUnchanged`), `src/application/probe-agents/use-cases/MarkSilentAgentsOfflineUseCase.ts`, `src/application/probe-agents/use-cases/RecordAgentContactUseCase.ts`
**Tests:** `tests/application/probe-agents/use-cases/RecordAgentContactUseCase.test.ts`, `tests/application/probe-agents/use-cases/MarkSilentAgentsOfflineUseCase.test.ts`, `tests/integration/use-cases/probe-agents/MarkSilentAgentsOfflineUseCase.integration.test.ts`

---

### AGT-025 — A PC clock more than a minute off raises one warning, and one all-clear once fixed

**Type:** Policy · **Status:** Active
**Layer:** Domain · Application · Infrastructure (composition)
**Since:** 2026-09-29

When a hello or heartbeat shows the agent's clock more than a minute ahead of
or behind the backend's, `clockDriftSince` is set and `AgentClockDrifted` is
raised, once. It is cleared, raising `AgentClockCorrected`, only when the
offset is back within 30 seconds. Both go out like the offline messages
(`AGT-023`): to the install's chat and the vendor's, with no device, type
`agent_clock`, as a warning and its resolution. Revoking clears it.

**Why:** ADR 0002, R12. Results are corrected for the offset either way
(`AGT-046`); the warning is so someone fixes the PC's clock, which keeps
drifting and can jump when Windows finally syncs. Warning past a minute but
clearing only well inside it means an offset hovering near the line cannot
flap between the two messages.

**Enforced at:** `src/domain/probe-agents/aggregates/Agent.ts` (`recordContact`, `CLOCK_DRIFT_WARN_MS`, `CLOCK_DRIFT_CLEAR_MS`), `src/application/notifications/event-handlers/AgentClockNotificationHandlers.ts`, `src/infrastructure/di/container.ts`
**Tests:** `tests/domain/probe-agents/aggregates/Agent.test.ts`, `tests/application/notifications/event-handlers/AgentClockNotificationHandlers.test.ts`, `tests/integration/use-cases/probe-agents/RecordAgentContactUseCase.integration.test.ts`

### AGT-026 — Every offline spell is kept, from its last contact to how it ended

**Type:** Policy · **Status:** Active
**Layer:** Application · Infrastructure (composition)
**Since:** 2026-09-29

When an agent is marked offline (`AGT-021`), one outage is opened with its last
contact (`silentSince`, or its enrollment if it never connected) and the moment
it was marked (`offlineSince`). The save that clears `offlineSince` closes it:
`RECONNECTED` at the contact that brought the agent back (`AGT-022`), or
`REVOKED` at the revocation. An agent has at most one open outage. The history
is read newest first, 20 per page by default and at most 100, at
`GET /api/agents/:id/outages`. Nothing is deleted while the agent exists.

**Why:** The offline and back-online messages (`AGT-023`) are gone once read,
and the agent's own row only knows about the current outage. The customer's
dashboard and the vendor need to see how often and how long a PC was down to
tell a flaky site from a one-off. Writing the outage in the same transaction as
the agent's state, from that state rather than from the events, means a lost
event cannot leave an outage open or missing. An outage is one row per several
minutes of silence, so the table stays small without a purge.

**Enforced at:** `src/infrastructure/probe-agents/repositories/PrismaAgentRepository.ts` (`syncOutage`), unique index `probe_agent_outages_one_open_per_agent`, `src/application/probe-agents/use-cases/ListAgentOutagesUseCase.ts`
**Reached from:** the offline check, the agent's hello and heartbeats, `POST /api/agents/:id/revoke`, `GET /api/agents/:id/outages`
**Tests:** `tests/application/probe-agents/use-cases/ListAgentOutagesUseCase.test.ts`, `tests/integration/use-cases/probe-agents/MarkSilentAgentsOfflineUseCase.integration.test.ts`, `tests/integration/use-cases/probe-agents/RecordAgentContactUseCase.integration.test.ts`, `tests/integration/use-cases/probe-agents/RevokeAgentUseCase.integration.test.ts`, `tests/integration/use-cases/probe-agents/ListAgentOutagesUseCase.integration.test.ts`, `tests/integration/agent.routes.test.ts`

---

## Connection and protocol

An agent keeps one WebSocket open to `/agent/v1/ws` on the backend's own HTTP
server, with `permessage-deflate` compression (R19). Messages are JSON with a
`type`; their shapes live in `src/agent/protocol/`, shared by both sides. Close
codes:

| Code   | Meaning                                          |
| ------ | ------------------------------------------------ |
| `4000` | Replaced by a newer connection of the same agent |
| `4001` | Revoked                                          |
| `4002` | Update required                                  |
| `4003` | Subscription expired (`INS-022`)                 |
| `4004` | Malformed or out-of-order message                |
| `4005` | No hello within 10 seconds                       |

### AGT-040 — An agent connects with its token and nothing else

**Type:** Policy · **Status:** Active
**Layer:** Application · Presentation
**Since:** 2026-09-28

The upgrade carries `Authorization: Bearer <token>`. A missing token, one
nobody holds, or one whose agent is not `ACTIVE` gets `401` and no socket. The
backend works out which agent is talking from the token alone; no message
carries an agent id it would trust. The endpoint is outside `/api` and never
accepts a user's JWT, and a pairing code is not a token.

**Why:** ADR 0002, R4. Deriving identity from the credential keeps the
protocol unchanged when one backend serves many tenants (token → agent →
tenant), and refusing at the upgrade means an unauthenticated caller never
holds an open socket.

**Enforced at:** `src/application/probe-agents/use-cases/AuthenticateAgentUseCase.ts`, `src/presentation/ws/agent/AgentGateway.ts`
**Tests:** `tests/application/probe-agents/use-cases/AuthenticateAgentUseCase.test.ts`, `tests/integration/use-cases/probe-agents/AuthenticateAgentUseCase.integration.test.ts`, `tests/integration/agent-gateway.test.ts`

### AGT-041 — The configuration lists the agent's pollable devices by a short index that is never reused

**Type:** Invariant · **Status:** Active
**Layer:** Application · Infrastructure
**Since:** 2026-09-28

The configuration an agent receives lists every device assigned to it that
in-process polling would otherwise poll: polling enabled, an IP set, not
deleted, `ACTIVE` or `COMMISSIONING` (the same test as the due query, DEV-086).
Each device appears with its IP, interval and `failuresBeforeDown`, under a
small number instead of its id. That number is assigned the first time the
device appears for that agent and never changes; it is never given to another
device of the same agent, even after the first one is purged. No credentials are
sent (they arrive with phase 3).

**Why:** ADR 0002, R19: results name devices by this number to keep them small.
Because it never changes or moves, a result buffered for hours still names the
right device after the configuration changed or the backend restarted. The
eligibility test is repeated rather than shared across contexts, so a change to
DEV-086 must touch this query too.

**Enforced at:** `src/application/probe-agents/use-cases/BuildAgentConfigSnapshotUseCase.ts`, `src/infrastructure/probe-agents/queries/PrismaAgentDeviceIndex.ts`, `src/infrastructure/probe-agents/queries/PrismaAgentPollingTargetsQuery.ts`
**Tests:** `tests/application/probe-agents/use-cases/BuildAgentConfigSnapshotUseCase.test.ts`, `tests/integration/use-cases/probe-agents/BuildAgentConfigSnapshotUseCase.integration.test.ts`, `tests/integration/agent-gateway.test.ts`

### AGT-042 — The configuration is sent on connect and within a minute of any change

**Type:** Policy · **Status:** Active
**Layer:** Application · Presentation
**Since:** 2026-09-28

After the welcome the agent receives its configuration. The backend rebuilds
it every 60 seconds and sends it again only if it changed. Its version is
derived from its content, so an unchanged configuration keeps its version.
The agent answers with the version it applied; a mismatch is logged.

**Why:** ADR 0002, R14. Rebuilding on a timer instead of reacting to every
change keeps device inventory, device monitoring and probe-agents from wiring
events into each other. The cost is up to a minute between editing a device
and its agent polling the new way, which is below any poll interval anyone
uses.

**Enforced at:** `src/presentation/ws/agent/AgentSession.ts` (`refresh`, `pushConfig`)
**Tests:** `tests/application/probe-agents/use-cases/BuildAgentConfigSnapshotUseCase.test.ts`, `tests/integration/agent-gateway.test.ts`

### AGT-043 — A result reaches a device only while the device is on the agent that sent it

**Type:** Policy · **Status:** Active
**Layer:** Application · Infrastructure
**Since:** 2026-09-28

Results arrive in batches. Each is handed to device monitoring (MON-022) if
its index names a device currently assigned to the sending agent. A result for
an unknown index, or for a device since moved to another agent or back
in-process, is acknowledged and dropped. A result that could not be stored is
left unacknowledged so the agent keeps it and sends it again. The backend
acknowledges each batch with the ids it is done with.

**Why:** After a move, the old agent may still send what it measured before it
received the new configuration. Letting that through would give the device two
writers again. Acknowledging it anyway stops the agent from resending it
forever. Duplicate and stale results are handled by the ingest rules of slice
1.6.

**Enforced at:** `src/application/probe-agents/use-cases/AcceptAgentResultsUseCase.ts`, `src/infrastructure/probe-agents/queries/PrismaAgentDeviceIndex.ts` (`resolveAssigned`)
**Tests:** `tests/application/probe-agents/use-cases/AcceptAgentResultsUseCase.test.ts`, `tests/integration/use-cases/probe-agents/AcceptAgentResultsUseCase.integration.test.ts`, `tests/integration/agent-gateway.test.ts`

### AGT-044 — An agent speaking an older protocol is told to update, and nothing else happens

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-09-28 · **Revised:** 2026-10-01

The hello carries the agent's protocol version. Below the minimum the backend
accepts (today `1`), the connection is closed with `4002` and a reason naming
the version, before the contact is recorded or any configuration is sent. Any
version number is read, however old, so the agent always gets that answer
rather than a bare protocol error. When a release is available for it
(`AGT-082`), the update offer is sent just before the close, so an agent that
can update itself gets out of that state on its own.

**Why:** ADR 0002, R18. An outdated agent must be visibly outdated, on the agent
and to support, rather than half-working. Recording nothing keeps it from
counting as online.

**Enforced at:** `src/presentation/ws/agent/AgentSession.ts` (`onHello`), `src/presentation/ws/agent/agentMessageSchema.ts`
**Tests:** `tests/integration/agent-gateway.test.ts`

### AGT-045 — An agent has at most one connection; the newest wins

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-09-28

When an agent connects while an older connection of the same agent is still
open, the older one is closed with `4000`. A connection that sends anything
before its hello, or anything malformed, is closed with `4004`; one that sends
no hello within 10 seconds, with `4005`.

**Why:** After a network blip the agent reconnects before the backend notices
the old socket is dead. The new connection is the one that reflects the
agent's state; two open sessions would each push configuration and handle
results for the same agent.

**Enforced at:** `src/presentation/ws/agent/AgentGateway.ts`, `src/presentation/ws/agent/AgentSession.ts`
**Tests:** `tests/integration/agent-gateway.test.ts`

---

### AGT-046 — Result timestamps are moved onto the backend's clock, and never past their arrival

**Type:** Policy · **Status:** Active
**Layer:** Application · Presentation
**Since:** 2026-09-29

Each result's time is taken on the agent's clock. Before it reaches the
device, it is corrected by the agent's last measured offset (`AGT-020`) and
capped at the moment its batch arrived. The arrival time is stamped when the
message is received, not when the session gets round to it, and travels with
each result, so whether a result is live (`MON-008`) is judged on the
backend's own clock.

**Why:** ADR 0002, R12. A PC whose clock runs ahead would otherwise date its
results in the future: each would read as newer than every live result after
it and freeze the device's state until real time caught up. Behind, it would
make live results look like backlog and never alert.

**Enforced at:** `src/application/probe-agents/use-cases/AcceptAgentResultsUseCase.ts`, `src/presentation/ws/agent/AgentSession.ts`
**Tests:** `tests/application/probe-agents/use-cases/AcceptAgentResultsUseCase.test.ts`, `tests/integration/use-cases/probe-agents/AcceptAgentResultsUseCase.integration.test.ts`

---

## The agent program

### AGT-060 — The agent pairs itself from the key alone, once, and keeps its token sealed

**Type:** Policy · **Status:** Active
**Layer:** Agent program
**Since:** 2026-09-29

Until it holds a token, the agent waits for a pairing key: given with
`--pair <key>` or `NMS_AGENT_PAIRING_KEY`, or left by the installer in
`pairing.key` in its data directory, checked every 30 seconds. It reads the
backend's address from the key and sends only the code to
`POST /agent/v1/enroll` (`AGT-003`). A key the backend refuses (`400`, `401`),
or one that is not a key at all, is deleted and never tried again; an
unreachable backend or any other answer is retried every minute with the same
key. Once enrolled, the key is deleted and the token is written to `agent.json`:
sealed with Windows DPAPI for the service's own account, or on Linux in a file
only its owner can read (`0600`). A token sealed on one platform is refused on
another rather than sent as garbage.

**Why:** ADR 0002, R1 and R2. The installer asks for one string and nothing
else. The service reads the key itself rather than the installer enrolling on
its behalf, so the token is sealed for the account that will use it. DPAPI goes
through PowerShell, which every supported Windows has, so the single executable
carries no native module; the token travels on stdin, never on a command line
other processes can read.

**Enforced at:** `src/agent/identity/enrollAgent.ts`, `src/agent/identity/PairingKeySource.ts`, `src/agent/identity/CredentialStore.ts`, `src/agent/identity/SecretProtector.ts`, `src/agent/AgentRuntime.ts`
**Tests:** `tests/agent/identity/enrollAgent.test.ts`, `tests/agent/identity/PairingKeySource.test.ts`, `tests/agent/identity/CredentialStore.test.ts`, `tests/agent/AgentRuntime.test.ts`, `tests/integration/agent-app.test.ts`

### AGT-061 — The agent measures each device on its interval and reports one result per cycle

**Type:** Policy · **Status:** Active
**Layer:** Agent program · Infrastructure
**Since:** 2026-09-29

Each device is polled every `intervalSeconds`, counted from the start of its
last cycle, with the same attempt loop the backend uses: up to
`failuresBeforeDown` pings, one second apart, stopping at the first reply
(`PingCycleProbe`). A cycle produces one result with its own id, the device's
index and the agent-clock time the cycle started: reachable with latency,
unreachable, or "the probe could not run" with the error. A device never has
two cycles running at once, and at most 32 cycles run together, the most
overdue first. The agent never decides whether a device is down.

Ping reads the same on any Windows language: the reply line is recognised by
its `bytes=32` field, not by the words around it (`time=`, `tiempo=`), and
"destination host unreachable" from a router is not a reply. A reply under a
millisecond (`tiempo<1ms`) reads as 1 ms.

**Why:** ADR 0002, "Responsibilities" and "Packaging". One result per cycle
keeps `DeviceState` meaning what it means for in-process polling. Before this
rule, the probe did not tell the ping library the packet size, and on Windows
the library then read the byte count as the latency: every device showed
32 ms.

**Enforced at:** `src/agent/polling/PollScheduler.ts`, `src/application/device-monitoring/services/PingCycleProbe.ts`, `src/infrastructure/monitoring/ping/PingService.ts`
**Tests:** `tests/agent/polling/PollScheduler.test.ts`, `tests/infrastructure/monitoring/ping/PingService.test.ts`, `tests/integration/agent-app.test.ts`

### AGT-062 — The agent polls what its last configuration says, and keeps it through a restart

**Type:** Policy · **Status:** Active
**Layer:** Agent program
**Since:** 2026-09-29

Each configuration the backend sends replaces the agent's device list and is
acknowledged with its version (`AGT-042`). A new device is polled at once; a
known one keeps its rhythm, pulled forward if its interval got shorter; a
device no longer listed stops being polled. The configuration is saved to
`config.json` — index, address, interval and attempts only — so an agent that
restarts while the internet is down keeps polling and buffering without
waiting for the backend.

**Why:** ADR 0002, R13 and R14. A PC rebooted during an outage would otherwise
measure nothing until the connection came back, leaving exactly the gap the
buffer exists to cover. Nothing else a device carries is written: device
credentials, when they arrive (phase 3), stay in memory only (R15).

**Enforced at:** `src/agent/polling/PollScheduler.ts` (`applyConfig`), `src/agent/config/ConfigStore.ts`, `src/agent/AgentRuntime.ts`, `src/agent/connection/BackendConnection.ts`
**Tests:** `tests/agent/polling/PollScheduler.test.ts`, `tests/agent/config/ConfigStore.test.ts`, `tests/agent/AgentRuntime.test.ts`, `tests/agent/connection/BackendConnection.test.ts`, `tests/integration/agent-app.test.ts`

### AGT-063 — After every reconnect the agent measures everything at once and sends the newest results first

**Type:** Policy · **Status:** Active
**Layer:** Agent program
**Since:** 2026-09-29

The first configuration after each connect polls every device immediately,
whatever its interval. Results always leave newest first, so these live results
go ahead of any backlog, and a backlog never delays a live result measured
while it drains.

**Why:** ADR 0002, R11. Only a live result can change a device's state
(`MON-008`); sending it first makes the dashboard current within seconds of a
reconnect, even for devices polled once an hour, while the backlog fills
history behind it.

**Enforced at:** `src/agent/AgentRuntime.ts` (`onConfig`), `src/agent/polling/PollScheduler.ts` (`pollAllNow`), `src/agent/results/ResultBuffer.ts` (`take`)
**Tests:** `tests/agent/AgentRuntime.test.ts`, `tests/agent/polling/PollScheduler.test.ts`, `tests/agent/results/ResultBuffer.test.ts`, `tests/agent/connection/BackendConnection.test.ts`

### AGT-064 — A result is kept until the backend acknowledges it, for up to 24 hours, on disk

**Type:** Policy · **Status:** Active
**Layer:** Agent program
**Since:** 2026-09-29

Every result is buffered in memory and appended to a file on disk, one file per
10 minutes, within about a second. Results go out in batches of up to 500
every 2 seconds, over the compressed connection, at most 4 batches awaiting
an answer. Only the ids the backend acknowledges leave the buffer; the rest of
a batch, a batch unanswered after 60 seconds, and everything in flight when the
connection drops are sent again. A file is deleted once all its results are
acknowledged. A result measured more than 24 hours ago is dropped, and so is
the file that held it. After a restart the agent resends whatever its files
still hold, including results acknowledged just before it stopped; the
backend stores each id once (`MON-007`), so the resend is harmless.

**Why:** ADR 0002, R8, R13 and R19. Nothing measured during an outage of up to
a day is lost, and the disk holds only what is still owed. Writing
acknowledgements down as well would double the disk writes of a healthy agent
to save a few seconds of resending after a restart.

**Enforced at:** `src/agent/results/ResultBuffer.ts`, `src/agent/connection/BackendConnection.ts`
**Tests:** `tests/agent/results/ResultBuffer.test.ts`, `tests/agent/connection/BackendConnection.test.ts`, `tests/integration/agent-app.test.ts`

### AGT-065 — The agent reconnects on its own, and waits as long as the reason for closing calls for

**Type:** Policy · **Status:** Active
**Layer:** Agent program
**Since:** 2026-09-29

The agent says hello on connect and sends a heartbeat on the interval the
welcome names (30 seconds). When the connection closes it reconnects:

| Close                                            | Agent does                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------- |
| `4003` subscription expired, or `402` on pairing | stops polling; retries after an hour; polling resumes on the next welcome |
| `4002` update required                           | keeps polling and buffering; retries after an hour                        |
| `4000` replaced                                  | retries after a minute                                                    |
| `4001` revoked                                   | `AGT-066`; never reconnects                                               |
| anything else, including a refused upgrade       | retries after 1 s, doubling up to 60 s, with jitter                       |

A `401` at the upgrade is retried like a network failure, never taken as a
revocation.

**Why:** ADR 0002, R5, R17 and R18. Nothing about an expired subscription or an
outdated agent changes within seconds, and an agent that measured while
expired would fill its buffer with results nobody accepts. An outdated agent
keeps measuring because an update installed within a day recovers its
backlog. A refused token is not proof of revocation: the gateway also answers
`401` when it cannot read the database, and an agent that forgot its token over
a hiccup would need a technician. Two copies of one agent retrying fast would
take the connection from each other every second.

**Enforced at:** `src/agent/connection/BackendConnection.ts`, `src/agent/AgentRuntime.ts`, `src/agent/identity/enrollAgent.ts`
**Tests:** `tests/agent/connection/BackendConnection.test.ts`, `tests/agent/AgentRuntime.test.ts`, `tests/agent/identity/enrollAgent.test.ts`

### AGT-066 — A revoked agent forgets everything and waits to be paired again

**Type:** Policy · **Status:** Active
**Layer:** Agent program
**Since:** 2026-09-29

On close code `4001` the agent stops polling and deletes its token, its saved
configuration and every buffered result, from memory and disk. It then waits
for a new pairing key as if freshly installed.

**Why:** ADR 0002, R3: after revocation the PC holds nothing sensitive — no
credential, and no list of the network's addresses. Waiting for a key rather
than exiting lets an administrator pair the same PC again without reinstalling.

**Enforced at:** `src/agent/AgentRuntime.ts` (`forgetEverything`), `src/agent/connection/BackendConnection.ts`
**Tests:** `tests/agent/AgentRuntime.test.ts`, `tests/agent/results/ResultBuffer.test.ts`, `tests/agent/identity/CredentialStore.test.ts`, `tests/agent/config/ConfigStore.test.ts`, `tests/agent/connection/BackendConnection.test.ts`

### AGT-067 — On Windows, one `setup.exe` asks only for the pairing key and leaves a service that runs unattended

**Type:** Policy · **Status:** Active
**Layer:** Agent program
**Since:** 2026-09-29 · **Revised:** 2026-10-01

`nms-agent-setup-<version>.exe` needs administrator rights and asks one
question, the pairing key, only on a PC that is not paired yet. It checks the
key's shape (`pk1.`, three parts) to catch a partial paste; the backend judges
the rest. It also accepts the key as `/PAIRINGKEY=<key>` for a silent install
(`/VERYSILENT`), which refuses to run on an unpaired PC without one. It then:

- installs the agent to `Program Files\NmsAgent`
- locks `%ProgramData%\NmsAgent` to SYSTEM and administrators, and leaves the
  key there as `pairing.key` for the service to use (`AGT-060`)
- sets the PC never to sleep or hibernate on mains power
- excludes the program and data folders from Microsoft Defender
- registers the `NmsAgent` service through WinSW: it starts at boot, runs as
  LocalSystem with nobody logged in, and restarts after a crash (10 s, 30 s,
  then every 60 s). Its logs go to `%ProgramData%\NmsAgent\logs`, kept to 5
  files of 10 MB.

Running the installer again upgrades in place: it stops the service, replaces
the files and starts it, keeping the pairing. Uninstalling stops and removes
the service, removes the Defender exclusion and deletes the data folder with
the token, configuration and unsent results. Both also delete what a
self-update leaves beside the program: `nms-agent.exe.old` and
`nms-agent.exe.new`. The installer speaks Spanish or English.

**Why:** ADR 0002, "Packaging": the customer's PC is Windows and whoever
installs it is not technical. A sleeping PC measures nothing, and Defender
tends to quarantine an unsigned executable (the agent is unsigned until there
are several customers). The data folder holds the token and the list of the
network's addresses, so other users of the PC cannot read it.

**Enforced at:** `packaging/agent/windows/nms-agent.iss`, `packaging/agent/windows/nms-agent-service.xml`, `scripts/agent/package.mjs`
**Tests:** `tests/agent/packaging.test.ts`

### AGT-068 — On Linux, an install script sets the agent up as a systemd service under its own user

**Type:** Policy · **Status:** Active
**Layer:** Agent program
**Since:** 2026-09-29 · **Revised:** 2026-10-01

`nms-agent-<version>-linux-x64.tar.gz` holds the agent binary, a systemd unit
and `install.sh`. Run as root, `install.sh <pairing-key>` does the following:

- checks that systemd and the system `ping` are present
- creates the system user `nms-agent`, which cannot log in
- installs the binary to `/opt/nms-agent/nms-agent`, in a directory owned by
  that user so that the agent can update itself
- creates `/var/lib/nms-agent`, readable by that user alone (`0700`), and
  leaves the key there as `pairing.key` (`0600`)
- enables and starts `nms-agent.service`

Without a key it only upgrades a PC that is already paired, and removes any
`.old` or `.new` copy a self-update left behind. The service restarts 10
seconds after any exit. Apart from its data directory and its own program
directory, the system is read-only to it, and it cannot see home directories. Logs go to the journal
(`journalctl -u nms-agent`). `uninstall.sh` removes the service, the binary,
the data directory and the user.

**Why:** ADR 0002, "Packaging": the same agent for customers who run Linux, a
Raspberry Pi for instance. A dedicated user and a private directory keep the
token away from everyone else on the machine. `NoNewPrivileges` is deliberately
not set: the system `ping` gets its right to send ICMP from setuid or a file
capability, which that option would strip.

**Enforced at:** `packaging/agent/linux/nms-agent.service`, `packaging/agent/linux/install.sh`, `packaging/agent/linux/uninstall.sh`, `scripts/agent/package.mjs`
**Tests:** `tests/agent/packaging.test.ts`

---

## Updates

An agent updates itself without anyone visiting the PC. The vendor builds a
release, signs it with a key that only the vendor holds, and copies it into
the install's installer folder. That install then offers it to its agents
(ADR 0002, phase 2).

### AGT-080 — A release is one signed binary per platform, and an agent installs nothing the vendor's key did not sign

**Type:** Invariant · **Status:** Active
**Layer:** Agent program
**Since:** 2026-10-01

`npm run package:agent` writes a release next to the installers:

- one gzipped binary per platform, `nms-agent-<version>-<platform>.gz`, where
  the platform is `win-x64` or `linux-x64`
- a manifest, `nms-agent-<version>.manifest.json`, giving each binary's
  SHA-256 and size once unzipped, and its signature

The signature is Ed25519, made with the vendor's release key over
`nms-agent-release:v1:<version>:<platform>:<sha256>`. The same binary therefore
cannot be presented as another version or for the other platform. The private
key lives on the vendor's machine (`~/.config/nms-agent/release-key.pem`,
created once by `npm run agent:release-key`), never in the repository or on a
server. Packaging refuses to sign with a key that does not match the public key
built into the agent. Without the key, it builds the installers and no release.

A version is plain `major.minor.patch`, compared number by number. Anything
else is never newer than anything.

**Why:** The agent runs as SYSTEM on Windows and as a service on Linux, on the
customer's PCs. If whoever controls a backend could push any program, one
breached server would be a way into every customer network behind it. The
signature confines that risk to the vendor's own key. Signing the version too
stops a backend from offering an old, signed release with a known fault as if
it were new. The cost: if the key is lost, nothing more can be signed, and
agents trusting a new key need one manual reinstall.

**Enforced at:** `src/agent/protocol/release.ts` (`verifyReleaseSignature`, `isNewerVersion`, `RELEASE_PUBLIC_KEY`), `scripts/agent/package.mjs` (`packageRelease`), `scripts/agent/release-key.mjs`
**Tests:** `tests/agent/protocol/release.test.ts`

### AGT-081 — An agent replaces itself only with a newer binary whose signature, checksum and self-test all pass

**Type:** Invariant · **Status:** Active
**Layer:** Agent program
**Since:** 2026-10-01

When the backend offers an update (`AGT-082`), the agent first checks the
offer itself:

- it ignores a version that is not newer than its own, and one that already
  failed on this PC
- it handles one offer at a time
- it refuses a file that is not the binary for its own platform, and a
  signature that does not verify against the vendor's key built into it
  (`AGT-080`), before downloading anything

It then downloads the binary with its own token (`AGT-083`) and unzips it next
to itself as `.new`. It refuses the binary if it is larger or smaller than
announced, or if its SHA-256 differs. Last, it runs the new binary with
`--self-test`, which must exit within 30 seconds and print the offered
version. A failing self-test prints its reason, and that line becomes the
reason reported (`AGT-084`). The self-test also loads the vendor's key, so the new version can
check the update after it.

Only then does it swap: the running binary becomes `.old` and the new one
takes its place. The agent then stops cleanly and exits with code `75`, and
the service manager starts the new binary (WinSW restarts on any failure
exit, systemd on any exit). The new version is on trial until it reaches the
backend (`AGT-085`).

A refusal leaves the running binary untouched and removes the download. The
version is remembered as failed, never tried again here, and reported as
`rejected` with the reason (`AGT-084`). A download that does not complete
(network, timeout, or any answer but `200`) is not held against the version:
it is tried again after 15 minutes, up to 3 attempts, and the backend offers
it again on the next connection.

Only a packaged agent updates itself, on `win-x64` and `linux-x64`. Run from
source, the agent has no binary of its own to replace.

**Why:** ADR 0002, phase 2. The agent runs unattended as SYSTEM or as a
service, so whatever it installs has to be the vendor's, intact, and able to
start, before the working version is touched. Checking the signature before
downloading saves 30 MB on a link that may be slow. A broken download says
nothing about the release, while a bad checksum or a failed self-test would
fail the same way every time. Renaming instead of deleting is what Windows
allows for a running program, and keeps the previous version at hand for a
rollback.

**Enforced at:** `src/agent/update/AgentUpdater.ts` (`offer`, `prepare`, `download`, `swap`), `src/agent/update/selfTest.ts`, `src/agent/main.ts`, `src/agent/AgentRuntime.ts`, `src/agent/connection/BackendConnection.ts`
**Tests:** `tests/agent/update/AgentUpdater.test.ts`, `tests/agent/update/selfTest.test.ts`, `tests/agent/AgentRuntime.test.ts`, `tests/agent/connection/BackendConnection.test.ts`

### AGT-082 — An install offers its newest signed release to each agent running something older, once per connection, and never one that already failed there

**Type:** Policy · **Status:** Active
**Layer:** Application · Infrastructure (composition) · Presentation · Agent program
**Since:** 2026-10-01

Releases live in the installer folder (`INSTALLERS_DIR`). The newest release
counts, among the manifests that pass every check:

- the name, `nms-agent-<version>.manifest.json`, matches the version inside
- each binary is listed under its own name and exists beside the manifest
- each signature verifies against the vendor's key (`AGT-080`)

A manifest that fails any check is skipped and logged, each new reason once.
A platform the backend does not know is ignored. The folder is read again on
every check, so a release copied in reaches connected agents within a minute,
with no restart, even if its binary arrives after the manifest. Without the
folder, nothing is offered.

The agent's hello names its platform (`win-x64` or `linux-x64`), when it is a
packaged agent on one of them. An agent is offered the release when all of
the following hold:

- the release has a binary for that platform
- the release's version is newer than the one the agent runs
- the agent has not already reported that very version as rolled back or
  rejected

An agent that names no platform is offered nothing: those older than
self-update, and one run from source. The offer is an `update` message after the configuration,
on connect and at every configuration refresh. It gives the version, the
binary's name, SHA-256, unzipped size and signature, and is sent once per
release per connection.

**Why:** ADR 0002, phase 2, and the vendor's decision of 2026-10-01: updates
are automatic, and publishing means copying files. Each customer is its own
install, so which folder the vendor copies into chooses who gets the release.
The backend checks the signature too, so it never offers a download every
agent would refuse. A release that failed on an agent would fail again the
same way; the vendor fixes it with a newer one instead of the agent trying
forever.

**Enforced at:** `src/application/probe-agents/use-cases/GetAgentUpdateOfferUseCase.ts`, `src/infrastructure/probe-agents/releases/FileSystemAgentReleaseCatalog.ts`, `src/presentation/ws/agent/AgentSession.ts` (`offerUpdate`), `src/presentation/ws/agent/agentMessageSchema.ts`, `src/domain/probe-agents/aggregates/Agent.ts` (`hasFailedUpdateTo`), `src/agent/update/selfTest.ts` (`agentPlatform`), `src/agent/connection/BackendConnection.ts`
**Tests:** `tests/application/probe-agents/use-cases/GetAgentUpdateOfferUseCase.test.ts`, `tests/infrastructure/probe-agents/releases/FileSystemAgentReleaseCatalog.test.ts`, `tests/integration/use-cases/probe-agents/GetAgentUpdateOfferUseCase.integration.test.ts`, `tests/integration/agent-gateway.test.ts`, `tests/presentation/ws/agent/agentMessageSchema.test.ts`, `tests/domain/probe-agents/aggregates/Agent.test.ts`, `tests/agent/update/selfTest.test.ts`, `tests/agent/connection/BackendConnection.test.ts`

### AGT-083 — A release binary is downloaded with the agent's own token, and only if a valid release lists it

**Type:** Invariant · **Status:** Active
**Layer:** Application · Presentation
**Since:** 2026-10-01

`GET /agent/v1/updates/<file>` streams a binary to an agent presenting the
token of an active agent. It answers:

- `401` to a missing, unknown or revoked token, and to a user's JWT. This is
  checked before anything about the name.
- `400` to a name that is not shaped like a release binary
- `404` to one that no valid manifest lists (`AGT-082`)

Installers, manifests and any path outside the folder are never served from
here. Like the other agent routes, it answers `402` once the subscription is
locked.

**Why:** ADR 0002, R4: the agent's token is its identity, and nothing on the
agent routes answers to a dashboard login. Serving only what a valid manifest
names keeps the route from becoming a way to read the folder, or anything
next to it.

**Enforced at:** `src/presentation/http/controllers/AgentUpdateController.ts`, `src/presentation/http/routes/agent-update.routes.ts`, `src/presentation/http/validation/agent.schemas.ts` (`agentReleaseFileSchema`), `src/application/probe-agents/use-cases/OpenAgentReleaseFileUseCase.ts`, `src/infrastructure/probe-agents/releases/FileSystemAgentReleaseCatalog.ts` (`open`)
**Tests:** `tests/integration/agent-update.routes.test.ts`, `tests/application/probe-agents/use-cases/OpenAgentReleaseFileUseCase.test.ts`, `tests/integration/use-cases/probe-agents/OpenAgentReleaseFileUseCase.integration.test.ts`, `tests/infrastructure/probe-agents/releases/FileSystemAgentReleaseCatalog.test.ts`

### AGT-084 — How the last self-update ended is kept on the agent, and a failure reaches the vendor once

**Type:** Policy · **Status:** Active
**Layer:** Domain · Application · Infrastructure (composition) · Presentation · Agent program
**Since:** 2026-10-01

After trying to update itself, the agent reports an `update.result`:

- `installed`: the new version runs and reached the backend
- `rolled-back`: it did not reach the backend in time, and the previous
  version was put back
- `rejected`: the binary's size, checksum, signature or self-test failed, or
  it could not be swapped in (`AGT-081`), and nothing changed

The agent keeps its last report in `update.json` in its data directory. It
sends a refusal at once if it is connected, and the last report again after
every welcome, so a report survives the restarts that an update involves and
a connection dropped before it was sent.

The backend keeps the latest report on the agent: the version tried, the
outcome, when, and for a failure the agent's reason (required, at most 500
characters). The version must be `major.minor.patch`, and only an active
agent can report. Reporting the same version and outcome again changes
nothing.

A new rolled-back or rejected report sends one warning, with no device, to
the vendor's chat only, never the install's. It names the agent, the version
it tried and the version it still runs, and the reason.

**Why:** ADR 0002, phase 2: an update that fails must be visible without
anyone opening the PC. The customer's monitoring continues on the version
that runs, so only the vendor needs to act. The agent repeats its report
after every welcome, so a repeat must not alert twice.

**Enforced at:** `src/domain/probe-agents/aggregates/Agent.ts` (`recordUpdateOutcome`), `src/application/probe-agents/use-cases/RecordAgentUpdateOutcomeUseCase.ts`, `src/application/notifications/event-handlers/AgentUpdateFailedNotificationHandler.ts`, `src/presentation/ws/agent/AgentSession.ts` (`onUpdateResult`), `src/infrastructure/di/container.ts`, `prisma/migrations/20261001120000_agent_last_update/migration.sql`, `src/agent/update/UpdateStateStore.ts`, `src/agent/AgentRuntime.ts` (`reportUpdate`)
**Tests:** `tests/domain/probe-agents/aggregates/Agent.test.ts`, `tests/application/probe-agents/use-cases/RecordAgentUpdateOutcomeUseCase.test.ts`, `tests/integration/use-cases/probe-agents/RecordAgentUpdateOutcomeUseCase.integration.test.ts`, `tests/application/notifications/event-handlers/AgentUpdateFailedNotificationHandler.test.ts`, `tests/integration/agent-gateway.test.ts`, `tests/infrastructure/probe-agents/mappers/AgentPrismaMapper.test.ts`, `tests/agent/update/AgentUpdater.test.ts`, `tests/agent/AgentRuntime.test.ts`, `tests/agent/connection/BackendConnection.test.ts`

### AGT-085 — A new version that does not reach the backend within 2 minutes is replaced by the previous one

**Type:** Policy · **Status:** Active
**Layer:** Agent program
**Since:** 2026-10-01

Before the swap (`AGT-081`), the agent records a trial in `update.json`: the
new version and the one it replaces. The new version is on trial from its
first start until its first welcome from the backend. That welcome ends the
trial: the agent reports `installed` and deletes `.old`.

The previous version is put back when, during the trial:

- no welcome arrives within 2 minutes of a start
- the new version starts a fourth time, after stopping three times without a
  welcome

Putting it back renames the new binary to `.new` and `.old` back into place,
then exits so that the service manager starts the previous version. That
version deletes `.new` on its start. The new version is reported as
`rolled-back` with the reason, and never tried again here.

If the previous version starts while a trial is still recorded, because a
power cut interrupted the rollback or the swap, it records the update as
`rolled-back` too. If some other version starts, installed by hand, the trial
is dropped without a report. A version on trial takes no offers.

**Why:** ADR 0002, phase 2: an update must never cost a customer their
monitoring. A welcome is the one proof that the new version works end to end:
it starts, reads its token, connects and speaks the protocol. Two minutes is
far more than a working agent needs, since it reconnects within seconds. The
start count covers a version that crashes before the timer can run out. The
trial is recorded before the swap, so whatever interrupts it, the next start
still knows what was being tried.

**Enforced at:** `src/agent/update/AgentUpdater.ts` (`recover`, `welcomed`, `rollBack`), `src/agent/update/UpdateStateStore.ts`, `src/agent/main.ts`
**Tests:** `tests/agent/update/AgentUpdater.test.ts`, `tests/agent/AgentRuntime.test.ts`
