# Quoting — Business Rules

A sales proposal, not an order. A `Quotation` (cotización) is a technician's
offer to a customer or prospect: catalog hardware from `device-inventory`, a
price set by hand for this quote alone, and a validity window — walked through
Draft, Sent, and one of Accepted, Rejected or Expired.

Format and conventions: [README.md](README.md).

## ID ranges

| Range                 | Area                                       |
| --------------------- | ------------------------------------------ |
| `QUO-001` … `QUO-029` | Identity, customer snapshot, and dates     |
| `QUO-030` … `QUO-049` | Line items and totals                      |
| `QUO-050` … `QUO-079` | Status machine                             |
| `QUO-080` … `QUO-099` | Creation and editing (Draft-only mutation) |
| `QUO-100` … `QUO-119` | PDF rendering                              |
| `QUO-120` … `QUO-139` | Listing and filtering                      |
| `QUO-140` … `QUO-159` | Cross-cutting (access control, deletion)   |

## Layer coverage

| Layer                     | Rules |
| ------------------------- | ----- |
| Domain (aggregate)        | 15    |
| Domain (value object)     | 6     |
| Application               | 6     |
| Infrastructure (database) | 3     |
| Presentation              | 3     |

Money arithmetic is not declared here. `Money` is shared-kernel and its rules
live in [shared.md](shared.md).

Authentication, roles and rate limiting are declared in
[identity.md](identity.md). `QUO-140` records only this context's permission map.

---

## Identity, customer snapshot, and dates

### QUO-001 — A quotation must name a customer

**Type:** Invariant · **Status:** Active
**Since:** 2026-09-04

`customerName` is required, trimmed, and cannot be empty after trimming.

**Why:** Every quote is addressed to someone, whether or not that someone is
already a `Customer` record. A quote with no name on it is not a document
anyone could send.

**Enforced at:** `src/domain/quoting/aggregates/Quotation.ts` (`validate`)
**Reached from:** `create`, `replaceLineItems`, `updateDetails`, `send`, `accept`, `reject`, `markExpired`
**Message:** `Customer name cannot be empty`
**Tests:** `tests/domain/quoting/aggregates/Quotation.test.ts`

### QUO-002 — A customer name is at most 150 characters

**Type:** Validation · **Status:** Active
**Since:** 2026-09-04

**Why:** Same bound as `Customer.fullName` (`CUS-`-series) and `Ticket.title` —
long enough for any real name, short enough to fit a PDF header without wrapping.

**Enforced at:** `src/domain/quoting/aggregates/Quotation.ts` (`validate`)
**Backed by:** `Quotation.customerName @db.VarChar(150)` in `prisma/schema.prisma`
**Message:** `Customer name cannot exceed 150 characters`
**Tests:** `tests/domain/quoting/aggregates/Quotation.test.ts`

### QUO-003 — Linking an existing customer is optional

**Type:** Policy · **Status:** Active
**Since:** 2026-09-04

`customerId` may be null. A prospect who is not yet a `Customer` record still
gets a quote — only the free-text snapshot fields are required.

**Why:** Sales happens before onboarding. Forcing every prospect through
customer creation first would put a data-entry step between the technician and
the thing that actually closes deals: a professional quote in the customer's
hand.

**Enforced at:** `src/application/quoting/use-cases/CreateQuotationUseCase.ts` (`resolveCustomer`)
**Tests:** `tests/integration/use-cases/quoting/CreateQuotationUseCase.integration.test.ts`

### QUO-004 — Customer name, phone, email, and address are snapshotted at creation, never re-read live

**Type:** Invariant · **Status:** Active
**Since:** 2026-09-04

Unlike `GetBillPdfUseCase`, which reads the customer live (`BIL-102`),
`GetQuotationPdfUseCase` never calls `ICustomerRepository` — every field it
prints already lives on the `Quotation` row.

**Why:** A quote is a point-in-time offer: the price and the person it was
offered to must match what the technician actually sent, even if the
`Customer` record is edited or deleted afterward. It is also the only option —
`Customer` has no address field at all, so an address can only ever come from
this free-text snapshot, never from a join.

**Enforced at:** `src/application/quoting/use-cases/CreateQuotationUseCase.ts` (`resolveCustomer`),
`src/application/quoting/use-cases/GetQuotationPdfUseCase.ts`
**Backed by:** `Quotation.customerName/customerPhone/customerEmail/customerAddress` in `prisma/schema.prisma`
**Tests:** `tests/integration/use-cases/quoting/CreateQuotationUseCase.integration.test.ts`

### QUO-005 — A quotation must have a validity date

**Type:** Invariant · **Status:** Active
**Since:** 2026-09-04

`validUntil` is required and must be a real `Date`.

**Why:** `QUO-056` needs a date to compare against before a quote can expire,
and the PDF's entire "act now" framing (`QUO-101`) depends on there being a
deadline printed on the page.

**Enforced at:** `src/domain/quoting/aggregates/Quotation.ts` (`validate`)
**Message:** `validUntil is null or undefined` / `validUntil must be a valid Date`
**Tests:** `tests/domain/quoting/aggregates/Quotation.test.ts`

### QUO-006 — A quote number is assigned by the database sequence, never supplied

**Type:** Invariant · **Status:** Active
**Since:** 2026-09-04

`code` is `null` on every quotation returned by `create()`, exactly like
`Ticket.code`. It is filled in only once the row is read back after the first
save.

**Why:** A caller-supplied number could collide or be guessed; a
database-owned sequence guarantees every quote gets a distinct, gapless-enough
number with no coordination required between concurrent requests.

**Enforced at:** `src/domain/quoting/aggregates/Quotation.ts` (`create`),
`src/infrastructure/quoting/repositories/PrismaQuotationRepository.ts` (`save`)
**Backed by:** `Quotation.code Int @unique @default(autoincrement())` in `prisma/schema.prisma`
**Tests:** `tests/integration/use-cases/quoting/CreateQuotationUseCase.integration.test.ts`

---

## Line items and totals

### QUO-030 — A quotation must have at least one line item

**Type:** Invariant · **Status:** Active
**Since:** 2026-09-04

Checked on creation and again whenever line items are replaced.

**Why:** An empty quote offers nothing and prices nothing — there is no
document to send. Mirrors `BIL-030`.

**Enforced at:** `src/domain/quoting/aggregates/Quotation.ts` (`validate`)
**Reached from:** `create`, `replaceLineItems`
**Message:** `A quotation must have at least one line item`
**Tests:** `tests/domain/quoting/aggregates/Quotation.test.ts`

### QUO-031 — A line item names the catalog item it was built from and what it's called on this quote

**Type:** Invariant · **Status:** Active
**Since:** 2026-09-04

`deviceModelName`, `vendorName`, and `deviceType` are required strings — plain
snapshots, not the live `DeviceType` value object — and `description` is
required, trimmed, and at most 500 characters.

**Why:** The description is the line the customer actually reads; the
device-model/vendor/type fields are the traceability that lets a technician
answer "what exactly did we quote them" months later, even after the catalog
entry changes or is deleted (`QUO-035`).

**Enforced at:** `src/domain/quoting/value-objects/QuotationLineItem.ts` (`create`)
**Message:** `deviceModelName cannot be empty` / `description cannot be empty`
**Tests:** `tests/domain/quoting/value-objects/QuotationLineItem.test.ts`

### QUO-032 — A description defaults to the catalog item's name but is freely editable

**Type:** Policy · **Status:** Active
**Since:** 2026-09-04

If the technician does not supply a description when adding a line item,
`CreateQuotationUseCase` and `UpdateQuotationLineItemsUseCase` fall back to
`"<vendor> <model>"`.

**Why:** Most lines need no customization — the catalog name is enough. But a
technician bundling a camera with a PoE injector and a mounting bracket needs
to say so on the line itself, so the field is never locked to the catalog name.

**Enforced at:** `src/application/quoting/use-cases/CreateQuotationUseCase.ts` (`buildLineItems`),
`src/application/quoting/use-cases/UpdateQuotationLineItemsUseCase.ts` (`buildLineItems`)
**Tests:** `tests/integration/use-cases/quoting/CreateQuotationUseCase.integration.test.ts`

### QUO-033 — A line item's quantity is a positive integer

**Type:** Validation · **Status:** Active
**Since:** 2026-09-04

Zero, negative, and fractional quantities are all rejected.

**Why:** A quote line for "0.5 antennas" or "-1 cameras" cannot correspond to
anything a warehouse could actually pull and install.

**Enforced at:** `src/domain/quoting/value-objects/QuotationLineItem.ts` (`create`)
**Message:** `quantity must be a positive integer`
**Tests:** `tests/domain/quoting/value-objects/QuotationLineItem.test.ts`

### QUO-034 — A line item's price is entered by hand for this quote, never derived from a catalog price

**Type:** Policy · **Status:** Active
**Since:** 2026-09-04

There is no price field anywhere on `DeviceModel` or `Vendor`. `unitPrice` is
supplied fresh on every `CreateQuotationUseCase` / `UpdateQuotationLineItemsUseCase`
call.

**Why:** Confirmed product decision: pricing varies by customer, quantity, and
negotiation in a way a single catalog price could never capture. Building a
reusable catalog price was explicitly rejected in favor of "pick the item, set
the price, on this quote."

**Enforced at:** `src/application/quoting/use-cases/CreateQuotationUseCase.ts` (`buildLineItems`)
**Tests:** `tests/integration/use-cases/quoting/CreateQuotationUseCase.integration.test.ts`

### QUO-035 — A line item's catalog reference survives the referenced DeviceModel being deleted

**Type:** Policy · **Status:** Active
**Since:** 2026-09-04

`deviceModelId` is nullable and `onDelete: SetNull`. Every field the PDF
actually renders — name, vendor, type, image — is already copied onto the line
item, so nulling the FK loses nothing displayed.

**Why:** A catalog cleanup months later must never retroactively break a quote
that already went out, and must certainly never cascade-delete it.

**Backed by:** `QuotationLineItem.deviceModel … onDelete: SetNull` in `prisma/schema.prisma`
**Tests:** `tests/domain/quoting/value-objects/QuotationLineItem.test.ts`

### QUO-036 — A quotation's total is computed from its line items, never stored

**Type:** Invariant · **Status:** Active
**Since:** 2026-09-04

`subtotal` and `total` sum `lineTotal` (itself `unitPrice.multiply(quantity)`)
across all line items each time they are read. `total` currently equals
`subtotal` — the split exists so a real tax line can be added later without a
schema change or a renderer rewrite.

**Why:** Mirrors `BIL-034` — a stored total is a second source of truth that
can drift from the lines beneath it. Computing on read makes that impossible.

**Enforced at:** `src/domain/quoting/aggregates/Quotation.ts` (`subtotal`, `total`)
**Tests:** `tests/domain/quoting/aggregates/Quotation.test.ts`

---

## Status machine

### QUO-050 — A quotation is DRAFT, SENT, ACCEPTED, REJECTED, or EXPIRED

**Type:** Invariant · **Status:** Active
**Since:** 2026-09-04

- **DRAFT** — being assembled, editable, not yet shown to the customer
- **SENT** — delivered, awaiting the customer's decision
- **ACCEPTED**, **REJECTED**, **EXPIRED** — terminal outcomes

**Enforced at:** `src/domain/quoting/enums/QuotationStatus.ts`
**Backed by:** `QuotationStatus` enum in `prisma/schema.prisma`
**Tests:** `tests/domain/quoting/aggregates/Quotation.test.ts`

### QUO-051 — A new quotation is DRAFT

**Type:** Invariant · **Status:** Active
**Since:** 2026-09-04

`create` ignores any status the caller might supply and always starts at
`DRAFT`, with every transition date null.

**Why:** A quote that could be born already Sent or Accepted would skip the
transition that emits its event and the guard that goes with it.

**Enforced at:** `src/domain/quoting/aggregates/Quotation.ts` (`create`)
**Backed by:** `Quotation.status @default(DRAFT)` in `prisma/schema.prisma`
**Tests:** `tests/domain/quoting/aggregates/Quotation.test.ts`

### QUO-052 — Only a DRAFT quotation can be sent

**Type:** Invariant · **Status:** Active
**Since:** 2026-09-04

**Why:** Sending is the one-way door: once a customer has seen the quote, the
technician editing line items behind their back would make the PDF they
received a lie. `QUO-080` is this same boundary, restated at the point it stops
you from editing rather than from sending.

**Enforced at:** `src/domain/quoting/aggregates/Quotation.ts` (`send`)
**Message:** `Cannot send a <status> quotation`
**Tests:** `tests/domain/quoting/aggregates/Quotation.test.ts`,
`tests/integration/use-cases/quoting/SendQuotationUseCase.integration.test.ts`

### QUO-053 — Only a SENT quotation can be accepted

**Type:** Invariant · **Status:** Active
**Since:** 2026-09-04

A customer cannot accept a quote that was never sent to them.

**Enforced at:** `src/domain/quoting/aggregates/Quotation.ts` (`accept`)
**Message:** `Cannot accept a <status> quotation`
**Tests:** `tests/domain/quoting/aggregates/Quotation.test.ts`,
`tests/integration/use-cases/quoting/AcceptQuotationUseCase.integration.test.ts`

### QUO-054 — Only a SENT quotation can be rejected, and rejecting requires a reason

**Type:** Invariant · **Status:** Active
**Since:** 2026-09-04

The reason is required, trimmed, non-empty, and at most 255 characters —
mirrors `Ticket.cancelReason`.

**Why:** A rejected quote with no reason tells the technician nothing to act
on — a follow-up call needs to know whether the price, the timeline, or the
scope was the problem.

**Enforced at:** `src/domain/quoting/aggregates/Quotation.ts` (`reject`)
**Message:** `Cannot reject a <status> quotation` / `A reason is required to reject a quotation` /
`Rejection reason cannot exceed 255 characters`
**Tests:** `tests/domain/quoting/aggregates/Quotation.test.ts`,
`tests/integration/use-cases/quoting/RejectQuotationUseCase.integration.test.ts`

### QUO-055 — Only a SENT quotation past its validity date can be marked expired

**Type:** Invariant · **Status:** Active
**Since:** 2026-09-04

Strictly after `validUntil` — on the day itself, the quote is still current.

**Why:** Mirrors `BIL-054`/`BIL-055`. Expiring is the state that tells a
technician to stop treating the quote as open and follow up or re-quote;
allowing it early would close out an offer before its own deadline.

**Enforced at:** `src/domain/quoting/aggregates/Quotation.ts` (`markExpired`)
**Message:** `Cannot expire a <status> quotation` /
`Cannot mark quotation expired: it is not past its validity date`
**Tests:** `tests/domain/quoting/aggregates/Quotation.test.ts`,
`tests/integration/use-cases/quoting/MarkQuotationExpiredUseCase.integration.test.ts`

### QUO-056 — Terminal-status date consistency is checked in both directions

**Type:** Invariant · **Status:** Active
**Since:** 2026-09-04

`ACCEPTED` requires `acceptedAt` set and `rejectedAt`/`expiredAt`/`rejectionReason`
null; `REJECTED` requires `rejectedAt` and `rejectionReason` set and the others
null; `EXPIRED` requires `expiredAt` set and the others null. `SENT` requires
`sentAt` set; `DRAFT` requires every transition date null.

**Why:** Mirrors `BIL-053`. Stating the rule in both directions is what makes
the status and its dates incapable of disagreeing.

**Enforced at:** `src/domain/quoting/aggregates/Quotation.ts` (`validate`)
**Tests:** `tests/domain/quoting/aggregates/Quotation.test.ts`

### QUO-057 — ACCEPTED, REJECTED, and EXPIRED are terminal

**Type:** Invariant · **Status:** Active
**Since:** 2026-09-04

No mutator accepts any of the three terminal statuses as its starting state.

**Enforced at:** `src/domain/quoting/aggregates/Quotation.ts` (`isTerminal`)
**Tests:** `tests/domain/quoting/aggregates/Quotation.test.ts`

### QUO-058 — Every transition is validated as a whole quotation before it is applied

**Type:** Invariant · **Status:** Active
**Since:** 2026-09-04

Each mutator builds the complete candidate state, runs the same `validate`
that `create` runs, and only then replaces `props`. A failed transition leaves
the quotation exactly as it was.

**Why:** Mirrors `BIL-058`. One shared `validate` covering creation and every
transition means a rule added there cannot be forgotten by a mutator written
later.

**Enforced at:** `src/domain/quoting/aggregates/Quotation.ts` (`send`, `accept`, `reject`, `markExpired`, `replaceLineItems`, `updateDetails`)
**Tests:** `tests/domain/quoting/aggregates/Quotation.test.ts`

### QUO-059 — Every transition announces itself

**Type:** Invariant · **Status:** Active
**Since:** 2026-09-04

`QuotationCreatedEvent`, `QuotationSentEvent`, `QuotationAcceptedEvent`,
`QuotationRejectedEvent`, `QuotationExpiredEvent` — one per transition, emitted
only after validation passes. `replaceLineItems` and `updateDetails` emit
nothing: they are Draft-only data edits, not business transitions.

**Enforced at:** `src/domain/quoting/aggregates/Quotation.ts`
**Tests:** `tests/domain/quoting/aggregates/Quotation.test.ts`

---

## Creation and editing

### QUO-080 — Line items can only be replaced wholesale, and only while DRAFT

**Type:** Policy · **Status:** Active
**Since:** 2026-09-04

There is no per-line add/remove method — `replaceLineItems` takes the full new
array. Persistence already implements this as delete-all-and-reinsert
(`QUO-`-series repository behavior), so the domain method matches the storage
strategy instead of pretending to support incremental edits it does not keep.

**Why:** `Bill` has zero line-item mutators at all — line items are fixed at
generation. A quotation needs to be genuinely editable while a technician
drafts it, but per-line `add`/`remove` use cases would double the application
surface for something the repository already treats as one unit.

**Enforced at:** `src/domain/quoting/aggregates/Quotation.ts` (`replaceLineItems`)
**Message:** `Cannot modify line items of a sent quotation`
**Tests:** `tests/domain/quoting/aggregates/Quotation.test.ts`,
`tests/integration/use-cases/quoting/UpdateQuotationLineItemsUseCase.integration.test.ts`,
`tests/integration/quotation.routes.test.ts`

### QUO-081 — Quotation details can only be edited while DRAFT

**Type:** Policy · **Status:** Active
**Since:** 2026-09-04

`validUntil`, `notes`, and the customer snapshot fields can only change
through `updateDetails`, which refuses anything but DRAFT — the same boundary
as `QUO-080`, for the same reason.

**Enforced at:** `src/domain/quoting/aggregates/Quotation.ts` (`updateDetails`)
**Message:** `Cannot update details of a sent quotation`
**Tests:** `tests/domain/quoting/aggregates/Quotation.test.ts`,
`tests/integration/use-cases/quoting/UpdateQuotationDetailsUseCase.integration.test.ts`

### QUO-082 — Creating a quotation resolves an existing customer or requires free-text identity

**Type:** Policy · **Status:** Active
**Since:** 2026-09-04

`CreateQuotationUseCase` fails before touching the database if neither
`customerId` nor `customerName` is present in the request.

**Why:** Catching this in `beforeExecute` gives a clear, immediate error
instead of a confusing domain-validation failure after a wasted round trip.

**Enforced at:** `src/application/quoting/use-cases/CreateQuotationUseCase.ts` (`beforeExecute`)
**Message:** `Either customerId or customerName is required`
**Tests:** `tests/integration/use-cases/quoting/CreateQuotationUseCase.integration.test.ts`

### QUO-083 — A line item snapshots the referenced DeviceModel's name, vendor, type, and image at add-time

**Type:** Invariant · **Status:** Active
**Since:** 2026-09-04

`CreateQuotationUseCase` and `UpdateQuotationLineItemsUseCase` both resolve
each `deviceModelId` and copy `deviceModelName`, `vendorName`, `deviceType`,
and `imageUrl` onto the line item at that moment.

**Why:** A catalog entry can be renamed, reclassified, or have its image
changed later (`DEV-`-series). A quote already sent must keep saying what it
said when it was built — the same reasoning as `BIL-032` for bill line items.

**Enforced at:** `src/application/quoting/use-cases/CreateQuotationUseCase.ts` (`buildLineItems`),
`src/application/quoting/use-cases/UpdateQuotationLineItemsUseCase.ts` (`buildLineItems`)
**Tests:** `tests/integration/use-cases/quoting/CreateQuotationUseCase.integration.test.ts`

### QUO-084 — Adding a line item with an unknown DeviceModel is rejected

**Type:** Policy · **Status:** Active
**Since:** 2026-09-04

**Enforced at:** `src/application/quoting/use-cases/CreateQuotationUseCase.ts` (`buildLineItems`),
`src/application/quoting/use-cases/UpdateQuotationLineItemsUseCase.ts` (`buildLineItems`)
**Message:** `Device model not found: <id>`
**Tests:** `tests/integration/use-cases/quoting/CreateQuotationUseCase.integration.test.ts`,
`tests/integration/use-cases/quoting/UpdateQuotationLineItemsUseCase.integration.test.ts`

---

## PDF rendering

### QUO-100 — A quotation PDF requires the quotation to exist

**Type:** Policy · **Status:** Active
**Since:** 2026-09-04

Unlike `BIL-100`, no second aggregate lookup is needed — the customer snapshot
already lives on the quotation (`QUO-004`).

**Enforced at:** `src/application/quoting/use-cases/GetQuotationPdfUseCase.ts`
**Message:** `Quotation not found: <id>`
**Tests:** `tests/integration/use-cases/quoting/GetQuotationPdfUseCase.integration.test.ts`

### QUO-101 — A quotation PDF is named and headed with its quote number, formatted `COT-NNNN`

**Type:** Policy · **Status:** Active
**Since:** 2026-09-04

The raw `code` integer is prefix-formatted only at the point the PDF (or a
future presentation-layer display) needs a human-facing string —
`formatQuoteNumber` — never stored. Filename: `cotizacion-<COT-NNNN>.pdf`.

**Why:** Same convention as `Ticket.code` (no stored string form). Keeping the
prefix out of the domain and database means it can change (a different
country's convention, a rebrand) without a migration.

**Enforced at:** `src/application/quoting/use-cases/GetQuotationPdfUseCase.ts` (`formatQuoteNumber`)
**Tests:** `tests/integration/use-cases/quoting/GetQuotationPdfUseCase.integration.test.ts`

### QUO-102 — A missing or broken line item image never fails the PDF

**Type:** Policy · **Status:** Active
**Since:** 2026-09-04

`GetQuotationPdfUseCase` fetches each line item's `imageUrl` through
`IImageFetcher` and swallows any failure into a `null` image buffer, logging a
warning rather than aborting. `PdfKitQuotationPdfRenderer` in turn falls back
to a placeholder box if a buffer it does receive turns out to be unparsable.

**Why:** Product images are a one-time, best-effort enrichment (`DEV-`-series
`imageUrl`) — a broken link or a slow host must never be the reason a
technician cannot send a customer their quote.

**Enforced at:** `src/application/quoting/use-cases/GetQuotationPdfUseCase.ts` (`fetchImage`),
`src/infrastructure/quoting/services/PdfKitQuotationPdfRenderer.ts` (`drawThumbnail`)
**Tests:** `tests/integration/use-cases/quoting/GetQuotationPdfUseCase.integration.test.ts`,
`tests/infrastructure/quoting/services/PdfKitQuotationPdfRenderer.test.ts`

### QUO-103 — Image fetching is the only network I/O in quote rendering, and it never happens inside the renderer

**Type:** Policy · **Status:** Active
**Since:** 2026-09-04

`pdfkit`'s `doc.image()` cannot fetch a URL — only a `Buffer` or a local path.
`HttpImageFetcher` is the single place in this feature that performs an HTTP
request; `PdfKitQuotationPdfRenderer` only ever consumes pre-fetched buffers,
keeping it synchronous, pure, and safe to unit-test without a network.

**Enforced at:** `src/infrastructure/quoting/services/HttpImageFetcher.ts`,
`src/infrastructure/quoting/services/PdfKitQuotationPdfRenderer.ts`
**Tests:** `tests/infrastructure/quoting/services/PdfKitQuotationPdfRenderer.test.ts`

---

## Listing and filtering

### QUO-120 — Listings return 20 rows by default and 100 at most

**Type:** Policy · **Status:** Active
**Since:** 2026-09-04

Mirrors `BIL-120`. A larger `limit` is clamped, not rejected.

**Enforced at:** `src/application/quoting/use-cases/ListQuotationsUseCase.ts` (`MAX_LIMIT`)
**Tests:** `tests/integration/use-cases/quoting/ListQuotationsUseCase.integration.test.ts`

### QUO-121 — Quotations can be filtered by customer and status

**Type:** Policy · **Status:** Active
**Since:** 2026-09-04

**Enforced at:** `src/application/quoting/use-cases/ListQuotationsUseCase.ts` (`buildFilters`)
**Message:** `Invalid status "<value>"` / `Invalid customerId: <error>`
**Tests:** `tests/integration/use-cases/quoting/ListQuotationsUseCase.integration.test.ts`

### QUO-122 — A limit outside 1…100 is rejected at the edge

**Type:** Validation · **Status:** Active
**Since:** 2026-09-04

Mirrors `BIL-123`. The application clamps; the presentation edge rejects
outright so a client cannot silently get less than it asked for.

**Enforced at:** `src/presentation/http/validation/quotation.schemas.ts` (`listQuotationsSchema`)
**Message:** `Limit must be between 1 and 100`
**Tests:** `tests/integration/quotation.routes.test.ts`

---

## Cross-cutting

### QUO-140 — Quotation endpoints are permission-gated, and there is no DELETE route

**Type:** Policy · **Status:** Active
**Since:** 2026-09-04

| Endpoint                                                         | Permission |
| ---------------------------------------------------------------- | ---------- |
| `GET /api/quotations`, `/:id`, `/:id/pdf`                        | `read`     |
| `POST /api/quotations`                                           | `create`   |
| `PATCH /api/quotations/:id`, `/:id/line-items`                   | `update`   |
| `POST /api/quotations/:id/send`, `/accept`, `/reject`, `/expire` | `update`   |

**Why:** Same reasoning as `BIL-140` — an abandoned Draft or a Rejected quote
is a record of an offer that was made, not a mistake to be erased. There is no
delete use case at all.

**Enforced at:** `src/presentation/http/routes/quotation.routes.ts` (`authorize`)
**Tests:** `tests/integration/quotation.routes.test.ts`

### QUO-141 — A customer with quotations can still be deleted; their quotations survive with `customerId` set to null

**Type:** Policy · **Status:** Active
**Since:** 2026-09-04

Unlike `BIL-011` (a customer with bills cannot be deleted), a quote's customer
snapshot (`QUO-004`) already contains everything the document needs — the FK
is purely for traceability/filtering, so it is safe to null out.

**Backed by:** `Quotation.customer … onDelete: SetNull` in `prisma/schema.prisma`
**Tests:** `tests/domain/quoting/aggregates/Quotation.test.ts`

### QUO-142 — A deleted DeviceModel does not break existing quotations

**Type:** Policy · **Status:** Active
**Since:** 2026-09-04

Restates `QUO-035` at the schema level: the same `SetNull` reasoning applies
to every line item referencing that model, across every quotation.

**Backed by:** `QuotationLineItem.deviceModel … onDelete: SetNull` in `prisma/schema.prisma`
**Tests:** `tests/domain/quoting/value-objects/QuotationLineItem.test.ts`
