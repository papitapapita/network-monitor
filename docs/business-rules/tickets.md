# Tickets — Business Rules

Field work orders. A ticket is the unit of work a technician is dispatched to
do: what broke, who to call, which device, and where to go.

Format and conventions: [README.md](README.md).

## ID ranges

| Range                 | Area                               |
| --------------------- | ---------------------------------- |
| `TKT-001` … `TKT-039` | Ticket identity, content and links |
| `TKT-040` … `TKT-069` | Status machine and terminal states |
| `TKT-070` … `TKT-089` | Assignment and scheduling          |
| `TKT-090` … `TKT-109` | Technician                         |
| `TKT-110` … `TKT-129` | Alert origin and deduplication     |

## Layer coverage

| Layer                             | Rules |
| --------------------------------- | ----- |
| Domain (aggregate)                | 23    |
| Domain (value object)             | 6     |
| Application                       | 6     |
| Application + database constraint | 4     |
| Infrastructure (database)         | 1     |

Most rules live in the `Ticket` aggregate, which owns the status machine. The
departures are deliberate:

- **Uniqueness** (`TKT-095`, `TKT-096`) cannot be checked inside an aggregate —
  it is a statement about the whole table. Checked in the use case, backed by a
  unique index so a race cannot slip past.
- **Referential refusal** (`TKT-097`) needs a count across another aggregate, so
  it is a use-case policy.
- **Technician availability** (`TKT-077`) is a fact about a different aggregate;
  the ticket cannot see it.
- **The ticket code** (`TKT-006`) is a database sequence. Nothing else can
  allocate a gapless, collision-free number under concurrency.
- **Deduplication** (`TKT-113`) is a query over existing tickets, so it belongs
  to the use case that opens them.

---

## Ticket identity, content and links

### TKT-001 — A ticket must have a title

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

Every ticket carries a non-empty title.

**Why:** The title is what the technician reads on a list of ten jobs. A ticket
with no title forces them to open every one to find out what it is.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`validate`)
**Reached from:** `create`, `updateDetails`
**Message:** `Ticket title cannot be empty`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`

### TKT-002 — A ticket title cannot exceed 150 characters

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

**Why:** The title is a label, not the report. The description carries the
detail, and the column is sized to match.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`validate`)
**Reached from:** `create`, `updateDetails`
**Backed by:** `Ticket.title @db.VarChar(150)` in `prisma/schema.prisma`
**Message:** `Ticket title cannot exceed 150 characters`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`

### TKT-003 — A ticket must have a description

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

**Why:** The description is the suspected failure. Without it the technician
arrives knowing only that something is wrong.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`validate`)
**Reached from:** `create`, `updateDetails`
**Message:** `Ticket description cannot be empty`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`

### TKT-004 — A ticket must reference a customer or a device

**Type:** Invariant · **Status:** Removed
**Since:** 2026-08-04 · **Removed:** 2026-09-25

At least one of `customerId` or `deviceId` had to be set.

**Why it was removed:** Tickets became general field tasks. A site survey for a
prospect has no customer record yet, and an internal errand ("buy connectors")
has neither a customer nor a device. The rule refused both. See [TKT-011] for
what replaced it: nothing is required beyond a title and a description, and a
prospect is recorded as a contact snapshot ([TKT-012]).

### TKT-005 — A new ticket opens unassigned

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

A freshly created ticket is `OPEN`, has no technician, and has no assignment,
start, resolution or cancellation timestamp.

**Why:** Creating a ticket records that work is needed; deciding who does it is
a separate act. Assigning at creation time is a convenience the use case offers,
but it still runs through `assign()` so the transition and its event look
identical either way.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`create`)
**Reached from:** `create`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`

### TKT-006 — Every ticket receives a unique sequential code

**Type:** Invariant · **Status:** Active
**Layer:** Infrastructure (database sequence)
**Since:** 2026-08-04

Each ticket is assigned an integer `code`, unique across all tickets, allocated
on insert.

**Why:** The UUID is for machines. When a technician phones the office about a
job, they need a number a human can say out loud. A database sequence is the
only allocator that stays collision-free under concurrent inserts, which is why
the aggregate leaves `code` null until the row is written.

**Enforced at:** `prisma/schema.prisma` (`Ticket.code @unique @default(autoincrement())`)
**Reached from:** `PrismaTicketRepository.save`
**Tests:** `tests/integration/ticket.routes.test.ts`

### TKT-007 — A service address requires a street, a municipality and a neighborhood

**Type:** Validation · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-08-04

A ticket's address is optional as a whole, but a partial one is refused: all
three parts must be present together or all absent. Coordinates or an address
reference without them are also refused.

**Why:** A street with no municipality is not something a technician can
navigate to. Half an address is worse than none, because it looks usable.

**Enforced at:** `src/domain/tickets/value-objects/ServiceAddress.ts`
**Reached from:** `ServiceAddress.create`, `ServiceAddress.createOptional`
**Message:** `An address requires a street, municipality, and neighborhood`
**Tests:** `tests/domain/tickets/value-objects/ServiceAddress.test.ts`, `tests/integration/ticket.routes.test.ts`

### TKT-008 — Ticket coordinates must be a valid WGS-84 pair

**Type:** Validation · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-08-04

Latitude and longitude are supplied together or not at all; latitude must be
within ±90, longitude within ±180, and both must be finite.

**Why:** One coordinate without the other cannot be put on a map, and an
out-of-range value silently drops the pin in the ocean.

**Enforced at:** `src/domain/tickets/value-objects/ServiceAddress.ts` (`validateCoordinates`)
**Reached from:** `ServiceAddress.create`, `ServiceAddress.createOptional`
**Message:** `Coordinates require both a latitude and a longitude`
**Tests:** `tests/domain/tickets/value-objects/ServiceAddress.test.ts`

### TKT-009 — A resolved ticket cannot be modified

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

Once `RESOLVED`, no field may change: not the title, the links, the address, the
schedule, the assignment, nor the status.

**Why:** A closed ticket is the record of what was done. Editing it after the
fact rewrites history that other people have already acted on.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`ensureMutable`)
**Reached from:** `assign`, `schedule`, `start`, `resolve`, `updateDetails`, `updateLinks`, `changeAddress`
**Message:** `Cannot modify a resolved ticket`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`, `tests/domain/tickets/value-objects/TicketStatus.test.ts`

### TKT-010 — A cancelled ticket cannot be modified

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

**Why:** Same reason as [TKT-009]: a terminal ticket is history. Work that needs
doing after a cancellation is a new ticket, which keeps the reason for the
cancellation legible.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`ensureMutable`)
**Reached from:** `assign`, `schedule`, `start`, `resolve`, `updateDetails`, `updateLinks`, `changeAddress`
**Message:** `Cannot modify a cancelled ticket`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`, `tests/domain/tickets/value-objects/TicketStatus.test.ts`

### TKT-011 — A ticket needs no customer, device or contact

**Type:** Policy · **Status:** Active
**Layer:** None — a deliberate absence of a check
**Since:** 2026-09-25

Beyond a title and a description ([TKT-001], [TKT-003]), a manual ticket may
reference any combination of a customer, a device and an on-site contact —
including none of them. Unlinking both the customer and the device from an
existing ticket is allowed.

**Why:** A ticket is any task on a technician's calendar, not only a repair.
Some tasks are about people who are not customers yet (a site survey), and some
are about nobody at all (buying stock, renewing a tower lease). The description
already tells the technician what to do; demanding a link would force the
office to invent one. Tickets opened from an alert still need their device
([TKT-111]).

**Replaces:** [TKT-004]
**Enforced at:** — (absence of a check in `Ticket.validate` and `createTicketSchema`)
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`, `tests/application/tickets/use-cases/UpdateTicketUseCase.test.ts`, `tests/presentation/http/validation/ticket.schemas.test.ts`, `tests/integration/use-cases/tickets/CreateTicketUseCase.integration.test.ts`, `tests/integration/use-cases/tickets/UpdateTicketUseCase.integration.test.ts`, `tests/integration/ticket.routes.test.ts`

### TKT-012 — An on-site contact needs a name; the phone is optional

**Type:** Validation · **Status:** Active
**Layer:** Domain (value object) + database constraint
**Since:** 2026-09-25

A ticket's contact is a free-text snapshot: a name of 1–150 characters and, if
given, a phone number with 7–15 digits (normalised the same way as a
technician's phone). A phone without a name is refused.

**Why:** The contact exists for prospects, who have no customer record to link
to. It is copied onto the ticket, like the service address and the
quotation's customer details, so the ticket keeps who was visited even after
the prospect signs up and the ticket is linked to their new customer record.
The name is what the technician asks for at the door; a bare number tells them
nobody to ask for. The phone stays optional because a walk-in may leave only a
name and an address.

**Enforced at:** `src/domain/tickets/value-objects/TicketContact.ts`, `src/presentation/http/validation/ticket.schemas.ts`
**Reached from:** `CreateTicketUseCase`, `UpdateTicketUseCase` (`Ticket.changeContact`)
**Backed by:** `tickets_contact_phone_requires_name` CHECK constraint, migration `20260925233208`
**Message:** `Contact name cannot be empty`
**Tests:** `tests/domain/tickets/value-objects/TicketContact.test.ts`, `tests/application/tickets/use-cases/UpdateTicketUseCase.test.ts`, `tests/presentation/http/validation/ticket.schemas.test.ts`, `tests/integration/use-cases/tickets/CreateTicketUseCase.integration.test.ts`, `tests/integration/use-cases/tickets/UpdateTicketUseCase.integration.test.ts`

---

## Status machine

The permitted path:

```
OPEN ──assign──▶ ASSIGNED ──start──▶ IN_PROGRESS ──resolve──▶ RESOLVED
 │                  │                    │
 └──────────────────┴───────cancel───────┴──────────────────▶ CANCELLED
```

### TKT-040 — Only an assigned ticket can be started

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

`start()` is refused unless the ticket is `ASSIGNED`, and refused if no
technician is attached.

**Why:** `IN_PROGRESS` means a named person is on site right now. A ticket
nobody owns cannot be in progress, and the day sheet would have no one to show
it to.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`start`)
**Reached from:** `start`
**Message:** `Only an assigned ticket can be started`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`, `tests/integration/ticket.routes.test.ts`

### TKT-041 — A ticket cannot be started twice

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

**Why:** `startedAt` is when the work began. Restarting would overwrite it and
lose how long the job has actually been running.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`start`)
**Reached from:** `start`
**Message:** `Ticket is already in progress`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`

### TKT-042 — A ticket cannot be resolved before it is assigned

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

`resolve()` is refused while the ticket is `OPEN`. Resolving straight from
`ASSIGNED` is allowed — plenty of faults are fixed remotely without a visit.

**Why:** An `OPEN` ticket has nobody attached to it, so there is no one whose
work the resolution notes would be describing.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`resolve`)
**Reached from:** `resolve`
**Message:** `Cannot resolve a ticket that has not been assigned`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`

### TKT-043 — Resolving a ticket requires resolution notes

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

**Why:** The notes are the only record of what was actually done. Without them a
repeat fault three months later starts from nothing.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`resolve`)
**Reached from:** `resolve`
**Message:** `Resolution notes are required to resolve a ticket`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`, `tests/integration/ticket.routes.test.ts`

### TKT-044 — Cancelling a ticket requires a reason

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

A non-empty reason of at most 255 characters.

**Why:** A cancelled ticket with no reason is indistinguishable from one dropped
by mistake, and the same fault will be reported again next week.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`cancel`)
**Reached from:** `cancel`
**Backed by:** `Ticket.cancelReason @db.VarChar(255)` in `prisma/schema.prisma`
**Message:** `A reason is required to cancel a ticket`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`

### TKT-045 — A resolved ticket cannot be cancelled

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

**Why:** The work is already done. Cancelling it would erase a completed job
from the record.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`cancel`)
**Reached from:** `cancel`
**Message:** `Cannot cancel a resolved ticket`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`, `tests/integration/ticket.routes.test.ts`

### TKT-046 — A ticket cannot be cancelled twice

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

**Why:** `cancelledAt` and the reason record the first decision. A second
cancellation would overwrite both with no gain.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`cancel`)
**Reached from:** `cancel`
**Message:** `Ticket is already cancelled`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`

### TKT-047 — Every status transition emits a status-changed event

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

`start`, `resolve` and `cancel` always emit `TicketStatusChangedEvent`. `assign`
emits one only when the status actually moves, so reassigning an already
assigned ticket does not.

**Why:** Anything that reacts to ticket progress — dashboards, future SLA
timers — subscribes to this event. A silent transition is invisible to all of
them. Reassignment is excluded because the status did not change; the
assignment event covers it.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`transitionTo`, `assign`)
**Reached from:** `assign`, `start`, `resolve`, `cancel`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`

---

## Assignment and scheduling

### TKT-070 — Assigning a ticket moves it to ASSIGNED and stamps the time

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

**Why:** Assignment is the moment the job enters someone's day. The timestamp is
what makes "sitting unassigned for two days" measurable.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`assign`)
**Reached from:** `assign`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`, `tests/integration/ticket.routes.test.ts`

### TKT-071 — A ticket may be reassigned until work starts

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

An `OPEN` or `ASSIGNED` ticket can be assigned to a different technician, which
re-stamps `assignedAt`.

**Why:** Dispatchers rebalance the day constantly — someone calls in sick, a job
turns out to be closer to another van. Nothing has happened yet, so nothing is
lost.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`assign`)
**Reached from:** `assign`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`

### TKT-072 — A ticket in progress cannot be reassigned

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

**Why:** Someone is on site. Silently swapping the technician mid-visit loses
who did what, and the resolution notes would end up attributed to the wrong
person. Hand-overs go through resolve or cancel, which keeps both halves on the
record.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`assign`)
**Reached from:** `assign`
**Message:** `Cannot reassign a ticket that is already in progress`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`

### TKT-073 — A terminal ticket cannot be assigned

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

**Why:** A specialisation of [TKT-009] and [TKT-010]. Dispatching a closed job
would put work on a technician's day sheet that nobody expects them to do.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`ensureMutable`)
**Reached from:** `assign`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`

### TKT-074 — A terminal ticket cannot be rescheduled

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

**Why:** Same as [TKT-073]. A resolved job has no future visit to move.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`ensureMutable`)
**Reached from:** `schedule`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`

### TKT-075 — A ticket may be scheduled for a date in the past

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

Scheduling accepts any calendar date, including one already gone.

**Why:** Deliberately permissive. Work done off the books gets entered
afterwards, and refusing a past date would force the office to lie about when
the visit happened.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`schedule`)
**Reached from:** `schedule`, `assign`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`

### TKT-076 — The day sheet puts booked visits first, then the most urgent

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-04 · **Revised:** 2026-09-25

A technician's tasks for a date come back in two groups. Tickets with a time
block ([TKT-078]) come first, earliest start first. Tickets without one follow,
ordered by priority — `URGENT`, `HIGH`, `NORMAL`, `LOW` — and oldest first
within a priority.

**Why:** The day sheet is a work queue, not a list. The order is the
instruction: do this one next. A time block is a promise made to a customer, so
it cannot be pushed back by an urgent job that has no fixed time; those fill
the gaps between appointments. Falling back to age within a priority stops a job
from being permanently overtaken by newer ones at the same level.

**Enforced at:** `src/application/tickets/use-cases/GetTechnicianDayUseCase.ts`
**Reached from:** `GetTechnicianDayUseCase.execute`
**Tests:** `tests/application/tickets/use-cases/GetTechnicianDayUseCase.test.ts`, `tests/integration/use-cases/tickets/GetTechnicianDayUseCase.integration.test.ts`, `tests/domain/tickets/value-objects/TicketPriority.test.ts`, `tests/integration/ticket.routes.test.ts`

**History — time blocks were added on 2026-09-25.** Before then every ticket
was "any time that day" and the order was priority alone.

### TKT-077 — A ticket can only be assigned to an active technician

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-04

**Why:** A deactivated technician has left the rota. Dispatching to them
produces a job nobody is going to do, and it will sit unnoticed on a day sheet
no one reads. Enforced in the use case because the ticket aggregate cannot see
the technician aggregate.

**Enforced at:** `src/application/tickets/use-cases/AssignTicketUseCase.ts`, `CreateTicketUseCase.ts`
**Reached from:** `AssignTicketUseCase.execute`, `CreateTicketUseCase.execute`
**Message:** `Cannot assign a ticket to an inactive technician`
**Tests:** `tests/integration/ticket.routes.test.ts`

### TKT-078 — A time block ends after it starts, on the same day

**Type:** Validation · **Status:** Active
**Layer:** Domain (value object) + database constraint
**Since:** 2026-09-25

A time block is a start and an end, each a wall-clock `HH:mm` ([SHR-062]). The
end must be strictly later than the start, so a zero-length block is refused and
so is an overnight one such as `22:00`–`02:00`.

**Why:** A block belongs to exactly one scheduled day. Letting it run past
midnight would put half the visit on a day the ticket is not scheduled for, and
the day sheet for that second day would never show it. The times are stored as
wall-clock text rather than timestamps so the block cannot drift onto a
neighbouring date when converted to or from UTC.

**Enforced at:** `src/domain/tickets/value-objects/TimeBlock.ts`
**Backed by:** `tickets_time_block_end_after_start` CHECK constraint, migration `20260925195608`
**Message:** `Time block end must be later than its start`
**Tests:** `tests/domain/tickets/value-objects/TimeBlock.test.ts`, `tests/application/tickets/use-cases/ScheduleTicketUseCase.test.ts`, `tests/integration/use-cases/tickets/ScheduleTicketUseCase.integration.test.ts`, `tests/integration/ticket.routes.test.ts`

### TKT-079 — A time block requires a scheduled day

**Type:** Invariant · **Status:** Active
**Layer:** Domain + database constraint
**Since:** 2026-09-25

A ticket can have a day and no block ("any time that day"), or a day and a
block, but never a block with no day. Clearing the day clears the block with it.

**Why:** `10:00`–`12:00` on no particular day is not an appointment. Accepting
it would leave a ticket that looks booked on a calendar and appears on no day
sheet.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`validate`, `assign`)
**Reached from:** `create`, `schedule`, `assign`
**Backed by:** `tickets_time_block_requires_date` CHECK constraint, migration `20260925195608`
**Message:** `A scheduled date is required for a time block`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`, `tests/application/tickets/use-cases/AssignTicketUseCase.test.ts`, `tests/application/tickets/use-cases/CreateTicketUseCase.test.ts`, `tests/integration/use-cases/tickets/ScheduleTicketUseCase.integration.test.ts`, `tests/integration/ticket.routes.test.ts`

### TKT-080 — Start and end times are given together or not at all

**Type:** Validation · **Status:** Active
**Layer:** Application + database constraint
**Since:** 2026-09-25

A request that sends `startTime` without `endTime`, or the reverse, is refused.
It is not read as "no block".

**Why:** A half-sent block is a client mistake. Treating it as "any time that
day" would silently discard the time the dispatcher typed and book the visit
for the whole day instead.

**Enforced at:** `src/application/tickets/use-cases/calendar-date.ts` (`parseTimeBlock`), `src/presentation/http/validation/ticket.schemas.ts`
**Reached from:** `CreateTicketUseCase`, `AssignTicketUseCase`, `ScheduleTicketUseCase`
**Backed by:** `tickets_time_block_both_or_neither` CHECK constraint, migration `20260925195608`
**Message:** `startTime and endTime must be provided together`
**Tests:** `tests/application/tickets/use-cases/ScheduleTicketUseCase.test.ts`, `tests/presentation/http/validation/ticket.schemas.test.ts`, `tests/integration/use-cases/tickets/ScheduleTicketUseCase.integration.test.ts`, `tests/integration/ticket.routes.test.ts`

### TKT-081 — Rescheduling replaces the whole schedule

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-09-25

Setting a new day without a block leaves the ticket with no block, even if it
had one before. This applies to `schedule` and to `assign` when a day is passed.
`assign` without a day keeps the existing day and block untouched.

**Why:** Carrying the old block over to a new day would book an appointment
time nobody chose for that day. Making every schedule call state the full
schedule keeps a calendar drag or resize to one call with no hidden leftovers.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`schedule`, `assign`)
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`, `tests/application/tickets/use-cases/ScheduleTicketUseCase.test.ts`, `tests/integration/use-cases/tickets/ScheduleTicketUseCase.integration.test.ts`

### TKT-082 — Overlapping time blocks are allowed

**Type:** Policy · **Status:** Active
**Layer:** None — a deliberate absence of a check
**Since:** 2026-09-25

Two active tickets for the same technician may have blocks that overlap on the
same day. Nothing checks for it.

**Why:** A deliberate choice. Short jobs at the same address, a two-stop run
booked as one window, or a dispatcher double-booking on purpose to cover a
likely no-show are all legitimate. The calendar view is the place to flag an
overlap, where a person can judge it; refusing it here would block legitimate
bookings.

**Enforced at:** — (absence of a check)
**Tests:** `tests/integration/use-cases/tickets/ScheduleTicketUseCase.integration.test.ts`

---

## Technician

### TKT-090 — A technician must have a name

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

**Why:** The name is what appears on the ticket and in the dispatcher's list.
There is no other human-readable identifier — a technician need not have a login
account.

**Enforced at:** `src/domain/tickets/aggregates/Technician.ts` (`validate`)
**Reached from:** `create`, `rename`, `changePhone`, `changeEmail`
**Message:** `Technician name cannot be empty`
**Tests:** `tests/domain/tickets/aggregates/Technician.test.ts`

### TKT-091 — A technician name cannot exceed 150 characters

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

**Why:** Matches the column width and the customer name limit.

**Enforced at:** `src/domain/tickets/aggregates/Technician.ts` (`validate`)
**Reached from:** `create`, `rename`
**Backed by:** `Technician.fullName @db.VarChar(150)` in `prisma/schema.prisma`
**Message:** `Technician name cannot exceed 150 characters`
**Tests:** `tests/domain/tickets/aggregates/Technician.test.ts`

### TKT-092 — A technician must have a phone number

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

**Why:** The phone is how the office reaches a technician mid-round, and how job
notices are delivered. It is also their natural key — see [TKT-095].

**Enforced at:** `src/domain/tickets/aggregates/Technician.ts` (`validate`)
**Reached from:** `create`, `changePhone`
**Tests:** `tests/domain/tickets/aggregates/Technician.test.ts`

### TKT-093 — A technician email must be well formed

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

The email is optional. When supplied it must look like an address and is
normalised to lowercase.

**Why:** Optional because the phone is the channel that matters. Normalised
because case-varying duplicates would defeat [TKT-096].

**Enforced at:** `src/domain/tickets/aggregates/Technician.ts` (`validate`, `changeEmail`)
**Reached from:** `create`, `changeEmail`
**Message:** `Technician email must be a valid email address`
**Tests:** `tests/domain/tickets/aggregates/Technician.test.ts`

### TKT-094 — A technician is active on creation

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

**Why:** Someone being added to the system is someone who is about to be given
work. Requiring a second activation step would only produce technicians who
cannot be dispatched for no reason.

**Enforced at:** `src/domain/tickets/aggregates/Technician.ts` (`create`)
**Reached from:** `create`
**Backed by:** `Technician.isActive @default(true)` in `prisma/schema.prisma`
**Tests:** `tests/domain/tickets/aggregates/Technician.test.ts`

### TKT-095 — Technician phone numbers are unique

**Type:** Invariant · **Status:** Active
**Layer:** Application + database constraint (not in domain)
**Since:** 2026-08-04

No two technicians may share a phone number. On update a technician may keep
their own — only a collision with a _different_ technician is rejected.

**Why:** The phone is the technician's natural key: it is how the office
identifies them and where job notices go. Two people sharing one makes both
ambiguous. Not in the domain because uniqueness is a statement about the whole
table, which an aggregate cannot see.

**Enforced at:** `src/application/tickets/use-cases/CreateTechnicianUseCase.ts`, `UpdateTechnicianUseCase.ts`
**Backed by:** `Technician.phone @unique` in `prisma/schema.prisma`
**Message:** `A technician with phone "<phone>" already exists`
**Tests:** `tests/integration/technician.routes.test.ts`

### TKT-096 — Technician emails are unique when present

**Type:** Invariant · **Status:** Active
**Layer:** Application + database constraint (not in domain)
**Since:** 2026-08-04

**Why:** Same reasoning as [TKT-095]. Null emails do not collide, so any number
of technicians may have none.

**Enforced at:** `src/application/tickets/use-cases/CreateTechnicianUseCase.ts`, `UpdateTechnicianUseCase.ts`
**Backed by:** `Technician.email @unique` in `prisma/schema.prisma`
**Message:** `A technician with email "<email>" already exists`
**Tests:** `tests/integration/use-cases/tickets/CreateTechnicianUseCase.integration.test.ts`

### TKT-097 — A technician who has tickets cannot be deleted

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-04

Deletion is refused while any ticket references the technician. Deactivation
([TKT-094]'s inverse) is the way to take someone off the rota.

**Why:** The foreign key is `SET NULL`, so deleting would silently blank the
technician on every ticket they ever worked, erasing who did what. Refusing and
pointing at deactivation keeps the history and still stops new dispatches.

**Enforced at:** `src/application/tickets/use-cases/DeleteTechnicianUseCase.ts`
**Message:** `Cannot delete a technician with <n> ticket(s); deactivate them instead`
**Tests:** `tests/integration/technician.routes.test.ts`

---

## Alert origin and deduplication

### TKT-110 — A ticket opened from an alert must reference that alert

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

When `origin` is `DEVICE_ALERT` or `WIRELESS_ALERT`, `originAlertId` must be
present and a valid UUID.

**Why:** It is the link back to the fault that caused the job, and the key that
stops the same alert raising a second ticket ([TKT-113]). It is deliberately not
a foreign key: it points at `alert_events` or `wireless_alert_records` depending
on origin, which no single FK can express.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`validate`)
**Reached from:** `create`
**Message:** `A ticket opened from an alert must reference the originating alert`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`, `tests/domain/tickets/value-objects/TicketOrigin.test.ts`

### TKT-111 — A ticket opened from an alert must reference a device

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

**Why:** Every alert in this system is raised against a device. A ticket that
lost that link would send a technician to a customer with no idea which box to
look at.

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`validate`)
**Reached from:** `create`
**Message:** `A ticket opened from an alert must reference a device`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`

### TKT-112 — A manually created ticket cannot reference an alert

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-04

**Why:** `origin` is what tells the office whether a human or the monitoring
system raised this. A `MANUAL` ticket carrying an alert id makes that answer
unreadable, and would let a hand-made ticket suppress a real alert's own via
[TKT-113].

**Enforced at:** `src/domain/tickets/aggregates/Ticket.ts` (`validate`)
**Reached from:** `create`
**Message:** `A manually created ticket cannot reference an originating alert`
**Tests:** `tests/domain/tickets/aggregates/Ticket.test.ts`, `tests/domain/tickets/value-objects/TicketOrigin.test.ts`

### TKT-113 — An alert raises at most one live ticket per device

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-04

Two levels of deduplication before an alert-origin ticket is created:

1. If a non-terminal ticket already exists for that exact alert id, it is
   returned unchanged.
2. If the device already has any non-terminal alert-origin ticket, that one is
   returned instead.

**Why:** Monitoring re-emits an alert every poll while the fault persists, and a
single failing device typically breaches several metrics at once. Without both
checks one dead antenna becomes dozens of jobs on a technician's day sheet.
Level 2 is the product rule that matters: a device with five breaching metrics
is still one site visit.

**Enforced at:** `src/application/tickets/use-cases/OpenTicketFromAlertUseCase.ts`
**Tests:** `tests/integration/use-cases/tickets/OpenTicketFromAlertUseCase.integration.test.ts`

### TKT-114 — Alert severity sets the ticket's priority

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-04

`CRITICAL` becomes `URGENT`; every other severity becomes `HIGH`.

**Why:** `CRITICAL` means a paying customer is off-service right now, which
outranks anything scheduled. Nothing arriving from monitoring is routine, so the
floor is `HIGH` rather than `NORMAL` — a human can always lower it.

**Enforced at:** `src/application/tickets/use-cases/OpenTicketFromAlertUseCase.ts` (`mapSeverity`)
**Tests:** `tests/application/tickets/use-cases/OpenTicketFromAlertUseCase.test.ts`
