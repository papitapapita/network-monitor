# Customers — Business Rules

Who the subscribers are, what they bought, and which device delivers it. Three
aggregates: `Customer` (the person), `ServicePlan` (the catalogue entry), and
`ContractedService` (the subscription that binds a customer to a plan and to one
piece of equipment).

Format and conventions: [README.md](README.md).

## ID ranges

| Range                 | Area                                         |
| --------------------- | -------------------------------------------- |
| `CUS-001` … `CUS-029` | Customer identity, contact details, deletion |
| `CUS-030` … `CUS-059` | Service plan catalogue                       |
| `CUS-060` … `CUS-099` | Contracted service lifecycle and status      |
| `CUS-100` … `CUS-119` | Device bonding                               |
| `CUS-120` … `CUS-139` | Listing and pagination                       |
| `CUS-140` … `CUS-159` | Cross-cutting (access control)               |

## Layer coverage

| Layer                              | Rules |
| ---------------------------------- | ----- |
| Domain (aggregate)                 | 32    |
| Domain (value object)              | 9     |
| Application                        | 9     |
| Application + database constraint  | 7     |
| Presentation                       | 3     |
| Presentation + Application         | 1     |
| Presentation + database constraint | 1     |
| Infrastructure (database)          | 2     |

The three aggregates hold everything they can see for themselves. The departures
are the usual ones:

- **Uniqueness** (`CUS-016`, `CUS-017`, `CUS-018`, `CUS-032`, `CUS-100`) is a
  statement about the whole table, which no aggregate can check. Enforced in the
  use case and backed by a unique index so a race cannot slip past.
- **Referential refusal** (`CUS-020`, `CUS-041`) counts rows in another
  aggregate's table, so it is a use-case policy.
- **Existence of the customer and the plan** (`CUS-064`, `CUS-065`) is likewise
  a fact `ContractedService` cannot see from inside.
- **Operation ordering on update** (`CUS-075`) is a property of the use case, not
  of any single mutator.
- **Money and bandwidth precision** (`CUS-035`, `CUS-037`) are column types. The
  domain accepts any number; the database is what rounds.

Authentication, roles and rate limiting are declared once in
[identity.md](identity.md) and apply to every endpoint here. `CUS-140` records
only which permission each of this context's endpoints demands.

---

## Customer identity, contact details, deletion

### CUS-001 — A customer must have a full name

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

Every customer carries a non-empty name after trimming.

**Why:** The name is the only thing that identifies a subscriber to the office
staff. Phone and cedula are optional-shaped identifiers used for lookup; a row
with no name cannot be discussed, dispatched to, or billed to a human.

**Enforced at:** `src/domain/customers/aggregates/Customer.ts` (`validateName`)
**Reached from:** `create`, `rename`
**Message:** `Customer name cannot be empty`
**Tests:** `tests/domain/customers/aggregates/Customer.test.ts`

### CUS-002 — A customer name cannot exceed 150 characters

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

**Why:** The name is a label on a list, not a free-text field. The column is
sized to match, so a longer value would be a database error rather than a
business one.

**Enforced at:** `src/domain/customers/aggregates/Customer.ts` (`validateName`)
**Reached from:** `create`, `rename`
**Backed by:** `Customer.fullName @db.VarChar(150)` in `prisma/schema.prisma`
**Message:** `Customer name cannot exceed 150 characters`
**Tests:** `tests/domain/customers/aggregates/Customer.test.ts`

### CUS-003 — A customer name is stored trimmed

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

Leading and trailing whitespace is removed before the name is stored, and the
length check in `CUS-002` applies to the trimmed value.

**Why:** Names arrive from a form. Without normalisation, `"Ana "` and `"Ana"`
are two different customers to every search and every sort.

**Enforced at:** `src/domain/customers/aggregates/Customer.ts` (`validateName`)
**Reached from:** `create`, `rename`
**Tests:** `tests/domain/customers/aggregates/Customer.test.ts`

### CUS-004 — A customer must have a phone number

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

The phone is the one contact channel that is not optional.

**Why:** Every outbound notice this system sends to a subscriber — suspension
warnings, technician dispatch — goes over WhatsApp, keyed by phone. A customer
with no phone cannot be told anything.

**Enforced at:** `src/domain/customers/aggregates/Customer.ts` (`create`, `changePhone`)
**Reached from:** `create`, `changePhone`
**Message:** `phone is null or undefined`
**Tests:** `tests/domain/customers/aggregates/Customer.test.ts`

### CUS-005 — A phone number must contain at least one digit

**Type:** Validation · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-08-05

**Why:** Normalisation (`CUS-007`) strips every non-digit character, so a string
of punctuation reduces to nothing. Rejecting it here gives the caller a real
message instead of an empty phone stored successfully.

**Enforced at:** `src/domain/customers/value-objects/PhoneNumber.ts` (`create`)
**Message:** `Phone number cannot be empty`
**Tests:** `tests/domain/customers/value-objects/PhoneNumber.test.ts`

### CUS-006 — A phone number must have between 7 and 15 digits

**Type:** Validation · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-08-05

Counted after normalisation, excluding the leading `+`.

**Why:** Seven digits is the shortest dialable local number; fifteen is the
E.164 maximum, so nothing longer is a real telephone number anywhere. The band
catches transposed cedulas and truncated entries, which are the two ways this
field is actually mistyped.

**Enforced at:** `src/domain/customers/value-objects/PhoneNumber.ts` (`create`)
**Message:** `Phone number must have at least 7 digits` /
`Phone number must not exceed 15 digits`
**Tests:** `tests/domain/customers/value-objects/PhoneNumber.test.ts`

### CUS-007 — A phone number is normalised to a leading `+` and digits

**Type:** Policy · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-08-05

Spaces, dashes, parentheses and dots are dropped. A leading `+` is kept; a `+`
anywhere else is not.

**Why:** The stored form is what uniqueness (`CUS-016`) compares and what the
WhatsApp gateway is handed. If `+58 412-555-0000` and `04125550000` can both be
stored verbatim, the same subscriber can be entered twice and the second notice
goes nowhere.

**Enforced at:** `src/domain/customers/value-objects/PhoneNumber.ts` (`normalize`)
**Tests:** `tests/domain/customers/value-objects/PhoneNumber.test.ts`

### CUS-008 — Email is optional

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

A customer may have no email address, and clearing it to `null` is a legitimate
update.

**Why:** This is a residential ISP in a market where many subscribers have no
email but everyone has WhatsApp. Requiring one would mean staff inventing
addresses to get past the form.

**Enforced at:** `src/domain/customers/aggregates/Customer.ts` (`create`, `changeEmail`)
**Tests:** `tests/domain/customers/aggregates/Customer.test.ts`

### CUS-009 — An email address must look like an address

**Type:** Validation · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-08-05

Non-empty local part, `@`, non-empty domain containing a dot — no whitespace
anywhere.

**Why:** A deliberately loose check. The only way to know an address is real is
to send to it, so the rule catches the typo class (`ana@gmail`, `ana gmail.com`)
without refusing valid but unusual addresses.

**Enforced at:** `src/domain/customers/value-objects/EmailAddress.ts` (`create`)
**Message:** `Email is not valid`
**Tests:** `tests/domain/customers/value-objects/EmailAddress.test.ts`

### CUS-010 — An email address is stored lowercased and trimmed

**Type:** Policy · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-08-05

**Why:** Mail domains are case-insensitive in practice, so `Ana@X.com` and
`ana@x.com` are one mailbox. Storing them as written would let the same person
be entered twice past the uniqueness check in `CUS-017`.

**Enforced at:** `src/domain/customers/value-objects/EmailAddress.ts` (`create`)
**Tests:** `tests/domain/customers/value-objects/EmailAddress.test.ts`

### CUS-011 — An email address cannot exceed 255 characters

**Type:** Validation · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-08-05

**Why:** The practical ceiling for an address, and the width of the column.

**Enforced at:** `src/domain/customers/value-objects/EmailAddress.ts` (`create`)
**Backed by:** `Customer.email @db.VarChar(255)` in `prisma/schema.prisma`
**Message:** `Email must not exceed 255 characters`
**Tests:** `tests/domain/customers/value-objects/EmailAddress.test.ts`

### CUS-012 — Cedula is optional

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

**Why:** The national ID is collected at contract signing, but a service can be
provisioned before the paperwork arrives. Blocking installation on a document
number would stop work that is otherwise ready to proceed.

**Enforced at:** `src/domain/customers/aggregates/Customer.ts` (`create`, `changeCedula`)
**Tests:** `tests/domain/customers/aggregates/Customer.test.ts`

### CUS-013 — A cedula must contain only digits

**Type:** Validation · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-08-05

Checked after the separators in `CUS-015` have been stripped.

**Why:** The nationality letter (`V-`, `E-`) is not part of the number and is not
stored. Accepting it would produce two spellings of one cedula and defeat
`CUS-018`.

**Enforced at:** `src/domain/customers/value-objects/Cedula.ts` (`create`)
**Message:** `Cedula must contain only digits`
**Tests:** `tests/domain/customers/value-objects/Cedula.test.ts`

### CUS-014 — A cedula must be between 6 and 10 digits

**Type:** Validation · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-08-05

**Why:** The range covers every issued Venezuelan cedula, including the older
short ones, with headroom above the current ceiling.

**Enforced at:** `src/domain/customers/value-objects/Cedula.ts` (`create`)
**Message:** `Cedula must be between 6 and 10 digits`
**Tests:** `tests/domain/customers/value-objects/Cedula.test.ts`

### CUS-015 — A cedula is stored without dots or spaces

**Type:** Policy · **Status:** Active
**Layer:** Domain (value object)
**Since:** 2026-08-05

`12.345.678` and `12 345 678` both store as `12345678`.

**Why:** People write the thousands separators; the number is the same either
way. Normalising is what makes `CUS-018` mean anything.

**Enforced at:** `src/domain/customers/value-objects/Cedula.ts` (`create`)
**Tests:** `tests/domain/customers/value-objects/Cedula.test.ts`

### CUS-016 — A phone number belongs to exactly one customer

**Type:** Invariant · **Status:** Active
**Layer:** Application + database constraint
**Since:** 2026-08-05

Compared in the normalised form of `CUS-007`.

**Why:** The phone is how a subscriber is found at the counter and how the
system reaches them. Two customers on one number means the wrong account gets
suspended and the notice for one arrives about the other.

**Enforced at:** `src/application/customers/use-cases/CreateCustomerUseCase.ts` (`ensureUnique`),
`src/application/customers/use-cases/UpdateCustomerUseCase.ts` (`ensureUnique`)
**Backed by:** `Customer.phone @unique` in `prisma/schema.prisma`
**Message:** `A customer with phone "<value>" already exists`
**Tests:** `tests/application/customers/use-cases/CreateCustomerUseCase.test.ts`,
`tests/application/customers/use-cases/UpdateCustomerUseCase.test.ts`

### CUS-017 — An email address belongs to at most one customer

**Type:** Invariant · **Status:** Active
**Layer:** Application + database constraint
**Since:** 2026-08-05

Unset emails do not collide — any number of customers may have none.

**Why:** Same reasoning as `CUS-016`, weakened by `CUS-008`: the address is a
lookup key when present, so it must not be ambiguous, but absence is normal and
cannot be treated as a duplicate.

**Enforced at:** `src/application/customers/use-cases/CreateCustomerUseCase.ts` (`ensureUnique`),
`src/application/customers/use-cases/UpdateCustomerUseCase.ts` (`ensureUnique`)
**Backed by:** `Customer.email @unique` in `prisma/schema.prisma`
**Message:** `A customer with email "<value>" already exists`
**Tests:** `tests/application/customers/use-cases/CreateCustomerUseCase.test.ts`,
`tests/application/customers/use-cases/UpdateCustomerUseCase.test.ts`

### CUS-018 — A cedula belongs to at most one customer

**Type:** Invariant · **Status:** Active
**Layer:** Application + database constraint
**Since:** 2026-08-05

Unset cedulas do not collide.

**Why:** The cedula is the legal identity behind the contract. Two accounts
under one document number is either a data-entry duplicate or someone
contracting twice under one identity — both need to surface at entry time, not
at billing time.

**Enforced at:** `src/application/customers/use-cases/CreateCustomerUseCase.ts` (`ensureUnique`),
`src/application/customers/use-cases/UpdateCustomerUseCase.ts` (`ensureUnique`)
**Backed by:** `Customer.cedula @unique` in `prisma/schema.prisma`
**Message:** `A customer with cedula "<value>" already exists`
**Tests:** `tests/application/customers/use-cases/CreateCustomerUseCase.test.ts`,
`tests/application/customers/use-cases/UpdateCustomerUseCase.test.ts`

### CUS-019 — A customer may resubmit its own unique values

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

On update, the uniqueness checks of `CUS-016` … `CUS-018` ignore a match whose
id is the customer being edited.

**Why:** A form that resends every field, changed or not, is the normal client
shape. Without this carve-out, correcting a customer's name would fail because
their own phone number "already exists".

**Enforced at:** `src/application/customers/use-cases/UpdateCustomerUseCase.ts` (`ensureUnique`)
**Tests:** `tests/application/customers/use-cases/UpdateCustomerUseCase.test.ts`

### CUS-020 — A customer with contracted services cannot be deleted

**Type:** Policy · **Status:** Active
**Layer:** Application + database constraint
**Since:** 2026-08-05

The services must be removed first, whatever their status — cancelled ones count.

**Why:** Deleting the customer would orphan bills that name them and services
still bonded to live equipment. Refusing forces the operator to decide what
happens to the subscription explicitly, which is the decision that actually
matters.

**Enforced at:** `src/application/customers/use-cases/DeleteCustomerUseCase.ts`
**Backed by:** `ContractedService.customer … onDelete: Restrict` in `prisma/schema.prisma`
**Message:** `Cannot delete customer: they have <n> contracted service(s). Remove all contracted services first.`
**Tests:** `tests/application/customers/use-cases/DeleteCustomerUseCase.test.ts`

### CUS-021 — An update request must carry at least one field

**Type:** Validation · **Status:** Active
**Layer:** Presentation
**Since:** 2026-08-05

Applies to customers, service plans and contracted services alike.

**Why:** An empty body is a client bug — a form that submitted nothing, or a
field name that was misspelled and silently dropped. Answering `200 OK` to it
hides the bug behind a success.

**Enforced at:** `src/presentation/http/validation/customer.schemas.ts`,
`service-plan.schemas.ts`, `contracted-service.schemas.ts` (`.refine`)
**Message:** `At least one field must be provided for update`
**Tests:** `tests/integration/customer.routes.test.ts`

### CUS-022 — Setting a field to the value it already holds changes nothing

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

Every `Customer` and `ServicePlan` mutator compares first and returns success
without touching `updatedAt` or emitting an event.

**Why:** `updatedAt` is what the office reads as "when was this last touched",
and the update event is what downstream handlers react to. A client that resends
the whole record on every save would otherwise make both meaningless.

**Enforced at:** `src/domain/customers/aggregates/Customer.ts`,
`src/domain/customers/aggregates/ServicePlan.ts`
**Reached from:** `rename`, `changePhone`, `changeEmail`, `changeCedula`,
`updatePricing`, `updateBandwidth`, `updateDescription`, `activate`, `deactivate`
**Tests:** `tests/domain/customers/aggregates/Customer.test.ts`,
`tests/domain/customers/aggregates/ServicePlan.test.ts`

### CUS-023 — A real change to a customer records which fields moved

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

`CustomerUpdatedEvent` carries the list of changed field names alongside the id.

**Why:** A handler that only wants to react to a phone change should not have to
diff the aggregate to find out whether one happened. The same shape is used by
`ServicePlanUpdatedEvent` for the same reason.

**Enforced at:** `src/domain/customers/aggregates/Customer.ts` (`emitUpdated`)
**Tests:** `tests/domain/customers/aggregates/Customer.test.ts`

---

## Service plan catalogue

### CUS-030 — A service plan must have a name

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

Non-empty after trimming, and stored trimmed.

**Why:** The plan name is what appears on the bill line item (`BIL-032`) and on
the dropdown the operator picks from. An unnamed plan cannot be chosen or
explained to a subscriber.

**Enforced at:** `src/domain/customers/aggregates/ServicePlan.ts` (`validate`, `rename`)
**Reached from:** `create`, `rename`
**Message:** `Service plan name cannot be empty`
**Tests:** `tests/domain/customers/aggregates/ServicePlan.test.ts`

### CUS-031 — A service plan name cannot exceed 100 characters

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

**Why:** The name is copied verbatim onto every bill line item, whose column is
the same width. The description field carries anything longer.

**Enforced at:** `src/domain/customers/aggregates/ServicePlan.ts` (`validate`, `rename`)
**Reached from:** `create`, `rename`
**Backed by:** `ServicePlan.name @db.VarChar(100)` in `prisma/schema.prisma`
**Message:** `Service plan name cannot exceed 100 characters`
**Tests:** `tests/domain/customers/aggregates/ServicePlan.test.ts`

### CUS-032 — A service plan name is unique across the catalogue, case-insensitively

**Type:** Invariant · **Status:** Active
**Layer:** Application + database constraint
**Since:** 2026-08-05
**Revised:** 2026-09-03 (case-insensitive comparison)

Comparison is case-insensitive: `Plan 10 Mbps` and `plan 10 mbps` collide. The
stored value keeps whatever casing the operator typed — only the collision
check folds case. A plan may keep its own name, including "renaming" itself to
a different case of that same name, since the check excludes a match on its
own id.

**Why:** The plan is chosen by name by whoever contracts a service. Two plans
called "Plan 10 Mbps" at different prices means the operator picks one at random
and the subscriber is billed the other — two spellings differing only in case
are exactly as ambiguous as an exact duplicate.

**Enforced at:** `src/application/customers/use-cases/CreateServicePlanUseCase.ts`,
`src/application/customers/use-cases/UpdateServicePlanUseCase.ts`, via a
case-insensitive lookup in
`src/infrastructure/customers/repositories/PrismaServicePlanRepository.ts`
(`findByName` — Postgres `mode: 'insensitive'`)
**Backed by:** `ServicePlan.name @unique` in `prisma/schema.prisma` — this is a
case-sensitive index, so it only catches exact-case duplicates; case-insensitive
collisions rely on the application-level check above, not the database, so a
race between two concurrent creates with different casing is not closed by the
database.
**Message:** `A service plan with name "<value>" already exists`
**Tests:** `tests/infrastructure/customers/repositories/PrismaServicePlanRepository.test.ts`,
`tests/application/customers/use-cases/CreateServicePlanUseCase.test.ts`,
`tests/application/customers/use-cases/UpdateServicePlanUseCase.test.ts`,
`tests/integration/service-plan.routes.test.ts`

### CUS-033 — Download bandwidth must be greater than zero

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

**Why:** A plan is a promise of throughput. Zero is not a slow plan, it is a
disconnected one — and the suspension mechanism (`SVC-`) is what expresses that,
not the catalogue.

**Enforced at:** `src/domain/customers/aggregates/ServicePlan.ts` (`validateBandwidth`)
**Reached from:** `create`, `updateBandwidth`
**Message:** `downloadMbps must be greater than 0`
**Tests:** `tests/domain/customers/aggregates/ServicePlan.test.ts`

### CUS-034 — Upload bandwidth must be greater than zero

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

**Why:** Same as `CUS-033`. Asymmetric plans are normal; a zero-upload plan is
not a plan.

**Enforced at:** `src/domain/customers/aggregates/ServicePlan.ts` (`validateBandwidth`)
**Reached from:** `create`, `updateBandwidth`
**Message:** `uploadMbps must be greater than 0`
**Tests:** `tests/domain/customers/aggregates/ServicePlan.test.ts`

### CUS-035 — Bandwidth is a whole number of Mbps

**Type:** Validation · **Status:** Active
**Layer:** Presentation + database constraint
**Since:** 2026-08-05

**Why:** The router queue that enforces the plan is configured in whole Mbps, so
a fractional plan could not be applied as written. The aggregate accepts any
positive number — the HTTP schema and the integer column are what hold the line,
which is why this is a validation and not an invariant.

**Enforced at:** `src/presentation/http/validation/service-plan.schemas.ts` (`bandwidthField`)
**Backed by:** `ServicePlan.downloadMbps Int`, `ServicePlan.uploadMbps Int` in `prisma/schema.prisma`
**Message:** `Bandwidth must be an integer`
**Tests:** `tests/integration/service-plan.routes.test.ts`

### CUS-036 — A monthly price cannot be negative

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

Zero is allowed; below zero is not.

**Why:** A zero-price plan is a real thing — a courtesy line, a staff account.
A negative one is a credit, which belongs in billing as an adjustment, not in
the catalogue as a plan that pays the subscriber every month.

**Enforced at:** `src/domain/customers/aggregates/ServicePlan.ts` (`validatePrice`)
**Reached from:** `create`, `updatePricing`
**Message:** `monthlyPrice cannot be negative`
**Tests:** `tests/domain/customers/aggregates/ServicePlan.test.ts`

### CUS-037 — A monthly price is held to two decimal places

**Type:** Validation · **Status:** Active
**Layer:** Infrastructure (database)
**Since:** 2026-08-05

**Why:** Prices are money and money is exact. The column is `Decimal(12, 2)`
rather than a float precisely so that a price never drifts by a cent between
what was set and what is billed.

**Backed by:** `ServicePlan.monthlyPrice @db.Decimal(12, 2)` in `prisma/schema.prisma`
**Tests:** `tests/infrastructure/customers/mappers/ServicePlanPrismaMapper.test.ts`

### CUS-038 — A service plan description cannot exceed 500 characters

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

The description is optional and may be cleared to `null`.

**Why:** Room for the terms a salesperson needs to quote, and no more. Unlike
the name (`CUS-031`), the length is checked against the raw value — the
description is not trimmed.

**Enforced at:** `src/domain/customers/aggregates/ServicePlan.ts` (`validate`, `updateDescription`)
**Reached from:** `create`, `updateDescription`
**Backed by:** `ServicePlan.description @db.VarChar(500)` in `prisma/schema.prisma`
**Message:** `Service plan description cannot exceed 500 characters`
**Tests:** `tests/domain/customers/aggregates/ServicePlan.test.ts`

### CUS-039 — A new service plan is active unless stated otherwise

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

`isActive` defaults to `true` when the caller does not supply it.

**Why:** The reason to create a plan is to sell it. Requiring a second call to
activate would mean the common path takes two steps and the forgotten one
produces a plan nobody can find.

**Enforced at:** `src/domain/customers/aggregates/ServicePlan.ts` (`create`)
**Backed by:** `ServicePlan.isActive @default(true)` in `prisma/schema.prisma`
**Tests:** `tests/domain/customers/aggregates/ServicePlan.test.ts`

### CUS-040 — Deactivating a plan does not disturb the services already on it

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

`deactivate()` flips one flag. Subscribers on the plan keep their service, their
bandwidth and their price.

**Why:** Retiring a plan means "stop selling this", not "cut off everyone who
bought it". Grandfathered subscribers are the normal outcome of a price change,
and the alternative — cascading a catalogue edit into live service — is the kind
of accident `DEV-043` was written after.

**Enforced at:** `src/domain/customers/aggregates/ServicePlan.ts` (`deactivate`)
**Tests:** `tests/domain/customers/aggregates/ServicePlan.test.ts`

### CUS-041 — A plan referenced by a contracted service cannot be deleted

**Type:** Policy · **Status:** Active
**Layer:** Application + database constraint
**Since:** 2026-08-05

Deactivating it (`CUS-040`) is the supported way to retire a plan in use.

**Why:** The plan is what a bill line item is priced from. Deleting one out from
under a live subscription would leave services pointing at nothing and bills
that cannot explain their own amount.

**Enforced at:** `src/application/customers/use-cases/DeleteServicePlanUseCase.ts`
**Backed by:** `ContractedService.servicePlan … onDelete: Restrict` in `prisma/schema.prisma`
**Message:** `Cannot delete service plan: it is referenced by <n> contracted service(s).`
**Tests:** `tests/integration/service-plan.routes.test.ts`

### CUS-042 — A contracted service may be placed on an inactive plan

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Creating or repointing a contracted service checks that the plan **exists**
(`CUS-065`, `CUS-076`), not that it is active.

**Why:** Recorded deliberately because it looks like an oversight. A retired
plan still has subscribers under `CUS-040`, and correcting a mis-entered
subscription onto the plan the customer actually holds is a normal back-office
fix. Refusing it would make the correction impossible without first reactivating
a plan that is no longer sold.

**Enforced at:** `src/application/customers/use-cases/CreateContractedServiceUseCase.ts`,
`src/application/customers/use-cases/UpdateContractedServiceUseCase.ts` (`applyPlanChange`)
**Tests:** `tests/application/customers/use-cases/CreateContractedServiceUseCase.test.ts`

---

## Contracted service lifecycle and status

### CUS-060 — A contracted service must name a customer

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

**Why:** The subscription exists to say who owes for what. Without a customer it
cannot be billed, suspended, or answered for at the counter.

**Enforced at:** `src/domain/customers/aggregates/ContractedService.ts` (`create`)
**Message:** `customerId is null or undefined`
**Tests:** `tests/domain/customers/aggregates/ContractedService.test.ts`

### CUS-061 — A contracted service must name a service plan

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

**Why:** The plan is the price and the bandwidth. A subscription without one has
no amount to bill and no shaping to apply.

**Enforced at:** `src/domain/customers/aggregates/ContractedService.ts` (`create`)
**Message:** `servicePlanId is null or undefined`
**Tests:** `tests/domain/customers/aggregates/ContractedService.test.ts`

### CUS-062 — A contracted service must have a start date

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

It must be a real `Date`, not a string or an invalid one.

**Why:** The start date is when the subscriber became liable. Billing periods
are counted from it, so an absent or unparseable value silently produces a bill
for the wrong months.

**Enforced at:** `src/domain/customers/aggregates/ContractedService.ts` (`create`)
**Message:** `startDate is null or undefined` / `startDate is not a valid date`
**Tests:** `tests/domain/customers/aggregates/ContractedService.test.ts`

### CUS-063 — An omitted start date means today

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

A supplied but unparseable date is still rejected — the default applies only to
absence.

**Why:** A service is usually contracted on the day it is entered. Defaulting
saves the common case a field; refusing garbage keeps the shortcut from
swallowing a typo.

**Enforced at:** `src/application/customers/use-cases/CreateContractedServiceUseCase.ts` (`parseStartDate`)
**Message:** `startDate is not a valid date`
**Tests:** `tests/application/customers/use-cases/CreateContractedServiceUseCase.test.ts`

### CUS-064 — The named customer must exist

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

**Why:** A well-formed UUID is not a customer. Checking before saving turns a
foreign-key error from the database into a message naming what was not found.

**Enforced at:** `src/application/customers/use-cases/CreateContractedServiceUseCase.ts`
**Message:** `Customer not found: <id>`
**Tests:** `tests/application/customers/use-cases/CreateContractedServiceUseCase.test.ts`

### CUS-065 — The named service plan must exist

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

**Why:** Same as `CUS-064`.

**Enforced at:** `src/application/customers/use-cases/CreateContractedServiceUseCase.ts`
**Message:** `Service plan not found: <id>`
**Tests:** `tests/application/customers/use-cases/CreateContractedServiceUseCase.test.ts`

### CUS-066 — A new contracted service starts PENDING

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

**Why:** Contracting and installing are different days. PENDING is the state
between the customer signing and the technician arriving with a device — which
is exactly the gap `CUS-069` refuses to let anyone skip.

**Enforced at:** `src/domain/customers/aggregates/ContractedService.ts` (`create`)
**Backed by:** `ContractedService.status @default(PENDING)` in `prisma/schema.prisma`
**Tests:** `tests/domain/customers/aggregates/ContractedService.test.ts`

### CUS-067 — A contracted service is PENDING, ACTIVE, SUSPENDED or CANCELLED

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

- **PENDING** — contracted, not yet delivering service
- **ACTIVE** — delivering service, bonded to a device
- **SUSPENDED** — bonded but throttled or cut off, usually for non-payment
- **CANCELLED** — over, and terminal (`CUS-068`)

**Why:** The four states are what the enforcement side keys on: `SVC-` acts on
the transition into and out of SUSPENDED, and billing counts what was ACTIVE
during a period. Adding a fifth means teaching both.

**Enforced at:** `src/domain/customers/enums/ContractedServiceStatus.ts`
**Backed by:** `ContractedServiceStatus` enum in `prisma/schema.prisma`
**Tests:** `tests/domain/customers/aggregates/ContractedService.test.ts`

### CUS-068 — CANCELLED is terminal

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

No mutator on a cancelled service succeeds — not a status change, not a device
assignment, not a plan change.

**Why:** Cancellation is the end of the commercial relationship, and bills
already issued refer to it. Letting a cancelled subscription be revived in place
would rewrite what those bills describe; the supported path is a new contracted
service.

**Enforced at:** `src/domain/customers/aggregates/ContractedService.ts` (`ensureNotCancelled`)
**Reached from:** `assignDevice`, `releaseDevice`, `activate`, `suspend`, `cancel`, `changePlan`
**Message:** `Cannot modify a cancelled contracted service`
**Tests:** `tests/domain/customers/aggregates/ContractedService.test.ts`

### CUS-069 — A service cannot be created ACTIVE without a device

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

**Why:** ACTIVE means "service is being delivered", and it is delivered through
a specific piece of equipment. An ACTIVE service with no device cannot be
suspended when the subscriber stops paying — there is nothing to throttle — so
it would be permanently unenforceable.

**Enforced at:** `src/domain/customers/aggregates/ContractedService.ts` (`create`)
**Message:** `Cannot create an ACTIVE contracted service without a device assigned`
**Tests:** `tests/domain/customers/aggregates/ContractedService.test.ts`

### CUS-070 — A service cannot be activated without a device

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

The same requirement as `CUS-069`, on the transition rather than on creation.

**Why:** Both doors into ACTIVE have to be closed, or the invariant holds only
for services that were born active. This is the door the update use case walks
through, which is why `CUS-075` orders the device assignment before it.

**Enforced at:** `src/domain/customers/aggregates/ContractedService.ts` (`activate`)
**Reached from:** `activate`, `reactivate`
**Message:** `Cannot activate a contracted service without a device assigned`
**Tests:** `tests/domain/customers/aggregates/ContractedService.test.ts`

### CUS-071 — Reactivating is activating

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

`reactivate()` delegates to `activate()` and carries the same device requirement.

**Why:** Coming back from suspension is not a different transition from going
live the first time — the same conditions have to hold. The separate name exists
for readability at the call site, not for different behaviour.

**Enforced at:** `src/domain/customers/aggregates/ContractedService.ts` (`reactivate`)
**Tests:** `tests/domain/customers/aggregates/ContractedService.test.ts`

### CUS-072 — Moving to the status already held changes nothing

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

No event, no `updatedAt` bump.

**Why:** `ContractedServiceStatusChangedEvent` triggers real hardware work —
`SVC-` queues a router rule off it and `NOT-` sends the subscriber a message.
Re-suspending an already suspended service must not do either a second time.

**Enforced at:** `src/domain/customers/aggregates/ContractedService.ts` (`changeStatus`)
**Reached from:** `activate`, `suspend`, `cancel`
**Tests:** `tests/domain/customers/aggregates/ContractedService.test.ts`

### CUS-073 — Every real status change announces both statuses

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

`ContractedServiceStatusChangedEvent` carries the previous and the new status.

**Why:** The handlers care about the direction, not the destination. Enforcement
suspends on the way into SUSPENDED and releases on the way out, and it cannot
tell the two apart from the new status alone.

**Enforced at:** `src/domain/customers/aggregates/ContractedService.ts` (`changeStatus`)
**Tests:** `tests/domain/customers/aggregates/ContractedService.test.ts`,
`tests/application/service-enforcement/event-handlers/ContractedServiceStatusChangedEnforcementHandler.test.ts`

### CUS-074 — PENDING cannot be requested over HTTP

**Type:** Validation · **Status:** Active
**Layer:** Presentation + Application
**Since:** 2026-08-05

The update endpoint accepts `ACTIVE`, `SUSPENDED` and `CANCELLED` only.

**Why:** PENDING is where a service starts (`CUS-066`), not somewhere it returns
to. Going back would mean the subscriber was un-installed, which is a device
release, not a status.

**Enforced at:** `src/presentation/http/validation/contracted-service.schemas.ts` (`STATUS_VALUES`),
`src/application/customers/use-cases/UpdateContractedServiceUseCase.ts` (`beforeExecute`)
**Message:** `Invalid target status "<value>". Allowed: ACTIVE, SUSPENDED, CANCELLED`
**Tests:** `tests/application/customers/use-cases/UpdateContractedServiceUseCase.test.ts`

### CUS-075 — One update applies plan, then suspension, then device, then activation, then cancellation

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

A single request may change several things at once. The order is fixed:

1. change the plan
2. suspend, if SUSPENDED was asked for
3. assign or release the device
4. activate, if ACTIVE was asked for
5. cancel, if CANCELLED was asked for

**Why:** The order is what makes the legal combinations legal. Releasing the
device of an ACTIVE service is refused (`CUS-102`), so the suspension has to land
first; activating without a device is refused (`CUS-070`), so the assignment has
to land before it. Cancellation is last because `CUS-068` makes it terminal —
anything after it would fail.

**Enforced at:** `src/application/customers/use-cases/UpdateContractedServiceUseCase.ts` (`executeImpl`)
**Tests:** `tests/application/customers/use-cases/UpdateContractedServiceUseCase.test.ts`

### CUS-076 — Repointing a service requires the new plan to exist

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

**Why:** Same as `CUS-065`, on the update path. The check is in the use case
because the aggregate holds only the plan's id and cannot look it up.

**Enforced at:** `src/application/customers/use-cases/UpdateContractedServiceUseCase.ts` (`applyPlanChange`)
**Message:** `Service plan not found: <id>`
**Tests:** `tests/application/customers/use-cases/UpdateContractedServiceUseCase.test.ts`

### CUS-077 — Repointing a service to the plan it already holds changes nothing

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

**Why:** The `CUS-022` reasoning, applied to the plan link: a client that
resends the whole record should not make `updatedAt` say the subscription
changed today.

**Enforced at:** `src/domain/customers/aggregates/ContractedService.ts` (`changePlan`)
**Tests:** `tests/domain/customers/aggregates/ContractedService.test.ts`

---

## Device bonding

### CUS-100 — A device backs at most one contracted service

**Type:** Invariant · **Status:** Active
**Layer:** Application + database constraint
**Since:** 2026-08-05

**Why:** Suspension works by writing a queue rule against the equipment the
service runs on. If one device backed two subscriptions, suspending one would
cut off the other — and neither the operator nor the router would be able to
tell whose rule was whose.

**Enforced at:** `src/application/customers/use-cases/CreateContractedServiceUseCase.ts` (`ensureDeviceFree`),
`src/application/customers/use-cases/UpdateContractedServiceUseCase.ts` (`applyDeviceChange`)
**Backed by:** `ContractedService.deviceId @unique` in `prisma/schema.prisma`
**Message:** `This device is already assigned to another contracted service`
**Tests:** `tests/application/customers/use-cases/CreateContractedServiceUseCase.test.ts`,
`tests/application/customers/use-cases/UpdateContractedServiceUseCase.test.ts`

### CUS-101 — A device change announces what it replaced

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

`DeviceAssignedToServiceEvent` carries the previous device id — `null` on first
assignment — and the new one, which is `null` on release.

**Why:** When a subscriber's antenna is swapped, whatever enforcement rule sat
on the old device has to be lifted from it and not merely written to the new
one. Only the previous id says where to look.

**Enforced at:** `src/domain/customers/aggregates/ContractedService.ts` (`assignDevice`, `releaseDevice`)
**Tests:** `tests/domain/customers/aggregates/ContractedService.test.ts`

### CUS-102 — The device of an ACTIVE service cannot be released

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

Suspend the service first.

**Why:** The alternative is an ACTIVE service with no device, which `CUS-069`
and `CUS-070` exist to prevent. Forcing the suspension first also means the
subscriber's line is actually cut when the equipment is pulled, rather than
staying nominally live on hardware that is gone.

**Enforced at:** `src/domain/customers/aggregates/ContractedService.ts` (`releaseDevice`)
**Message:** `Cannot release the device of an ACTIVE service; suspend it first`
**Tests:** `tests/domain/customers/aggregates/ContractedService.test.ts`

### CUS-103 — Releasing a device that was never assigned changes nothing

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

Returns success, emits nothing.

**Why:** A `deviceId: null` in an update body is a statement of the desired end
state, not a command. If the service already has no device, that state has been
reached.

**Enforced at:** `src/domain/customers/aggregates/ContractedService.ts` (`releaseDevice`)
**Tests:** `tests/domain/customers/aggregates/ContractedService.test.ts`

### CUS-104 — Reassigning the device already bonded changes nothing

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-05

**Why:** Same as `CUS-103`, from the other side — and it is what keeps `CUS-100`
from rejecting a service's own device as "already assigned".

**Enforced at:** `src/domain/customers/aggregates/ContractedService.ts` (`assignDevice`)
**Tests:** `tests/domain/customers/aggregates/ContractedService.test.ts`

### CUS-105 — Deleting a device unbonds the service rather than deleting it

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure (database)
**Since:** 2026-08-05

The service survives with `deviceId` set to `null`.

**Why:** The subscription is a commercial fact and the device is the equipment
that happened to serve it. Cascading would mean removing a decommissioned
antenna from the inventory silently cancelled somebody's internet — and took the
link to their bills with it.

**Backed by:** `ContractedService.device … onDelete: SetNull` in `prisma/schema.prisma`
**Tests:** `tests/infrastructure/customers/repositories/PrismaContractedServiceRepository.test.ts`

---

## Listing and pagination

### CUS-120 — Listings return 20 rows by default and 100 at most

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

Applies to customers, service plans and contracted services. A larger `limit` is
silently clamped rather than rejected.

**Why:** The cap is what stops one request from reading the whole subscriber
table into memory. Clamping rather than failing means a client asking for too
much still gets a usable answer.

**Enforced at:** `src/application/customers/use-cases/ListCustomersUseCase.ts`,
`ListServicePlansUseCase.ts`, `ListContractedServicesUseCase.ts` (`MAX_LIMIT`)
**Tests:** `tests/integration/customer.routes.test.ts`

### CUS-121 — A limit outside 1…100 is rejected at the edge

**Type:** Validation · **Status:** Active
**Layer:** Presentation
**Since:** 2026-08-05

The offset must be a non-negative integer.

**Why:** The application clamps (`CUS-120`) so nothing dangerous gets through
either way, but a client that asked for 500 rows and silently received 100 has a
bug it cannot see. `400` tells it.

**Enforced at:** `src/presentation/http/validation/customer.schemas.ts`,
`service-plan.schemas.ts`, `contracted-service.schemas.ts`
**Message:** `Limit must be between 1 and 100` / `Offset must be non-negative`
**Tests:** `tests/integration/customer.routes.test.ts`

### CUS-122 — Listing one customer's services returns all of them, unpaged

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-05

`GET /api/contracted-services?customerId=…` ignores `limit` and `offset` and
returns the customer's complete set.

**Why:** A subscriber has a handful of services, not a page of them, and the
caller is invariably rendering the whole list on an account screen. Paging it
would make the common case take two requests to be sure it had everything.

**Enforced at:** `src/application/customers/use-cases/ListContractedServicesUseCase.ts`
**Tests:** `tests/integration/contracted-service.routes.test.ts`

---

## Cross-cutting

### CUS-140 — Customer, plan and subscription endpoints are permission-gated

**Type:** Policy · **Status:** Active
**Layer:** Presentation
**Since:** 2026-08-05

| Endpoint            | Permission |
| ------------------- | ---------- |
| `GET` (list, by id) | `read`     |
| `POST`              | `create`   |
| `PUT`               | `update`   |
| `DELETE`            | `delete`   |

Under the role table in [identity.md](identity.md) (`IDN-030`) this makes
deletion administrator-only across all three resources, while an operator may
create and edit.

**Why:** Deleting a customer or a plan is the one action here that destroys
commercial history, and `CUS-020` and `CUS-041` already force the operator to
dismantle the subscription first. Requiring an administrator for the last step
keeps that from being a formality someone clicks through.

**Enforced at:** `src/presentation/http/routes/customer.routes.ts`,
`service-plan.routes.ts`, `contracted-service.routes.ts` (`authorize`)
**Tests:** `tests/integration/customer.routes.test.ts`
