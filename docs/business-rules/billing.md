# Billing — Business Rules

What a subscriber owes for a month. A `Bill` is a customer, a billing period, and
one immutable line item per active subscription, priced at the moment the bill
was cut.

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

## Layer coverage

| Layer                     | Rules |
| ------------------------- | ----- |
| Application               | 18    |
| Domain (aggregate)        | 16    |
| Domain (value object)     | 5     |
| Presentation              | 3     |
| Infrastructure (database) | 3     |

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
