# Probe Agents — Business Rules

An agent is the small program an ISP runs on a PC inside its own network. It
measures that network and reports to this backend, which a VPS could not reach
directly (ADR 0002). These rules cover how an agent gets its identity: an
administrator creates it, the installer pairs it with a one-time key, and an
administrator can revoke it.

Liveness (heartbeats, OFFLINE after 5 minutes), result ingest and the device
assignment arrive in later slices of ADR 0002 phase 1 and will extend this
file.

Format and conventions: [README.md](README.md).

## ID ranges

| Range                 | Area                           |
| --------------------- | ------------------------------ |
| `AGT-001` … `AGT-019` | Enrollment and identity        |
| `AGT-020` … `AGT-039` | Liveness (reserved, slice 1.5) |

## Layer coverage

A rule enforced in two layers counts in both.

| Layer                        | Rules |
| ---------------------------- | ----- |
| Domain                       | 6     |
| Application                  | 3     |
| Infrastructure (composition) | 3     |
| Presentation                 | 2     |

-------------- | ----- |
| Domain         | 5     |
| Application    | 1     |
| Infrastructure | 1     |
| Presentation   | 2     |

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

**Why:** ADR 0002, R3: a lost or retired PC must be cut off without touching
the customer's other agents. Keeping the record keeps its name and history
attributable. Closing a live connection when the agent is revoked arrives with
the WebSocket gateway (slice 1.5).

**Enforced at:** `src/domain/probe-agents/aggregates/Agent.ts` (`revoke`)
**Reached from:** `POST /api/agents/:id/revoke`
**Tests:** `tests/domain/probe-agents/aggregates/Agent.test.ts`, `tests/integration/use-cases/probe-agents/RevokeAgentUseCase.integration.test.ts`

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
