# Service Enforcement — Business Rules

Making a suspension real. When a subscription moves to SUSPENDED (`CUS-067`),
something has to happen on the network — otherwise the status is a note in a
database and the subscriber keeps their bandwidth. This context writes a
throttling queue onto the edge router, removes it when service resumes, and
continuously reconciles what the router is actually doing against what the
database says it should be.

Format and conventions: [README.md](README.md).

## Is this a bounded context?

The README left this open. It is treated as one here, for three reasons:

- It owns a decision nothing else makes — _how_ a suspension is expressed on the
  network. Customers owns _whether_ a service is suspended and does not know a
  router exists.
- It has its own ubiquitous language (queue, enforcement, reconciliation,
  drift), its own outbound ports, and its own failure model.
- Its rules change for their own reasons. Moving from RouterOS queues to
  RADIUS disconnects would rewrite this file and touch nothing in `CUS-`.

What it does **not** have is a domain layer — there is no aggregate, no
repository, no persistence of its own. That is deliberate and is itself a rule
(`SVC-002`): the router is the store.

## ID ranges

| Range                 | Area                           |
| --------------------- | ------------------------------ |
| `SVC-001` … `SVC-019` | Shape of the context           |
| `SVC-020` … `SVC-039` | Enforcing a suspension         |
| `SVC-040` … `SVC-059` | Releasing a suspension         |
| `SVC-060` … `SVC-079` | The enforcement router         |
| `SVC-080` … `SVC-099` | Reconciliation                 |
| `SVC-100` … `SVC-119` | Reading enforcement state      |
| `SVC-120` … `SVC-139` | Cross-cutting (access control) |

## Layer coverage

| Layer                            | Rules |
| -------------------------------- | ----- |
| Infrastructure (orchestrator)    | 8     |
| Application (use case)           | 8     |
| Application (service)            | 4     |
| Application (event handler)      | 4     |
| Infrastructure (RouterOS client) | 2     |
| Presentation                     | 1     |

---

## Shape of the context

### SVC-001 — Enforcement reacts to a status change, it never decides one

**Type:** Policy · **Status:** Active
**Layer:** Application (event handler)
**Since:** 2026-08-05

The handler acts on `ContractedServiceStatusChangedEvent`: enforce on the way
into SUSPENDED, release on the way out. Nothing here suspends a service.

**Why:** Suspension is a commercial decision that belongs to the customers
context, where it can be audited and reversed by the office. If enforcement
could also decide, there would be two places a subscriber's service could be cut
and only one of them would show up in the subscription record.

**Enforced at:** `src/application/service-enforcement/event-handlers/ContractedServiceStatusChangedEnforcementHandler.ts`
**Tests:** `tests/application/service-enforcement/event-handlers/ContractedServiceStatusChangedEnforcementHandler.test.ts`

### SVC-002 — The router is the store; this context persists nothing

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

There is no table, no aggregate and no repository for enforcement. Whether a
service is enforced is answered by querying the router live (`SVC-100`).

**Why:** A local table recording "we enforced this" would be a second source of
truth that goes stale the moment someone edits a queue by hand, the router is
reimaged, or a write fails after the row was saved. Reading the router means the
answer cannot be wrong — at the cost of a network round trip per query, and of
being unavailable when the router is.

**Enforced at:** `src/application/service-enforcement/`
**Tests:** `tests/application/service-enforcement/use-cases/EnforcementStatusUseCases.test.ts`

### SVC-003 — A suspension queue is named for the subscription it enforces

**Type:** Invariant · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

`suspend-<contractedServiceId>`. The prefix is what identifies a queue as ours;
the id is what maps it back.

**Why:** This name is the only link between the router and the database — there
is no table holding the correspondence (`SVC-002`). It has to be derivable from
the subscription id alone, so that enforcing, releasing, checking and
reconciling all compute the same string without consulting anything.

The prefix carries a second responsibility: `SVC-085` deletes every `suspend-`
queue with no matching suspension, so **any manually created queue whose name
starts with `suspend-` will be removed within a minute.**

**Enforced at:** `src/application/service-enforcement/interfaces/IRouterQueueService.ts` (`suspensionQueueName`)
**Tests:** `tests/application/service-enforcement/use-cases/EnforceSuspensionUseCase.test.ts`

### SVC-004 — Enforcement reads device credentials through its own narrow port

**Type:** Policy · **Status:** Active
**Layer:** Application (service)
**Since:** 2026-08-05

`IDeviceCredentialsReader` exposes exactly `httpUsername` and `httpPassword` for
one device. The full credentials interface stays in device inventory.

**Why:** Enforcement needs to log into one router; it does not need the ability
to write credentials, and importing the device-inventory interface would give it
that. The narrow port is also what keeps `DEV-144`'s administrator-only
restriction meaningful — there is no path from here to changing a credential.

**Enforced at:** `src/application/service-enforcement/interfaces/IDeviceCredentialsReader.ts`
**Tests:** `tests/application/service-enforcement/services/EnforcementRouterResolver.test.ts`

---

## Enforcing a suspension

### SVC-020 — Only a SUSPENDED subscription can be enforced

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

The use case re-reads the subscription and refuses if its status is anything
else.

**Why:** The use case is reachable directly, not only through the event handler,
and a stale or replayed request could otherwise throttle a paying subscriber.
Re-reading rather than trusting the event is what makes the database the
authority on who is suspended.

**Enforced at:** `src/application/service-enforcement/use-cases/EnforceSuspensionUseCase.ts`
**Message:** `Contracted service is not suspended — nothing to enforce`
**Tests:** `tests/application/service-enforcement/use-cases/EnforceSuspensionUseCase.test.ts`

### SVC-021 — Enforcement needs the subscription's device and its IP

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

A subscription with no device, a missing device, or a device with no IP address
cannot be enforced.

**Why:** The queue throttles an IP address, so the subscriber's address is the
one input the router cannot do without. `CUS-069` and `CUS-070` mean an ACTIVE
service always has a device — but a service suspended from PENDING may not, so
this is reachable rather than theoretical.

**Enforced at:** `src/application/service-enforcement/use-cases/EnforceSuspensionUseCase.ts`
**Message:** `Contracted service has no device assigned — cannot resolve customer IP` /
`Customer device has no IP address`
**Tests:** `tests/application/service-enforcement/use-cases/EnforceSuspensionUseCase.test.ts`

### SVC-022 — Suspension throttles to 1 Mbit rather than cutting the line

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (RouterOS client)
**Since:** 2026-08-05

The queue is written with `max-limit=1k/1k` against the subscriber's `/32`.

**Why:** A suspended subscriber who can still load a page is a subscriber who
can be shown why they were suspended and can reach the ISP to pay. A hard block
produces a support call about an outage instead. It also means the device stays
reachable for monitoring, so the ping loop does not report a suspension as a
fault.

**Enforced at:** `src/infrastructure/service-enforcement/RouterOsQueueService.ts` (`SUSPENSION_MAX_LIMIT`)
**Tests:** `tests/infrastructure/service-enforcement/RouterOsQueueService.test.ts`

### SVC-023 — Enforcement targets a single address, never a range

**Type:** Invariant · **Status:** Active
**Layer:** Infrastructure (RouterOS client)
**Since:** 2026-08-05

The target is always written as `<ip>/32`, and a target read back from the
router is stripped of its mask and of any comma-separated extras before
comparison.

**Why:** RouterOS accepts a list of targets on one queue. A suspension queue
that acquired a second target — by hand, or by a mask wider than `/32` — would
throttle subscribers who owe nothing. Normalising on read is what lets
`SVC-084` notice the drift and recreate the queue.

**Enforced at:** `src/infrastructure/service-enforcement/RouterOsQueueService.ts` (`stripCidr`)
**Tests:** `tests/infrastructure/service-enforcement/RouterOsQueueService.test.ts`

---

## Releasing a suspension

### SVC-040 — Release removes the queue by name and asks no questions

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Unlike enforcement, release does not load the subscription, the device, or the
status — it computes the queue name from the id and deletes it.

**Why:** Deliberately asymmetric with `SVC-020`. The failure modes are not
equivalent: wrongly throttling a paying subscriber is a support incident, while
wrongly _not_ throttling one costs a little bandwidth. Release must therefore
work even when the subscription has been deleted, its device unassigned, or its
IP changed — all of which would make a validating release refuse and leave the
subscriber throttled with no way out.

**Enforced at:** `src/application/service-enforcement/use-cases/ReleaseSuspensionUseCase.ts`
**Tests:** `tests/application/service-enforcement/use-cases/ReleaseSuspensionUseCase.test.ts`

### SVC-041 — Leaving SUSPENDED for any status releases the queue

**Type:** Policy · **Status:** Active
**Layer:** Application (event handler)
**Since:** 2026-08-05

The handler releases whenever the previous status was SUSPENDED and the new one
is not — including a move to CANCELLED.

**Why:** Cancellation ends the relationship; it does not entitle the ISP to keep
throttling equipment that may be redeployed to someone else. Keying on the
transition out of SUSPENDED rather than on arrival at ACTIVE is what catches
that case.

**Enforced at:** `src/application/service-enforcement/event-handlers/ContractedServiceStatusChangedEnforcementHandler.ts`
**Tests:** `tests/application/service-enforcement/event-handlers/ContractedServiceStatusChangedEnforcementHandler.test.ts`

### SVC-042 — A re-suspension is not re-enforced, and a non-transition is ignored

**Type:** Policy · **Status:** Active
**Layer:** Application (event handler)
**Since:** 2026-08-05

The handler acts only when the status actually crossed the SUSPENDED boundary.
A change from PENDING to ACTIVE reaches it and does nothing.

**Why:** Complements `CUS-072` at the handler level. The aggregate already
refuses to emit an event for a no-op status change, so this guards against the
transitions that are real but irrelevant — every other status change in the
system flows through this same handler.

**Enforced at:** `src/application/service-enforcement/event-handlers/ContractedServiceStatusChangedEnforcementHandler.ts`
**Tests:** `tests/application/service-enforcement/event-handlers/ContractedServiceStatusChangedEnforcementHandler.test.ts`

---

## The enforcement router

### SVC-060 — There is exactly one enforcement router, named in configuration

**Type:** Policy · **Status:** Active
**Layer:** Application (service)
**Since:** 2026-08-05

Its device id and API port come from configuration; the resolver looks that
device up in the inventory to find its address and credentials.

**Why:** Naming the router by device id rather than by IP means its address and
credentials are maintained in one place — the device inventory — and enforcement
picks up a re-addressed router without a config change. The single-router
assumption is the real constraint: a second point of presence would need this
rule rewritten to choose a router per subscriber.

**Enforced at:** `src/application/service-enforcement/services/EnforcementRouterResolver.ts`
**Tests:** `tests/application/service-enforcement/services/EnforcementRouterResolver.test.ts`

### SVC-061 — The router must exist, have an IP, and have both credentials

**Type:** Policy · **Status:** Active
**Layer:** Application (service)
**Since:** 2026-08-05

Each failure returns its own message rather than one generic error.

**Why:** These are the four ways a deployment is misconfigured, and they are
indistinguishable from the outside — all four produce "suspensions are not being
enforced". Separate messages are what turn a silent failure into a fixable one.

**Enforced at:** `src/application/service-enforcement/services/EnforcementRouterResolver.ts`
**Message:** `Enforcement router device not found` /
`Enforcement router device has no IP address` /
`Enforcement router credentials not configured`
**Tests:** `tests/application/service-enforcement/services/EnforcementRouterResolver.test.ts`

### SVC-062 — The connection is resolved fresh for every operation

**Type:** Policy · **Status:** Active
**Layer:** Application (service)
**Since:** 2026-08-05

Nothing caches the resolved host, port or credentials.

**Why:** Credentials are rotated and routers are re-addressed. A cached
connection would keep failing until a restart, which is exactly the sort of
outage nobody attributes to the right cause. The cost is one extra database read
per enforcement operation, which is negligible against the router round trip
that follows.

**Enforced at:** `src/application/service-enforcement/services/EnforcementRouterResolver.ts`
**Tests:** `tests/application/service-enforcement/services/EnforcementRouterResolver.test.ts`

---

## Reconciliation

### SVC-080 — Router state is reconciled against the database every minute

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (orchestrator)
**Since:** 2026-08-05

The orchestrator runs immediately on start and then on a 60-second interval.

**Why:** This is what makes the whole context tolerant of failure. Every write
path here — the event handler, the router, the network in between — can fail,
and none of them retry (`SVC-081`). Convergence on a timer means the worst
outcome of any single failure is that enforcement is up to a minute late,
instead of permanently wrong.

**Enforced at:** `src/infrastructure/service-enforcement/orchestrator/SuspensionReconciliationOrchestrator.ts`
**Tests:** `tests/infrastructure/service-enforcement/orchestrator/SuspensionReconciliationOrchestrator.test.ts`

### SVC-081 — An enforcement failure is logged, never retried and never propagated

**Type:** Policy · **Status:** Active
**Layer:** Application (event handler)
**Since:** 2026-08-05

The handler logs and returns. It does not throw, does not retry, and does not
fail the status change that triggered it.

**Why:** The suspension has already been decided and recorded; the router being
unreachable does not un-decide it. Throwing would abort the transaction that
suspended the service, which would leave the subscription ACTIVE — the exact
opposite of what was intended. Retrying is unnecessary because `SVC-080` is the
retry, and a better one: it re-derives the desired state rather than repeating a
stale command.

**Enforced at:** `src/application/service-enforcement/event-handlers/ContractedServiceStatusChangedEnforcementHandler.ts`
**Tests:** `tests/application/service-enforcement/event-handlers/ContractedServiceStatusChangedEnforcementHandler.test.ts`

### SVC-082 — The desired state is every SUSPENDED subscription with a device and an IP

**Type:** Invariant · **Status:** Active
**Layer:** Infrastructure (orchestrator)
**Since:** 2026-08-05

A suspended subscription with no device, an unloadable device, or a device
without an IP is skipped with a warning rather than failing the pass.

**Why:** One unenforceable subscription must not stop the other hundred from
being reconciled. The warning is what keeps the skip from being silent — a
suspended subscriber who cannot be throttled is a revenue problem somebody
should see.

**Enforced at:** `src/infrastructure/service-enforcement/orchestrator/SuspensionReconciliationOrchestrator.ts` (`buildDesiredState`)
**Tests:** `tests/infrastructure/service-enforcement/orchestrator/SuspensionReconciliationOrchestrator.test.ts`

### SVC-083 — A missing queue is created

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (orchestrator)
**Since:** 2026-08-05

**Why:** Covers the enforcement that never landed — the router was down when the
suspension happened, or the process restarted mid-write.

**Enforced at:** `src/infrastructure/service-enforcement/orchestrator/SuspensionReconciliationOrchestrator.ts` (`reconcile`)
**Tests:** `tests/infrastructure/service-enforcement/orchestrator/SuspensionReconciliationOrchestrator.test.ts`

### SVC-084 — A queue pointing at the wrong address is recreated, not edited

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (orchestrator)
**Since:** 2026-08-05

Drift is repaired by removing the queue and adding it again.

**Why:** The subscriber's device was swapped or re-addressed while suspended, so
the old queue is now throttling whoever holds that address next. Recreating
rather than editing means the new queue is built by the same code path as any
other, with `SVC-022`'s limit and `SVC-023`'s single target — an in-place edit
could leave a stale field behind.

**Enforced at:** `src/infrastructure/service-enforcement/orchestrator/SuspensionReconciliationOrchestrator.ts` (`reconcile`)
**Tests:** `tests/infrastructure/service-enforcement/orchestrator/SuspensionReconciliationOrchestrator.test.ts`

### SVC-085 — A suspension queue with no suspension behind it is removed

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (orchestrator)
**Since:** 2026-08-05

Every `suspend-` queue on the router that is not in the desired set is deleted.

**Why:** This is what stops a subscriber staying throttled after paying, when
the release failed or was never attempted. It is also the sharpest edge in this
context: the orchestrator claims ownership of the entire `suspend-` namespace on
that router, so a queue an engineer creates by hand with that prefix is deleted
within the minute. See `SVC-003`.

**Enforced at:** `src/infrastructure/service-enforcement/orchestrator/SuspensionReconciliationOrchestrator.ts` (`reconcile`)
**Tests:** `tests/infrastructure/service-enforcement/orchestrator/SuspensionReconciliationOrchestrator.test.ts`

### SVC-086 — Reconciliation passes never overlap

**Type:** Invariant · **Status:** Active
**Layer:** Infrastructure (orchestrator)
**Since:** 2026-08-05

A tick arriving while the previous pass is still running returns immediately.

**Why:** A slow router can make a pass outlast its interval. Two concurrent
passes would race on the same queues — one adding what the other is removing —
and could leave the router in a state neither intended.

**Enforced at:** `src/infrastructure/service-enforcement/orchestrator/SuspensionReconciliationOrchestrator.ts` (`inFlight`)
**Tests:** `tests/infrastructure/service-enforcement/orchestrator/SuspensionReconciliationOrchestrator.test.ts`

### SVC-087 — An unreachable router aborts the pass without touching anything

**Type:** Invariant · **Status:** Active
**Layer:** Infrastructure (orchestrator)
**Since:** 2026-08-05

If the connection cannot be resolved or the queue list cannot be read, the pass
logs a warning and returns before making any change.

**Why:** The most dangerous possible bug here would be treating "I could not
read the queues" as "there are no queues" — `SVC-085` would then delete every
suspension on the router, restoring full bandwidth to every non-paying
subscriber at once. Returning before the comparison is what makes that
impossible.

**Enforced at:** `src/infrastructure/service-enforcement/orchestrator/SuspensionReconciliationOrchestrator.ts` (`reconcile`)
**Tests:** `tests/infrastructure/service-enforcement/orchestrator/SuspensionReconciliationOrchestrator.test.ts`

### SVC-088 — Shutdown waits for an in-flight pass, up to 30 seconds

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (orchestrator)
**Since:** 2026-08-05

**Why:** A pass killed between removing a queue and adding it back leaves a
subscriber unthrottled until the next start. The bounded wait is what keeps that
window closed without letting a hung router block shutdown indefinitely.

**Enforced at:** `src/infrastructure/service-enforcement/orchestrator/SuspensionReconciliationOrchestrator.ts` (`stop`)
**Tests:** `tests/infrastructure/service-enforcement/orchestrator/SuspensionReconciliationOrchestrator.test.ts`

---

## Reading enforcement state

### SVC-100 — Enforcement status is read live from the router

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Both the per-subscription check and the full listing query the router at request
time and stamp the answer with `checkedAt`.

**Why:** The point of these endpoints is to answer "is this actually enforced
right now", which a local record could not do (`SVC-002`). The timestamp is part
of the answer: it tells the reader how fresh it is, and makes clear that the
result is an observation rather than stored state.

**Enforced at:** `src/application/service-enforcement/use-cases/GetServiceEnforcementStatusUseCase.ts`,
`src/application/service-enforcement/use-cases/ListSuspensionEnforcementsUseCase.ts`
**Tests:** `tests/application/service-enforcement/use-cases/EnforcementStatusUseCases.test.ts`

### SVC-101 — An unenforced subscription is a successful answer, not an error

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

`enforced: false` with a null target IP.

**Why:** "Not throttled" is the normal state for most subscriptions. Reporting
it as a failure would make the endpoint unusable for the question it exists to
answer.

**Enforced at:** `src/application/service-enforcement/use-cases/GetServiceEnforcementStatusUseCase.ts`
**Tests:** `tests/application/service-enforcement/use-cases/EnforcementStatusUseCases.test.ts`

### SVC-102 — The listing derives subscription ids from queue names

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

The `suspend-` prefix is stripped from each queue name to recover the id.

**Why:** The direct consequence of `SVC-002` — the router holds the only record,
so the id has to be read back out of the name it was written into. It also means
the listing reports what the _router_ believes, including a queue for a
subscription that no longer exists. That is the point: such a queue is drift,
and seeing it is how it gets noticed before `SVC-085` clears it.

**Enforced at:** `src/application/service-enforcement/use-cases/ListSuspensionEnforcementsUseCase.ts`
**Tests:** `tests/application/service-enforcement/use-cases/EnforcementStatusUseCases.test.ts`

---

## Cross-cutting

### SVC-120 — Enforcement can be read but never driven over HTTP

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-08-05

| Endpoint                                       | Permission |
| ---------------------------------------------- | ---------- |
| `GET /api/enforcement/suspensions`             | `read`     |
| `GET /api/contracted-services/:id/enforcement` | `read`     |

There is no endpoint that enforces or releases a suspension.

**Why:** The only supported way to throttle a subscriber is to suspend their
subscription (`SVC-001`), which leaves a record in the subscription and notifies
them (`NOT-110`). An enforce endpoint would be a way to cut someone off with
none of that — invisible in the customer record and unexplained to the
subscriber. Read access is ungated beyond `read` because seeing which lines are
throttled is diagnostic, not privileged.

**Enforced at:** `src/presentation/http/routes/enforcement.routes.ts` (`authorize`)
**Tests:** `tests/presentation/http/controllers/EnforcementController.test.ts`
