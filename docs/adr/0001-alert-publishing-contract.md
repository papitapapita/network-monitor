# ADR 0001 — Alert Publishing Contract

## Status

Accepted — 2026-07-27

This is the first ADR in the repository. Component-level conventions live in
`docs/rules/*-STANDARD.md`; ADRs (`docs/adr/NNNN-title.md`) record cross-cutting
architectural decisions and the reasoning behind them.

## Context

Operational alerts reach the notification channel (Telegram) through several
bounded contexts. Before this decision the paths were inconsistent:

- **Wireless monitoring** owned a bespoke outbound port (`IWirelessAlertNotifier`)
  and an infrastructure adapter translating to the single renderer
  (`SendAlertNotificationUseCase`). Clean — no context imported another.
- **Device availability** (down / recovery) lived *inside* `application/notifications`,
  imported `domain/device-monitoring` events directly, and each use case
  formatted its own Telegram message and called `INotificationService.send()`
  directly — bypassing the single renderer.

Two problems followed:

1. **Coupling that grows with every producer.** Making the Notifications context
   subscribe to each producer's domain events means it imports every producer's
   domain. Adding a context (e.g. billing) would be another import into
   Notifications — O(N) coupling converging on one god-context.
2. **No enforced "notification language."** Each path formatted its own message,
   so tone, structure, and severity rendering could drift.

`AlertSeverity` (WARNING / CRITICAL) lived in `domain/notifications/enums`, and
wireless dodged importing it by passing a `'WARNING' | 'CRITICAL'` string union
translated in the adapter.

## Decision

Adopt **"Option B": each context decides _what_ to alert; everyone delegates
_how_ to deliver to one shared capability.** Concretely:

1. **Split WHAT from HOW.**
   - *WHAT* (which condition, which severity, which wording) stays in each
     producing context — it is that context's ubiquitous language.
   - *HOW* (formatting, escaping, channel, delivery) is a single generic
     capability every context shares.

2. **Shared vocabulary.** Promote `AlertSeverity` to the shared kernel
   (`domain/shared/enums`). It is genuine cross-context domain vocabulary
   (`Alert` already consumes it), so a shared type enforces one severity
   language instead of per-context string unions.

3. **One shared outbound port + neutral envelope**, in `application/shared/interfaces`:

   ```ts
   interface AlertNotification {
     deviceId: string; severity: AlertSeverity; source: string;
     subject: string; detail: string; occurredAt: Date; resolved: boolean;
   }
   interface IAlertPublisher {
     publish(notification: AlertNotification): Promise<Result<void>>;
   }
   ```

   A **single** `publish` (not `triggered`/`cleared`) — `resolved` already
   disambiguates. The envelope is deliberately **distinct** from
   `SendAlertNotificationDTO` (owned by Notifications); the infra adapter maps
   between them so `application/shared` never imports a context-owned type.

4. **One infra adapter** (`AlertPublisher`) implements `IAlertPublisher` by
   mapping the envelope to `SendAlertNotificationUseCase` — the single renderer
   that owns all Telegram formatting. This adapter is the only module allowed to
   know two application layers (the anti-corruption boundary).

5. **Producers own the mapping.** Each producing context's handler builds the
   envelope (its own `source` label, severity decision, wording) and calls
   `IAlertPublisher.publish`. **Reliability stays per-producer**: wireless keeps
   its `notifiedAt` persist-and-retry sweep; nothing about the port dictates
   delivery guarantees.

### Why these placements are load-bearing (not style)

- If the port lived in `application/notifications`, every producer would import
  Notifications — the exact coupling this removes. `application/shared` is the
  only zone every context's application layer may already depend on while
  depending on none of them (precedent: `ILogger`, `IUseCase`).
- If `AlertSeverity` stayed in `domain/notifications`, a producer would import
  `domain/notifications` just to type the envelope's severity — the same leak one
  layer down. Promoting it closes both holes with one move.

**Invariant:** nothing in `application/shared` may import any `application/<bc>`
or `domain/<bc>` folder (only `domain/shared`).

## Consequences

**Positive**
- Adding a future producer (billing, latency, …) is an O(1) copy of the pattern:
  a handler that maps its own event to the envelope + a one-line container wire.
  No Notifications edit.
- One renderer = one consistent notification language, structurally guaranteed
  rather than by convention.
- Contexts stay decoupled; the ACL lives in exactly one infra file.

**Negative / accepted trade-offs**
- Device down/recovery messages now render through the generic template
  (`🔴 ALERTA CRÍTICA …`) instead of their previous bespoke layout
  (`🔴 DISPOSITIVO FUERA DE LÍNEA`). **No information is lost** — consecutive
  failures, IP, offline duration, and alert id fold into `detail` — but the
  operator's up/down messages look different. This is the intended cost of one
  unified language.
- `application/shared/interfaces` now holds one alerting-shaped port beside pure
  technical ports (`ILogger`, `IUseCase`). Hold future additions to the same
  bar (consumed by 2+ contexts, imports nothing context-specific) so it does not
  become a dumping ground.

## Scope of the change that introduced this ADR

**In scope (implemented):** the shared vocabulary + port + envelope + adapter;
wireless and device down/recovery converged onto `IAlertPublisher`.

**Out of scope (deliberately not built):**
- **Moving the `Alert` aggregate** into device-monitoring. Device availability
  still keeps its `Alert` lifecycle (dedup, open/resolve) inside Notifications;
  only its *delivery* now goes through the port.
- **Suspension notices** — customer-facing WhatsApp via `ICustomerNotificationService`,
  a different channel and audience, not an operational alert.
- **A reliability sweep for `Alert`.** Device-down retry behavior is unchanged:
  a transient send failure is logged and not retried (unlike wireless, which
  persists `notifiedAt` and retries next cycle).
- **Alert-list visibility.** Wireless and device-down alerts still do not appear
  in `GET /api/alerts`; converging delivery does not change that.
- **The remaining direct cross-context imports.** The device-availability and
  suspension handlers still import other contexts' domain events directly. This
  decision stops *propagating* that pattern (new producers use the port); it does
  not retro-eliminate the existing instances.

## Alternatives considered

- **Notifications stays the subscriber-in-charge** (imports every producer's
  domain events, decides severity + formatting centrally). Rejected: O(N)
  coupling, pushes each context's decisions out of the context that owns them,
  turns Notifications into a god-context.
- **A per-context port each** (like the original `IWirelessAlertNotifier`, one
  per producer). Rejected: the envelope is already neutral, so per-context ports
  are boilerplate ×N with no added expressiveness. Producers keep their language
  in the *handler's mapping*, not in a bespoke port type.
- **Reuse `SendAlertNotificationDTO` as the port payload.** Rejected: it is
  owned by `application/notifications`; using it in the shared port would make
  `application/shared` import a context-owned type — the exact leak avoided here.
  Its identical shape today is coincidental, not contractual.
