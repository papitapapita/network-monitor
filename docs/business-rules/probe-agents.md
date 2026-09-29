# Probe Agents — Business Rules

An agent is the small program an ISP runs on a PC inside its own network. It
measures that network and reports to this backend, which a VPS could not reach
directly (ADR 0002). These rules cover how an agent gets its identity: an
administrator creates it, the installer pairs it with a one-time key, and an
administrator can revoke it.

The connection rules cover the agent's one WebSocket: how it authenticates,
what configuration it receives and how its results reach the devices. The
liveness rules cover when an agent counts as offline and who is told. The
ingest rules for buffered and duplicate results arrive in a later slice of
ADR 0002 phase 1.

Format and conventions: [README.md](README.md).

## ID ranges

| Range                 | Area                    |
| --------------------- | ----------------------- |
| `AGT-001` … `AGT-019` | Enrollment and identity |
| `AGT-020` … `AGT-039` | Liveness                |
| `AGT-040` … `AGT-059` | Connection and protocol |

## Layer coverage

A rule enforced in two layers counts in both.

| Layer                        | Rules |
| ---------------------------- | ----- |
| Domain                       | 9     |
| Application                  | 12    |
| Infrastructure (composition) | 8     |
| Presentation                 | 6     |

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

**Enforced at:** `src/domain/probe-agents/aggregates/Agent.ts` (`PAIRING_KEY_TTL_MS`, `enroll`), `src/application/probe-agents/services/PairingKey.ts`
**Reached from:** `POST /api/agents`, `POST /api/agents/:id/pairing-key`
**Tests:** `tests/domain/probe-agents/aggregates/Agent.test.ts`, `tests/application/probe-agents/services/PairingKey.test.ts`, `tests/integration/use-cases/probe-agents/CreateAgentUseCase.integration.test.ts`

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

### AGT-009 — Only administrators create, re-key or revoke agents; every role can read them

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-09-28

| Endpoint                           | Permission           |
| ---------------------------------- | -------------------- |
| `POST /api/agents`                 | `manage-credentials` |
| `GET /api/agents`                  | `read`               |
| `GET /api/agents/:id`              | `read`               |
| `POST /api/agents/:id/pairing-key` | `manage-credentials` |
| `POST /api/agents/:id/revoke`      | `manage-credentials` |
| `POST /agent/v1/enroll`            | none (pairing code)  |

**Why:** A pairing key grants a machine access to the customer's network data,
the same weight as device credentials, so it sits on the same tier
(`manage-credentials`, administrators only). Agent status is operational
information everyone who watches the network needs.

**Enforced at:** `src/presentation/http/routes/agent.routes.ts` (`authorize`)
**Tests:** `tests/integration/agent.routes.test.ts`

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
**Since:** 2026-09-28

Both events are published through the shared `IAlertPublisher` as alerts with
no device (`NOT-100`): critical when the agent goes offline, resolved when it
comes back, type `agent_offline`, naming the agent. When
`TELEGRAM_VENDOR_CHAT_ID` is set, the same message also goes to that chat,
with the install's host (from `AGENT_PUBLIC_URL`) added to the source. One
chat failing does not stop delivery to the other. Neither copy is subject to
quiet hours or mutes (`NOT-196`). These messages are not recorded in the alert
list: an alert record belongs to a device.

**Why:** ADR 0002, R6. The customer needs to know its monitoring has stopped;
the vendor needs to know first, because a silent agent looks like a broken
product. The vendor chat hears from every customer's install, so each message
says which one. The vendor chat receives only agent-health messages, never
device alerts.

**Enforced at:** `src/application/notifications/event-handlers/AgentWentOfflineNotificationHandler.ts`, `src/application/notifications/event-handlers/AgentCameBackNotificationHandler.ts`, `src/infrastructure/notifications/FanOutAlertPublisher.ts`, `src/infrastructure/notifications/InstallLabelAlertPublisher.ts`, `src/infrastructure/di/container.ts`
**Tests:** `tests/application/notifications/event-handlers/AgentHealthNotificationHandlers.test.ts`, `tests/infrastructure/notifications/FanOutAlertPublisher.test.ts`

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
**Since:** 2026-09-28

The hello carries the agent's protocol version. Below the minimum the backend
accepts (today `1`), the connection is closed with `4002` and a reason naming
the version, before the contact is recorded or any configuration is sent. Any
version number is read, however old, so the agent always gets that answer
rather than a bare protocol error.

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
