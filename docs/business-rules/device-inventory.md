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

Rationales marked _(inferred)_ were reconstructed from the code, not stated by
the business. They are the ones to read critically.

---

## Vendor

### DEV-001 — A vendor has a non-empty name of at most 100 characters

**Type:** Validation · **Status:** Active

The name is trimmed before storage. Whitespace-only names are rejected.

**Why:** The vendor name is the human-facing label in equipment pickers. Empty
names make a dropdown unusable; the 100-character cap matches the database
column and keeps the picker from wrapping.

**Enforced at:** `src/domain/device-inventory/aggregates/Vendor.ts:107` (`Vendor.validateName`)
**Reached from:** `create`, `updateName`
**Message:** `Vendor name cannot be empty` / `Vendor name cannot exceed 100 characters`

### DEV-002 — A vendor slug is lowercase letters, digits and hyphens only

**Type:** Validation · **Status:** Active

Required, non-empty, at most 100 characters, matching
`^[a-z0-9]+(?:-[a-z0-9]+)*$` — e.g. `tp-link`, `ubiquiti`, `mikrotik`. No
leading, trailing or doubled hyphens.

**Why:** The slug is the stable machine identifier for a vendor: it appears in
URLs and is denormalized onto every device model. Restricting it to a URL-safe
alphabet means it never needs escaping, and forbidding uppercase prevents
`Ubiquiti` and `ubiquiti` from being treated as two vendors.

**Enforced at:** `src/domain/device-inventory/aggregates/Vendor.ts:125` (`Vendor.validateSlug`)
**Reached from:** `create`, `updateSlug`
**Message:** `Vendor slug must contain only lowercase letters, digits, and hyphens (e.g. "tp-link")`

### DEV-003 — Vendor slugs are unique

**Type:** Invariant · **Status:** Active

No two vendors may share a slug. On update, a vendor may keep its own slug —
only a collision with a _different_ vendor is rejected.

**Why:** The slug identifies a vendor across the system. Two vendors sharing one
would make the identifier ambiguous everywhere it is denormalized.

**Enforced at:** `src/application/device-inventory/use-cases/CreateVendorUseCase.ts:44`, `UpdateVendorUseCase.ts:62`
**Backed by:** `Vendor.slug @unique` in `prisma/schema.prisma:48`
**Message:** `A vendor with slug "<slug>" already exists`

### DEV-004 — A vendor description is at most 500 characters

**Type:** Validation · **Status:** Active

Optional; defaults to `null`.

**Why:** A free-text note for operators. Capped so it stays a note rather than a
document.

**Enforced at:** `src/domain/device-inventory/aggregates/Vendor.ts:142` (`Vendor.validateDescription`)
**Reached from:** `create`, `updateDescription`
**Message:** `Vendor description cannot exceed 500 characters`

### DEV-005 — A vendor with device models cannot be deleted

**Type:** Policy · **Status:** Active

Deletion is refused while any device model references the vendor. The message
reports how many.

**Why:** Deleting a vendor would orphan its models, and through them every
device built on those models. Refusing forces the operator to decide
deliberately what happens to the equipment rather than losing its provenance
silently.

**Enforced at:** `src/application/device-inventory/use-cases/DeleteVendorUseCase.ts:57`
**Message:** `Cannot delete vendor: it has N device model(s) associated. Remove all device models first.`

### DEV-006 — A vendor requires both a name and a slug

**Type:** Validation · **Status:** Active

Both are mandatory at creation. `null`, `undefined`, a non-string and a blank
string are all rejected; neither has a default to fall back on. Update accepts a
new value for either but offers no way to clear one — a vendor cannot lose a
name or a slug once created. DEV-001 and DEV-002 then govern the shape of each.

**Why:** The pair is the whole of a vendor's identity, and the two halves are
not interchangeable. The name is what a human reads in an equipment picker; the
slug is what the system stores and links by, denormalized onto every device
model (DEV-028). A vendor missing the name is unusable to operators, one missing
the slug is unaddressable to the code — so neither can be optional.

**Enforced at:** `src/domain/device-inventory/aggregates/Vendor.ts:104` (`validateName` guard), `:124` (`validateSlug` guard); use case pre-check at `CreateVendorUseCase.ts:23-28`; HTTP fast-fail in `src/presentation/http/validation/vendor.schemas.ts:10-24`
**Reached from:** `create`, `updateName`, `updateSlug`
**Message:** `Vendor name is required` / `Vendor slug is required` (use case); `name is null or undefined` / `slug is null or undefined` (aggregate guards)
**Tests:** `tests/domain/device-inventory/aggregates/Vendor.test.ts`, `tests/application/device-inventory/use-cases/CreateVendorUseCase.test.ts`

---

## Device Model

### DEV-020 — A device model requires a vendor, a model name and a device type

**Type:** Validation · **Status:** Active

All three are mandatory at creation.

**Why:** A model is meaningless without its maker — "AirGrid M5" is only
identifiable as _Ubiquiti's_ AirGrid M5. The device type drives which collector
and which alert rules apply to units of this model. _(inferred)_

**Enforced at:** `src/domain/device-inventory/aggregates/DeviceModel.ts:144` (`DeviceModel.validate`), use case pre-checks at `CreateDeviceModelUseCase.ts:32-41`
**Message:** `Vendor ID is required` / `Model name is required` / `Device type is required`

### DEV-021 — The vendor of a device model must exist

**Type:** Invariant · **Status:** Active

Checked on create and on any update that changes the vendor.

**Why:** Prevents dangling references, and the lookup also supplies the vendor
name and slug copied onto the model (DEV-028).

**Enforced at:** `src/application/device-inventory/use-cases/CreateDeviceModelUseCase.ts:63`, `UpdateDeviceModelUseCase.ts:77`
**Message:** `Vendor not found: <id>`

### DEV-022 — A vendor cannot have two device models with the same name

**Type:** Invariant · **Status:** Active

Uniqueness is per vendor, on the trimmed model name. Two different vendors may
both have a model called "AC Lite".

**Why:** Within one manufacturer the model name is the identifier operators use
to pick equipment. Duplicates would make the choice ambiguous. Scoping to the
vendor rather than globally is deliberate — model names collide across
manufacturers all the time.

**Enforced at:** `src/application/device-inventory/use-cases/CreateDeviceModelUseCase.ts:78`
**Backed by:** `@@unique([vendorId, model])` in `prisma/schema.prisma:88`
**Message:** `A device model "<model>" already exists for this vendor`

### DEV-023 — A model name is non-empty and at most 150 characters

**Type:** Validation · **Status:** Active

Trimmed before storage.

**Why:** Matches the database column and keeps model names readable in pickers.
_(inferred)_

**Enforced at:** `src/domain/device-inventory/aggregates/DeviceModel.ts:81` (`validate`), `:161` (`updateModel`)
**Reached from:** `create`, `updateModel`
**Message:** `Model name cannot be empty` / `Model name cannot exceed 150 characters`

### DEV-024 — A device type is a free-form string

**Type:** Validation · **Status:** Active

Not an enum. Required and non-empty **at creation only**.

**Why:** Device types vary by manufacturer and new categories appear faster than
the code changes; an enum would need a deploy for every new kind of hardware.
Note this is a deliberately weaker rule than `DeviceCategory` (DEV-043), which
_is_ a closed set because behaviour branches on it. _(inferred)_

**Enforced at:** `src/application/device-inventory/use-cases/CreateDeviceModelUseCase.ts:41`
**Message:** `Device type is required`
**Gap:** `updateDeviceType` does not re-check non-emptiness — see [G-2](#known-gaps).

### DEV-025 — A device model is non-wireless unless stated

**Type:** Policy · **Status:** Active

`isWireless` defaults to `false` when omitted.

**Why:** Wireless is the exception in the catalogue and the flag switches on
extra collection machinery. Defaulting to off means a carelessly created model
does not silently start wireless polling. _(inferred)_

**Enforced at:** `src/domain/device-inventory/aggregates/DeviceModel.ts:56`

### DEV-026 — A device model with devices cannot be deleted

**Type:** Policy · **Status:** Active

**Why:** Same reasoning as DEV-005 — deleting the model would strip every unit
built on it of its identity. Reassignment must be an explicit decision.

**Enforced at:** `src/application/device-inventory/use-cases/DeleteDeviceModelUseCase.ts:58`
**Message:** `Cannot delete device model: it has N device(s) associated. Reassign or remove those devices first.`

### DEV-027 — Turning off `isWireless` removes the wireless config of every device on that model

**Type:** Policy · **Status:** Active

When an update changes `isWireless` from `true` to `false`, wireless device
configurations for all devices of that model are deleted.

**Why:** The flag is the statement of what the hardware can do. Once a model is
declared non-wireless, wireless polling of those units is collecting from an
interface that was never there — the configs are dead weight that would keep
scheduling failing polls.

**Enforced at:** `src/application/device-inventory/use-cases/UpdateDeviceModelUseCase.ts:119`
**Note:** Deletion is fire-and-forget — failures are not surfaced to the caller.
See [G-4](#known-gaps).

### DEV-028 — A device model carries a copy of its vendor's name and slug

**Type:** Policy · **Status:** Active

`vendorName` and `vendorSlug` are stored on the model and refreshed whenever the
model's vendor changes.

**Why:** Device listings show the vendor on every row; denormalizing avoids a
join on the hottest read path in the catalogue. The cost is that renaming a
vendor does **not** propagate to existing models — see [G-3](#known-gaps).
_(inferred)_

**Enforced at:** `src/domain/device-inventory/aggregates/DeviceModel.ts:122` (`updateVendor`)

---

## Device

### DEV-040 — A device requires a device model and a name

**Type:** Invariant · **Status:** Active

Everything else — location, category, owner, serial, MAC, IP, dates — is
optional at creation, subject to the status rules below.

**Why:** These two are the minimum that makes a row meaningful: what the thing
is, and what we call it. Keeping the rest optional is what lets equipment be
registered on arrival, before it has been configured or installed.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:91` (`Guard.combine` in `create`)
**Message:** `deviceModelId is required` / `Device name is required`

### DEV-041 — A device name is non-empty and at most 150 characters

**Type:** Validation · **Status:** Active

Trimmed before storage.

**Enforced at:** `src/domain/device-inventory/value-objects/DeviceName.ts:28`
**Message:** `Device name cannot be empty` / `Device name cannot exceed 150 characters`

### DEV-042 — A device status is one of ACTIVE, COMMISSIONING, DAMAGED, INVENTORY

**Type:** Validation · **Status:** Active

Input is trimmed and upper-cased. **INVENTORY is the default** when no status is
given.

**Why:** These four are the lifecycle of a unit as the business tracks it:
sitting in the warehouse, being installed, in service, or broken. INVENTORY is
the default because that is where equipment enters the business — it is bought
before it is deployed.

**Enforced at:** `src/domain/device-inventory/value-objects/DeviceStatus.ts:43`
**Default applied at:** `src/application/device-inventory/use-cases/CreateDeviceUseCase.ts:104`
**Message:** `Invalid device status: <value>. Must be one of: ACTIVE, COMMISSIONING, DAMAGED, INVENTORY`

### DEV-043 — A device category, when set, is one of seven values

**Type:** Validation · **Status:** Active

Optional (nullable). When present it must be one of `CPE`, `WIRELESS_CPE`, `AP`,
`ROUTERBOARD`, `SMART_SWITCH`, `SMART_SWITCH_POE`, `OTHER`. Trimmed and
upper-cased.

**Why:** Unlike device _type_ (DEV-024), behaviour branches on category: only
`WIRELESS_CPE` and `AP` may hold a wireless configuration (DEV-062). A closed
set is what makes that decision safe. `OTHER` is the escape hatch that keeps the
set from needing to grow for every oddity.

**Enforced at:** `src/domain/device-inventory/value-objects/DeviceCategory.ts:50`
**Message:** `Invalid device category: <value>. Must be one of: CPE, WIRELESS_CPE, AP, ROUTERBOARD, SMART_SWITCH, SMART_SWITCH_POE, OTHER`

### DEV-044 — A device owner, when set, is COMPANY or CLIENT

**Type:** Validation · **Status:** Active

Optional. Case-insensitive on input.

**Why:** Determines who owns the hardware, which decides who replaces it when it
fails and whether it goes back to the warehouse when a client leaves.
_(inferred)_

**Enforced at:** `src/application/device-inventory/use-cases/CreateDeviceUseCase.ts:50`, `UpdateDeviceUseCase.ts:44`
**Message:** `Invalid ownerType: "<value>". Must be one of: COMPANY, CLIENT`

### DEV-045 — A serial number is non-empty and at most 100 characters

**Type:** Validation · **Status:** Active

Optional; trimmed before storage.

**Enforced at:** `src/domain/device-inventory/value-objects/SerialNumber.ts:28`
**Message:** `Serial number cannot be empty` / `Serial number cannot exceed 100 characters`

### DEV-046 — A MAC address is in colon or hyphen hex format

**Type:** Validation · **Status:** Active

Accepts `AA:BB:CC:DD:EE:FF` or `AA-BB-CC-DD-EE-FF`. **Normalized to
upper-case with colons** before storage, so the two input forms cannot produce
two distinct stored values.

**Why:** MAC is how a device is recognised on the wire — by the ARP table and by
network scans. Normalizing at the boundary is what makes DEV-047 meaningful; two
spellings of one address would defeat the uniqueness check.

**Enforced at:** `src/domain/shared/value-objects/MACAddress.ts:45`
**Message:** `Invalid MAC address format: <value>. Must be in format AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF.`

### DEV-047 — A MAC address belongs to at most one device

**Type:** Invariant · **Status:** Active

Checked on create, and on update only when the value actually changes — so
re-submitting a device's own MAC is not a collision.

**Why:** A MAC is globally unique in hardware. Two records claiming one means an
inventory error — most often the same physical unit registered twice — and would
make network scan results ambiguous about which record they matched.

**Enforced at:** `src/application/device-inventory/use-cases/CreateDeviceUseCase.ts:144`, `UpdateDeviceUseCase.ts:167`
**Message:** `MAC address "<value>" is already assigned to another device`
**Gap:** No database constraint backs this — see [G-1](#known-gaps).

### DEV-048 — An IP address is a valid IPv4 or IPv6 address

**Type:** Validation · **Status:** Active

Optional. IPv6 is lower-cased on storage; IPv4 is stored as written.

**Why:** The IP is the polling target. An unparseable address would fail at ping
time, long after the operator who typed it has moved on.

**Enforced at:** `src/domain/shared/value-objects/IPAddress.ts:53`
**Message:** `Invalid IP address format: <value>. Must be a valid IPv4 or IPv6 address.`

### DEV-049 — An IP address belongs to at most one device

**Type:** Invariant · **Status:** Active

Same change-detection as DEV-047: a device may keep its own IP on update.

**Why:** Two devices on one IP is either a configuration error on the network or
a duplicate record. Either way the monitor cannot tell which unit answered a
ping, so the data would be silently wrong rather than absent.

**Enforced at:** `src/application/device-inventory/use-cases/CreateDeviceUseCase.ts:166`, `UpdateDeviceUseCase.ts:197`
**Message:** `IP address "<value>" is already assigned to another device`
**Gap:** No database constraint backs this — see [G-1](#known-gaps).

### DEV-050 — An installation date must be a parseable date

**Type:** Validation · **Status:** Active

Optional. Rejected if `new Date(value)` yields `Invalid Date`.

**Enforced at:** `src/application/device-inventory/use-cases/CreateDeviceUseCase.ts:176`, `UpdateDeviceUseCase.ts:113`
**Message:** `Invalid installedDate: "<value>". Must be a valid ISO 8601 date string.`
**Note:** The message promises ISO 8601 but the check is looser than that — see
[G-5](#known-gaps).

### DEV-051 — An installation date cannot be in the future

**Type:** Invariant · **Status:** Active

Compared against the moment of validation.

**Why:** The field records when a unit _was_ installed — an observation, not a
plan. A future date is a typo, and it would distort age-based reporting on the
fleet.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:514` (`Device.validateInstalledDate`)
**Reached from:** `create`, `changeStatus`, `assignLocation`, `enableMonitoring`, `updateDetails`
**Message:** `installedDate cannot be in the future`

### DEV-052 — A device description is at most 500 characters

**Type:** Validation · **Status:** Active

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:494` (`Device.validateDescription`)
**Message:** `Device description cannot exceed 500 characters`

### DEV-053 — An INVENTORY or DAMAGED device must have a serial number or a MAC address

**Type:** Invariant · **Status:** Active

At least one of the two. Either satisfies the rule.

**Why:** These are the two states where the unit is _not_ on the network — it is
a physical object on a shelf. Without a serial or a MAC there is no way to match
the record to the box in your hand, so the row is untraceable stock. An ACTIVE
device is exempt because its IP already identifies it.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:437` (`Device.validate`)
**Reached from:** `create`, `changeStatus`, `assignLocation`, `enableMonitoring`, `updateDetails`
**Message:** `A device with status <status> must have at least a serial number or MAC address`

### DEV-054 — An ACTIVE device must have an IP address

**Type:** Invariant · **Status:** Active

**Why:** ACTIVE means in service and monitored. Monitoring is ping-based, so a
device with no IP cannot be polled — it would sit in the dashboard permanently
green and never actually be checked. _(inferred)_

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:447`
**Reached from:** `create`, `changeStatus`, `assignLocation`, `enableMonitoring`, `updateDetails`
**Message:** `An ACTIVE device must have an IP address assigned`

### DEV-055 — An ACTIVE device must have a location

**Type:** Invariant · **Status:** Active

Also blocks _removing_ the location from a device that is already ACTIVE.

**Why:** ACTIVE means installed and serving a customer. A technician dispatched
to a fault needs somewhere to drive. A device with no location cannot be found
in the field. _(inferred)_

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:453`
**Reached from:** `create`, `changeStatus`, `assignLocation`, `enableMonitoring`, `updateDetails`
**Message:** `An ACTIVE device must have a location assigned`

### DEV-056 — A COMMISSIONING device must have an IP address

**Type:** Invariant · **Status:** Active

**Why:** Commissioning is the stage where the unit is being brought up and
watched to see whether it stays up. That requires reaching it. Note this is
weaker than ACTIVE: no location is required yet, because a unit can be
configured on the bench before it is installed. _(inferred)_

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:459`
**Message:** `A COMMISSIONING device must have an IP address assigned`

### DEV-057 — Monitoring can only be enabled for ACTIVE or COMMISSIONING devices

**Type:** Invariant · **Status:** Active

**Why:** Those are the two states where the device is expected to answer. Polling
a warehouse unit or a broken one would generate a permanent stream of
false-alarm outage alerts and train operators to ignore the dashboard.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:465`
**Reached from:** `create`, `changeStatus`, `assignLocation`, `enableMonitoring`, `updateDetails`
**Message:** `Monitoring can only be enabled for ACTIVE or COMMISSIONING devices`

### DEV-058 — A new COMMISSIONING device gets monitoring on by default

**Type:** Policy · **Status:** Active

Default applies only when the caller expresses no preference. An **explicit
`false` is respected**.

**Why:** The point of commissioning is to watch the unit stabilise, so watching
it is the sensible default rather than a step to remember. It stays a default
and not a rule because there are legitimate reasons to stage a device without
polling it yet.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:106`

### DEV-059 — Moving a device into COMMISSIONING turns monitoring on

**Type:** Policy · **Status:** Active

A status change into COMMISSIONING enables monitoring if it was off. Unlike
DEV-058, this is not conditional on caller intent.

**Why:** Same reasoning as DEV-058, applied to units that reach commissioning by
transition rather than at creation.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:211` (`changeStatus`)

### DEV-060 — Status-dependent rules are validated against prospective state, not current state

**Type:** Invariant · **Status:** Active

`Device.validate()` is the single source of truth for DEV-051 through DEV-057.
It is static and takes the _candidate_ state as an argument, so it can run
before a mutation commits. Every mutator that can change status, identifiers,
IP, location or monitoring routes through it: `create`, `changeStatus`,
`assignLocation`, `enableMonitoring`, `updateDetails`.

**Why:** Rules that span several fields cannot be checked field-by-field. A
request that sets an IP _and_ flips the status to ACTIVE is legal as a whole but
illegal in either order if each field is validated alone. Validating the
prospective whole state is what makes such a request work.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:427`

**Consequence — update ordering.** `UpdateDeviceUseCase` applies changes in a
fixed order, and the order is load-bearing:

1. `updateDetails` — so an IP arriving in the same request is on the aggregate
   before the status transition is judged
2. `disableMonitoring` — so turning monitoring off while moving to a
   non-monitorable status is not rejected by DEV-057
3. `changeStatus`
4. `assignLocation`
5. `enableMonitoring`

**Enforced at:** `src/application/device-inventory/use-cases/UpdateDeviceUseCase.ts:206-262`

### DEV-061 — Devices loaded from the database bypass validation

**Type:** Policy · **Status:** Active

`Device.reconstitute()` applies no rules.

**Why:** Rules change over time; rows written under older rules must still load,
or a rule tightening would make existing equipment unreadable rather than merely
uneditable. The trade-off is that a row violating a current invariant loads
silently — invalid state is caught on the next _write_, not on read.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:161`

### DEV-062 — Only WIRELESS_CPE and AP devices may hold a wireless configuration

**Type:** Invariant · **Status:** Active

Exposed as `device.canHaveWirelessConfig()`.

**Why:** Wireless collection reads radio metrics — signal, SNR, CCQ. On hardware
with no radio there is nothing to read, so a config would schedule polls that
can only fail.

**Enforced at:** `src/domain/device-inventory/aggregates/Device.ts:293`

---

## Location

### DEV-090 — A location has a non-empty name of at most 150 characters

**Type:** Validation · **Status:** Active

**Why:** The name is what operators search by and what appears on the map pin.
_(inferred)_

**Enforced at:** `src/domain/device-inventory/aggregates/Location.ts:183` (`Location.validateName`)
**Reached from:** `create`, `updateName`
**Message:** `Location name cannot be empty` / `Location name cannot exceed 150 characters`

### DEV-091 — A location type is one of six values

**Type:** Validation · **Status:** Active

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
**Tests:** `tests/domain/device-inventory/value-objects/LocationType.test.ts`

A stored value is held to a stricter standard than an incoming one:
`LocationMapper.toDomain` checks `LocationType.isValid` on the raw column with no
trimming or case-folding, and throws
`Data integrity violation: unrecognised LocationType "<value>" in persistence store`
on a miss. A row that only matches after normalisation means the database and the
domain have drifted, which is a defect to surface rather than paper over.
(`src/infrastructure/mappers/LocationMapper.ts:117`)

### DEV-092 — Latitude and longitude must be supplied together

**Type:** Validation · **Status:** Active

Coordinates are optional, but half a coordinate is rejected. On update, passing
both as `null` explicitly clears them.

**Why:** A latitude without a longitude does not locate anything — it is a
partially-filled form, and storing it would put a pin at an arbitrary spot on a
meridian.

**Enforced at:** `src/application/device-inventory/use-cases/CreateLocationUseCase.ts:44`, `UpdateLocationUseCase.ts:39`; structurally enforced by `CoordinatesProps`
**Message:** `Both latitude and longitude must be provided together`

### DEV-093 — Coordinates are finite numbers in WGS-84 range

**Type:** Validation · **Status:** Active

Latitude −90 to 90, longitude −180 to 180. Altitude is optional and unbounded
but must be a finite number when present. `NaN` and `Infinity` are rejected for
all three.

**Why:** These are the limits of the coordinate system; anything outside is not
a point on Earth. The explicit finite check exists because `NaN` passes a naive
`typeof x === 'number'` test and would render as a broken map pin.

**Enforced at:** `src/domain/device-inventory/value-objects/Coordinates.ts:43-88`
**Message:** `latitude must be a finite number` / `longitude must be a finite number` / `altitude must be a finite number`, plus range messages from `Guard.inRange`

### DEV-094 — An address is all three parts or none

**Type:** Invariant · **Status:** Active

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
**Tests:** `tests/domain/device-inventory/value-objects/Address.test.ts`

### DEV-095 — Address parts are non-empty and length-capped

**Type:** Validation · **Status:** Active

Street ≤ 255, municipality ≤ 100, neighborhood ≤ 150. All trimmed.

**Enforced at:** `src/domain/device-inventory/value-objects/Address.ts:36-56` (`Address.create`, reached from `createOptional` — DEV-094)
**Message:** `Street address cannot exceed 255 characters` (and the parallel messages for the other two)

### DEV-096 — A CUSTOMER_PREMISES location must be navigable

**Type:** Invariant · **Status:** Active

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

### DEV-097 — A location with devices assigned cannot be deleted

**Type:** Policy · **Status:** Active

**Why:** Deleting it would strip those devices of the answer to "where is it" —
and for ACTIVE devices that is a state DEV-055 forbids. The devices must be
moved first, deliberately.

**Enforced at:** `src/application/device-inventory/use-cases/DeleteLocationUseCase.ts:57`
**Message:** `Cannot delete location: it has N device(s) assigned. Reassign or remove those devices first.`

### DEV-098 — The map shows only locations with coordinates

**Type:** Policy · **Status:** Active

`GetMapLocationsUseCase` returns pins for locations that have coordinates.
Address-only locations are omitted. Each pin carries its devices with their
current status.

**Why:** A pin needs a latitude and longitude; an address alone cannot be plotted
without geocoding, which the system does not do. _(inferred)_

**Enforced at:** `src/application/device-inventory/use-cases/GetMapLocationsUseCase.ts:30`

---

## Device Credentials

Credentials never enter the domain layer — they are infrastructure access
secrets, not part of the device's identity. Every rule below lives in the
application layer.

### DEV-120 — HTTP username and password are required, together

**Type:** Validation · **Status:** Active

Both must be present and non-blank on every save. There is no way to store one
without the other.

**Why:** HTTP is the collection path actually in use today — the wireless
collector authenticates against the device's web interface. Credentials without
both halves cannot log in, so storing them would only produce collection
failures later. See also DEV-122: SNMP is the optional pair.

**Enforced at:** `src/application/device-inventory/use-cases/SetDeviceCredentialsUseCase.ts:36`
**Message:** `httpUsername and httpPassword are required`

### DEV-121 — Credentials can only be set for a device that exists

**Type:** Invariant · **Status:** Active

**Enforced at:** `src/application/device-inventory/use-cases/SetDeviceCredentialsUseCase.ts:134`
**Message:** `Device not found`

### DEV-122 — SNMP is optional, but partial SNMP input is rejected

**Type:** Validation · **Status:** Active

If **any** SNMP field is present, `snmpVersion` becomes mandatory and the
version-specific rules (DEV-123 to DEV-126) apply. If none is present, SNMP is
skipped entirely.

**Why:** No client collects SNMP today — nothing polls it. The rules are kept
intact so the capability survives untouched until SNMP metrics land, but they
must not force every HTTP-only save to supply SNMP fields it does not have.

**Enforced at:** `src/application/device-inventory/use-cases/SetDeviceCredentialsUseCase.ts:48-56`
**Message:** `snmpVersion is required when SNMP credentials are provided`

### DEV-123 — SNMP version is 1, 2 or 3

**Type:** Validation · **Status:** Active

**Enforced at:** `src/application/device-inventory/use-cases/SetDeviceCredentialsUseCase.ts:66`
**Message:** `snmpVersion must be 1, 2, or 3`

### DEV-124 — SNMPv1 and v2 require a community string

**Type:** Validation · **Status:** Active

**Why:** The community string is the entire authentication mechanism in these
versions. Without it there is no credential at all.

**Enforced at:** `src/application/device-inventory/use-cases/SetDeviceCredentialsUseCase.ts:73`
**Message:** `snmpCommunity is required for SNMPv1 and SNMPv2`

### DEV-125 — SNMPv3 requires an auth user, protocol and key

**Type:** Validation · **Status:** Active

All three of `snmpV3AuthUser`, `snmpV3AuthProto`, `snmpV3AuthKey`.

**Why:** v3 replaces the community string with user-based authentication; the
three fields are one credential and any subset cannot authenticate.

**Enforced at:** `src/application/device-inventory/use-cases/SetDeviceCredentialsUseCase.ts:79-89`
**Message:** `snmpV3AuthUser is required for SNMPv3` / `snmpV3AuthProto is required for SNMPv3` / `snmpV3AuthKey is required for SNMPv3`

### DEV-126 — An SNMPv3 privacy protocol requires a privacy key

**Type:** Validation · **Status:** Active

Privacy (encryption) is optional in v3; requesting it without a key is not.

**Why:** The protocol names the cipher, the key feeds it. Naming a cipher with
no key would fail at connection time.

**Enforced at:** `src/application/device-inventory/use-cases/SetDeviceCredentialsUseCase.ts:94`
**Message:** `snmpV3PrivKey is required when snmpV3PrivProto is set`

### DEV-127 — Ports are between 1 and 65535, defaulting to 161 and 443

**Type:** Validation · **Status:** Active

SNMP defaults to 161, HTTP to 443.

**Why:** The range is the TCP/UDP port space. The defaults are the standard SNMP
port and HTTPS, which is what the devices in the fleet listen on. _(inferred)_

**Enforced at:** `src/application/device-inventory/use-cases/SetDeviceCredentialsUseCase.ts:105`, `:112`; defaults in `DeviceCredentialsMapper.ts:69`, `:72`
**Message:** `snmpPort must be between 1 and 65535` / `httpPort must be between 1 and 65535`

### DEV-128 — Stored secrets are never returned; they are masked as `***`

**Type:** Policy · **Status:** Active

`snmpCommunity`, `snmpV3AuthKey`, `snmpV3PrivKey` and `httpPassword` come back
as `***` when set and `null` when absent. Two booleans — `hasSnmpCredentials`,
`hasHttpCredentials` — report whether a usable credential exists.
`hasSnmpCredentials` is version-aware: community for v1/v2, user plus auth key
for v3.

**Why:** Masking rather than omitting lets the UI distinguish "a password is
set" from "no password configured" — which changes what the form should show —
without ever putting the secret on the wire.

**Enforced at:** `src/application/device-inventory/mappers/DeviceCredentialsMapper.ts:8`

### DEV-129 — Secrets are redacted from logs

**Type:** Policy · **Status:** Active

`SetDeviceCredentialsUseCase` overrides `sanitizeForLogging` to replace the four
secret fields with `***` before the request is logged.

**Why:** Use case logging records request payloads. Without this override, every
credential save would write plaintext passwords into the log files, which are
retained and less protected than the database.

**Enforced at:** `src/application/device-inventory/use-cases/SetDeviceCredentialsUseCase.ts:168`

### DEV-130 — A save replaces HTTP fields but preserves omitted SNMP fields

**Type:** Policy · **Status:** Active

HTTP username and password are taken from the request outright. SNMP fields are
carried forward from the stored row when the request omits them. Passing an
explicit `null` still clears a field — omission and `null` mean different
things.

**Why:** No client sends SNMP fields today, so a routine HTTP credential update
would otherwise wipe SNMP keys that are tedious to re-enter and that nobody
intended to touch. Honouring explicit `null` keeps deliberate clearing possible.

**Enforced at:** `src/application/device-inventory/mappers/DeviceCredentialsMapper.ts:42` (`extractCreateData`)

### DEV-131 — Reading credentials for a device with none configured is a failure

**Type:** Policy · **Status:** Active

Not an empty success.

**Enforced at:** `src/application/device-inventory/use-cases/GetDeviceCredentialsUseCase.ts:50`
**Message:** `No credentials configured for this device`

### DEV-132 — Deleting credentials succeeds whether or not any exist

**Type:** Policy · **Status:** Active

Idempotent, and does not check that the device exists.

**Why:** The caller's intent is "this device should have no credentials", which
is already true when there are none. _(inferred)_

**Enforced at:** `src/application/device-inventory/use-cases/DeleteDeviceCredentialsUseCase.ts:39`

---

## Cross-cutting

### DEV-140 — Every device inventory endpoint requires authentication

**Type:** Policy · **Status:** Active

All `/api` routes sit behind `createAuthenticateMiddleware`. No Bearer token
means `401`.

**Enforced at:** `src/presentation/http/routes/index.ts:51`

### DEV-141 — Write access to the catalogue is role-gated

**Type:** Policy · **Status:** Active

| Operation   | Permission | ADMIN | OPERATOR | VIEWER |
| ----------- | ---------- | :---: | :------: | :----: |
| List / read | `read`     |  ✅   |    ✅    |   ✅   |
| Create      | `create`   |  ✅   |    ✅    |   ❌   |
| Update      | `update`   |  ✅   |    ✅    |   ❌   |
| Delete      | `delete`   |  ✅   |    ❌    |   ❌   |

Applies uniformly to devices, device models, locations, vendors, credentials and
network scanning.

**Why:** Deletion is the only irreversible operation in the catalogue and the
one that can strip records from equipment in the field, so it is held to
administrators. Operators need create and update to do daily inventory work.

**Enforced at:** `src/domain/identity/permissions/Permission.ts:11` (`ROLE_PERMISSIONS`), applied per route via `authorize(...)`

**Note:** Credentials are gated by the same generic `update` / `read` / `delete`
permissions as any other resource — an OPERATOR can set device passwords. See
[G-6](#known-gaps).

### DEV-142 — Listings page at 20 per page, capped at 100

**Type:** Policy · **Status:** Active

`limit` defaults to 20 and is silently clamped to 100 — an over-large request is
reduced, not rejected. `offset` defaults to 0.

**Why:** Caps the cost of a single request so one caller cannot pull the whole
fleet in one query. Clamping rather than rejecting keeps a sloppy client working
instead of erroring. _(inferred)_

**Enforced at:** `src/application/device-inventory/use-cases/ListDevicesUseCase.ts:18-19`
**Note:** Filtered listings fetch the full matching set and paginate in memory —
a known scaling limit, see [G-7](#known-gaps).

### DEV-143 — A network scan requires a segment

**Type:** Validation · **Status:** Active

`segment` is required and non-blank. The response reports how many addresses
were scanned, derived from the CIDR prefix: `2^(32−prefix)`, minus network and
broadcast addresses for prefixes below /31.

**Why:** Subtracting the two reserved addresses makes `scannedCount` the number
of hosts that could actually have answered, so the responsive/scanned ratio is
meaningful. /31 and /32 are exempt because they have no reserved pair.

**Enforced at:** `src/application/device-inventory/use-cases/ScanNetworkSegmentUseCase.ts:25`, `:50`
**Message:** `segment is required`

---

## Known gaps

Discrepancies found while reconciling this document against the code. Each is a
decision to make, not a bug report — recorded here so the rule book states what
is true rather than what was intended.

**G-1 — MAC and IP uniqueness are not enforced by the database.**
DEV-047 and DEV-049 are check-then-write in the use case. Two concurrent
requests can both pass the check and both insert; `prisma/schema.prisma:200` has
an index on `ipAddress` but no unique constraint, and `macAddress` has neither.
For a single-operator ISP tool this may never fire. The fix is a unique index on
each, which would also convert the race into a clean database error.

**G-2 — `deviceType` is only validated at creation.**
DEV-024 is checked in `CreateDeviceModelUseCase` but
`DeviceModel.updateDeviceType` (`DeviceModel.ts:97`) guards only against
`null`/`undefined` — an empty string or a non-string passes. Unlike model name,
there is no shared validator between the create and update paths.

**G-3 — Renaming a vendor does not update its device models.**
DEV-028 copies `vendorName` and `vendorSlug` onto each model, refreshed only
when the _model's_ vendor changes. `Vendor.updateName` and `updateSlug` do not
propagate, so after a rename existing models keep showing the old value.

**G-4 — Wireless config cleanup is fire-and-forget.**
DEV-027's deletions run through `Promise.all` with no result check
(`UpdateDeviceModelUseCase.ts:119`). A failure is silently swallowed and the use
case still reports success, leaving orphaned configs.

**G-5 — The installedDate message over-promises.**
DEV-050 says "Must be a valid ISO 8601 date string" but the check is
`!isNaN(new Date(v).getTime())`, which accepts `"March 5, 2020"` and other
non-ISO forms. Either tighten the check or soften the message.

**G-6 — Credentials use generic CRUD permissions.**
DEV-141 gates credential writes behind the same `update` permission as renaming
a device, so any OPERATOR can set device passwords. If credential management
should be admin-only, it needs its own permission rather than reusing `update`.

**G-7 — Filtered listings paginate in memory.**
`findByFilters` takes no limit/offset, so `ListDevicesUseCase.listByFilters`
loads every matching device and slices the array
(`ListDevicesUseCase.ts:168`). Unfiltered listings paginate in SQL correctly.
Fine at current fleet size; the shape of the problem is worth knowing before it
matters.

**G-8 — `Vendor.name` is unique in the database but unchecked in code.**
`prisma/schema.prisma:47` marks it `@unique`, but `CreateVendorUseCase` only
checks the slug. A duplicate vendor name surfaces as a raw Prisma error instead
of the clean `A vendor with ... already exists` message that a duplicate slug
produces. Either add the check (and a rule) or drop the constraint.
