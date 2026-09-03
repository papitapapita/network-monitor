# Business Rules — Device Inventory

The catalogue of physical network equipment: who makes it (Vendor), what it is
(DeviceModel), the individual unit (Device), where it sits (Location), and how
we log into it (Credentials).

Conventions, rule types and the ID scheme are in [README.md](README.md).

**ID ranges**

| Range                 | Subject                                    |
| --------------------- | ------------------------------------------ |
| `DEV-001` – `DEV-019` | Vendor                                     |
| `DEV-020` – `DEV-039` | Device Model                               |
| `DEV-040` – `DEV-089` | Device                                     |
| `DEV-090` – `DEV-119` | Location                                   |
| `DEV-120` – `DEV-139` | Device Credentials                         |
| `DEV-140` – `DEV-159` | Cross-cutting (access, listing, discovery) |
| `DEV-160` – `DEV-179` | Device (continued — first block is full)   |

Rationales marked _(inferred)_ were reconstructed from the code, not stated by
the business. They are the ones to read critically.

Every rule carries two extra fields. **Layer** names the layer that actually
enforces it, so a rule sitting outside the domain is visible without opening the
code. **Tests** lists the suites covering it — `_none_` means genuinely nothing
covers it, which is a gap rather than an omission in this document.

---

## Layer coverage

Where each rule is enforced today. The domain layer is where business rules
belong, so the rows below it are the ones worth arguing about — not all of them
are wrong, but each is a deliberate choice that should stay deliberate.

| Layer                                 | Rules | IDs                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Domain**                            |    42 | DEV-001, DEV-002, DEV-004, DEV-006, DEV-020, DEV-023, DEV-024, DEV-025, DEV-040, DEV-041, DEV-042, DEV-043, DEV-045, DEV-046, DEV-048, DEV-051, DEV-052, DEV-053, DEV-054, DEV-055, DEV-056, DEV-057, DEV-058, DEV-059, DEV-060, DEV-061, DEV-062, DEV-063, DEV-071, DEV-073, DEV-082, DEV-083, DEV-086, DEV-088, DEV-090, DEV-091, DEV-093, DEV-094, DEV-095, DEV-096, DEV-141, DEV-144 |
| **Application**                       |    41 | DEV-005, DEV-008, DEV-021, DEV-026, DEV-027, DEV-029, DEV-030, DEV-044, DEV-050, DEV-065, DEV-066, DEV-067, DEV-068, DEV-069, DEV-075, DEV-076, DEV-077, DEV-080, DEV-081, DEV-085, DEV-089, DEV-092, DEV-097, DEV-098, DEV-099, DEV-120, DEV-121, DEV-122, DEV-123, DEV-124, DEV-125, DEV-126, DEV-127, DEV-128, DEV-129, DEV-130, DEV-131, DEV-132, DEV-142, DEV-143, DEV-145          |
| **Application + Domain**              |     6 | DEV-070, DEV-074, DEV-078, DEV-079, DEV-087, DEV-160                                                                                                                                                                                                                                                                                                                                     |
| **Application + database constraint** |     5 | DEV-003, DEV-007, DEV-022, DEV-047, DEV-049                                                                                                                                                                                                                                                                                                                                              |
| **Infrastructure + Domain**           |     1 | DEV-028                                                                                                                                                                                                                                                                                                                                                                                  |
| **Infrastructure + Application**      |     2 | DEV-072, DEV-084                                                                                                                                                                                                                                                                                                                                                                         |
| **Presentation**                      |     2 | DEV-140, DEV-146                                                                                                                                                                                                                                                                                                                                                                         |

**Half the book sits outside the domain, and most of it belongs there.** The
three clusters are worth naming, because they are not the same kind of
departure:

- **Uniqueness rules** (DEV-003, DEV-007, DEV-022, DEV-047, DEV-049) cannot live
  in an aggregate: no aggregate can see its siblings. They are enforced in the
  use case and backed by a database constraint, which is the standard answer for
  a cross-aggregate invariant, not a shortcut.
- **Referential and deletion rules** (DEV-005, DEV-021, DEV-026, DEV-027,
  DEV-065, DEV-066, DEV-067, DEV-097) span two aggregates for the same reason.
  A domain service could hold them; a use case holding them is the pragmatic
  equivalent.
- **The credential rules** (DEV-120 – DEV-132) are deliberately outside the
  domain, and the Device Credentials section says so: they are infrastructure
  access secrets, not part of a device's identity.

The genuine outliers are **DEV-044** (`ownerType` parsed inline in two use
cases, though every sibling closed set is a value object — G-14) and
**DEV-050** (`installedDate` is the only validated field with no value object
of its own — G-15).

**DEV-092 is not one of them**, despite looking like it. `CoordinatesProps`
declares `latitude` and `longitude` as required non-optional numbers, so half a
coordinate is unrepresentable in the domain — the invariant is enforced by the
type, not by the use case. What `CreateLocationUseCase.ts:44` does is translate
_two independently nullable request fields_ into one clean message before
construction. That is boundary translation, which is the use case's job.

DEV-141 and DEV-144 count as domain because `ROLE_PERMISSIONS` lives in
`domain/identity` — the enforcement point is presentation middleware.

---

## Vendor

### DEV-001 — A vendor has a non-empty name of at most 100 characters

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28
**Revised:** 2026-09-03

The name is trimmed before storage. Whitespace-only names are rejected.

**Why:** The vendor name is the human-facing label in equipment pickers. Empty
names make a dropdown unusable; the 100-character cap matches the database
column and keeps the picker from wrapping.

**Enforced at:** `src/domain/device-inventory/aggregates/Vendor.ts:107` (`Vendor.validateName`)
**Reached from:** `create`, `updateName`
**Message:** `Vendor name cannot be empty` / `Vendor name cannot exceed 100 characters`
**Tests:** `tests/domain/device-inventory/aggregates/Vendor.test.ts`, `tests/integration/use-cases/device-inventory/CreateVendorUseCase.integration.test.ts`, `tests/integration/use-cases/device-inventory/UpdateVendorUseCase.integration.test.ts`, `tests/integration/vendor.routes.test.ts`

### DEV-002 — A vendor slug is lowercase letters, digits and hyphens only

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28
**Revised:** 2026-09-03

Required, non-empty, at most 100 characters, matching
`^[a-z0-9]+(?:-[a-z0-9]+)*$` — e.g. `tp-link`, `ubiquiti`, `mikrotik`. No
leading, trailing or doubled hyphens.

**Why:** The slug is the stable machine identifier for a vendor: it appears in
URLs and on every device model of that vendor. Restricting it to a URL-safe
alphabet means it never needs escaping, and forbidding uppercase prevents
`Ubiquiti` and `ubiquiti` from being treated as two vendors.

**Enforced at:** `src/domain/device-inventory/aggregates/Vendor.ts:125` (`Vendor.validateSlug`)
**Reached from:** `create`, `updateSlug`
**Message:** `Vendor slug must contain only lowercase letters, digits, and hyphens (e.g. "tp-link")`
**Tests:** `tests/domain/device-inventory/aggregates/Vendor.test.ts`, `tests/integration/use-cases/device-inventory/CreateVendorUseCase.integration.test.ts`, `tests/integration/use-cases/device-inventory/UpdateVendorUseCase.integration.test.ts`, `tests/integration/vendor.routes.test.ts`

### DEV-003 — Vendor slugs are unique

**Type:** Invariant · **Status:** Active
**Layer:** Application + database constraint (not in domain)
**Since:** 2026-07-28
**Revised:** 2026-09-03

No two vendors may share a slug. On update, a vendor may keep its own slug —
only a collision with a _different_ vendor is rejected.

**Why:** The slug identifies a vendor across the system. Two vendors sharing one
would make the identifier ambiguous everywhere it is reported.

**Enforced at:** `src/application/device-inventory/use-cases/CreateVendorUseCase.ts:44`, `UpdateVendorUseCase.ts:62`
**Backed by:** `Vendor.slug @unique` in `prisma/schema.prisma:48`
**Message:** `A vendor with slug "<slug>" already exists`
**Tests:** `tests/integration/use-cases/device-inventory/CreateVendorUseCase.integration.test.ts`, `tests/integration/use-cases/device-inventory/UpdateVendorUseCase.integration.test.ts`, `tests/integration/vendor.routes.test.ts`

### DEV-004 — A vendor description is at most 500 characters

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28
**Revised:** 2026-09-03

Optional; defaults to `null`.

**Why:** A free-text note for operators. Capped so it stays a note rather than a
document.

**Enforced at:** `src/domain/device-inventory/aggregates/Vendor.ts:142` (`Vendor.validateDescription`)
**Reached from:** `create`, `updateDescription`
**Message:** `Vendor description cannot exceed 500 characters`
**Tests:** `tests/domain/device-inventory/aggregates/Vendor.test.ts`, `tests/integration/use-cases/device-inventory/CreateVendorUseCase.integration.test.ts`, `tests/integration/use-cases/device-inventory/UpdateVendorUseCase.integration.test.ts`, `tests/integration/vendor.routes.test.ts`

### DEV-005 — A vendor with device models cannot be deleted

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28
**Revised:** 2026-09-03

Deletion is refused while any device model references the vendor. The message
reports how many.

**Why:** Deleting a vendor would orphan its models, and through them every
device built on those models. Refusing forces the operator to decide
deliberately what happens to the equipment rather than losing its provenance
silently.

**Enforced at:** `src/application/device-inventory/use-cases/DeleteVendorUseCase.ts:57`
**Message:** `Cannot delete vendor: it has N device model(s) associated. Remove all device models first.`
**Tests:** `tests/integration/use-cases/device-inventory/DeleteVendorUseCase.integration.test.ts`, `tests/integration/vendor.routes.test.ts`

### DEV-006 — A vendor requires both a name and a slug

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28
**Revised:** 2026-09-03

Both are mandatory at creation. `null`, `undefined`, a non-string and a blank
string are all rejected; neither has a default to fall back on. Update accepts a
new value for either but offers no way to clear one — a vendor cannot lose a
name or a slug once created. DEV-001 and DEV-002 then govern the shape of each.

**Why:** The pair is the whole of a vendor's identity, and the two halves are
not interchangeable. The name is what a human reads in an equipment picker; the
slug is what the system stores and links by, and both are reported on every
device model of that vendor (DEV-028). A vendor missing the name is unusable to
operators, one missing the slug is unaddressable to the code — so neither can be
optional.

**Enforced at:** `src/domain/device-inventory/aggregates/Vendor.ts:104` (`validateName` guard), `:124` (`validateSlug` guard); use case pre-check at `CreateVendorUseCase.ts:23-28`; HTTP fast-fail in `src/presentation/http/validation/vendor.schemas.ts:10-24`
**Reached from:** `create`, `updateName`, `updateSlug`
**Message:** `Vendor name is required` / `Vendor slug is required` (use case); `name is null or undefined` / `slug is null or undefined` (aggregate guards)
**Tests:** `tests/domain/device-inventory/aggregates/Vendor.test.ts`, `tests/application/device-inventory/use-cases/CreateVendorUseCase.test.ts`, `tests/integration/use-cases/device-inventory/CreateVendorUseCase.integration.test.ts`, `tests/integration/vendor.routes.test.ts`

### DEV-007 — Vendor names are unique, case-insensitively

**Type:** Invariant · **Status:** Active
**Layer:** Application + database constraint (not in domain)
**Since:** 2026-08-01 · **Updated:** 2026-09-03 (case-insensitive comparison)
**Revised:** 2026-09-03

No two vendors may share a name. On update, a vendor may keep its own name —
only a collision with a _different_ vendor is rejected. The comparison is
case-insensitive: `Mimosa` and `mimosa` are treated as the same name and the
second one is rejected. The stored value still keeps whatever casing the
operator typed — only the collision check folds case.

**Why:** The name is what operators pick equipment by. Two vendors carrying
what reads as the same name — differing only in casing — makes the picker
ambiguous exactly where the slug cannot help, since a human reading a dropdown
does not see slugs. An exact-match check let `Mimosa` and `mimosa` coexist as
two vendors, which is the bug this rule now closes.

**Enforced at:** `src/application/device-inventory/use-cases/CreateVendorUseCase.ts:49`, `UpdateVendorUseCase.ts:78`, via case-insensitive lookups in `src/infrastructure/persistence/PrismaVendorRepository.ts` (`findByName`, `existsByName` — Postgres `mode: 'insensitive'`)
**Backed by:** `Vendor.name @unique` in `prisma/schema.prisma:47` — this is a case-sensitive index, so it only catches exact-case duplicates; case-insensitive collisions rely on the application-level check above, not the database, so a race between two concurrent creates with different casing is not closed by the database.
**Message:** `A vendor with name "<name>" already exists`
**Tests:** `tests/application/device-inventory/use-cases/CreateVendorUseCase.test.ts`, `tests/application/device-inventory/use-cases/UpdateVendorUseCase.test.ts`, `tests/infrastructure/persistence/PrismaVendorRepository.test.ts`, `tests/integration/use-cases/device-inventory/CreateVendorUseCase.integration.test.ts`, `tests/integration/use-cases/device-inventory/UpdateVendorUseCase.integration.test.ts`

### DEV-008 — Only an existing vendor can be deleted

**Type:** Invariant · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-11
**Revised:** 2026-09-03

**Why:** Mirrors DEV-068 (only an existing device can be deleted) one
aggregate over — a delete against an id nobody recognizes is a caller error,
not a no-op, so it fails loudly instead of silently succeeding.

**Enforced at:** `src/application/device-inventory/use-cases/DeleteVendorUseCase.ts:42-48`
**Message:** `Vendor not found: <id>`
**Tests:** `tests/application/device-inventory/use-cases/DeleteVendorUseCase.test.ts`, `tests/integration/use-cases/device-inventory/DeleteVendorUseCase.integration.test.ts`, `tests/integration/vendor.routes.test.ts`

---

## Device Model

### DEV-020 — A device model requires a vendor, a model name and a device type

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28
**Revised:** 2026-09-03

All three are mandatory at creation.

**Why:** A model is meaningless without its maker — "AirGrid M5" is only
identifiable as _Ubiquiti's_ AirGrid M5. The device type drives which collector
and which alert rules apply to units of this model.

**Enforced at:** `src/domain/device-inventory/aggregates/DeviceModel.ts:153` (`DeviceModel.validate`), use case pre-checks at `CreateDeviceModelUseCase.ts:32-43`
**Message:** `Vendor ID is required` / `Model name is required` / `Device type is required`
**Tests:** `tests/domain/device-inventory/aggregates/DeviceModel.test.ts`, `tests/integration/use-cases/device-inventory/CreateDeviceModelUseCase.integration.test.ts`, `tests/integration/device-model.routes.test.ts`

The shape of each is then governed by DEV-023 (model name) and DEV-024 (device
type). The aggregate guard only checks that a `DeviceType` is present — by the
time `create` runs, the value has already been through `DeviceType.create`.

### DEV-021 — The vendor of a device model must exist

**Type:** Invariant · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28
**Revised:** 2026-09-03

Checked on create and on any update that changes the vendor.

**Why:** Prevents dangling references, and the lookup also supplies the vendor
name and slug the model reports until its next read (DEV-028).

**Enforced at:** `src/application/device-inventory/use-cases/CreateDeviceModelUseCase.ts:63`, `UpdateDeviceModelUseCase.ts:77`
**Message:** `Vendor not found: <id>`
**Tests:** `tests/integration/use-cases/device-inventory/CreateDeviceModelUseCase.integration.test.ts`, `tests/integration/use-cases/device-inventory/UpdateDeviceModelUseCase.integration.test.ts`, `tests/integration/device-model.routes.test.ts`

### DEV-022 — A vendor cannot have two device models with the same name, case-insensitively

**Type:** Invariant · **Status:** Active
**Layer:** Application + database constraint (not in domain)
**Since:** 2026-07-28
**Revised:** 2026-09-03 (case-insensitive comparison; now also enforced on update)

Uniqueness is per vendor, on the trimmed model name, compared case-insensitively:
`hAP ac3` and `HAP AC3` collide for the same vendor. Two different vendors may
both have a model called "AC Lite" regardless of casing. The stored value keeps
whatever casing the operator typed — only the collision check folds case.
Checked on both create and update: renaming a model, or moving it to a
different vendor, is rejected if the resulting (vendor, model) pair collides
with a model other than itself. A model may keep its own name — including
"renaming" itself to a different case of that same name — since the check
excludes a match on its own id.

**Why:** Within one manufacturer the model name is the identifier operators use
to pick equipment. Duplicates would make the choice ambiguous, including two
spellings that only differ in case — the picker doesn't distinguish them any
better than an exact duplicate would. Scoping to the vendor rather than globally
is deliberate — model names collide across manufacturers all the time.

**Enforced at:** `src/application/device-inventory/use-cases/CreateDeviceModelUseCase.ts:78` (`existsByVendorAndModel`), `UpdateDeviceModelUseCase.ts:94` (`findByVendorAndModel`, excluding the model's own id) — both via case-insensitive lookups in `src/infrastructure/persistence/PrismaDeviceModelRepository.ts` (Postgres `mode: 'insensitive'`)
**Backed by:** `@@unique([vendorId, model])` in `prisma/schema.prisma:88` — this is a case-sensitive index, so it only catches exact-case duplicates; case-insensitive collisions rely on the application-level checks above, not the database, so a race between two concurrent creates/updates with different casing is not closed by the database.
**Message:** `A device model "<model>" already exists for this vendor`
**Tests:** `tests/infrastructure/persistence/PrismaDeviceModelRepository.test.ts`, `tests/application/device-inventory/use-cases/UpdateDeviceModelUseCase.test.ts`, `tests/integration/use-cases/device-inventory/CreateDeviceModelUseCase.integration.test.ts`, `tests/integration/use-cases/device-inventory/UpdateDeviceModelUseCase.integration.test.ts`, `tests/integration/device-model.routes.test.ts`

### DEV-023 — A model name is non-empty and at most 150 characters

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28
**Revised:** 2026-09-03

Trimmed before storage.

**Why:** Matches the database column and keeps model names readable in pickers.

**Enforced at:** `src/domain/device-inventory/aggregates/DeviceModel.ts:170` (`validate`), `:88` (`updateModel`)
**Reached from:** `create`, `updateModel`
**Message:** `Model name cannot be empty` / `Model name cannot exceed 150 characters`
**Tests:** `tests/domain/device-inventory/aggregates/DeviceModel.test.ts`, `tests/integration/use-cases/device-inventory/CreateDeviceModelUseCase.integration.test.ts`, `tests/integration/device-model.routes.test.ts`

### DEV-024 — A device type is one of seven values

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28 · **Updated:** 2026-07-29
**Revised:** 2026-09-03

Required: `ANTENNA`, `OTHER`, `RADIO`, `ROUTER`, `ROUTERBOARD`, `SERVER`,
`SWITCH`. Input is trimmed and upper-cased before the set is checked, so
`router` is accepted and stored as `ROUTER`. A blank or whitespace-only value is
rejected before the set is consulted, with its own message.

The set is owned by the `DeviceType` value object. Nothing above the domain
holds a copy of it: the aggregate's `deviceType` is a `DeviceType`, never a
string, so an unparsed value cannot reach `DeviceModel.create` or
`updateDeviceType`. The Zod schemas at the HTTP edge do carry their own literal
list — that one is a fast-fail for a better 400, not the authority. The Prisma
`device_type` enum (`prisma/schema.prisma:64`) carries the same seven values, so
the column cannot hold anything the domain would reject.

**Why:** The type drives which collector runs against units of this model and
which alert rules apply, so behaviour branches on it — the same reason
`DeviceCategory` (DEV-043) is a closed set. `OTHER` is the escape hatch that
keeps the set from needing to grow for every unusual piece of hardware.

**Enforced at:** `src/domain/device-inventory/value-objects/DeviceType.ts:31` (`DeviceType.create`)
**Reached from:** `CreateDeviceModelUseCase.ts:52`, `UpdateDeviceModelUseCase.ts:99`; use case pre-check at `CreateDeviceModelUseCase.ts:38-43`; HTTP fast-fail in `src/presentation/http/validation/device-model.schemas.ts:61`, `:94`
**Message:** `Device type cannot be empty` / `Invalid device type: "<value>". Must be one of: ANTENNA, OTHER, RADIO, ROUTER, ROUTERBOARD, SERVER, SWITCH`
**Tests:** `tests/domain/device-inventory/value-objects/DeviceType.test.ts`, `tests/domain/device-inventory/aggregates/DeviceModel.test.ts`, `tests/integration/use-cases/device-inventory/CreateDeviceModelUseCase.integration.test.ts`, `tests/integration/use-cases/device-inventory/UpdateDeviceModelUseCase.integration.test.ts`, `tests/integration/device-model.routes.test.ts`

A stored value is held to a stricter standard than an incoming one:
`DeviceModelMapper.toDomain` checks `DeviceType.isValid` on the raw column with
no trimming or case-folding, and fails with
`Data integrity violation: unrecognised DeviceType "<value>" in persistence store`
on a miss. A row that only matches after normalisation means the database and
the domain have drifted, which is a defect to surface rather than paper over.
(`src/infrastructure/mappers/DeviceModelMapper.ts:49`)

### DEV-025 — A device model is non-wireless unless stated

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28 · **Updated:** 2026-07-29
**Revised:** 2026-09-03

`isWireless` defaults to `false` when omitted.

The default is applied in the aggregate, not at the edge. `DeviceModel.create`
accepts `isWireless` as optional and resolves it; the Zod schema only checks
that a supplied value is a boolean, and the application mapper passes the
caller's value through untouched. So a non-HTTP caller — a seed script, an
importer — gets the same default as a request, and there is one place to read to
know what omission means. Same arrangement as DEV-058.

**Why:** Wireless is the exception in the catalogue and the flag switches on
extra collection machinery. Defaulting to off means a carelessly created model
does not silently start wireless polling.

**Enforced at:** `src/domain/device-inventory/aggregates/DeviceModel.ts:62` (`DeviceModel.create`)
**Tests:** `tests/domain/device-inventory/aggregates/DeviceModel.test.ts`, `tests/application/device-inventory/mappers/DeviceModelMapper.test.ts`, `tests/integration/use-cases/device-inventory/CreateDeviceModelUseCase.integration.test.ts`, `tests/integration/device-model.routes.test.ts`

### DEV-026 — A device model with devices cannot be deleted

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28
**Revised:** 2026-09-03

**Why:** Same reasoning as DEV-005 — deleting the model would strip every unit
built on it of its identity. Reassignment must be an explicit decision.

This counts **live** devices only. Devices sitting in the recycle bin still hold
the foreign key but do not block on this rule; DEV-030 handles them.

**Enforced at:** `src/application/device-inventory/use-cases/DeleteDeviceModelUseCase.ts:58`
**Message:** `Cannot delete device model: it has N device(s) associated. Reassign or remove those devices first.`
**Tests:** `tests/integration/use-cases/device-inventory/DeleteDeviceModelUseCase.integration.test.ts`, `tests/integration/device-model.routes.test.ts`

### DEV-027 — `isWireless` cannot be turned off while any device on the model has a wireless configuration

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28 · **Revised:** 2026-07-30

An update changing `isWireless` from `true` to `false` is refused when any
device built on that model still holds a wireless configuration; the message
names how many. Devices on the model that have **no** configuration do not block
it — the refusal is about configurations, not about the devices or their
categories. Every other field of the same request is refused with it, and
nothing is written.

To make the model non-wireless, delete those configurations first
(`DELETE /api/devices/:id/wireless/config`), then set the flag.

**Why:** A configuration carries operator-entered values — `linkCapacityKbps` or
`clientsProvisionedLimit` (WLS-004, WLS-005) — that no cascade can preserve, because a
non-wireless model has nowhere to put them. This is the same data DEV-065
refuses to discard one device at a time, so the model catalogue may not discard
it wholesale: it would be inconsistent for a single device's category to be
frozen against losing one field while a checkbox on its model destroyed that
field for the entire fleet built on it. Refusing puts the decision in front of
the operator, which is also what DEV-026 does for a model that still has
devices.

The check only runs on the `true → false` edge, so resubmitting the current
value costs no query, and a failed lookup aborts rather than being read as "no
configuration".

**Consequence.** A model mis-flagged as wireless can still be corrected freely
until someone configures a device on it. After that the correction has an
explicit price: the configurations go first.

**History — this rule replaced a cascade on 2026-07-30.** It previously deleted
the wireless configuration of every device on the model, which is how the data
loss described above was possible. The deletions also ran unchecked and after
the save, so a failure left orphaned configurations behind while the request
still reported success.

**Enforced at:** `src/application/device-inventory/use-cases/UpdateDeviceModelUseCase.ts:144` (`guardAgainstWirelessConfigs`)
**Message:** `Cannot mark device model as non-wireless: N device(s) built on it have a wireless config. Delete those wireless configs first.` → `409` / `Failed to load devices for the wireless config check: <reason>` / `Failed to check for existing wireless configs: <reason>`
**Tests:** `tests/application/device-inventory/use-cases/UpdateDeviceModelUseCase.test.ts`, `tests/integration/use-cases/device-inventory/UpdateDeviceModelUseCase.integration.test.ts`, `tests/integration/device-model.routes.test.ts`

### DEV-028 — A device model reports its vendor's name and slug

**Type:** Policy · **Status:** Active
**Layer:** Infrastructure + Domain (partly in domain)
**Since:** 2026-07-28 · **Revised:** 2026-07-30

Every device model response carries `vendorName` and `vendorSlug` alongside
`vendorId`. Neither is a column on `device_models`: each read joins `vendors`
and the mapper hydrates the pair onto the aggregate, so a vendor rename is
visible on its models from the next read — no propagation step exists because
there is no copy to propagate to. `updateVendor` sets all three together, which
keeps an in-memory aggregate consistent for the rest of the request that
reassigned it.

**Why:** A model is identified by maker and model together (DEV-020), so the
vendor label belongs on every row a caller lists — making clients resolve
`vendorId` themselves would mean an extra request per row. Serving it off the
join rather than a stored copy is what keeps it from ageing: the catalogue can
never disagree with the vendor record it came from.

**Enforced at:** `src/infrastructure/mappers/DeviceModelMapper.ts:55` (`toDomain`), `src/domain/device-inventory/aggregates/DeviceModel.ts:131` (`updateVendor`)
**Tests:** `tests/domain/device-inventory/aggregates/DeviceModel.test.ts`, `tests/integration/use-cases/device-inventory/CreateDeviceModelUseCase.integration.test.ts`, `tests/integration/use-cases/device-inventory/UpdateDeviceModelUseCase.integration.test.ts`, `tests/integration/use-cases/device-inventory/UpdateVendorUseCase.integration.test.ts`, `tests/integration/device-model.routes.test.ts`

### DEV-029 — Only an existing device model can be deleted

**Type:** Invariant · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-11

**Why:** Same reasoning as DEV-008/DEV-068, one aggregate over.

**Enforced at:** `src/application/device-inventory/use-cases/DeleteDeviceModelUseCase.ts:42-49`
**Message:** `Device model not found: <id>`
**Tests:** `tests/application/device-inventory/use-cases/DeleteDeviceModelUseCase.test.ts`, `tests/integration/use-cases/device-inventory/DeleteDeviceModelUseCase.integration.test.ts`, `tests/integration/device-model.routes.test.ts`

### DEV-030 — A device model whose only devices are in the recycle bin is deleted only on confirmation

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-12

DEV-026 counts live devices, so a model whose every remaining unit has been
soft-deleted (DEV-070) reads as unused. It is not: the tombstones still hold the
foreign key. Deleting the model is refused, and the message names how many
devices are in the bin and how to proceed.

Repeating the request with `purgeBinnedDevices=true` permanently removes those
devices — with the full cascade of DEV-077 — and then the model. The
confirmation covers only the bin: a **live** device still refuses under DEV-026,
whatever the flag says, and nothing is purged on a refused request.

**Why:** Two things could go wrong here and the rule closes both.

Without the check the delete reaches Postgres and dies on
`devices_device_model_id_fkey` (`ON DELETE RESTRICT`), which surfaces as a
database error — the operator is told the server broke when in fact a rule
stopped them. Naming the tombstones turns an accident into a decision.

Cascading silently would be worse. The devices in the bin are inside their
seven-day window and a restore is still expected to work (DEV-074); destroying
them because someone tidied the model catalogue would take the undo away
without ever mentioning it. So the destruction is opt-in, in the same spirit as
DEV-027: put the price in front of the operator rather than paying it for them.

Purging is safe at this point for the same reason the scheduled purge is —
nothing reaches the bin without clearing the live-contracted-service (DEV-075)
and open-ticket (DEV-076) guards first. The confirmation buys time, not a
bypass.

**Consequence.** A model cannot be deleted the instant its last device is
deleted, without an explicit second step. Waiting out the grace period is the
other route: once DEV-077 has purged the devices, the plain delete succeeds.

**Enforced at:** `src/application/device-inventory/use-cases/DeleteDeviceModelUseCase.ts:74` (`purgeBinnedDevices`)
**Message:** `Cannot delete device model: it has N device(s) in the recycle bin. Retry with purgeBinnedDevices=true to remove them permanently along with the model.` → `409`
**Tests:** `tests/application/device-inventory/use-cases/DeleteDeviceModelUseCase.test.ts`, `tests/integration/use-cases/device-inventory/DeleteDeviceModelUseCase.integration.test.ts`, `tests/integration/device-model.routes.test.ts`

---

## Device

### DEV-040 — A device requires a device model and a name

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28

Everything else — location, category, owner, serial, MAC, IP, dates — is
optional at creation, subject to the status rules below.

**Why:** These two are the minimum that makes a row meaningful: what the thing
is, and what we call it. Keeping the rest optional is what lets equipment be
registered on arrival, before it has been configured or installed.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:92` (`Guard.combine` in `create`)
**Message:** `deviceModelId is required` / `Device name is required`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`, `tests/integration/use-cases/device-inventory/CreateDeviceUseCase.integration.test.ts`, `tests/integration/device.routes.test.ts`

### DEV-041 — A device name is non-empty and at most 150 characters

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28

Trimmed before storage.

**Enforced at:** `src/domain/device-inventory/value-objects/DeviceName.ts:28`
**Message:** `Device name cannot be empty` / `Device name cannot exceed 150 characters`
**Tests:** `tests/domain/device-inventory/value-objects/DeviceName.test.ts`, `tests/domain/device-inventory/aggregates/Device.test.ts`

### DEV-042 — A device status is one of ACTIVE, COMMISSIONING, DAMAGED, DECOMMISSIONED, INVENTORY

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28 · **Revised:** 2026-08-12

Input is trimmed and upper-cased. **INVENTORY is the default** when no status is
given.

**Why:** These five are the lifecycle of a unit as the business tracks it:
sitting in the warehouse, being installed, in service, broken, or retired for
good. INVENTORY is the default because that is where equipment enters the
business — it is bought before it is deployed.

Three of them — INVENTORY, DAMAGED, DECOMMISSIONED — form the **retired set**
(DEV-078): the unit is off the network, so none of them polls and each demands
an identifier (DEV-053).

**History — DECOMMISSIONED was removed on 2026-05-09 and restored on
2026-08-12.** Migration `20260509000000_refine_device_status_and_category`
dropped it and remapped its rows to DAMAGED, on the reasoning that a status
nobody set was noise. Hardware replacement gave it a caller: a swap is not
always a failure. When an antenna is upgraded the outgoing unit still works and
belongs back in INVENTORY; when it is obsolete it is neither broken nor stock.
Folding that third case into DAMAGED made "broken" mean two different things,
and the lineage link was the only way to tell them apart. Restored by
`20260811120000_device_soft_delete_and_replacement` via `ALTER TYPE … ADD
VALUE`, so no existing row was touched — units remapped to DAMAGED in 2026-05
stay DAMAGED.

**Enforced at:** `src/domain/device-inventory/value-objects/DeviceStatus.ts` (`DeviceStatus.create`)
**Default applied at:** `src/application/device-inventory/use-cases/CreateDeviceUseCase.ts:104`
**Message:** `Invalid device status: <value>. Must be one of: ACTIVE, COMMISSIONING, DAMAGED, DECOMMISSIONED, INVENTORY`
**Tests:** `tests/domain/device-inventory/value-objects/DeviceStatus.test.ts`, `tests/integration/use-cases/device-inventory/CreateDeviceUseCase.integration.test.ts`, `tests/integration/use-cases/device-inventory/UpdateDeviceUseCase.integration.test.ts`, `tests/integration/device.routes.test.ts`

### DEV-043 — A device category, when set, is one of six deployment roles

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28 · **Revised:** 2026-07-29, 2026-08-01

Optional (nullable). When present it must be one of `CPE`, `WIRELESS_CPE`,
`ACCESS_POINT`, `GATEWAY`, `AGGREGATION_SWITCH`, `OTHER`. Trimmed and
upper-cased, so `access_point` is accepted and stored as `ACCESS_POINT`. A blank
or whitespace-only value is rejected before the set is consulted, with its own
message.

The set is owned by the `DeviceCategory` value object; the aggregate's
`category` is a `DeviceCategory`, never a string. The Zod schemas at the HTTP
edge carry their own literal list
(`src/presentation/http/validation/device.schemas.ts:23`) — a fast-fail for a
better 400, not the authority. The Prisma `device_category` enum
(`prisma/schema.prisma:144`) carries the same six values.

**Why:** Category answers **what role the unit plays in the network**, where
device type (DEV-024) answers **what kind of hardware it is** — both closed
sets, for the same reason: behaviour branches on them. Only `WIRELESS_CPE` and
`ACCESS_POINT` may hold a wireless configuration (DEV-062), and the wireless
radio mode is derived from the category rather than asked for (WLS-003). `OTHER`
is the escape hatch that keeps the set from needing to grow for every oddity.

**Enforced at:** `src/domain/device-inventory/value-objects/DeviceCategory.ts:47` (`DeviceCategory.create`)
**Message:** `Device category cannot be empty` / `Invalid device category: <value>. Must be one of: CPE, WIRELESS_CPE, ACCESS_POINT, GATEWAY, AGGREGATION_SWITCH, OTHER`
**Tests:** `tests/domain/device-inventory/value-objects/DeviceCategory.test.ts`, `tests/domain/device-inventory/aggregates/Device.test.ts`, `tests/infrastructure/mappers/DeviceMapper.test.ts`

A stored value is held to a stricter standard than an incoming one, exactly as
DEV-024 and DEV-091 are: `DeviceMapper.toDomain` checks `DeviceCategory.isValid`
on the raw column with no trimming or case-folding, and fails with
`Data integrity violation: unrecognised DeviceCategory "<value>" in persistence store`
on a miss. A row that only matches after normalisation means the database and
the domain have drifted, which is a defect to surface rather than paper over.
The repository's `try`/`catch` turns the throw into a `Result.fail`, so a stale
row fails the read rather than escaping as a half-valid aggregate.
(`src/infrastructure/mappers/DeviceMapper.ts`, `DeviceMapper.mapCategoryFromPrisma`)

**History — the roles were recast on 2026-07-29.** The original set mixed
network role with hardware kind, which is the distinction DEV-024 now owns. The
migration `20260729030000_device_category_deployment_roles` rewrote existing
rows:

| Old                | New                  | Reason                                                                             |
| ------------------ | -------------------- | ---------------------------------------------------------------------------------- |
| `AP`               | `ACCESS_POINT`       | renamed for clarity                                                                |
| `ROUTERBOARD`      | `GATEWAY`            | the role is _where upstream internet enters_; `ROUTERBOARD` remains a `DeviceType` |
| `SMART_SWITCH`     | `AGGREGATION_SWITCH` | the node switch radios converge on                                                 |
| `SMART_SWITCH_POE` | `AGGREGATION_SWITCH` | PoE is a hardware trait, not a role                                                |

`SMART_SWITCH` and `SMART_SWITCH_POE` collapsing onto one role is why the
migration swaps the enum type rather than renaming values in place — Postgres
cannot drop an enum value.

**History — the read guard was added on 2026-08-01, closing G-11.** Until then
`DeviceMapper.toDomain` called `DeviceCategory.reconstitute` on the raw column
unchecked, so a row the recast had missed loaded silently and only surfaced
downstream — a `getDisplayName()` falling through to its `default`, or a
`canHaveWirelessConfig()` quietly answering `false`. Widening
`DeviceCategory.isValid` from `private` to `public` was the only change the
domain needed; the guard itself lives in the mapper.

That the gap was real is not hypothetical: the fixtures in four test suites had
drifted onto the pre-recast vocabulary (`CORE`, `DISTRIBUTION`, `POE`,
`CLIENT_CPE`) and still passed, because `reconstitute` accepted values `create`
had rejected since 2026-07-29. Adding the guard failed those suites, which is
how they were found and corrected.

### DEV-044 — A device owner, when set, is COMPANY or CLIENT

**Type:** Validation · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28

Optional. Case-insensitive on input.

**Why:** Determines who owns the hardware, which decides who replaces it when it fails and whether it goes back to the warehouse when a client leaves.

**Enforced at:** `src/application/device-inventory/use-cases/CreateDeviceUseCase.ts:50`, `UpdateDeviceUseCase.ts:51`
**Message:** `Invalid ownerType: "<value>". Must be one of: COMPANY, CLIENT`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`, `tests/integration/use-cases/device-inventory/CreateDeviceUseCase.integration.test.ts`, `tests/integration/device.routes.test.ts`

### DEV-045 — A serial number is non-empty and at most 100 characters

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28

Optional; trimmed before storage.

**Enforced at:** `src/domain/device-inventory/value-objects/SerialNumber.ts:28`
**Message:** `Serial number cannot be empty` / `Serial number cannot exceed 100 characters`
**Tests:** `tests/domain/device-inventory/value-objects/SerialNumber.test.ts`, `tests/domain/device-inventory/aggregates/Device.test.ts`

### DEV-046 — A MAC address is in colon or hyphen hex format

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28

Accepts `AA:BB:CC:DD:EE:FF` or `AA-BB-CC-DD-EE-FF`. **Normalized to
upper-case with colons** before storage, so the two input forms cannot produce
two distinct stored values.

**Why:** MAC is how a device is recognised on the wire — by the ARP table and by
network scans. Normalizing at the boundary is what makes DEV-047 meaningful; two
spellings of one address would defeat the uniqueness check.

**Enforced at:** `src/domain/shared/value-objects/MACAddress.ts:45`
**Message:** `Invalid MAC address format: <value>. Must be in format AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF.`
**Tests:** `tests/domain/shared/value-objects/MACAddress.test.ts`, `tests/domain/device-inventory/aggregates/Device.test.ts`, `tests/integration/use-cases/device-inventory/CreateDeviceUseCase.integration.test.ts`, `tests/integration/device.routes.test.ts`

### DEV-047 — A MAC address belongs to at most one device

**Type:** Invariant · **Status:** Active
**Layer:** Application + database constraint (not in domain)
**Since:** 2026-07-28 · **Revised:** 2026-07-30

Checked on create, and on update only when the value actually changes — so
re-submitting a device's own MAC is not a collision.

**Why:** A MAC is globally unique in hardware. Two records claiming one means an
inventory error — most often the same physical unit registered twice — and would
make network scan results ambiguous about which record they matched.

**Enforced at:** `src/application/device-inventory/use-cases/CreateDeviceUseCase.ts:144`, `UpdateDeviceUseCase.ts:174`, `prisma/schema.prisma:174` (unique index `devices_mac_address_key`)
**Message:** `MAC address "<value>" is already assigned to another device`
**Note:** The use case check is the normal path; the unique index catches
concurrent writes that both clear it and reports the same message.
**Tests:** `tests/integration/use-cases/device-inventory/CreateDeviceUseCase.integration.test.ts`, `tests/integration/use-cases/device-inventory/UpdateDeviceUseCase.integration.test.ts`

### DEV-048 — An IP address is a valid IPv4 or IPv6 address

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28

Optional. IPv6 is lower-cased on storage; IPv4 is stored as written.

**Why:** The IP is the polling target. An unparseable address would fail at ping
time, long after the operator who typed it has moved on.

**Enforced at:** `src/domain/shared/value-objects/IPAddress.ts:53`
**Message:** `Invalid IP address format: <value>. Must be a valid IPv4 or IPv6 address.`
**Tests:** `tests/domain/shared/value-objects/IPAddress.test.ts`, `tests/domain/device-inventory/aggregates/Device.test.ts`

### DEV-049 — An IP address belongs to at most one device

**Type:** Invariant · **Status:** Active
**Layer:** Application + database constraint (not in domain)
**Since:** 2026-07-28 · **Revised:** 2026-07-30

Same change-detection as DEV-047: a device may keep its own IP on update.

**Why:** Two devices on one IP is either a configuration error on the network or
a duplicate record. Either way the monitor cannot tell which unit answered a
ping, so the data would be silently wrong rather than absent.

**Enforced at:** `src/application/device-inventory/use-cases/CreateDeviceUseCase.ts:166`, `UpdateDeviceUseCase.ts:204`, `prisma/schema.prisma:175` (unique index `devices_ip_address_key`)
**Message:** `IP address "<value>" is already assigned to another device`
**Note:** Same two-layer enforcement as DEV-047.
**Tests:** `tests/integration/use-cases/device-inventory/CreateDeviceUseCase.integration.test.ts`, `tests/integration/use-cases/device-inventory/UpdateDeviceUseCase.integration.test.ts`

### DEV-050 — An installation date must be ISO 8601

**Type:** Validation · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28 · **Revised:** 2026-08-01

Optional. Accepted forms are `YYYY-MM-DD` and `YYYY-MM-DDThh:mm[:ss[.sss]]` with
an optional `Z` or `±hh:mm` offset. The calendar is checked too: `2024-02-31`
and `2023-02-29` are rejected rather than rolled forward into the next month,
as `new Date()` would.

**Why:** The date is entered by hand and read back as an ISO string, so anything
the parser silently reinterprets — a locale form like `March 5, 2020`, or a day
that does not exist in that month — stores a date nobody typed. Rejecting is
cheap; a wrong installation date is discovered years later, if ever.

Until 2026-08-01 the check was `!isNaN(new Date(v).getTime())`, which accepted
both of those while the message promised ISO 8601 (was G-5). The HTTP layer
already rejected non-ISO input via `z.string().datetime()`, so this only ever
applied to callers that bypass the edge schema.

**Enforced at:** `src/application/shared/utils/parseIso8601Date.ts`, called from `CreateDeviceUseCase.ts:196`, `UpdateDeviceUseCase.ts:127`
**Message:** `Invalid installedDate: "<value>". Must be a valid ISO 8601 date string.`
**Tests:** `tests/application/shared/utils/parseIso8601Date.test.ts`, `tests/application/device-inventory/use-cases/CreateDeviceUseCase.test.ts`

### DEV-051 — An installation date cannot be in the future

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28

Compared against the moment of validation.

**Why:** The field records when a unit _was_ installed — an observation, not a
plan. A future date is a typo, and it would distort age-based reporting on the
fleet.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:575` (`Device.validateInstalledDate`)
**Reached from:** `create`, and every later change via `applyChanges` (DEV-060)
**Message:** `installedDate cannot be in the future`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`

### DEV-052 — A device description is at most 500 characters

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:555` (`Device.validateDescription`)
**Message:** `Device description cannot exceed 500 characters`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`

### DEV-053 — A retired device must have a serial number or a MAC address

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28 · **Revised:** 2026-08-12

Applies to every status in the retired set — INVENTORY, DAMAGED,
DECOMMISSIONED. At least one of the two identifiers. Either satisfies the rule.

**Why:** These are the states where the unit is _not_ on the network — it is a
physical object on a shelf. Without a serial or a MAC there is no way to match
the record to the box in your hand, so the row is untraceable stock. An ACTIVE
device is exempt because its IP already identifies it.

Revised on 2026-08-12 only to follow DEV-042: the check now asks
`DeviceStatus.isRetired()` rather than naming INVENTORY and DAMAGED, so adding
DECOMMISSIONED extended it automatically. That is deliberate — a set the code
enumerates in one place cannot drift from the rule that depends on it.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts` (`Device.validate`, via `Device.requiresIdentifier`)
**Reached from:** `create`, and every later change via `applyChanges` (DEV-060)
**Message:** `A device with status <status> must have at least a serial number or MAC address`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`

### DEV-054 — An ACTIVE device must have an IP address

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28

**Why:** ACTIVE means in service and monitored. Monitoring is ping-based, so a
device with no IP cannot be polled — it would sit in the dashboard permanently
green and never actually be checked.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:508`
**Reached from:** `create`, and every later change via `applyChanges` (DEV-060)
**Message:** `An ACTIVE device must have an IP address assigned`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`

### DEV-055 — An ACTIVE device must have a location

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28

Also blocks _removing_ the location from a device that is already ACTIVE.

**Why:** ACTIVE means installed and serving a customer. A technician dispatched
to a fault needs somewhere to drive. A device with no location cannot be found
in the field.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:514`
**Reached from:** `create`, and every later change via `applyChanges` (DEV-060)
**Message:** `An ACTIVE device must have a location assigned`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`, `tests/integration/use-cases/device-inventory/UpdateDeviceUseCase.integration.test.ts`

### DEV-056 — A COMMISSIONING device must have an IP address

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28

**Why:** Commissioning is the stage where the unit is being brought up and
watched to see whether it stays up. That requires reaching it. Note this is
weaker than ACTIVE: no location is required yet, because a unit can be
configured on the bench before it is installed.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:520`
**Message:** `A COMMISSIONING device must have an IP address assigned`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`

### DEV-057 — Monitoring can only be enabled for ACTIVE or COMMISSIONING devices

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28

**Why:** Those are the two states where the device is expected to answer. Polling
a warehouse unit or a broken one would generate a permanent stream of
false-alarm outage alerts and train operators to ignore the dashboard.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:527`
**Reached from:** `create`, and every later change via `applyChanges` (DEV-060)
**Message:** `Monitoring can only be enabled for ACTIVE or COMMISSIONING devices`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`

### DEV-058 — A new COMMISSIONING device gets monitoring on by default

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28

Default applies only when the caller expresses no preference. An **explicit
`false` is respected**.

**Why:** The point of commissioning is to watch the unit stabilise, so watching
it is the sensible default rather than a step to remember. It stays a default
and not a rule because there are legitimate reasons to stage a device without
polling it yet.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:108`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`

### DEV-059 — Moving a device into COMMISSIONING turns monitoring on by default

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28 · **Revised:** 2026-08-03

A status change into COMMISSIONING enables monitoring if it was off — but, as in
DEV-058, only when the caller expressed no preference. An **explicit
`monitoringEnabled: false` in the same request is respected**, leaving the
device commissioned with monitoring off.

**Why:** Same reasoning as DEV-058, applied to units that reach commissioning by
transition rather than at creation — and the same exception, for the same
reason: staging a device without polling it yet is legitimate, so the default
must stay a default.

Until 2026-08-03 the transition forced monitoring on unconditionally, silently
discarding an explicit `false`. That made the two paths to COMMISSIONING behave
differently for no stated reason, and made `PATCH { status: 'COMMISSIONING',
monitoringEnabled: false }` return `200` with `monitoringEnabled: true`.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:226` (`applyChanges` — the COMMISSIONING override)
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`

### DEV-060 — Status-dependent rules are validated against prospective state, not current state

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28 · **Revised:** 2026-07-29

`Device.validate()` is the single source of truth for DEV-051 through DEV-057.
It is static and takes the _candidate_ state as an argument, so it runs before
any mutation commits.

There is exactly one mutation path: `Device.applyChanges(changes)`. It receives
every field a caller may change **together**, resolves the candidate state
(absent key = unchanged, explicit `null` = clear), validates that candidate
**once**, and only then commits and raises events. `changeStatus`,
`assignLocation`, `enableMonitoring`, `disableMonitoring`, `correctDeviceModel`
and `updateDetails` are one-line wrappers over it and hold no rules of their
own.

**Why:** Rules that span several fields cannot be checked field-by-field. A
request that sets an IP _and_ flips the status to ACTIVE, or assigns a location
_and_ flips the status to ACTIVE, is legal as a whole but illegal in either
order if each field is validated alone. Validating the whole candidate at once
is what makes the API's PATCH semantics honest: a request either describes a
legal end state or it does not, and no field is ever judged against a
half-applied version of the others.

Two consequences worth stating, because both were bugs under the previous
field-by-field design:

- **Either order works.** `{ locationId, status: 'ACTIVE' }` and
  `{ ipAddress, status: 'ACTIVE' }` both succeed. The old implementation
  accepted the second and rejected the first, purely because of the sequence
  its mutators ran in.
- **Nothing partially applies.** A rejected request leaves the aggregate
  exactly as it was and raises no events, so a caller cannot end up with a
  located-but-not-activated device after a failed call.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:175` (`Device.applyChanges`), validation at `:488` (`Device.validate`)
**Reached from:** `create` validates the same way at construction; every later change goes through `applyChanges`
**Called from:** `src/application/device-inventory/use-cases/UpdateDeviceUseCase.ts:280` — one call, after the use case has parsed and uniqueness-checked the incoming fields
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts` (`applyChanges() — whole-state validation`), `tests/application/device-inventory/use-cases/UpdateDeviceUseCase.test.ts`, `tests/integration/use-cases/device-inventory/UpdateDeviceUseCase.integration.test.ts`

**Event order.** When one call changes several aspects, events are raised in a
fixed sequence — model, details, status, location, monitoring — and only for
aspects that actually changed. An empty change set is a no-op: no validation, no
`updatedAt` bump, no events.

### DEV-061 — Devices loaded from the database bypass validation

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28

`Device.reconstitute()` applies no rules.

**Why:** Rules change over time; rows written under older rules must still load,
or a rule tightening would make existing equipment unreadable rather than merely
uneditable. The trade-off is that a row violating a current invariant loads
silently — invalid state is caught on the next _write_, not on read.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:164`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`

### DEV-062 — Only WIRELESS_CPE and ACCESS_POINT devices may hold a wireless configuration

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28 · **Revised:** 2026-07-29

Exposed as `device.canHaveWirelessConfig()`, which asks the category itself
(`isWirelessCpe()`, `isAccessPoint()`) rather than comparing against constants. A
device with no category at all cannot hold one either — the check is on a
present, matching category.

**Why:** Wireless collection reads radio metrics — signal, SNR, CCQ. On hardware
with no radio there is nothing to read, so a config would schedule polls that
can only fail.

**This rule is enforced across two contexts and stays here.** The predicate is
on the `Device` aggregate and is the device's own statement about itself, so
Device Inventory owns it; the only caller is in Wireless Monitoring. The
wireless book records it as a consumed rule rather than restating it. It is
paired with [WLS-002](wireless-monitoring.md#wls-002--the-devices-model-must-be-marked-wireless-capable),
which checks the _model_'s `isWireless` flag — category says what role the unit
plays, `isWireless` says whether the hardware has a radio at all, and a
configuration needs both.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:393`
**Reached from:** `src/application/wireless-monitoring/use-cases/CreateWirelessConfigUseCase.ts:62`
**Message:** `Only WIRELESS_CPE and ACCESS_POINT devices can have a wireless config`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`

### DEV-063 — A device's model can only be corrected while it is INVENTORY

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-29

`deviceModelId` is mandatory at creation (DEV-040) and thereafter changeable
only through `Device.correctDeviceModel()`, which refuses unless the device's
current status is `INVENTORY`. Re-submitting the model the device already has is
a no-op that succeeds in any status — so a `PATCH` echoing the whole record back
is not rejected. The target model must exist.

**Why:** This is a **data-entry correction**, not a hardware swap. An operator
registering a box on arrival can pick the wrong model from the picker — "AirGrid
M2" instead of "AirGrid M5" — and the record must be fixable without deleting
and re-creating it (which DEV-026's `onDelete: Restrict` and the credential and
contracted-service links make painful).

The restriction to `INVENTORY` is what keeps the correction from becoming a
replacement. A `Device` row is one physical unit, and its model determines which
collector polls it (DEV-024), whether it may hold a wireless config (DEV-062),
and which alert rules apply. Every metric — `pingResults`, `wirelessSnapshots`,
`alertEvents` — hangs off the device id. `INVENTORY` is the one status in which
none of that history can exist yet (monitoring is impossible there, DEV-057), so
a correction cannot retroactively re-attribute collected data to hardware that
never produced it. Once a unit has been ACTIVE, COMMISSIONING or DAMAGED, the
model is frozen and swapping in different hardware is a separate operation that
retires the old record and links a new one — that operation now exists, see
DEV-078.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:379` (`Device.correctDeviceModel`); model existence at `src/application/device-inventory/use-cases/UpdateDeviceUseCase.ts:234`
**Reached from:** `UpdateDeviceUseCase` (`deviceModelId` on `PATCH /api/devices/:id`)
**Message:** `Cannot change the device model of a device with status <status> — only an INVENTORY device may have its model corrected` / `Device model not found: <id>`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`, `tests/application/device-inventory/use-cases/UpdateDeviceUseCase.test.ts`, `tests/integration/use-cases/device-inventory/UpdateDeviceUseCase.integration.test.ts`

**Judged against the current status.** `applyChanges` checks this rule against
the status the device has _now_, not the one it is moving to, so a single request
may both correct the model and commission the unit — the correction is legal
because the device is still `INVENTORY` when the request arrives.

`Device.create` does **not** check that the model exists — see
[G-9](#known-gaps).

### DEV-064 — Wireless radio mode is derived from the device's category, never supplied

**Type:** Policy · **Status:** Superseded by `WLS-003`
**Layer:** Application (not in domain)
**Since:** 2026-07-29 · **Revised:** 2026-07-30 · **Superseded:** 2026-08-03

Moved to [wireless-monitoring.md](wireless-monitoring.md) as **WLS-003**. The
`linkCapacityKbps` and `clientsProvisionedLimit` cross-checks this entry carried
were split out with it, as **WLS-004** and **WLS-005**.

**Why it was moved:** every line that enforces this rule is in
`CreateWirelessConfigUseCase` and `wireless.schemas.ts`, and every test covering
it is under `tests/application/wireless-monitoring/`. It was filed here because
the deciding input — the device's category — is a device-inventory concept, but
consuming a value is not owning a rule: if the wireless side went back to
accepting `deviceType` as input tomorrow, nothing in Device Inventory would
change.

**Why it is still mentioned here:** adding a third device category changes what
this rule derives. DEV-062 narrows the field to two, so "otherwise means
`WIRELESS_CPE`" holds only while that stays true.

**Reached from:** `POST /api/devices/:id/wireless-config`

---

### DEV-065 — A device's category cannot change while it has a wireless configuration

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-30

Once a wireless configuration exists for a device, `PATCH /api/devices/:id`
refuses any request that would change that device's `category` — including
clearing it to `null`. Every other field on the same request is unaffected;
submitting the category it already has is not a change and passes. The check
only runs when the value actually differs, so no read is spent on requests that
leave the category alone.

To recategorise the device, delete its wireless configuration first
(`DELETE /api/devices/:id/wireless/config`) and create a new one afterwards.

**This rule is enforced across two contexts and stays here.** The refusal is
written in `UpdateDeviceUseCase`, on a device-inventory request, about a
device-inventory field — but it can only be decided by asking the wireless
context whether a configuration exists, so `UpdateDeviceUseCase` depends on
`IWirelessDeviceConfigRepository`. Neither side owns it alone; it is filed with
the aggregate whose field it protects. Its wireless-side counterpart is
[WLS-003](wireless-monitoring.md#wls-003--radio-mode-is-derived-from-the-devices-category-never-supplied).

**Why:** WLS-003 (the former DEV-064) derives the config's radio mode from the
category once, at creation, and nothing re-derives it. Letting the category move
afterwards recreates precisely the contradiction WLS-003 exists to remove — a
device categorised `ACCESS_POINT` holding a `STATION` config, still accepting
`linkCapacityKbps` (WLS-004), still refusing `clientsProvisionedLimit`
(WLS-005), and never engaging the AP collection path in the collector
(WLS-050).

Refusing is chosen over cascading because the cascade cannot be performed
without data loss: which of `linkCapacityKbps` / `clientsProvisionedLimit` is
legal flips with the mode, so re-deriving would have to silently discard
whichever value the operator had set. A category is a statement about physical
hardware; a legitimate `WIRELESS_CPE` → `ACCESS_POINT` move is a hardware
replacement, and rebuilding the config is the honest representation of that.
Failing loudly puts the decision in front of the operator instead of resolving
it silently — DEV-027 refuses the model-wide version of the same loss for the
same reason.

**Consequence.** The refusal happens before `Device.applyChanges`, so a rejected
request leaves both the device row and the stored `deviceType` untouched and the
operation is retryable. `UpdateDeviceUseCase` now depends on
`IWirelessDeviceConfigRepository`; a failed lookup aborts the update rather than
being treated as "no config".

This rule prevents new drift, it does not repair old drift. A config written
before this rule existed, whose `device_type` already disagrees with its
device's category, stays wrong until it is deleted and re-created — the rule
only stops the category moving any further.

**Enforced at:** `src/application/device-inventory/use-cases/UpdateDeviceUseCase.ts:135-172`
**Message:** `Cannot change the category of a device that has a wireless config. Delete the wireless config first, then recategorise the device.`
**Tests:** `tests/application/device-inventory/use-cases/UpdateDeviceUseCase.test.ts`, `tests/integration/use-cases/device-inventory/UpdateDeviceUseCase.integration.test.ts`

### DEV-066 — A device's model must exist

**Type:** Invariant · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-01

Creation verifies that `deviceModelId` names a real device model before building
the aggregate; DEV-063 does the same on the correction path. The check runs
before any other lookup, so a request naming a missing model is rejected without
spending a uniqueness query on its MAC or IP.

**Why:** `deviceModelId` decides which collector polls the device (DEV-024),
whether it may hold a wireless configuration (DEV-062) and which alert rules
apply, so a device pointing at nothing is not a device the system can act on.
The database already refuses the row — the check exists so the caller is told
`Device model not found` instead of a raw Prisma foreign-key error naming a
constraint they have never heard of. Until 2026-08-01 only the correction path
checked, so the create path returned that raw error.

**Enforced at:** `src/application/device-inventory/use-cases/CreateDeviceUseCase.ts:92`, `UpdateDeviceUseCase.ts:262`
**Backed by:** `Device.deviceModelId` FK with `onDelete: Restrict` in `prisma/schema.prisma`
**Message:** `Device model not found: <id>` / `Failed to verify device model: <error>`
**Tests:** `tests/application/device-inventory/use-cases/CreateDeviceUseCase.test.ts`, `tests/integration/use-cases/device-inventory/CreateDeviceUseCase.integration.test.ts`

### DEV-067 — A device's location, when set, must exist

**Type:** Invariant · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-11

Location is optional (DEV-040), so this only runs when a `locationId` is
actually supplied. Creation verifies it before building the aggregate;
update verifies it only when the value actually changes — same
change-detection as DEV-047/DEV-049, so resubmitting a device's own location is
not re-checked.

**Why:** Same reasoning as DEV-066, one layer down in the URL: a location the
system cannot find is not a place a technician can be dispatched to. The
column's FK is `onDelete: SetNull` rather than `Restrict` — deleting a
location never blocks on its devices, it just clears the reference — but that
asymmetry only protects the delete path. Nothing previously stopped a create
or update from pointing at a location that never existed; it would fail as a
raw Prisma foreign-key error instead of a sentence an operator could act on,
exactly the gap DEV-066 closed for `deviceModelId` on 2026-08-01.

**Enforced at:** `src/application/device-inventory/use-cases/CreateDeviceUseCase.ts:106-118`, `UpdateDeviceUseCase.ts:288-315`
**Backed by:** `Device.locationId` FK in `prisma/schema.prisma:190`
**Message:** `Location not found: <id>` / `Failed to verify location: <error>`
**Tests:** `tests/application/device-inventory/use-cases/CreateDeviceUseCase.test.ts`, `tests/application/device-inventory/use-cases/UpdateDeviceUseCase.test.ts`

### DEV-068 — Only an existing device can be deleted

**Type:** Invariant · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-11

**Why:** Mirrors DEV-121 (credentials can only be _set_ for a device that
exists) on the other side of the same aggregate — a delete against an id
nobody recognizes is a caller error, not a no-op, so it fails instead of
silently succeeding. This is the opposite policy from DEV-132 (deleting
credentials succeeds whether or not any exist): deleting a device is a real
state change with cascade effects on its polling configuration, so unlike a
credentials delete there is no idempotent "already gone" reading — the
second delete of the same device must fail.

**Still true now that deleting is soft (DEV-070).** The lookup runs through
`findById`, which excludes tombstones (DEV-072), so a second delete of the same
device reads as "not found" and fails for exactly the same reason it did when
the delete was permanent. The caller cannot tell the two cases apart, and does
not need to.

**Enforced at:** `src/application/device-inventory/use-cases/DeleteDeviceUseCase.ts` (`executeImpl`, the `findById` null check)
**Message:** `Device not found: <id>`
**Tests:** `tests/application/device-inventory/use-cases/DeleteDeviceUseCase.test.ts`, `tests/integration/use-cases/device-inventory/DeleteDeviceUseCase.integration.test.ts`, `tests/integration/device.routes.test.ts`

### DEV-069 — Only an existing device can be updated

**Type:** Invariant · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-11

**Why:** Same reasoning as DEV-068, one operation over: a `PATCH` against an id
nobody recognizes is a caller error, not a no-op, so it fails loudly instead of
validating and applying changes to nothing.

**Enforced at:** `src/application/device-inventory/use-cases/UpdateDeviceUseCase.ts:94-102`
**Message:** `Device not found: <id>`
**Tests:** `tests/application/device-inventory/use-cases/UpdateDeviceUseCase.test.ts`, `tests/integration/use-cases/device-inventory/UpdateDeviceUseCase.integration.test.ts`, `tests/integration/device.routes.test.ts`

### DEV-070 — Deleting a device is reversible for seven days, then permanent

**Type:** Policy · **Status:** Active
**Layer:** Application + Domain
**Since:** 2026-08-12

`DELETE /api/devices/:id` stamps `deletedAt` and `deletedBy` instead of removing
the row. The device disappears from every read path (DEV-072) but its collected
history survives. A restore inside the grace period undoes it (DEV-074); once
the period lapses the retention job removes the row for good (DEV-077). The
grace period defaults to 7 days and is set by `DEVICE_DELETE_GRACE_DAYS`.

Deleting twice still fails (DEV-068) — the second attempt cannot see the first
one's tombstone.

**Why:** A hard delete cascaded away every `pingResult`, `alertEvent`,
`wirelessSnapshot`, `deviceState` and credential the unit had ever produced, and
set the customer's `ContractedService.deviceId` to null on the way out. All of
that from one click, with nothing to undo it. Operators delete the wrong row;
months of link-quality history is not something to lose to a misclick.

Seven days is chosen to be longer than a weekend plus a working day, so a
mistake noticed on Monday is still fixable. It is deliberately not forever: the
whole point of the delete is that the row eventually stops costing anything, and
an unbounded tombstone table is just a slower leak.

`deletedBy` records the authenticated user id, so the tombstone says who as well
as when.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts` (`Device.softDelete`); orchestrated by `src/application/device-inventory/use-cases/DeleteDeviceUseCase.ts`
**Message:** `Device is already deleted`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`, `tests/application/device-inventory/use-cases/DeleteDeviceUseCase.test.ts`, `tests/integration/use-cases/device-inventory/DeleteDeviceUseCase.integration.test.ts`

### DEV-071 — Deleting a device stops monitoring it

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-12

`softDelete` forces `monitoringEnabled` to false and raises
`DeviceMonitoringToggledEvent` alongside `DeviceDeletedEvent`. Monitoring can
never be on for a deleted device — `Device.validate` refuses the combination
outright, so no other path can reintroduce it.

**Why:** Deleting is also a decision to stop watching. Leaving the flag on would
keep the ICMP orchestrator polling an address the operator has written off, and
would raise device-down alerts for something nobody can see in the UI to
acknowledge.

Doing it inside `softDelete` rather than asking the caller to send
`monitoringEnabled: false` separately is what actually makes the polling
pipeline react: `DeviceMonitoringToggledHandler` is the only consumer that
suspends polling, and it is driven by that event. See also
[MON-002](device-monitoring.md) for what "monitoring stopped" does downstream.

Wireless polling does **not** follow the same flag — it selects on
`wireless_polling_configurations.enabled` — so it is disabled separately off
`DeviceDeletedEvent` (DEV-072).

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts` (`Device.softDelete` and `Device.validate`)
**Reached from:** `softDelete`
**Message:** `Monitoring cannot be enabled for a deleted device`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`, `tests/application/device-inventory/use-cases/DeleteDeviceUseCase.test.ts`, `tests/integration/use-cases/device-inventory/DeleteDeviceUseCase.integration.test.ts`

### DEV-072 — A deleted device is invisible to every read path

**Type:** Invariant · **Status:** Active
**Layer:** Infrastructure (repository) + Application
**Since:** 2026-08-12

Every finder on `IDeviceRepository` excludes rows with a `deletedAt`. `GET
/api/devices/:id` answers `404`, listings omit it and do not count it in
`total`, and the MAC and IP uniqueness checks ignore it. Two methods deliberately
see tombstones, and say so in their names: `findByIdIncludingDeleted` (restore)
and `findDeletedBefore` (purge).

The MAC and IP unique indexes are **partial** — `WHERE deleted_at IS NULL` — so
a deleted device releases its addresses for reuse rather than holding them
hostage until the purge runs.

The device's wireless configuration is disabled off `DeviceDeletedEvent`, since
the wireless orchestrator selects on its own `enabled` flag and would otherwise
keep collecting snapshots for a device nobody can see.

**Why:** "Soft delete" is only honest if the device is genuinely gone from the
operator's point of view. A tombstone that still appears in a listing, still
blocks an IP address, or still gets polled is not a deleted device — it is a
bug with a nicer name.

Putting the predicate in the repository rather than in each use case is what
makes that hold by default: `buildFilterWhere` is shared by the page query and
the count query, so the two cannot disagree about what "matching" means.

**Enforced at:** `src/infrastructure/persistence/PrismaDeviceRepository.ts` (the `LIVE` predicate, applied by every finder); partial indexes in `prisma/migrations/20260811120000_device_soft_delete_and_replacement/migration.sql`; `src/application/wireless-monitoring/event-handlers/DeviceDeletedWirelessConfigHandler.ts`
**Message:** `Device not found: <id>`
**Tests:** `tests/integration/use-cases/device-inventory/DeleteDeviceUseCase.integration.test.ts`, `tests/application/wireless-monitoring/event-handlers/DeviceDeletedWirelessConfigHandler.test.ts`, `tests/infrastructure/persistence/PrismaDeviceRepository.test.ts`

### DEV-073 — A deleted device cannot be modified

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-12

`applyChanges` refuses on the first line when `deletedAt` is set, so every
mutator built on it — `changeStatus`, `assignLocation`, `updateDetails`,
`enableMonitoring`, `correctDeviceModel` — refuses too. `markReplaced` refuses
separately (DEV-083).

**Why:** A tombstone is a record of what the device was when it was deleted. If
a `PATCH` could rewrite it, a restore inside the grace period would hand back a
device that had silently changed while it was invisible, and the audit trail
would describe a state that never existed in service.

In practice `PATCH` returns `404` before reaching the aggregate (DEV-072), so
this is defence in depth rather than the primary gate — but the aggregate is
where the rule belongs, because it must also hold for callers that load a
tombstone deliberately.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts` (`Device.applyChanges`)
**Reached from:** every mutator except `restore`
**Message:** `Cannot modify a deleted device — restore it first`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`

### DEV-074 — A deleted device can be restored only inside the grace period

**Type:** Policy · **Status:** Active
**Layer:** Domain + Application
**Since:** 2026-08-12

`POST /api/devices/:id/restore` clears `deletedAt` and `deletedBy`. It refuses
if the device is not deleted, and refuses once `deletedAt` is more than the
grace period old. **Monitoring stays off** — restoring does not resume polling.

Requires the `delete` permission (ADMIN), not `update`: restoring is the inverse
of deleting, so the same authority governs both.

**Why:** The grace period is the promise the delete makes, and a restore that
worked past it would be a lie — the purge either has already taken the row or is
about to on the next daily sweep, so the device would silently vanish again.
Refusing with a clear message is better than handing back something that does
not survive the night.

Monitoring stays off because coming back from a deletion is not the same as
being put back in service. The operator deleted this device on purpose; bringing
the record back is a smaller decision than resuming polling, and silently
restarting alerts for a device someone had written off is the wrong default. Re-
enabling is one explicit `PATCH`.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts` (`Device.restore`); `src/application/device-inventory/use-cases/RestoreDeviceUseCase.ts`
**Message:** `Cannot restore a device whose <N>-day grace period expired` / `Cannot restore a device that is not deleted`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`, `tests/application/device-inventory/use-cases/RestoreDeviceUseCase.test.ts`, `tests/integration/use-cases/device-inventory/RestoreDeviceUseCase.integration.test.ts`, `tests/integration/device.routes.test.ts`

### DEV-075 — A device carrying a live contracted service cannot be deleted

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-12

The delete is refused when a `ContractedService` points at the device in any
status other than `CANCELLED` — so `PENDING`, `ACTIVE` and `SUSPENDED` all
block. The message names the offending status. A cancelled service is history
and does not block.

**Why:** `ContractedService.deviceId` is `ON DELETE SET NULL`, so the purge at
the end of the grace period would detach the customer's service from its
equipment without an error, a log line, or anything a person would notice. The
billing link would simply be gone.

Checking at delete time rather than at purge time is the deliberate half of this
rule. The purge runs unattended a week later; refusing there would leave rows
that can never die and nobody watching to find out why. Refusing at the moment
the operator asks puts the decision in front of the person who can act on it —
cancel the service, or keep the device.

**Enforced at:** `src/application/device-inventory/use-cases/DeleteDeviceUseCase.ts` (`guardAgainstLiveContract`)
**Reached from:** `DELETE /api/devices/:id`
**Message:** `Cannot delete a device with a live contracted service (status <status>). Cancel the service first.`
**Tests:** `tests/application/device-inventory/use-cases/DeleteDeviceUseCase.test.ts`, `tests/integration/use-cases/device-inventory/DeleteDeviceUseCase.integration.test.ts`, `tests/integration/device.routes.test.ts`

### DEV-076 — A device with open tickets cannot be deleted

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-12

The delete is refused while any non-terminal ticket references the device —
`OPEN`, `ASSIGNED` or `IN_PROGRESS` (see [TKT](tickets.md)). `RESOLVED` and
`CANCELLED` do not block. The message names how many are in the way. Tickets for
other devices are irrelevant.

**Why:** An open ticket is unfinished field work whose subject is this device. A
technician has it on their day sheet; `Ticket.deviceId` is `ON DELETE SET NULL`,
so purging the device would leave them holding a job that points at nothing,
with the address and the fault description intact but no equipment record to
match them to.

Resolving or cancelling the ticket first is not busywork — it is the operator
stating what happened to the job, which is exactly the information the deleted
device can no longer supply.

**Enforced at:** `src/application/device-inventory/use-cases/DeleteDeviceUseCase.ts` (`guardAgainstOpenTickets`)
**Reached from:** `DELETE /api/devices/:id`
**Message:** `Cannot delete a device with <N> open ticket(s). Resolve or cancel them first.`
**Tests:** `tests/application/device-inventory/use-cases/DeleteDeviceUseCase.test.ts`, `tests/integration/use-cases/device-inventory/DeleteDeviceUseCase.integration.test.ts`, `tests/integration/device.routes.test.ts`

### DEV-077 — A device past its grace period is removed permanently, with its history

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-12

A daily job hard-deletes every device whose `deletedAt` is older than the grace
period, cascading to its `pingResults`, `alertEvents`, `wirelessSnapshots`,
`wirelessAlertRecords`, `deviceState`, `deviceCredentials`,
`pollingConfiguration` and `wirelessPollingConfiguration`. A device that was the
lineage ancestor of a replacement leaves its successor's `replacesDeviceId`
null rather than blocking (`ON DELETE SET NULL`). One failing row is logged and
skipped; the rest of the batch still runs.

The job runs **unguarded**: it does not re-check the contracted-service or
ticket conditions.

**Why:** The cascade is the point, not a side effect. Retention exists so that
data for equipment that no longer exists stops costing storage and stops
appearing in queries; keeping a device's snapshots after the device is gone
would be keeping the expensive half of the record and discarding the cheap one.

It runs unguarded because DEV-075 and DEV-076 already refused the delete a week
earlier. Anything that reaches the purge was cleared for removal by a person at
the time they asked. Re-checking here would convert a decided deletion into a
row that quietly never dies, with no one watching the job to notice — the worst
of both policies.

Skipping a failed row rather than aborting the batch matters because there is no
transaction around the loop: one device with an unexpected constraint must not
strand every other device behind it indefinitely.

**Enforced at:** `src/application/device-inventory/use-cases/PurgeDeletedDevicesUseCase.ts`; scheduled by `src/infrastructure/retention/DataRetentionOrchestrator.ts`
**Reached from:** the retention orchestrator only — there is no HTTP surface
**Tests:** `tests/application/device-inventory/use-cases/PurgeDeletedDevicesUseCase.test.ts`, `tests/integration/use-cases/device-inventory/PurgeDeletedDevicesUseCase.integration.test.ts`

### DEV-078 — Replacing a unit retires it into a status the caller chooses

**Type:** Policy · **Status:** Active
**Layer:** Application + Domain
**Since:** 2026-08-12

`POST /api/devices/:id/replace` creates a new `Device` for the replacement
hardware and retires `:id` into `retiredStatus`, which is **required** and must
be one of the retired set: `INVENTORY`, `DAMAGED`, `DECOMMISSIONED`. `ACTIVE`
and `COMMISSIONING` are refused. The replacement inherits the retired unit's
location, category and owner, and defaults its name. What the replacement must
carry of its own is DEV-160.

The endpoint requires the `activate` permission (ADMIN and OPERATOR).

**Why:** A `Device` row is one physical unit. Every metric hangs off its id, so
editing `deviceModelId` in place would retroactively re-attribute months of
readings to hardware that never produced them — which is exactly why DEV-063
refuses it. Replacement is the operation that closes the gap DEV-063 leaves
open, by creating a second row instead of rewriting the first.

**The retired status is the caller's because the system cannot infer it.** A
swap is not always a failure. A damaged unit is `DAMAGED`; an antenna upgraded
for a more powerful model is still working and belongs back in `INVENTORY` as
stock; a unit that is obsolete rather than broken is `DECOMMISSIONED`. Picking
one of those for the operator would mean guessing why the swap happened, and
guessing wrong makes the fleet's condition report fiction.

**History — the identifier requirement was split out as DEV-160 on 2026-08-18.**
It was declared inside this entry and enforced with its own check and its own
message, so it was a second rule wearing this one's ID: `check-rule-coverage`
counts by ID and could only ever report the pair as one. Nothing about either
rule changed in the split.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts` (`Device.markReplaced`); `src/application/device-inventory/use-cases/ReplaceDeviceUseCase.ts` (`beforeExecute`); route schema in `src/presentation/http/validation/device.schemas.ts`
**Message:** `Cannot retire a replaced device as <status> — must be one of: DAMAGED, DECOMMISSIONED, INVENTORY`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`, `tests/domain/device-inventory/value-objects/DeviceStatus.test.ts`, `tests/application/device-inventory/use-cases/ReplaceDeviceUseCase.test.ts`, `tests/integration/use-cases/device-inventory/ReplaceDeviceUseCase.integration.test.ts`

### DEV-079 — A replacement takes over the retired unit's IP address

**Type:** Invariant · **Status:** Active
**Layer:** Application + Domain
**Since:** 2026-08-12

`markReplaced` clears the retired unit's `ipAddress` and stops its monitoring;
the replacement is created with the released address. A replacement that
inherited an address starts in `COMMISSIONING`; one that did not starts in
`INVENTORY`. The retired unit is saved before the replacement is created.

**Why:** The address belongs to the job, not to the box. A CPE at a customer's
house keeps its address across a hardware swap, because that is what the rest of
the network — routing, the enforcement queues, the customer's service — is
pointing at.

The write order is not incidental. Both rows are live, and the unique index on
`ip_address` is scoped to live rows (DEV-072), so creating the replacement first
would collide with the address the retired unit has not yet given up.

The starting status is keyed off the inherited address rather than off the
retired unit's old status, because by the time the replacement is built
`markReplaced` has already rewritten that field. A unit with an address is being
installed; one without is a box on a shelf — and both readings satisfy the
status invariants (DEV-054, DEV-056) without a special case.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts` (`Device.markReplaced`); `src/application/device-inventory/use-cases/ReplaceDeviceUseCase.ts`
**Reached from:** `POST /api/devices/:id/replace`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`, `tests/application/device-inventory/use-cases/ReplaceDeviceUseCase.test.ts`, `tests/integration/use-cases/device-inventory/ReplaceDeviceUseCase.integration.test.ts`

### DEV-080 — A replacement inherits the retired unit's credentials and contracted service

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-12

`DeviceCredentials` are copied to the replacement and then deleted from the
retired unit — in that order. `ContractedService.deviceId` is re-pointed via
`ContractedService.assignDevice`. The response reports whether each actually
moved. If either fails after the replacement exists, the whole call fails with a
message saying so.

**Why:** Both links are `1:1` and both are invisible when they break.
`ContractedService.deviceId` is `@unique`, so the customer's service can only
point at one device; leaving it on the retired unit means the billing and
enforcement pipelines act on a box that is no longer installed. Credentials are
worse to lose than to move — re-entering an AirOS password per site is exactly
the tedium that makes operators skip the swap and edit the row instead.

Copy-then-delete rather than move: the retired unit's row is the only surviving
copy of the credentials until the write lands, so deleting first would risk
losing them to a failure in between.

**Known limitation:** no repository accepts a transaction client, so these
writes are not atomic with the two device saves. The order is chosen so a
partial failure is recoverable and a retry is safe, and a failure after the
replacement exists is reported rather than swallowed — but a crash between steps
can still leave the credentials copied and the contract not. The real fix is the
transactional-outbox item in [TODOS.md](../TODOS.md), which this rule does not
attempt to pre-empt.

**Enforced at:** `src/application/device-inventory/use-cases/ReplaceDeviceUseCase.ts`
**Reached from:** `POST /api/devices/:id/replace`
**Message:** `Replacement created but credentials could not be transferred: <error>` / `Replacement created but the contracted service could not be re-pointed: <error>`
**Tests:** `tests/application/device-inventory/use-cases/ReplaceDeviceUseCase.test.ts`, `tests/integration/use-cases/device-inventory/ReplaceDeviceUseCase.integration.test.ts`

### DEV-081 — A non-wireless replacement ends the retired unit's wireless polling

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-12

When the retired unit had a `WirelessPollingConfiguration` and the replacement's
model is not `isWireless`, the configuration is deleted and the response says
so. When the replacement is also wireless the configuration is left alone. A
failure to delete is logged and does not fail the replacement.

**Why:** The configuration describes a radio. If the replacement has no radio,
copying it forward would schedule AirOS polls against hardware that cannot
answer, and every wireless rule downstream would evaluate against nothing.

The orchestrator has to do this explicitly because DEV-027 deliberately stopped
cascading. That rule now _refuses_ to make a model non-wireless while configs
exist, rather than deleting them — so nothing removes the config on the
operator's behalf, and the replacement is the one place that knows the old and
new radio capability at the same time.

Reporting it in the response rather than doing it silently matters: the operator
needs to know their wireless monitoring stopped, and why. A failure to delete is
logged rather than fatal because the replacement itself has already succeeded —
an orphaned config is a smaller problem than a half-done swap.

**Enforced at:** `src/application/device-inventory/use-cases/ReplaceDeviceUseCase.ts`
**Reached from:** `POST /api/devices/:id/replace`
**Tests:** `tests/application/device-inventory/use-cases/ReplaceDeviceUseCase.test.ts`, `tests/integration/use-cases/device-inventory/ReplaceDeviceUseCase.integration.test.ts`

### DEV-082 — A device can be replaced once per service life, and the lineage has one source of truth

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-12 · **Amended:** 2026-08-18

Only `replacesDeviceId` is stored, on the replacement's row, with an
`ON DELETE SET NULL` self-reference. `replacedByDeviceId` is read back off it
rather than stored, and resolves to the **most recently created** successor.
Replacing a unit that already has a successor is refused **while that unit is
still retired**; once it is back in service the refusal lifts.

**Why one stored column:** storing both directions invites them to disagree, and
a lineage chain that contradicts itself is worse than no lineage at all — it is
the record that answers "is this the same CPE the customer has had since March,
or a different box?", and a wrong answer there re-attributes history to the
wrong hardware. One column makes the second direction a derivation rather than
a claim.

**Why the cap is per service life, not per lifetime.** A swap is not always a
failure (DEV-078): an antenna upgraded for a more powerful model still works and
goes back to `INVENTORY` as stock. Nothing stops it being deployed to another
site later, and when it eventually breaks there it needs replacing again. A
lifetime cap made that second swap unrecordable — the operator got
`Device has already been replaced` for a unit that was live at a customer, with
no way forward but to falsify the record. What must not happen is a _second_
successor for a service life that already ended, which is what the retired-status
condition expresses: a unit sitting in `INVENTORY`/`DAMAGED`/`DECOMMISSIONED`
with a successor has been superseded and stays superseded.

**History — the unique index was dropped on 2026-08-18.**
`devices_replaces_device_id_key` capped the lineage at one successor per row, so
no aggregate rule could have permitted the second swap; the constraint would
have rejected the insert regardless. It is replaced by a plain index on the same
column (`devices_replaces_device_id_idx`), which keeps the back-reference lookup
an index scan. Rows with several successors are ordered newest-first and the
head is the current one; the older rows are the record of previous service
lives. This also removed the check from `DeviceEligibilityService` — see
DEV-086.

`SET NULL` rather than `RESTRICT` on the self-reference so that purging a
retired unit at the end of its grace period (DEV-077) breaks the chain instead
of the delete. Losing the link when the ancestor's record is gone is honest —
there is nothing left to point at.

**Known gap:** a unit that has _never_ been deployed can still be "replaced" —
`markReplaced` does not require the device to be in service, only that it is not
a superseded retired one. Replacing a warehouse unit is meaningless (there is
nothing installed to swap out) but harmless, and tightening it would make
DEV-079's no-address branch unreachable. Left as-is deliberately.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts` (`Device.markReplaced`)
**Message:** `Device has already been replaced`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`, `tests/application/device-inventory/use-cases/ReplaceDeviceUseCase.test.ts`, `tests/infrastructure/mappers/DeviceMapper.test.ts`, `tests/integration/use-cases/device-inventory/ReplaceDeviceUseCase.integration.test.ts`, `tests/integration/use-cases/device-inventory/PurgeDeletedDevicesUseCase.integration.test.ts`

### DEV-083 — A deleted device cannot be replaced

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-12

`markReplaced` refuses when `deletedAt` is set. In practice the use case fails
earlier with `Device not found`, because `findById` excludes tombstones
(DEV-072).

**Why:** Replacement inherits from the retired unit — its location, its
category, its owner, its IP, its credentials and its customer's service. A
deleted device has already had its monitoring stopped and is days away from
being purged along with all of it. Building a new device on top of a record
scheduled for destruction would produce a replacement whose ancestor vanishes,
and whose inherited links were copied from something the operator had already
written off.

Restore first if the swap is genuine; the two operations are deliberately
separate decisions.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts` (`Device.markReplaced`)
**Message:** `Cannot replace a deleted device`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`, `tests/application/device-inventory/use-cases/ReplaceDeviceUseCase.test.ts`

### DEV-084 — Deleted devices are listable as a recycle bin

**Type:** Policy · **Status:** Active
**Layer:** Application + Infrastructure (repository)
**Since:** 2026-08-12

`GET /api/devices` takes a `deleted` filter with three states: absent or
`false` returns live devices only (the default everywhere), `true` returns
tombstones only, `any` returns both. The bin rows carry `deletedAt` and
`deletedBy`, and `sortBy=deletedAt` orders them most-recently-deleted first.
Reading the bin needs only the `read` permission; acting on it needs more
(DEV-074, DEV-085).

**Why:** Soft delete is only useful if the operator can find what they deleted.
DEV-070 made deletion reversible for seven days, but without a listing the only
way to exercise that was to already hold the device id — which meant the undo
had to be an inline toast the user might miss, and a device deleted yesterday
was unrecoverable in practice even though the row was still sitting there. The
grace period existed and could not be used.

The filter is one tri-state knob rather than two booleans because
`includeDeleted` and `deletedOnly` could be set to a combination that means
nothing. It routes through the filtered query path deliberately: the unfiltered
listing calls `findAll`/`count`, which hard-code the live predicate, so a flag
that did not force the filtered path would silently do nothing.

`any` exists for callers that genuinely want the whole table and is the only
way a tombstone and a live device appear on the same page — which is why it is
not the default for anything.

**Enforced at:** `src/infrastructure/persistence/PrismaDeviceRepository.ts` (`buildFilterWhere`); `src/application/device-inventory/use-cases/ListDevicesUseCase.ts` (`hasActiveFilters`); `src/presentation/http/validation/device.schemas.ts`
**Message:** `deleted must be true, false or any`
**Tests:** `tests/integration/use-cases/device-inventory/ListDevicesUseCase.integration.test.ts`, `tests/integration/use-cases/device-inventory/PermanentlyDeleteDeviceUseCase.integration.test.ts`, `tests/integration/device.routes.test.ts`

### DEV-085 — A device can only be permanently deleted from the recycle bin

**Type:** Invariant · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-12

`DELETE /api/devices/:id/purge` removes a device and its whole cascade
immediately, without waiting out the grace period — the "empty the bin" action.
It refuses unless the device has already been soft-deleted. ADMIN only.

**Why:** This is the same destruction the scheduled purge performs (DEV-077),
just on demand, so it must enter through the same door. A live device reaching
it directly would skip **both** delete guards — the live contracted service
(DEV-075) and the open tickets (DEV-076) — and destroy in one call exactly what
those rules exist to protect. Requiring the device to be in the bin means it has
already passed them.

It is a separate endpoint rather than a flag on `DELETE /api/devices/:id`
because the two have opposite risk profiles: one is reversible for a week, the
other is immediate and total. A boolean would make the destructive reading of a
familiar verb one typo away.

**Enforced at:** `src/application/device-inventory/use-cases/PermanentlyDeleteDeviceUseCase.ts`
**Reached from:** `DELETE /api/devices/:id/purge`
**Message:** `Cannot permanently delete a device that is not in the recycle bin. Delete it first.`
**Tests:** `tests/application/device-inventory/use-cases/PermanentlyDeleteDeviceUseCase.test.ts`, `tests/integration/use-cases/device-inventory/PermanentlyDeleteDeviceUseCase.integration.test.ts`, `tests/integration/device.routes.test.ts`

---

### DEV-086 — Only a live, in-service device is polled

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-13

A device is eligible for polling when it is not deleted, its status is `ACTIVE`
or `COMMISSIONING`, and monitoring is enabled.
`COMMISSIONING` is included deliberately — see DEV-058/DEV-059; a unit is
monitored while it is being installed, not only once someone marks it `ACTIVE`.

**Why:** Every stop-polling path in the system works by flipping a flag from an
event handler, and event dispatch is fire-and-forget over an already-committed
write. A flag that never got flipped is a cached answer nothing invalidates, so
a device can keep being polled long after it was deleted or retired. Naming the
rule once, against the aggregate, gives callers a check that cannot go stale.

Enforced in two places on purpose. `ExecutePollingCycleUseCase` re-reads the
device and asks `canPoll` before probing — that is the authority. The ICMP
`findAllDue` query _also_ filters on `deleted_at IS NULL AND status IN
('ACTIVE', 'COMMISSIONING')`, so an ineligible device is never selected in the
first place.

**Why the duplication is deliberate:** the SQL filter is an optimisation, not
the rule. It keeps the scheduler from waking up once per tick for devices it
will only discard, but it cannot express the whole predicate (`monitoringEnabled`
is already covered by `pc.enabled`). If the two ever disagree, the use case wins — it is the one
that runs against the aggregate. A change to this rule must touch both.

**History — the "not replaced" condition was dropped on 2026-08-18.**
`checkLive` also refused any device with a successor. Having a successor is a
fact about lineage, not about whether the box is in service: a unit superseded
by an upgrade and later redeployed to another site is live hardware a customer
depends on, and this denied its polling _and_ its alerting with nothing but a
skip to show for it. Being out of service is what `markReplaced` writes as a
retired status, and the status condition above already refuses that — so
nothing that should have been skipped is now polled. `DEVICE_REPLACED` was
removed from `IneligibilityReason` with it. See DEV-082.

**Enforced at:** `src/domain/device-inventory/services/DeviceEligibilityService.ts` (`canPoll`), called from `src/application/device-monitoring/use-cases/ExecutePollingCycleUseCase.ts`; pre-filtered in `src/infrastructure/persistence/PrismaPollingConfigurationRepository.ts` (`findAllDue`)
**Reached from:** the polling orchestrator's tick, and `POST /api/devices/:id/polling/execute` (`forceExecution` does **not** override it — it turns the silent skip into a `400`)
**Message:** `Device is <STATUS> and is not polled` / `Device has monitoring disabled` / `the device no longer exists`
**Tests:** `tests/domain/device-inventory/services/DeviceEligibilityService.test.ts`, `tests/application/device-monitoring/use-cases/ExecutePollingCycleUseCase.test.ts`

---

### DEV-087 — A deleted or retired device raises no new alert

**Type:** Policy · **Status:** Active
**Layer:** Application + Domain
**Since:** 2026-08-13

Checked at alert-dispatch time, not at poll time: the device is re-read from
the repository the moment an alert is about to be recorded, and a deleted,
replaced or retired device is skipped. Deliberately **not** gated on
`monitoringEnabled` — that flag is the stale cache this rule routes around, and
an alert already in flight when monitoring was switched off is still true.

Only the alert-**opening** paths are gated. Resolution stays ungated so an alert
raised while the device was live can still be closed; gating it too would strand
the alert permanently `OPEN` on a device no read path can see.

**Why:** A device can be deleted between the poll that failed and the
notification that reports it. The wireless path is the costly one — it reaches
`ITicketOpener`, so a suppressed-too-late alert becomes a work order carrying a
customer's name, phone and address, and a technician is dispatched to a customer
who cancelled. Investigating it then hits a 404, because every read path already
hides the device.

**Enforced at:** `src/domain/device-inventory/services/DeviceEligibilityService.ts` (`canAlert`), called from `SendDeviceDownAlertUseCase` and `OpenAlertUseCase`
**Reached from:** `DeviceWentOfflineEvent` → `SendDeviceDownAlertUseCase`; `WirelessAlertTriggeredEvent` → `AlertRecorder` → `OpenAlertUseCase`
**Message:** `Device has been deleted` / `Device is <STATUS> and is not alerted on`
**Tests:** `tests/domain/device-inventory/services/DeviceEligibilityService.test.ts`, `tests/application/notifications/use-cases/SendDeviceDownAlertUseCase.test.ts`, `tests/application/notifications/use-cases/OpenAlertUseCase.test.ts`, `tests/integration/use-cases/notifications/SendDeviceDownAlertUseCase.integration.test.ts`, `tests/integration/use-cases/notifications/SendDeviceRecoveryAlertUseCase.integration.test.ts`

---

### DEV-088 — Wireless polling additionally requires a radio-capable device

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-13

On top of DEV-086, a device is eligible for wireless polling only when its
category is `WIRELESS_CPE` or `ACCESS_POINT` (DEV-062).

**Why:** The two eligibility questions differ by exactly one term, and writing
that term twice is how they drift. Note this checks the device's _category_, not
`DeviceModel.isWireless` — the model lives in a second aggregate, and pulling it
in would force a repository into a domain service. `CreateWirelessConfigUseCase`
already checks the model at config-creation time; re-checking it per poll is
tracked separately.

`PollWirelessDeviceUseCase` reaches this through its own narrow port
(`application/wireless-monitoring/interfaces/IDeviceRepository`), which returns
the _reason_ rather than the `Device`. That keeps device-inventory's aggregate
out of wireless-monitoring; `WirelessDeviceRepositoryAdapter` is where the two
contexts meet. The wireless `findAllDue` pre-filters on deletion and status like
DEV-086, but **not** on category — a config only exists for a radio-capable
device (WLS-002), so the SQL would be filtering on something already guaranteed.

**Enforced at:** `src/domain/device-inventory/services/DeviceEligibilityService.ts` (`canPollWireless`), applied in `src/infrastructure/wireless-monitoring/adapters/WirelessDeviceRepositoryAdapter.ts`; pre-filtered in `src/infrastructure/wireless-monitoring/repositories/PrismaWirelessDeviceConfigRepository.ts` (`findAllDue`)
**Reached from:** the wireless polling orchestrator's tick, and `POST /api/devices/:id/wireless/poll` (`forceExecution` does **not** override it)
**Message:** `Only WIRELESS_CPE and ACCESS_POINT devices can be polled for wireless metrics`
**Tests:** `tests/domain/device-inventory/services/DeviceEligibilityService.test.ts`, `tests/application/wireless-monitoring/use-cases/PollWirelessDeviceUseCase.test.ts`

---

### DEV-089 — Retiring a device stops its wireless polling, and only commissioning resumes it

**Type:** Policy · **Status:** Active
**Layer:** Application
**Since:** 2026-08-13

Moving a device into any retired status (`INVENTORY`, `DAMAGED`,
`DECOMMISSIONED`) disables its `WirelessDeviceConfig`. Only one transition turns
it back on: **arriving at `COMMISSIONING`**, mirroring what DEV-059 does for
ICMP monitoring. Every other return to service — including retired → `ACTIVE`,
and restoring from the recycle bin — leaves polling off for an operator to
enable deliberately, exactly as `Device.restore()` leaves `monitoringEnabled`
false. The config is **disabled, never deleted**, so the interval and link
capacity survive the round trip and resuming is one click.

Enabling is guarded at the API too: `UpdateWirelessConfigUseCase` refuses
`enabled: true` for a device that fails `canPollWireless` (DEV-088). Only that
direction is guarded — disabling is always allowed, and every other field stays
editable on a retired device, since correcting an IP on something in the
workshop is harmless.

**Why:** Two independent flags govern polling. `DeviceStatusChangedHandler` →
`SuspendDeviceMonitoringUseCase` only touches `polling_configurations` (ICMP);
the wireless orchestrator selects on `wireless_polling_configurations.enabled`,
and nothing linked that flag to device status. A radio marked `DAMAGED` kept
being HTTP-polled and kept writing snapshots — silently, since it is invisible
in every device read path.

**Why resuming is so narrow:** wireless follows ICMP rather than inventing its
own lifecycle. `softDelete()` turns `monitoringEnabled` off and `restore()` does
not turn it back on, so ICMP polling stays off after a restore; a device moved
straight from retired to `ACTIVE` likewise keeps `monitoringEnabled: false`.
Re-enabling wireless in either case would have the two pipelines disagree about
whether a device is being watched — the exact split this rule exists to close.
Only `COMMISSIONING` re-enables because that is the one transition the aggregate
itself treats as "this unit is going back into service" (DEV-059).

A consequence worth stating: an operator who deliberately disabled wireless
polling and then commissions the device will find it enabled again. The config
records no reason for being off, so the handler cannot tell its own change from
theirs. Distinguishing them needs a flag on `WirelessDeviceConfig`; until then
the narrow trigger keeps the blast radius to one transition.

**Enforced at:** `src/application/wireless-monitoring/event-handlers/DeviceStatusChangedWirelessConfigHandler.ts`; enabling additionally guarded in `src/application/wireless-monitoring/use-cases/UpdateWirelessConfigUseCase.ts`
**Reached from:** `DeviceStatusChangedEvent` (see DEV-072 for the deletion leg), and `PATCH /api/devices/:id/wireless/config`
**Message:** `Cannot enable wireless polling — <reason>` (the event handler logs rather than surfacing a failure)
**Tests:** `tests/application/wireless-monitoring/event-handlers/DeviceStatusChangedWirelessConfigHandler.test.ts`, `tests/application/wireless-monitoring/use-cases/UpdateWirelessConfigUseCase.test.ts`

---

## Location

### DEV-090 — A location has a non-empty name of at most 150 characters

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28

**Why:** The name is what operators search by and what appears on the map pin.

**Enforced at:** `src/domain/device-inventory/aggregates/Location.ts:183` (`Location.validateName`)
**Reached from:** `create`, `updateName`
**Message:** `Location name cannot be empty` / `Location name cannot exceed 150 characters`
**Tests:** `tests/domain/device-inventory/aggregates/Location.test.ts`, `tests/integration/use-cases/device-inventory/CreateLocationUseCase.integration.test.ts`, `tests/integration/location.routes.test.ts`

### DEV-091 — A location type is one of six values

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28

Required: `TOWER`, `DATACENTER`, `POINT_OF_PRESENCE`, `OFFICE`,
`CUSTOMER_PREMISES`, `OTHER`. Input is trimmed and upper-cased before the set is
checked, so `tower` is accepted and stored as `TOWER`.

The set is owned by the `LocationType` value object. Nothing above the domain
holds a copy of it: the aggregate's `type` is a `LocationType`, never a string,
so an unparsed value cannot reach `Location.create`. The Zod schemas at the HTTP
edge do carry their own literal list — that one is a fast-fail for a better 400,
not the authority.

**Why:** The type distinguishes infrastructure the ISP owns from premises it
visits, which is what DEV-096 keys off. `OTHER` keeps the set closed without
forcing a deploy for every unusual site. _(inferred)_

**Enforced at:** `src/domain/device-inventory/value-objects/LocationType.ts:29` (`LocationType.create`)
**Reached from:** `CreateLocationUseCase.ts:56`, `UpdateLocationUseCase.ts:77`, `ListLocationsUseCase.ts:70` (type filter)
**Message:** `Invalid location type: "<value>". Must be one of: TOWER, DATACENTER, POINT_OF_PRESENCE, OFFICE, CUSTOMER_PREMISES, OTHER`
**Tests:** `tests/domain/device-inventory/value-objects/LocationType.test.ts`, `tests/domain/device-inventory/aggregates/Location.test.ts`, `tests/integration/use-cases/device-inventory/CreateLocationUseCase.integration.test.ts`, `tests/integration/use-cases/device-inventory/UpdateLocationUseCase.integration.test.ts`, `tests/integration/location.routes.test.ts`

A stored value is held to a stricter standard than an incoming one:
`LocationMapper.toDomain` checks `LocationType.isValid` on the raw column with no
trimming or case-folding, and throws
`Data integrity violation: unrecognised LocationType "<value>" in persistence store`
on a miss. A row that only matches after normalisation means the database and the
domain have drifted, which is a defect to surface rather than paper over.
(`src/infrastructure/mappers/LocationMapper.ts:117`)

### DEV-092 — Latitude and longitude must be supplied together

**Type:** Validation · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28

Coordinates are optional, but half a coordinate is rejected. On update, passing
both as `null` explicitly clears them.

**Why:** A latitude without a longitude does not locate anything — it is a
partially-filled form, and storing it would put a pin at an arbitrary spot on a
meridian.

**Enforced at:** `src/application/device-inventory/use-cases/CreateLocationUseCase.ts:44`, `UpdateLocationUseCase.ts:39`; structurally enforced by `CoordinatesProps`
**Message:** `Both latitude and longitude must be provided together`
**Tests:** `tests/integration/use-cases/device-inventory/UpdateLocationUseCase.integration.test.ts`, `tests/integration/location.routes.test.ts`

### DEV-093 — Coordinates are finite numbers in WGS-84 range

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28

Latitude −90 to 90, longitude −180 to 180. Altitude is optional and unbounded
but must be a finite number when present. `NaN` and `Infinity` are rejected for
all three.

**Why:** These are the limits of the coordinate system; anything outside is not
a point on Earth. The explicit finite check exists because `NaN` passes a naive
`typeof x === 'number'` test and would render as a broken map pin.

**Enforced at:** `src/domain/device-inventory/value-objects/Coordinates.ts:43-88`
**Message:** `latitude must be a finite number` / `longitude must be a finite number` / `altitude must be a finite number`, plus range messages from `Guard.inRange`
**Tests:** `tests/domain/device-inventory/value-objects/Coordinates.test.ts`, `tests/integration/use-cases/device-inventory/UpdateLocationUseCase.integration.test.ts`

### DEV-094 — An address is all three parts or none

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28

Street, municipality and neighborhood must be supplied together. Supplying any
one of them requires all three. On update, the rule is applied to the merged
result of current and incoming fields, not to the incoming fields alone.

All three absent is a legitimate outcome, not a failure — it means the location
has no address. `Address.createOptional` is the single factory expressing that
three-way outcome (none → `null`, partial → failure, all → an `Address`), which
is why both the create path and the update path can share it.

**Why:** A partial address cannot be navigated to. Accepting one would create the
appearance of a known address while leaving a technician unable to find the
site.

**Enforced at:** `src/domain/device-inventory/value-objects/Address.ts:61` (`Address.createOptional`)
**Reached from:** `Location.updateAddressFields` (`Location.ts:126`), `CreateLocationUseCase.ts:74`
**Message:** `An address requires a street, municipality, and neighborhood`
**Tests:** `tests/domain/device-inventory/value-objects/Address.test.ts`, `tests/domain/device-inventory/aggregates/Location.test.ts`, `tests/integration/use-cases/device-inventory/UpdateLocationUseCase.integration.test.ts`

### DEV-095 — Address parts are non-empty and length-capped

**Type:** Validation · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28

Street ≤ 255, municipality ≤ 100, neighborhood ≤ 150. All trimmed.

**Enforced at:** `src/domain/device-inventory/value-objects/Address.ts:36-56` (`Address.create`, reached from `createOptional` — DEV-094)
**Message:** `Street address cannot exceed 255 characters` (and the parallel messages for the other two)
**Tests:** `tests/domain/device-inventory/value-objects/Address.test.ts`

### DEV-096 — A CUSTOMER_PREMISES location must be navigable

**Type:** Invariant · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28

It must have coordinates **or** a complete address. Either satisfies the rule;
having neither is rejected. Enforced at creation, when changing an existing
location's type to `CUSTOMER_PREMISES`, and when editing the address of a
location that already is one.

**Why:** Customer premises are the sites technicians are dispatched to, usually
somewhere they have never been. Infrastructure sites are exempt because staff
already know where their own towers and offices are.

**Enforced at:** `src/domain/device-inventory/aggregates/Location.ts:204` (`Location.validateCustomerPremisesNavigability`)
**Reached from:** `create`, `updateType`, `updateAddressFields` — each asks the type itself via `LocationType.isCustomerPremises()` rather than comparing against a constant
**Message:** `A CUSTOMER_PREMISES location must have coordinates or a complete address (street, municipality, and neighborhood) so technicians can navigate to it`
**Tests:** `tests/domain/device-inventory/aggregates/Location.test.ts`, `tests/domain/device-inventory/value-objects/LocationType.test.ts`

### DEV-097 — A location with devices assigned cannot be deleted

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28

**Why:** Deleting it would strip those devices of the answer to "where is it" —
and for ACTIVE devices that is a state DEV-055 forbids. The devices must be
moved first, deliberately.

**Enforced at:** `src/application/device-inventory/use-cases/DeleteLocationUseCase.ts:57`
**Message:** `Cannot delete location: it has N device(s) assigned. Reassign or remove those devices first.`
**Tests:** `tests/integration/use-cases/device-inventory/DeleteLocationUseCase.integration.test.ts`, `tests/integration/location.routes.test.ts`

### DEV-098 — The map shows only locations with coordinates

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28

`GetMapLocationsUseCase` returns pins for locations that have coordinates.
Address-only locations are omitted. Each pin carries its devices with their
current status.

**Why:** A pin needs a latitude and longitude; an address alone cannot be plotted
without geocoding, which the system does not do. _(inferred)_

**Enforced at:** `src/application/device-inventory/use-cases/GetMapLocationsUseCase.ts:30`
**Tests:** `tests/integration/use-cases/device-inventory/GetMapLocationsUseCase.integration.test.ts`

### DEV-099 — A location requires a name and a type

**Type:** Invariant · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-11

Distinct from DEV-090/DEV-091: those govern what a _supplied_ name or type must
look like (length, closed set); this one governs whether the field was supplied
at all. `LocationProps.name` and `.type` are non-optional in the domain, so
`Location.create` can never see a missing one — the presence check has to
happen earlier, in `CreateLocationUseCase.beforeExecute`, before either value
reaches a value object or the aggregate.

**Why:** Same minimum as DEV-040 for a device: a name and a type are what make
a location row meaningful — what to call it, and what kind of site it is.
Everything else (address, coordinates) is optional at creation.

**Enforced at:** `src/application/device-inventory/use-cases/CreateLocationUseCase.ts:31-37`
**Message:** `Location name is required` / `Location type is required`
**Tests:** `tests/application/device-inventory/use-cases/CreateLocationUseCase.test.ts`, `tests/integration/use-cases/device-inventory/CreateLocationUseCase.integration.test.ts`, `tests/integration/location.routes.test.ts`

---

## Device Credentials

Credentials never enter the domain layer — they are infrastructure access
secrets, not part of the device's identity. Every rule below lives in the
application layer.

### DEV-120 — HTTP username and password are required, together

**Type:** Validation · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28

Both must be present and non-blank on every save. There is no way to store one
without the other.

**Why:** HTTP is the collection path actually in use today — the wireless
collector authenticates against the device's web interface. Credentials without
both halves cannot log in, so storing them would only produce collection
failures later. See also DEV-122: SNMP is the optional pair.

**Enforced at:** `src/application/device-inventory/use-cases/SetDeviceCredentialsUseCase.ts:36`
**Message:** `httpUsername and httpPassword are required`
**Tests:** `tests/integration/use-cases/device-inventory/SetDeviceCredentialsUseCase.integration.test.ts`

### DEV-121 — Credentials can only be set for a device that exists

**Type:** Invariant · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28

**Enforced at:** `src/application/device-inventory/use-cases/SetDeviceCredentialsUseCase.ts:134`
**Message:** `Device not found`
**Tests:** `tests/integration/use-cases/device-inventory/SetDeviceCredentialsUseCase.integration.test.ts`

### DEV-122 — SNMP is optional, but partial SNMP input is rejected

**Type:** Validation · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28

If **any** SNMP field is present, `snmpVersion` becomes mandatory and the
version-specific rules (DEV-123 to DEV-126) apply. If none is present, SNMP is
skipped entirely.

**Why:** No client collects SNMP today — nothing polls it. The rules are kept
intact so the capability survives untouched until SNMP metrics land, but they
must not force every HTTP-only save to supply SNMP fields it does not have.

**Enforced at:** `src/application/device-inventory/use-cases/SetDeviceCredentialsUseCase.ts:48-56`
**Message:** `snmpVersion is required when SNMP credentials are provided`
**Tests:** `tests/integration/use-cases/device-inventory/SetDeviceCredentialsUseCase.integration.test.ts`

### DEV-123 — SNMP version is 1, 2 or 3

**Type:** Validation · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28

**Enforced at:** `src/application/device-inventory/use-cases/SetDeviceCredentialsUseCase.ts:66`
**Message:** `snmpVersion must be 1, 2, or 3`
**Tests:** `tests/integration/use-cases/device-inventory/SetDeviceCredentialsUseCase.integration.test.ts`

### DEV-124 — SNMPv1 and v2 require a community string

**Type:** Validation · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28

**Why:** The community string is the entire authentication mechanism in these
versions. Without it there is no credential at all.

**Enforced at:** `src/application/device-inventory/use-cases/SetDeviceCredentialsUseCase.ts:73`
**Message:** `snmpCommunity is required for SNMPv1 and SNMPv2`
**Tests:** `tests/integration/use-cases/device-inventory/SetDeviceCredentialsUseCase.integration.test.ts`

### DEV-125 — SNMPv3 requires an auth user, protocol and key

**Type:** Validation · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28

All three of `snmpV3AuthUser`, `snmpV3AuthProto`, `snmpV3AuthKey`.

**Why:** v3 replaces the community string with user-based authentication; the
three fields are one credential and any subset cannot authenticate.

**Enforced at:** `src/application/device-inventory/use-cases/SetDeviceCredentialsUseCase.ts:79-89`
**Message:** `snmpV3AuthUser is required for SNMPv3` / `snmpV3AuthProto is required for SNMPv3` / `snmpV3AuthKey is required for SNMPv3`
**Tests:** `tests/integration/use-cases/device-inventory/SetDeviceCredentialsUseCase.integration.test.ts`

### DEV-126 — An SNMPv3 privacy protocol requires a privacy key

**Type:** Validation · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28

Privacy (encryption) is optional in v3; requesting it without a key is not.

**Why:** The protocol names the cipher, the key feeds it. Naming a cipher with
no key would fail at connection time.

**Enforced at:** `src/application/device-inventory/use-cases/SetDeviceCredentialsUseCase.ts:94`
**Message:** `snmpV3PrivKey is required when snmpV3PrivProto is set`
**Tests:** `tests/integration/use-cases/device-inventory/SetDeviceCredentialsUseCase.integration.test.ts`

### DEV-127 — Ports are between 1 and 65535, defaulting to 161 and 443

**Type:** Validation · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28

SNMP defaults to 161, HTTP to 443.

**Why:** The range is the TCP/UDP port space. The defaults are the standard SNMP
port and HTTPS, which is what the devices in the fleet listen on. _(inferred)_

**Enforced at:** `src/application/device-inventory/use-cases/SetDeviceCredentialsUseCase.ts:105`, `:112`; defaults in `DeviceCredentialsMapper.ts:69`, `:72`
**Message:** `snmpPort must be between 1 and 65535` / `httpPort must be between 1 and 65535`
**Tests:** `tests/integration/use-cases/device-inventory/SetDeviceCredentialsUseCase.integration.test.ts`

### DEV-128 — Stored secrets are never returned; they are masked as `***`

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28

`snmpCommunity`, `snmpV3AuthKey`, `snmpV3PrivKey` and `httpPassword` come back
as `***` when set and `null` when absent. Two booleans — `hasSnmpCredentials`,
`hasHttpCredentials` — report whether a usable credential exists.
`hasSnmpCredentials` is version-aware: community for v1/v2, user plus auth key
for v3.

**Why:** Masking rather than omitting lets the UI distinguish "a password is
set" from "no password configured" — which changes what the form should show —
without ever putting the secret on the wire.

**Enforced at:** `src/application/device-inventory/mappers/DeviceCredentialsMapper.ts:8`
**Tests:** `tests/integration/use-cases/device-inventory/GetDeviceCredentialsUseCase.integration.test.ts`

### DEV-129 — Secrets are redacted from logs

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28

`SetDeviceCredentialsUseCase` overrides `sanitizeForLogging` to replace the four
secret fields with `***` before the request is logged.

**Why:** Use case logging records request payloads. Without this override, every
credential save would write plaintext passwords into the log files, which are
retained and less protected than the database.

**Enforced at:** `src/application/device-inventory/use-cases/SetDeviceCredentialsUseCase.ts:168`
**Tests:** _none_

### DEV-130 — A save replaces HTTP fields but preserves omitted SNMP fields

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28

HTTP username and password are taken from the request outright. SNMP fields are
carried forward from the stored row when the request omits them. Passing an
explicit `null` still clears a field — omission and `null` mean different
things.

**Why:** No client sends SNMP fields today, so a routine HTTP credential update
would otherwise wipe SNMP keys that are tedious to re-enter and that nobody
intended to touch. Honouring explicit `null` keeps deliberate clearing possible.

**Enforced at:** `src/application/device-inventory/mappers/DeviceCredentialsMapper.ts:42` (`extractCreateData`)
**Tests:** `tests/integration/use-cases/device-inventory/SetDeviceCredentialsUseCase.integration.test.ts`

### DEV-131 — Reading credentials for a device with none configured is a failure

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28

Not an empty success.

**Enforced at:** `src/application/device-inventory/use-cases/GetDeviceCredentialsUseCase.ts:50`
**Message:** `No credentials configured for this device`
**Tests:** `tests/integration/use-cases/device-inventory/GetDeviceCredentialsUseCase.integration.test.ts`

### DEV-132 — Deleting credentials succeeds whether or not any exist

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28

Idempotent, and does not check that the device exists.

**Why:** The caller's intent is "this device should have no credentials", which
is already true when there are none. _(inferred)_

**Enforced at:** `src/application/device-inventory/use-cases/DeleteDeviceCredentialsUseCase.ts:39`
**Tests:** `tests/integration/use-cases/device-inventory/DeleteDeviceCredentialsUseCase.integration.test.ts`

---

## Cross-cutting

### DEV-140 — Every device inventory endpoint requires authentication

**Type:** Policy · **Status:** Active
**Layer:** Presentation (not in domain)
**Since:** 2026-07-28

All `/api` routes sit behind `createAuthenticateMiddleware`. No Bearer token
means `401`.

**Enforced at:** `src/presentation/http/routes/index.ts:51`
**Tests:** `tests/integration/location.routes.test.ts`

### DEV-141 — Write access to the catalogue is role-gated

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-07-28 · **Revised:** 2026-08-01

| Operation   | Permission | ADMIN | OPERATOR | VIEWER |
| ----------- | ---------- | :---: | :------: | :----: |
| List / read | `read`     |  ✅   |    ✅    |   ✅   |
| Create      | `create`   |  ✅   |    ✅    |   ❌   |
| Update      | `update`   |  ✅   |    ✅    |   ❌   |
| Delete      | `delete`   |  ✅   |    ❌    |   ❌   |

Applies uniformly to devices, device models, locations, vendors and network
scanning. Credential writes are the one carve-out — see DEV-144.

**Why:** Deletion is the only irreversible operation in the catalogue and the
one that can strip records from equipment in the field, so it is held to
administrators. Operators need create and update to do daily inventory work.

**Enforced at:** `src/domain/identity/permissions/Permission.ts:12` (`ROLE_PERMISSIONS`), applied per route via `authorize(...)`
**Tests:** `tests/domain/identity/permissions/Permission.test.ts`, `tests/integration/location.routes.test.ts`

**Note:** Credentials are gated by the same generic `update` / `read` / `delete`
permissions as any other resource — an OPERATOR can set device passwords. See
[G-6](#known-gaps).

### DEV-142 — Listings page at 20 per page, capped at 100

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28

`limit` defaults to 20 and is silently clamped to 100 — an over-large request is
reduced, not rejected. `offset` defaults to 0.

**Why:** Caps the cost of a single request so one caller cannot pull the whole
fleet in one query. Clamping rather than rejecting keeps a sloppy client working
instead of erroring. _(inferred)_

**Enforced at:** `src/application/device-inventory/use-cases/ListDevicesUseCase.ts:18-19`
**Note:** Filtered listings fetch the full matching set and paginate in memory —
a known scaling limit, see [G-7](#known-gaps).
**Tests:** `tests/integration/use-cases/device-inventory/ListDevicesUseCase.integration.test.ts`

### DEV-143 — A network scan requires a segment

**Type:** Validation · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-07-28

`segment` is required and non-blank. The response reports how many addresses
were scanned, derived from the CIDR prefix: `2^(32−prefix)`, minus network and
broadcast addresses for prefixes below /31.

**Why:** Subtracting the two reserved addresses makes `scannedCount` the number
of hosts that could actually have answered, so the responsive/scanned ratio is
meaningful. /31 and /32 are exempt because they have no reserved pair.

**Enforced at:** `src/application/device-inventory/use-cases/ScanNetworkSegmentUseCase.ts:25`, `:50`
**Message:** `segment is required`
**Tests:** `tests/integration/use-cases/device-inventory/ScanNetworkSegmentUseCase.integration.test.ts`

### DEV-144 — Setting or clearing device credentials is administrator-only

**Type:** Policy · **Status:** Active
**Layer:** Domain
**Since:** 2026-08-01

`PUT` and `DELETE /api/devices/:id/credentials` require a dedicated
`manage-credentials` permission, granted to ADMIN alone. `GET` stays on `read`
(DEV-141) because the response is masked (DEV-129).

**Why:** These endpoints write the passwords and SNMP keys that open the
equipment itself. Under DEV-141 they sat behind the same `update` permission as
renaming a device, so every OPERATOR could rewrite the credentials of any device
— an escalation from "may edit inventory records" to "may take over the
hardware" that nothing in the role name suggests (was G-6). A separate
permission means widening that access later is a deliberate one-line grant
rather than a side effect of who may edit a record.

**Enforced at:** `src/domain/identity/permissions/Permission.ts` (`manage-credentials` in `ROLE_PERMISSIONS`), applied at `src/presentation/http/routes/credentials.routes.ts:22`, `:34`
**Message:** `Forbidden` (HTTP 403)
**Tests:** `tests/domain/identity/permissions/Permission.test.ts`, `tests/presentation/http/middleware/authorize.test.ts`

### DEV-145 — Filtered listings paginate in the database

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-08-01

A filtered device listing pushes `limit` and `offset` into the query and takes
its `total` from a second count query over the same filters. The page and the
count therefore agree on what "matching" means — both build their `where` from
the same place — and `total` remains the size of the whole match, not of the
page.

**Why:** Until 2026-08-01 the filtered path loaded every matching device and
sliced the array in memory (was G-7), so the cost of `GET /api/devices?status=ACTIVE`
grew with the fleet no matter how small a page the caller asked for. DEV-142
caps what is returned; this is what makes the cap also bound the work. The
unfiltered path already paginated in SQL, so the two now behave the same way.

**Enforced at:** `src/application/device-inventory/use-cases/ListDevicesUseCase.ts:152`, backed by `PrismaDeviceRepository.countByFilters`
**Tests:** `tests/application/device-inventory/use-cases/ListDevicesUseCase.test.ts`, `tests/infrastructure/persistence/PrismaDeviceRepository.test.ts`

### DEV-146 — Request rate is budgeted per user, per resource

**Type:** Policy · **Status:** Active
**Layer:** Presentation (not in domain)
**Since:** 2026-08-01

Each route carries one of four buckets: reads 100/min, writes 60/min, deletes
60/min, bulk import 5/hour. The counter is keyed by the authenticated user id —
IP only for unauthenticated callers — and each route file holds its own counter,
so device deletes and vendor deletes do not draw on the same budget. Over the
limit is `429`, `{ success: false, error: 'Too many requests' }`.

**Why:** The limits exist to bound damage from a runaway client or a stolen
token, not to pace human work — so they have to sit above what an operator
clearing a batch of records actually does. The delete bucket was 10/min until
2026-08-01, which an operator hit by deleting eleven things in a minute.

Keying by user rather than IP is what makes the numbers mean anything: on a
shared office address a per-IP budget is divided by however many people are
working, so the effective limit changed with the staffing. It also stops one
careless client from locking out everyone sitting behind the same router.

**Consequence.** Counters live in memory, per process. With more than one
instance behind a load balancer the effective limit is the bucket times the
number of instances — see the Priority 5 item in `docs/TODOS.md`.

**Enforced at:** `src/presentation/http/middleware/rateLimiter.ts`, applied per route via `createRateLimiter(...)`
**Tests:** `tests/presentation/http/middleware/rateLimiter.test.ts`

### DEV-147 — Every device listing sorts in the database, including a sort with no other filter

**Type:** Policy · **Status:** Active
**Layer:** Application (not in domain)
**Since:** 2026-09-03

`sortBy`/`sortOrder` are honored by pushing them into the same `ORDER BY` that
`findByFilters` already builds, before `LIMIT`/`OFFSET` are applied — so a page
is ordered against the whole matching set, not just the rows that landed on
that page. This holds even when `sortBy` is the only query parameter supplied,
with no `status`/`category`/etc. filter alongside it.

**Why:** Until 2026-09-03, a request with no other filter went through
`findAll(limit, offset)`, which has no `sortBy` parameter and always returns
`createdAt desc`. `sortBy`/`sortOrder` were silently dropped in that case, so a
paginated table sorted only by whatever the client did with the 20-or-so rows
it received for that page — the client had no way to get a globally sorted
result. DEV-145 already routed every _filtered_ request through the database
for this reason; the unfiltered request is now folded into the same path
instead of being a special case with weaker guarantees.

**Enforced at:** `src/application/device-inventory/use-cases/ListDevicesUseCase.ts`, backed by `PrismaDeviceRepository.findByFilters`/`countByFilters`
**Tests:** `tests/application/device-inventory/use-cases/ListDevicesUseCase.test.ts`

---

## Device (continued)

The `DEV-040` – `DEV-089` block is fully allocated and IDs are never reused or
renumbered, so Device rules added after 2026-08-18 continue here.

### DEV-160 — A replacement device must carry a serial number or a MAC address

**Type:** Invariant · **Status:** Active
**Layer:** Application + Domain
**Since:** 2026-08-12 · **Revised:** 2026-08-18

A `Device` created as the successor of another — one whose `replacesDeviceId` is
set — must have at least one of `serialNumber`, `macAddress`. Neither is
required on its own; only the absence of both is refused. The requirement then
holds for the unit's whole life, not just at creation: an update that would
clear the last remaining identifier of a replacement is refused too.

**Why:** This is DEV-053 arriving early. Whichever retired status the caller
picks under DEV-078, the outgoing unit will need an identifier — and the
incoming box is different hardware, so it cannot borrow the one it is replacing.

**Status alone cannot express it, which is why the rule is separate.** DEV-053
keys off the retired statuses, and a replacement that takes over an IP address
under DEV-079 is born `COMMISSIONING`. That is not a retired status, so the
replacement most likely to be confused with its predecessor — same location,
same customer, same address, both rows live — is exactly the one DEV-053 does
not cover. Once the IP has moved, what is printed on the box is the only thing
left that tells the two apart.

**History — this rule was declared inside DEV-078 until 2026-08-18**, and
enforced only in `ReplaceDeviceUseCase.beforeExecute` and the route schema. It
moved into `Device.validate` on the same date. `Device.create` would previously
accept a replacement carrying neither identifier, so the invariant held only for
callers arriving through the use case. The application-layer check stayed: it
fails before `executeImpl` retires and saves the outgoing unit, which is what
keeps a rejected replacement from leaving a retired device with no successor.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts` (`Device.requiresIdentifier`, applied by `Device.validate` and so by `create` and every mutator); `src/application/device-inventory/use-cases/ReplaceDeviceUseCase.ts` (`beforeExecute`); route schema in `src/presentation/http/validation/device.schemas.ts`
**Message:** `The replacement device must have at least a serial number or MAC address`
**Tests:** `tests/domain/device-inventory/aggregates/Device.test.ts`, `tests/application/device-inventory/use-cases/ReplaceDeviceUseCase.test.ts`, `tests/integration/use-cases/device-inventory/ReplaceDeviceUseCase.integration.test.ts`

---

## Known gaps

Discrepancies found while reconciling this document against the code. Each is a
decision to make, not a bug report — recorded here so the rule book states what
is true rather than what was intended.

G-5 through G-12 were closed on 2026-08-01 and their history now lives on the
rules themselves — DEV-050 (G-5), DEV-144 (G-6), DEV-145 (G-7), DEV-007 (G-8),
DEV-066 (G-9). G-12 was an infrastructure defect with no rule of its own in this
book: every repository that branched on `errorMessage.includes('P2002')` now
calls `isUniqueViolation(error)` from
`src/infrastructure/persistence/prisma-errors.ts`, and the `P2003` and `P2025`
branches beside it — which were broken the same way, and never fired either —
now call `isForeignKeyViolation` and `isRecordNotFound`. The clean duplicate,
foreign-key and not-found messages those repositories always meant to return now
actually reach the caller. The rules affected belong to contexts whose rule books
are not yet written.

**G-13 — A wireless category on a non-wireless model is legal, deliberately.**
Nothing requires `category ∈ {WIRELESS_CPE, ACCESS_POINT}` to imply
`model.isWireless`. `CreateWirelessConfigUseCase` consults the two
independently — the device's category (DEV-062) and the model's flag
(`CreateWirelessConfigUseCase.ts:101`) — and `CreateDeviceUseCase` /
`UpdateDeviceUseCase` never read the flag at all, so a device can be
categorised `WIRELESS_CPE` on a non-wireless model at any time, and DEV-027
leaves such categories standing when the flag goes off. The combination is
inert, not corrupt: no configuration can be created, nothing polls, and no query
returns a false answer.

It is left unenforced on purpose. Making it an invariant would have to bind the
device path as well as the model path, and that creates an ordering trap with no
escape: the model must be flagged before any device can be categorised, and
every device must be re-categorised before a mis-flagged model can be corrected.
The cost of the rule lands on the operator fixing a mistake, which is the wrong
place for it. What actually needs protecting is the configuration data, and
DEV-027 protects that directly.

G-14 and G-15 came out of the layer audit on 2026-08-03; G-16 and G-17 out of
the test audit the same day. Note that DEV-050 and DEV-007 each carried an
earlier gap number — G-5 and G-8 — for unrelated defects that were closed on
2026-08-01. These are new findings against the same rules, not reopenings.

**G-14 — DEV-044 parses `ownerType` inline, in two places.**
`CreateDeviceUseCase.ts:50` and `UpdateDeviceUseCase.ts:51` each read
`Object.values(DeviceOwnerType)`, upper-case the incoming string and check
membership themselves. The vocabulary does live in the domain
(`src/domain/device-inventory/enums/DeviceOwnerType.ts`), but it is a plain
TypeScript enum with no parser attached, and every other closed set in this
context is a value object that owns its own parsing — `DeviceType` (DEV-024),
`DeviceCategory` (DEV-043), `DeviceStatus` (DEV-042), `LocationType` (DEV-091).
Those four cannot be bypassed, because the aggregate holds the value object
rather than the raw value. `ownerType` can: `DeviceProps.ownerType` is typed
`DeviceOwnerType | null`, and a caller that bypasses the two use cases has
nothing standing between a bad string and the aggregate.

The fix is a `DeviceOwnerType` value object shaped like the other four, which
would also delete the duplicated check. It is filed rather than done because the
duplication is currently harmless — the HTTP schemas fast-fail first, and both
use cases do agree with each other today. The cost is paid by the third writer
of devices, who has to know the check exists.

**G-15 — DEV-050 validates `installedDate` outside the domain, unlike every
other validated field.** `parseIso8601Date` lives in
`src/application/shared/utils/` while its sibling DEV-051 — the future-date
check on the same field — sits in `Device.validateInstalledDate`. So one field's
validation is split across two layers.

There is a real argument for leaving it: `DeviceProps.installedDate` is a
`Date | null`, so by the time a value reaches the aggregate the string is
already gone, and parsing a wire format is a boundary concern. The
counter-argument is that this codebase does not otherwise draw the line there —
`DeviceType.create(type: string)` takes a raw string and parses it inside the
domain. Under that convention `installedDate` is simply the one validated field
that never got a value object. Either answer is defensible; what is not
defensible is the current split, where reading `Device` tells you only half of
what the field accepts.

**G-16 — DEV-007 has no integration test, though it is a uniqueness rule.**
Vendor name uniqueness is covered only by
`tests/application/device-inventory/use-cases/CreateVendorUseCase.test.ts` and
`UpdateVendorUseCase.test.ts`, both of which mock the repository. The constraint
the rule actually depends on is `Vendor.name @unique` in the database, and a
mocked repository cannot exercise it — the tests verify the pre-check, not the
guarantee. `docs/rules/TESTING-INTEGRATION-STANDARD.md` puts uniqueness
explicitly in the category that gets a thorough integration suite, and DEV-003
(slug uniqueness) has three. DEV-007 was added on 2026-08-01, later than its
sibling, which is the likely reason it was missed.

**G-17 — DEV-129 has no test of any kind.** The `sanitizeForLogging` override at
`SetDeviceCredentialsUseCase.ts:168` is what keeps device passwords and SNMP
keys out of the Winston logs, and nothing anywhere asserts that it does. It is
the only rule in this book with `**Tests:** _none_`.

The failure mode is why this one is worth more than its size suggests: if the
override is dropped in a refactor, no test fails, no request errors, and no
operator sees anything different. The evidence lands in log files — which
DEV-129's own rationale notes are retained and less protected than the
database — and it is found by reading them, if ever.
