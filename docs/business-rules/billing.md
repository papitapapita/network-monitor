# Billing — Business Rules

What a subscriber owes for a month. A `Bill` is a customer, a billing period, and
one immutable line item per active subscription, priced at the moment the bill
was cut.

The context also issues **cuentas de cobro** (`CollectionAccount`): one-off
charges for work outside the internet service — a camera install, equipment, a
repair visit. They share nothing with `Bill` but the context: free-text line
items, no period, no subscription, and no effect on service
(`BIL-200` … `BIL-251`).

Format and conventions: [README.md](README.md).

## ID ranges

| Range                 | Area                            |
| --------------------- | ------------------------------- |
| `BIL-001` … `BIL-029` | Bill identity, period and dates |
| `BIL-030` … `BIL-049` | Line items and totals           |
| `BIL-050` … `BIL-079` | Status machine                  |
| `BIL-080` … `BIL-099` | Generation, single and bulk     |
| `BIL-100` … `BIL-119` | PDF rendering                   |
| `BIL-120` … `BIL-139` | Listing and filtering           |
| `BIL-140` … `BIL-159` | Cross-cutting (access control)  |
| `BIL-200` … `BIL-259` | Cuentas de cobro                |
| `BIL-260` … `BIL-279` | Bank accounts                   |

## Layer coverage

| Layer                     | Rules |
| ------------------------- | ----- |
| Application               | 25    |
| Domain (aggregate)        | 28    |
| Domain (value object)     | 7     |
| Presentation              | 5     |
| Infrastructure (database) | 7     |
| Infrastructure (PDF)      | 1     |
| Infrastructure (config)   | 1     |

More of this context lives in the application layer than in any other, and the
reason is structural: a bill is assembled from three other aggregates it cannot
see. Which subscriptions are active, what each plan costs today, and whether
this customer has already been billed for March are all facts outside `Bill`.
What `Bill` owns is what a bill _is_ once assembled — its status machine, its
totals, and the refusal to exist without a line item.

Money arithmetic is not declared here. `Money` is shared-kernel and its rules
live in [shared.md](shared.md) (`SHR-040` … `SHR-045`).

Authentication, roles and rate limiting are declared in
[identity.md](identity.md). `BIL-140` records only this context's permission map.

---

## Bill identity, period and dates

### BIL-001 — A bill must name a customer

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

**Why:** A bill with no debtor is not a bill. Everything downstream — the PDF,
the payment, the eventual suspension for non-payment — starts from who owes it.

**Enforced at:** `src/domain/billing/aggregates/Bill.ts` (`validate`)
**Reached from:** `create`, `markPaid`, `markOverdue`, `cancel`
**Message:** `customerId is null or undefined`
**Tests:** `tests/domain/billing/aggregates/Bill.test.ts`

### BIL-002 — A bill must name a billing period

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

**Why:** The period is what makes two bills for the same customer different
documents rather than a duplicate. It is also the key `BIL-007` deduplicates on.

**Enforced at:** `src/domain/billing/aggregates/Bill.ts` (`validate`)
**Reached from:** `create`, `markPaid`, `markOverdue`, `cancel`
**Message:** `period is null or undefined`
**Tests:** `tests/domain/billing/aggregates/Bill.test.ts`

### BIL-003 — A billing period is a month of a year between 2000 and 2100

**Type:** Validation · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-08-05

Both the year and the month must be whole numbers; the month is 1 to 12.

**Why:** The bounds are a typo net, not a business limit — they catch a year
typed as `20025` or a month as `0`, which would otherwise produce a bill nobody
would ever find again. The window comfortably outlives the system.

**Enforced at:** `src/domain/billing/value-objects/BillingPeriod.ts` (`create`)
**Message:** `year must be an integer between 2000 and 2100` /
`month must be an integer between 1 and 12`
**Tests:** `tests/domain/billing/value-objects/BillingPeriod.test.ts`

### BIL-004 — A billing period is written `YYYY-MM`

**Type:** Policy · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-08-05

The month is zero-padded. `fromString` accepts exactly this shape and nothing
else — not `2026-7`, not `07/2026`.

**Why:** The string form appears in the PDF file name (`BIL-101`), in duplicate
messages, and in the bulk-generation response. One spelling means those sort
correctly and compare as text.

**Enforced at:** `src/domain/billing/value-objects/BillingPeriod.ts` (`fromString`, `toString`)
**Message:** `Invalid billing period format: <value>. Expected 'YYYY-MM'.`
**Tests:** `tests/domain/billing/value-objects/BillingPeriod.test.ts`

### BIL-005 — A bill must have an issue date and a due date

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

Both must be real `Date` values.

**Why:** The issue date is when the debt was communicated and the due date is
when it becomes late. `BIL-056` refuses to age a bill without the second, so a
bill missing either can never move out of PENDING.

**Enforced at:** `src/domain/billing/aggregates/Bill.ts` (`validate`)
**Reached from:** `create`, `markPaid`, `markOverdue`, `cancel`
**Message:** `issueDate is null or undefined` / `dueDate is not a valid date`
**Tests:** `tests/domain/billing/aggregates/Bill.test.ts`

### BIL-006 — A due date cannot precede its issue date

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

They may be the same day.

**Why:** A bill due before it was issued is late the moment it exists, which
means the subscriber is charged for a delay they were never given the chance to
avoid. Same-day is allowed because a bill payable on receipt is a real
arrangement.

**Enforced at:** `src/domain/billing/aggregates/Bill.ts` (`validate`)
**Reached from:** `create`, `markPaid`, `markOverdue`, `cancel`
**Message:** `dueDate cannot be before issueDate`
**Tests:** `tests/domain/billing/aggregates/Bill.test.ts`

### BIL-007 — A customer has at most one bill per period

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Checked on single generation and again on each iteration of the bulk run.

**Why:** Billing a month twice is the failure mode that costs real money and
real trust. The check makes re-running a generation safe, which is what makes it
safe to re-run after a partial failure (`BIL-087`).

**Enforced at:** `src/application/billing/use-cases/GenerateBillUseCase.ts`,
`src/application/billing/use-cases/GenerateBillsForPeriodUseCase.ts`
**Message:** `A bill already exists for customer <id> for period <YYYY-MM>`
**Tests:** `tests/application/billing/use-cases/GenerateBillUseCase.test.ts`,
`tests/application/billing/use-cases/GenerateBillsForPeriodUseCase.test.ts`

**Known gap — this rule has no database backing.** Unlike the uniqueness rules
in `CUS-016` … `CUS-018`, there is no unique index on
`(customer_id, period_year, period_month)`. Two concurrent generation runs for
the same period can both pass the check and both insert. Nothing in the product
issues concurrent runs today, which is why it has not bitten; adding
`@@unique([customerId, periodYear, periodMonth])` to `Bill` is the fix, and it
would turn this Policy into an Invariant.

### BIL-008 — An omitted issue date means today

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

**Why:** A bill is normally cut on the day it is issued. Supplying the date
explicitly exists for backdating a run that should have happened last week.

**Enforced at:** `src/application/billing/use-cases/GenerateBillUseCase.ts` (`resolveDates`)
**Tests:** `tests/application/billing/use-cases/GenerateBillUseCase.test.ts`

### BIL-009 — An omitted due date is fifteen days after the issue date

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

**Why:** Fifteen days is the grace period this ISP gives before a bill is
eligible to go overdue and the subscriber becomes a suspension candidate. It is
a business decision expressed as a constant, so changing it is a one-line edit
and a conversation — not a migration.

**Enforced at:** `src/application/billing/use-cases/GenerateBillUseCase.ts` (`DEFAULT_DUE_DAYS`)
**Tests:** `tests/application/billing/use-cases/GenerateBillUseCase.test.ts`

### BIL-010 — A supplied date that cannot be parsed is rejected

**Type:** Validation · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

The defaults in `BIL-008` and `BIL-009` apply to absence, never to garbage.

**Why:** Silently falling back to today when someone sent `"31-02-2026"` would
issue a bill dated differently from what the operator believed they asked for,
with no signal that anything went wrong.

**Enforced at:** `src/application/billing/use-cases/GenerateBillUseCase.ts` (`resolveDates`)
**Message:** `issueDate is not a valid date` / `dueDate is not a valid date`
**Tests:** `tests/application/billing/use-cases/GenerateBillUseCase.test.ts`

### BIL-011 — A customer with bills cannot be deleted

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (database)
**Since:** 2026-08-05

**Why:** Bills are the financial record of the relationship, and they name the
customer rather than copying them. `CUS-020` already stops the deletion at the
subscription level for a customer in service; this catches the one who cancelled
everything but still has history.

**Backed by:** `Bill.customer … onDelete: Restrict` in `prisma/schema.prisma`
**Tests:** `tests/integration/bill.routes.test.ts`

---

## Line items and totals

### BIL-030 — A bill must have at least one line item

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

Checked on creation and on every state transition.

**Why:** An empty bill is a demand for zero, which is either an error in
generation or a document that should not have been produced. `BIL-082` is the
same rule stated at the point where it can be explained usefully.

**Enforced at:** `src/domain/billing/aggregates/Bill.ts` (`validate`)
**Reached from:** `create`, `markPaid`, `markOverdue`, `cancel`
**Message:** `A bill must have at least one line item`
**Tests:** `tests/domain/billing/aggregates/Bill.test.ts`

### BIL-031 — A line item names the subscription, the plan, and what it cost

**Type:** Invariant · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-08-05

All four of `contractedServiceId`, `servicePlanId`, `planName` and
`monthlyPrice` are required.

**Why:** The ids let the line be traced back to what was being billed; the name
and price are what the subscriber reads. Neither pair substitutes for the other
once `BIL-032` has frozen the copy.

**Enforced at:** `src/domain/billing/value-objects/BillLineItem.ts` (`create`)
**Message:** `contractedServiceId is null or undefined`
**Tests:** `tests/domain/billing/aggregates/Bill.test.ts`

### BIL-032 — A line item freezes the plan's name and price

**Type:** Invariant · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-08-05

The plan name and monthly price are copied onto the line item at generation and
never re-read from the plan afterwards.

**Why:** This is the rule the whole context is built around. Plans get renamed
and repriced (`CUS-032`, `CUS-036`), and a bill must keep saying what it said
when it was issued. If the line item read through to the plan, raising a price
in March would silently rewrite every unpaid bill from January.

**Enforced at:** `src/domain/billing/value-objects/BillLineItem.ts`,
`src/application/billing/use-cases/GenerateBillUseCase.ts` (`buildLineItems`)
**Backed by:** `BillLineItem.planName`, `BillLineItem.monthlyPrice` in `prisma/schema.prisma`
**Tests:** `tests/domain/billing/aggregates/Bill.test.ts`,
`tests/application/billing/use-cases/GenerateBillUseCase.test.ts`

### BIL-033 — A line item's plan name is non-empty and at most 100 characters

**Type:** Validation · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-08-05

Stored trimmed.

**Why:** The same bound as `CUS-031`, restated because the copy is independent
of the plan once made. A line item can outlive the plan it names, so it cannot
rely on the catalogue to have checked.

**Enforced at:** `src/domain/billing/value-objects/BillLineItem.ts` (`create`)
**Backed by:** `BillLineItem.planName @db.VarChar(100)` in `prisma/schema.prisma`
**Message:** `planName cannot be empty` / `planName cannot exceed 100 characters`
**Tests:** `tests/domain/billing/aggregates/Bill.test.ts`

### BIL-034 — A bill's total is computed from its line items, never stored

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

`total` sums the line items in cents each time it is read.

**Why:** A stored total is a second source of truth that can disagree with the
lines beneath it — and when it does, nobody can tell which is right. Summing on
read makes the disagreement impossible. The arithmetic is exact because `Money`
counts cents (`SHR-040`).

**Enforced at:** `src/domain/billing/aggregates/Bill.ts` (`total`)
**Tests:** `tests/domain/billing/aggregates/Bill.test.ts`

### BIL-035 — A line item's price is held to two decimal places

**Type:** Validation · **Status:** Active
**Layer:** Infrastructure (database)
**Since:** 2026-08-05

**Why:** The `CUS-037` reasoning, applied to the frozen copy. A float column
would let a total drift by a cent between what was billed and what is displayed.

**Backed by:** `BillLineItem.monthlyPrice @db.Decimal(12, 2)` in `prisma/schema.prisma`
**Tests:** `tests/application/billing/mappers/BillMapper.test.ts`

### BIL-036 — Deleting a bill deletes its line items

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (database)
**Since:** 2026-08-05

**Why:** A line item has no meaning apart from its bill — it is a value object
that happens to need its own table. This is the one cascade in the schema that
is safe, because the child cannot be referenced from anywhere else.

**Backed by:** `BillLineItem.bill … onDelete: Cascade` in `prisma/schema.prisma`
**Tests:** `tests/integration/bill.routes.test.ts`

---

## Status machine

### BIL-050 — A bill is PENDING, PAID, OVERDUE or CANCELLED

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

- **PENDING** — issued, not yet paid, not yet late
- **OVERDUE** — past its due date and still unpaid
- **PAID** — settled, and terminal
- **CANCELLED** — withdrawn, and terminal

**Why:** Four states because there are four things the office needs to count:
what is outstanding, what is late, what came in, and what was written off.

**Enforced at:** `src/domain/billing/enums/BillStatus.ts`
**Backed by:** `BillStatus` enum in `prisma/schema.prisma`
**Tests:** `tests/domain/billing/aggregates/Bill.test.ts`

### BIL-051 — A new bill is PENDING and unpaid

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

`create` ignores any status or `paidAt` the caller supplies.

**Why:** A bill that could be born PAID would let a payment be recorded without
a transition, and the transition is what emits `BillPaidEvent`. Every bill
therefore starts owed and has to be walked through the machine.

**Enforced at:** `src/domain/billing/aggregates/Bill.ts` (`create`)
**Backed by:** `Bill.status @default(PENDING)` in `prisma/schema.prisma`
**Tests:** `tests/domain/billing/aggregates/Bill.test.ts`

### BIL-052 — Only a PENDING or OVERDUE bill can be paid

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

A PAID bill cannot be paid twice; a CANCELLED one cannot be paid at all.

**Why:** Paying twice would move the paid-at date and emit a second
`BillPaidEvent` for one payment. Paying a cancelled bill means the cancellation
was wrong, and reversing that should be an explicit decision, not a side effect
of someone clicking pay.

**Enforced at:** `src/domain/billing/aggregates/Bill.ts` (`markPaid`)
**Message:** `Cannot mark a <status> bill as paid`
**Tests:** `tests/application/billing/use-cases/MarkBillPaidUseCase.test.ts`,
`tests/domain/billing/aggregates/Bill.test.ts`

### BIL-053 — A PAID bill records when it was paid, and only a PAID bill has that date

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

Both directions are checked: PAID without `paidAt` is invalid, and `paidAt` on
any other status is equally invalid.

**Why:** The payment date is what reconciliation is done against. Stating the
rule in both directions is what makes the status and the date incapable of
disagreeing — a bill cannot be PENDING while carrying evidence it was settled.

**Enforced at:** `src/domain/billing/aggregates/Bill.ts` (`validate`)
**Reached from:** `create`, `markPaid`, `markOverdue`, `cancel`
**Message:** `A PAID bill must have a paidAt date` /
`Only a PAID bill can have a paidAt date`
**Tests:** `tests/domain/billing/aggregates/Bill.test.ts`

### BIL-054 — Only a PENDING bill can go overdue

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

**Why:** OVERDUE means "still owed, and late". A paid bill is not owed and a
cancelled one is not either; an already-overdue bill going overdue again would
emit a duplicate `BillOverdueEvent` and re-trigger whatever acts on it.

**Enforced at:** `src/domain/billing/aggregates/Bill.ts` (`markOverdue`)
**Message:** `Cannot mark a <status> bill as overdue`
**Tests:** `tests/application/billing/use-cases/MarkBillOverdueUseCase.test.ts`,
`tests/domain/billing/aggregates/Bill.test.ts`

### BIL-055 — A bill cannot be marked overdue before its due date

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

Strictly after: on the due date itself, the bill is still current.

**Why:** OVERDUE is the state that justifies a suspension notice. Letting a bill
reach it early would mean cutting off a subscriber who is still inside the grace
period `BIL-009` promised them.

**Enforced at:** `src/domain/billing/aggregates/Bill.ts` (`markOverdue`)
**Message:** `Cannot mark bill overdue: it is not past its due date`
**Tests:** `tests/domain/billing/aggregates/Bill.test.ts`

### BIL-056 — A paid bill cannot be cancelled

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

**Why:** Money changed hands. Cancelling the document afterwards would erase the
obligation the payment settled, leaving a payment with nothing to have paid for.
A refund is a different transaction, not a cancelled bill.

**Enforced at:** `src/domain/billing/aggregates/Bill.ts` (`cancel`)
**Message:** `Cannot cancel a paid bill`
**Tests:** `tests/application/billing/use-cases/CancelBillUseCase.test.ts`

### BIL-057 — A cancelled bill cannot be cancelled again

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

**Why:** The second cancellation would emit a second `BillCancelledEvent` and
move `updatedAt`, making it look like something happened on a day nothing did.

**Enforced at:** `src/domain/billing/aggregates/Bill.ts` (`cancel`)
**Message:** `Cannot cancel an already cancelled bill`
**Tests:** `tests/application/billing/use-cases/CancelBillUseCase.test.ts`

### BIL-058 — Every transition is validated as a whole bill before it is applied

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

Each mutator builds the complete would-be state, runs the same `validate` that
`create` runs, and only then replaces `props`. A failed transition leaves the
bill exactly as it was.

**Why:** The alternative — mutate, then check — leaves a corrupt aggregate
behind on failure, which the caller is free to save. Building a candidate first
means a rejected transition cannot have partially happened. It is also what lets
one `validate` cover creation and every transition, so a rule added there cannot
be forgotten by a mutator written later.

**Enforced at:** `src/domain/billing/aggregates/Bill.ts` (`markPaid`, `markOverdue`, `cancel`)
**Tests:** `tests/domain/billing/aggregates/Bill.test.ts`

### BIL-059 — Every transition announces itself

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

`BillGeneratedEvent`, `BillPaidEvent`, `BillOverdueEvent`, `BillCancelledEvent`
— one per transition, emitted only after validation passes.

**Why:** The events are the seam anything reacting to billing hangs off. Emitting
after validation rather than before is what guarantees no handler ever sees a
transition that did not happen.

**Enforced at:** `src/domain/billing/aggregates/Bill.ts`
**Tests:** `tests/domain/billing/aggregates/Bill.test.ts`

---

## Generation

### BIL-080 — A bill is generated only for a customer that exists

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

**Why:** Checked before the work of assembling line items, so a mistyped id
fails immediately and with a message that names what was not found.

**Enforced at:** `src/application/billing/use-cases/GenerateBillUseCase.ts`
**Message:** `Customer not found: <id>`
**Tests:** `tests/application/billing/use-cases/GenerateBillUseCase.test.ts`

### BIL-081 — A bill covers the customer's ACTIVE subscriptions only

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

PENDING, SUSPENDED and CANCELLED subscriptions produce no line item.

**Why:** ACTIVE is the state that means service is being delivered (`CUS-067`).
A pending installation has not started; a suspended line is not being provided.
Billing either would charge for something the subscriber did not receive.

**Enforced at:** `src/application/billing/use-cases/GenerateBillUseCase.ts`
**Tests:** `tests/application/billing/use-cases/GenerateBillUseCase.test.ts`

**Note on partial months.** The rule reads status at the moment of generation,
not across the period. A subscription suspended on the 28th is billed in full
for that month, and one activated on the 28th is billed in full too. Proration
is not implemented and would change this rule rather than extend it.

### BIL-082 — A customer with no active subscriptions cannot be billed

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

**Why:** `BIL-030` would refuse the empty bill anyway, further down, with a
message about line items. Catching it here says the thing the operator needs to
hear: this customer has nothing to bill for.

**Enforced at:** `src/application/billing/use-cases/GenerateBillUseCase.ts`
**Message:** `Customer has no active contracted services for billing`
**Tests:** `tests/application/billing/use-cases/GenerateBillUseCase.test.ts`

### BIL-083 — A subscription pointing at a missing plan fails the whole bill

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

The line item is not skipped and the bill is not issued short.

**Why:** `CUS-041` and the `Restrict` behind it mean this cannot happen through
any supported path — reaching it means the data is already broken. Issuing a
bill missing a line would undercharge the subscriber quietly and leave no
evidence; failing loudly puts the corruption in front of someone.

**Enforced at:** `src/application/billing/use-cases/GenerateBillUseCase.ts` (`buildLineItems`)
**Message:** `Data integrity error: service plan <id> referenced by contracted service <id> does not exist`
**Tests:** `tests/application/billing/use-cases/GenerateBillUseCase.test.ts`

### BIL-084 — Bulk generation bills every customer holding an active subscription, once

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Customers are derived from ACTIVE subscriptions and de-duplicated, so a customer
with three active lines is billed one bill with three items.

**Why:** The bill is per customer, not per subscription — that is what makes one
document, one due date, and one payment. Deriving the customer list from active
subscriptions rather than from the customer table also means nobody with nothing
to pay for receives a run.

**Enforced at:** `src/application/billing/use-cases/GenerateBillsForPeriodUseCase.ts` (`uniqueCustomerIds`)
**Tests:** `tests/application/billing/use-cases/GenerateBillsForPeriodUseCase.test.ts`

### BIL-085 — Bulk generation reports generated, skipped and failed separately

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Skipped rows carry a reason; failed rows carry the error.

**Why:** A run over hundreds of customers ends in a mix. Collapsing it to a
count would leave the operator unable to tell "already billed, nothing to do"
from "this one broke and somebody owes nothing" — the second needs action and
the first does not.

**Enforced at:** `src/application/billing/use-cases/GenerateBillsForPeriodUseCase.ts`
**Tests:** `tests/application/billing/use-cases/GenerateBillsForPeriodUseCase.test.ts`

### BIL-086 — Bulk generation skips a customer already billed for the period

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

The customer lands in `skipped`, not in `failed`.

**Why:** `BIL-007` states the constraint; this states what the bulk run does
about it. Skipping rather than failing is what makes a re-run after a partial
failure the obvious recovery instead of a risk.

**Enforced at:** `src/application/billing/use-cases/GenerateBillsForPeriodUseCase.ts`
**Message:** `A bill already exists for customer <id> for period <YYYY-MM>`
**Tests:** `tests/application/billing/use-cases/GenerateBillsForPeriodUseCase.test.ts`

### BIL-087 — One customer's failure does not stop the run

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

The error is recorded against that customer and the loop continues.

**Why:** A monthly billing run is the job that must not half-happen invisibly.
Aborting on the first bad row would leave the customers after it in the list
unbilled, with nothing but a stack trace to say who they were.

**Enforced at:** `src/application/billing/use-cases/GenerateBillsForPeriodUseCase.ts`
**Tests:** `tests/application/billing/use-cases/GenerateBillsForPeriodUseCase.test.ts`

---

## PDF rendering

### BIL-100 — A bill PDF requires both the bill and its customer

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

**Why:** The document is addressed to a person. A bill whose customer has
vanished cannot be rendered into anything sendable, and `BIL-011` means it
should not be possible — so reaching this failure is a signal, not a routine
outcome.

**Enforced at:** `src/application/billing/use-cases/GetBillPdfUseCase.ts`
**Message:** `Bill not found: <id>` / `Customer not found for bill: <id>`
**Tests:** `tests/application/billing/use-cases/GetBillPdfUseCase.test.ts`

### BIL-101 — A bill PDF is named for its period and its bill

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

`bill-<YYYY-MM>-<billId>.pdf`.

**Why:** The file leaves the system and lands in a folder or a chat. The period
first makes a directory of them sort chronologically; the id makes each one
unambiguous when two customers' bills sit side by side.

**Enforced at:** `src/application/billing/use-cases/GetBillPdfUseCase.ts`
**Tests:** `tests/application/billing/use-cases/GetBillPdfUseCase.test.ts`

### BIL-102 — A bill PDF shows the customer's details as they are now

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Name, phone, email and cedula are read from the customer at render time — unlike
the line items, which are frozen by `BIL-032`.

**Why:** Deliberately the opposite choice from the line items, and for the same
reason. The amounts must not change because they are what was agreed; the
contact details must change because a re-issued bill should reach the subscriber
at the number they have today, not the one they had in January.

**Enforced at:** `src/application/billing/use-cases/GetBillPdfUseCase.ts`
**Tests:** `tests/application/billing/use-cases/GetBillPdfUseCase.test.ts`

---

## Listing and filtering

### BIL-120 — Listings return 20 rows by default and 100 at most

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

A larger `limit` is clamped, not rejected.

**Why:** Same reasoning as `CUS-120`. Bills accumulate one per customer per
month forever, so this is the table where an unbounded read hurts first.

**Enforced at:** `src/application/billing/use-cases/ListBillsUseCase.ts` (`MAX_LIMIT`)
**Tests:** `tests/application/billing/use-cases/ListBillsUseCase.test.ts`

### BIL-121 — Bills can be filtered by customer, status and period

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Filters combine; the status filter accepts any case.

**Why:** These three are the questions the office actually asks — what does this
subscriber owe, what is overdue across the board, and what did March look like.

**Enforced at:** `src/application/billing/use-cases/ListBillsUseCase.ts` (`buildFilters`)
**Message:** `Invalid status "<value>"` / `Invalid customerId: <error>`
**Tests:** `tests/application/billing/use-cases/ListBillsUseCase.test.ts`

### BIL-122 — Filtering by period needs both the year and the month

**Type:** Validation · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Supplying one without the other is refused rather than defaulted.

**Why:** A year alone would have to mean either "the whole year" or "January",
and a month alone even less. Refusing makes the caller say which they meant
instead of guessing on their behalf.

**Enforced at:** `src/application/billing/use-cases/ListBillsUseCase.ts` (`buildFilters`)
**Message:** `Both year and month are required to filter by period`
**Tests:** `tests/application/billing/use-cases/ListBillsUseCase.test.ts`

### BIL-123 — A limit outside 1…100 is rejected at the edge

**Type:** Validation · **Status:** Active
**Layer:** Presentation
**Since:** 2026-08-05

Year and month query parameters are bounded at the edge too, matching `BIL-003`.

**Why:** Same reasoning as `CUS-121` — the application clamps, but a client that
silently got less than it asked for cannot see its own bug.

**Enforced at:** `src/presentation/http/validation/bill.schemas.ts` (`listBillsSchema`)
**Message:** `Limit must be between 1 and 100`
**Tests:** `tests/integration/bill.routes.test.ts`

---

## Cross-cutting

### BIL-140 — Billing endpoints are permission-gated, and no bill can be deleted

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-08-05

| Endpoint                                         | Permission |
| ------------------------------------------------ | ---------- |
| `GET /api/bills`, `/:id`, `/:id/pdf`             | `read`     |
| `POST /api/bills/generate`                       | `create`   |
| `POST /api/bills/generate-bulk`                  | `create`   |
| `POST /api/bills/:id/pay`, `/overdue`, `/cancel` | `update`   |

There is no `DELETE` route on this resource at all.

**Why:** A bill is a financial record; the way to withdraw one is `cancel`
(`BIL-056`, `BIL-057`), which leaves it visible and dated. Omitting the endpoint
rather than gating it behind `delete` means no role can be granted the ability
by accident.

**Enforced at:** `src/presentation/http/routes/bill.routes.ts` (`authorize`)
**Tests:** `tests/integration/bill.routes.test.ts`

### BIL-141 — Bulk generation is metered on the bulk-import budget

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-08-05

`POST /api/bills/generate-bulk` uses the `bulk-import` rate limiter rather than
the `write` one that every other billing mutation uses.

**Why:** One call to it does the work of hundreds of writes and can run for
minutes. Budgeting it like a single write would let a retrying client stack
concurrent monthly runs on top of each other — which, given `BIL-007` has no
database backing, is precisely the condition that could double-bill.

**Enforced at:** `src/presentation/http/routes/bill.routes.ts` (`createRateLimiter`)
**Tests:** `tests/integration/bill.routes.test.ts`

---

## Cuentas de cobro

A cuenta de cobro (`CollectionAccount`) is the document handed to a customer
after one-off work: cameras installed, a router sold, a site visit. It is not a
bill. It has no period, no subscription behind it, and nothing in the service
side of the system reads it.

### BIL-200 — A cuenta de cobro must name who owes it

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-09-25

The customer name is required, non-blank after trimming, and at most 150
characters.

**Why:** The document is a demand for payment addressed to someone. Without a
name it cannot be presented or collected.

**Enforced at:** `src/domain/billing/aggregates/CollectionAccount.ts` (`validate`)
**Reached from:** `create`, `markPaid`, `cancel`
**Message:** `Customer name cannot be empty` / `Customer name cannot exceed 150 characters`
**Tests:** `tests/domain/billing/aggregates/CollectionAccount.test.ts`

### BIL-201 — Customer details are snapshotted at issue time

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-25

Linking an existing customer is optional. When `customerId` is given, the
name, phone, email and cédula are copied from the customer record (a supplied
document is used only when the customer has no cédula); the address always
comes from the request, since `Customer` has none. Without `customerId`, every
field is taken as typed. Nothing is re-read later.

**Why:** Camera installs and equipment sales are often for people who are not
internet subscribers, so a free-text customer has to work. And a document that
has been handed over must keep saying what it said — a later rename of the
customer must not rewrite it.

**Enforced at:** `src/application/billing/use-cases/CreateCollectionAccountUseCase.ts` (`resolveCustomer`)
**Message:** `Customer not found: <id>` / `Invalid customerId: …`
**Tests:** `tests/application/billing/use-cases/CreateCollectionAccountUseCase.test.ts`, `tests/integration/use-cases/billing/CreateCollectionAccountUseCase.integration.test.ts`

### BIL-202 — Either a customerId or a customerName is required

**Type:** Validation · **Status:** Active
**Layer:** Application
**Since:** 2026-09-25

**Why:** `BIL-200` needs a name, and one of the two is the only place it can
come from.

**Enforced at:** `src/application/billing/use-cases/CreateCollectionAccountUseCase.ts` (`beforeExecute`)
**Message:** `Either customerId or customerName is required`
**Tests:** `tests/application/billing/use-cases/CreateCollectionAccountUseCase.test.ts`, `tests/integration/collection-account.routes.test.ts`

### BIL-203 — Snapshot fields fit their columns

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-09-25

Document ≤ 20, phone ≤ 20, email ≤ 255, address ≤ 255 characters.

**Why:** Free-text customers bypass the `Customer` value objects that would
otherwise bound these. Checking in the aggregate turns an oversized value into
a 400 instead of a database error.

**Enforced at:** `src/domain/billing/aggregates/CollectionAccount.ts` (`validate`)
**Message:** `<Field> cannot exceed <n> characters`
**Tests:** `tests/domain/billing/aggregates/CollectionAccount.test.ts`

### BIL-204 — An omitted issue date means now; the due date is optional

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-25

An unparseable date is rejected.

**Why:** Unlike a monthly bill (`BIL-009`), one-off work is often paid on the
spot, so there is no sensible default term to impose.

**Enforced at:** `src/application/billing/use-cases/CreateCollectionAccountUseCase.ts` (`parseDates`)
**Message:** `issueDate is not a valid date` / `dueDate is not a valid date`
**Tests:** `tests/application/billing/use-cases/CreateCollectionAccountUseCase.test.ts`

### BIL-205 — A due date cannot precede its issue date

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-09-25

**Why:** Same as `BIL-006`: such a document is overdue the moment it exists.

**Enforced at:** `src/domain/billing/aggregates/CollectionAccount.ts` (`validate`)
**Message:** `dueDate cannot be before issueDate`
**Tests:** `tests/domain/billing/aggregates/CollectionAccount.test.ts`, `tests/integration/collection-account.routes.test.ts`

### BIL-206 — The number is assigned by the database, formatted `CC-NNNN`

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (database)
**Since:** 2026-09-25

`code` is a Postgres sequence, never supplied by a caller. It is shown
zero-padded to four digits behind `CC-`; it is `null` only between `create()`
and the first save.

**Why:** A consecutive number is what the customer and the accountant refer to.
Letting the database own it means two concurrent requests can never be given
the same one.

**Enforced at:** `prisma/schema.prisma` (`CollectionAccount.code`), `src/application/billing/mappers/CollectionAccountMapper.ts` (`formatNumber`)
**Tests:** `tests/application/billing/mappers/CollectionAccountMapper.test.ts`, `tests/integration/use-cases/billing/CreateCollectionAccountUseCase.integration.test.ts`

### BIL-210 — A cuenta de cobro must have at least one line item

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-09-25

**Why:** A demand for nothing is a mistake, not a document.

**Enforced at:** `src/domain/billing/aggregates/CollectionAccount.ts` (`validate`), `CreateCollectionAccountUseCase` (`beforeExecute`)
**Message:** `A collection account must have at least one line item`
**Tests:** `tests/domain/billing/aggregates/CollectionAccount.test.ts`, `tests/application/billing/use-cases/CreateCollectionAccountUseCase.test.ts`

### BIL-211 — A line item is free text with a hand-entered price

**Type:** Validation · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-09-25

Description 1–500 characters after trimming; quantity a positive integer; unit
price a non-negative `Money`. The line total is unit price × quantity.

**Why:** What is being charged for — labour, cable by the metre, a used camera —
rarely exists in the device catalog, so unlike quotations (`QUO-031`) nothing
is looked up.

**Enforced at:** `src/domain/billing/value-objects/CollectionAccountLineItem.ts`
**Message:** `description cannot be empty` / `description cannot exceed 500 characters` / `quantity must be a positive integer`
**Tests:** `tests/domain/billing/value-objects/CollectionAccountLineItem.test.ts`

### BIL-212 — The total is computed from the line items, never stored

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-09-25

**Why:** Same as `BIL-034` — a stored total is a second copy that can disagree.

**Enforced at:** `src/domain/billing/aggregates/CollectionAccount.ts` (`total`)
**Tests:** `tests/domain/billing/aggregates/CollectionAccount.test.ts`

### BIL-213 — A cuenta de cobro lists at most five payment accounts

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-09-26

Zero is allowed — the "Forma de pago" section is then left out of the PDF.

**Why:** A customer needs one place to pay, maybe two. Beyond a handful the
section stops being instructions and becomes noise.

**Enforced at:** `src/domain/billing/aggregates/CollectionAccount.ts` (`validate`), `src/presentation/http/validation/collection-account.schemas.ts`
**Message:** `Payment accounts cannot exceed 5`
**Tests:** `tests/domain/billing/aggregates/CollectionAccount.test.ts`, `tests/integration/collection-account.routes.test.ts`

### BIL-214 — Payment accounts are chosen per document; omitting the choice lists them all

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-26

`bankAccountIds` picks which registered bank accounts appear, in the order
given, each once. Omitted, every registered account is listed; `[]` lists none.
An id that does not exist fails the whole request.

**Why:** Different jobs may be paid into different accounts, so the choice
belongs to the document. Defaulting to all keeps the common case — one
account — free of any extra step.

**Enforced at:** `src/application/billing/use-cases/CreateCollectionAccountUseCase.ts` (`resolvePaymentAccounts`)
**Message:** `Bank account not found: <id>` / `Invalid bankAccountId: …`
**Tests:** `tests/application/billing/use-cases/CreateCollectionAccountUseCase.test.ts`, `tests/integration/use-cases/billing/CreateCollectionAccountUseCase.integration.test.ts`, `tests/integration/collection-account.routes.test.ts`

### BIL-215 — Payment accounts are copied onto the document, not referenced

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (database)
**Since:** 2026-09-26

`collection_account_payment_accounts` holds bank, type and number with no
foreign key to `bank_accounts`.

**Why:** A cuenta de cobro already handed to a customer must keep telling them
where to pay, even after the account is corrected, closed or deleted — the same
reasoning as the customer snapshot in `BIL-201`.

**Enforced at:** `prisma/schema.prisma` (`CollectionAccountPaymentAccount`)
**Tests:** `tests/integration/use-cases/billing/CreateCollectionAccountUseCase.integration.test.ts`

### BIL-220 — A cuenta de cobro is PENDING, PAID or CANCELLED; new ones are PENDING

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-09-25

**Why:** Three states cover the only questions asked of it: has it been paid,
and does it still stand.

**Enforced at:** `src/domain/billing/enums/CollectionAccountStatus.ts`, `CollectionAccount.create`
**Tests:** `tests/domain/billing/aggregates/CollectionAccount.test.ts`

### BIL-221 — Only a PENDING cuenta de cobro can be paid

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-09-25

Paying records `paidAt`.

**Why:** Paying twice would record a second payment that never happened;
paying a cancelled one would revive a document that was withdrawn.

**Enforced at:** `src/domain/billing/aggregates/CollectionAccount.ts` (`markPaid`)
**Message:** `Cannot mark a <STATUS> collection account as paid`
**Tests:** `tests/domain/billing/aggregates/CollectionAccount.test.ts`, `tests/integration/collection-account.routes.test.ts`

### BIL-222 — Only a PENDING cuenta de cobro can be cancelled

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-09-25

Cancelling records `cancelledAt`. There is no edit: a wrong document is
cancelled and a new one issued.

**Why:** A paid document records money received; cancelling it would erase
that. Cancel-and-reissue keeps every number that was ever handed out visible.

**Enforced at:** `src/domain/billing/aggregates/CollectionAccount.ts` (`cancel`)
**Message:** `Cannot cancel a <STATUS> collection account`
**Tests:** `tests/domain/billing/aggregates/CollectionAccount.test.ts`, `tests/integration/collection-account.routes.test.ts`

### BIL-223 — Status and its date agree in both directions

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-09-25

Only a PAID one has `paidAt`, and it must; only a CANCELLED one has
`cancelledAt`, and it must.

**Why:** The same shape as `BIL-053`: a date on the wrong status is corrupt
data that the PDF stamp (`BIL-231`) would then misreport.

**Enforced at:** `src/domain/billing/aggregates/CollectionAccount.ts` (`validate`)
**Tests:** `tests/domain/billing/aggregates/CollectionAccount.test.ts`

### BIL-224 — Every transition announces itself

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-09-25

`CollectionAccountIssuedEvent`, `CollectionAccountPaidEvent`,
`CollectionAccountCancelledEvent`. Nothing subscribes yet.

**Why:** Consistent with `BIL-059`, so a future notification or accounting
export can hook in without touching the aggregate.

**Enforced at:** `src/domain/billing/aggregates/CollectionAccount.ts`
**Tests:** `tests/domain/billing/aggregates/CollectionAccount.test.ts`

### BIL-225 — A cuenta de cobro never affects internet service

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-09-25

It has no OVERDUE state, is not read by bill generation, and plays no part in
suspension or enforcement.

**Why:** Decided with the business: these are separate documents. An unpaid
camera install must not cut someone's internet.

**Enforced at:** `src/domain/billing/enums/CollectionAccountStatus.ts` (by absence)
**Tests:** `tests/domain/billing/aggregates/CollectionAccount.test.ts`

### BIL-230 — The PDF is a "CUENTA DE COBRO" with the amount in words

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-25 · **Revised:** 2026-09-28

The document is titled `CUENTA DE COBRO`, carries its `CC-NNNN` number, states
"DEBE A" (the issuer) and "LA SUMA DE" with the total written out in Spanish
(`… PESOS M/CTE`), then lists the items. It downloads as
`cuenta-de-cobro-CC-NNNN.pdf`. The issuer's name, NIT, address and contact
details come from the install's configuration (`BIL-232`);
the "Forma de pago" lines come from the document's own payment accounts
(`BIL-214`), e.g. `Transferencia a cuenta de ahorros Bancolombia No. 39500002227`.

**Why:** That is the conventional shape of a Colombian cuenta de cobro, and the
amount in words is what makes the figure hard to alter on a printed copy.

**Enforced at:** `src/application/billing/use-cases/GetCollectionAccountPdfUseCase.ts`, `src/infrastructure/billing/services/PdfKitCollectionAccountPdfRenderer.ts`, `src/infrastructure/billing/utils/spanishAmountInWords.ts`
**Tests:** `tests/application/billing/use-cases/GetCollectionAccountPdfUseCase.test.ts`, `tests/infrastructure/billing/utils/spanishAmountInWords.test.ts`, `tests/integration/collection-account.routes.test.ts`

### BIL-231 — A paid or cancelled PDF is stamped

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (PDF)
**Since:** 2026-09-25

`PAGADA` in green or `ANULADA` in red, top right.

**Why:** A re-downloaded copy must not be mistakable for an open demand.

**Enforced at:** `src/infrastructure/billing/services/PdfKitCollectionAccountPdfRenderer.ts` (`drawStatusStamp`)
**Tests:** `tests/infrastructure/billing/services/PdfKitCollectionAccountPdfRenderer.test.ts`

### BIL-232 — The issuer is the vendor's setting, and no cuenta de cobro prints without it

**Type:** Validation · **Status:** Active
**Layer:** Domain · Infrastructure
**Since:** 2026-09-28 · **Revised:** 2026-09-30 (set from the dashboard; no longer a boot requirement)

The issuer's name, document label (`NIT`), document, address, city, phone,
email and accent colour (`#1F4E79`) are the vendor's settings (`INS-028`),
read for every PDF. All are required, the email must be an address and the
colour `#RRGGBB`. Until the vendor saves them they come from `ISSUER_NAME`,
`ISSUER_DOCUMENT_LABEL`, `ISSUER_DOCUMENT`, `ISSUER_ADDRESS`, `ISSUER_CITY`,
`ISSUER_CONTACT_PHONE`, `ISSUER_CONTACT_EMAIL` and `ISSUER_ACCENT_COLOR`:
none of the six required ones set leaves the issuer unset; only some set stops
the boot, naming the missing ones. With no issuer, downloading a cuenta de cobro
answers `409`. The logo (`ISSUER_LOGO_PATH`, a file on the server), locale
(`es-CO`) and time zone (`America/Bogota`) stay in env.

**Why:** Each install bills as its own company; hard-coded, every customer's
cuentas de cobro would have been issued in Insetel's name. It used to stop the
boot, to surface the gap on install day — but now that the vendor sets it from
the dashboard, a new install has to boot to be configured, so the gap shows on
the document instead, with a reason the dashboard can act on. A partial env is
still refused: that is a typo, not an unconfigured install.

**Enforced at:** `src/domain/shared/value-objects/VendorSettings.ts`, `src/infrastructure/di/vendorSettingsDefaults.ts`, `src/infrastructure/billing/services/SettingsIssuerPdfRenderer.ts`, `src/infrastructure/billing/config/collectionAccountIssuerConfig.ts`
**Message:** `Cannot print the cuenta de cobro: the issuer is not configured`
**Tests:** `tests/domain/shared/value-objects/VendorSettings.test.ts`, `tests/infrastructure/di/vendorSettingsDefaults.test.ts`, `tests/infrastructure/billing/config/collectionAccountIssuerConfig.test.ts`, `tests/integration/use-cases/billing/GetCollectionAccountPdfUseCase.integration.test.ts`

### BIL-240 — Listings return 20 rows by default and 100 at most, filterable by customer and status

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-25

Newest first. A limit above 100 is rejected at the edge and capped in the use
case.

**Why:** Same limits as `BIL-120`.

**Enforced at:** `src/application/billing/use-cases/ListCollectionAccountsUseCase.ts`, `src/presentation/http/validation/collection-account.schemas.ts`
**Tests:** `tests/application/billing/use-cases/ListCollectionAccountsUseCase.test.ts`, `tests/integration/use-cases/billing/ListCollectionAccountsUseCase.integration.test.ts`

### BIL-250 — Endpoints are permission-gated, with no edit or delete

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-09-25

| Endpoint                                           | Permission |
| -------------------------------------------------- | ---------- |
| `GET /api/collection-accounts`, `/:id`, `/:id/pdf` | `read`     |
| `POST /api/collection-accounts`                    | `create`   |
| `POST /api/collection-accounts/:id/pay`, `/cancel` | `update`   |

**Why:** As `BIL-140`: a document handed to a customer is withdrawn by
cancelling it, which leaves it visible and dated.

**Enforced at:** `src/presentation/http/routes/collection-account.routes.ts`
**Tests:** `tests/integration/collection-account.routes.test.ts`

### BIL-251 — Deleting a customer keeps their cuentas de cobro

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (database)
**Since:** 2026-09-25

The foreign key is `ON DELETE SET NULL`; the snapshot (`BIL-201`) still says
who the document was for.

**Why:** Unlike bills (`BIL-011`), a cuenta de cobro stands on its snapshot, so
there is no reason for it to block a customer's removal — and no reason to lose
the record either.

**Enforced at:** `prisma/schema.prisma` (`CollectionAccount.customer`)
**Tests:** `tests/integration/use-cases/billing/CreateCollectionAccountUseCase.integration.test.ts`

---

## Bank accounts

The issuer's own accounts that customers pay into. They exist only to be
picked onto a cuenta de cobro (`BIL-214`), which copies them (`BIL-215`).

### BIL-260 — A bank account is a bank, a type and a number

**Type:** Validation · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-09-26

Bank name 1–100 characters after trimming; type `SAVINGS` (ahorros) or
`CHECKING` (corriente); number 4–30 characters, digits optionally separated by
spaces or dashes, starting and ending with a digit.

**Why:** These three facts are exactly what a customer needs to make a
transfer; anything else in the number field is a typo that would send money
nowhere.

**Enforced at:** `src/domain/billing/value-objects/BankAccountDetails.ts`, `src/presentation/http/validation/bank-account.schemas.ts`
**Message:** `bankName cannot be empty` / `Invalid accountType "<x>"` / `accountNumber must be 4 to 30 digits, optionally separated by spaces or dashes`
**Tests:** `tests/domain/billing/value-objects/BankAccountDetails.test.ts`, `tests/application/billing/use-cases/CreateBankAccountUseCase.test.ts`, `tests/integration/bank-account.routes.test.ts`

### BIL-261 — The same number at the same bank is registered once

**Type:** Invariant · **Status:** Active
**Layer:** Infrastructure (database)
**Since:** 2026-09-26

Unique on (`bank_name`, `account_number`); a duplicate create or update is a 409. The same number at a different bank is allowed.

**Why:** Two rows for one account would show up twice in the picker and could
be listed twice on one document.

**Enforced at:** `prisma/schema.prisma` (`BankAccount @@unique`), `src/infrastructure/billing/repositories/PrismaBankAccountRepository.ts`
**Message:** `A bank account with number <n> at <bank> already exists`
**Tests:** `tests/integration/use-cases/billing/CreateBankAccountUseCase.integration.test.ts`, `tests/integration/use-cases/billing/UpdateBankAccountUseCase.integration.test.ts`, `tests/integration/bank-account.routes.test.ts`

### BIL-263 — Bank account endpoints are permission-gated; only ADMIN deletes

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-09-26

| Endpoint                         | Permission |
| -------------------------------- | ---------- |
| `GET /api/bank-accounts`, `/:id` | `read`     |
| `POST /api/bank-accounts`        | `create`   |
| `PATCH /api/bank-accounts/:id`   | `update`   |
| `DELETE /api/bank-accounts/:id`  | `delete`   |

**Why:** Where the company's money goes is sensitive. Operators can add and fix
accounts; removing one is an owner's decision. Deleting is always safe for
issued documents (`BIL-215`).

**Enforced at:** `src/presentation/http/routes/bank-account.routes.ts`
**Tests:** `tests/integration/bank-account.routes.test.ts`

### BIL-264 — Every bank account carries a ready-made picker label

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-09-26

`<bank> · Ahorros|Corriente · <number>`, e.g.
`Bancolombia · Ahorros · 39500002227`. Listed oldest first.

**Why:** The frontend shows these in a selector when issuing a cuenta de cobro;
formatting them in one place keeps the wording consistent with the PDF.

**Enforced at:** `src/application/billing/mappers/BankAccountMapper.ts`
**Tests:** `tests/application/billing/use-cases/CreateBankAccountUseCase.test.ts`, `tests/integration/use-cases/billing/ListBankAccountsUseCase.integration.test.ts`
