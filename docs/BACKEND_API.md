# Backend API Reference

> **Purpose:** This file is the source of truth for the backend API when working on the frontend.  
> It is written for a Claude Code session in the frontend directory — paste it as context when you need endpoint details.  
> The backend lives at `/home/jonathan/Studies/projects/network-management-system/backend`.

---

## Base

| Key          | Value                   |
| ------------ | ----------------------- |
| Dev base URL | `http://localhost:3000` |
| API prefix   | `/api`                  |
| Content-Type | `application/json`      |

Most API responses are wrapped:

```ts
// Success
{ success: true, data: T }

// Error
{ success: false, error: string }
```

> **Exceptions:** Credentials, Polling, and Wireless endpoints return **raw data** — no `{ success, data }` wrapper.  
> Their error responses use `{ error: string }` (no `success` field).

### Optional modules

An install can switch off whole modules (`ENABLED_MODULES`, see `INS-001` … `INS-008`). A disabled
module's endpoints are not mounted: an authenticated request gets **`404`** (`401` still comes
first without a token). The frontend should hide those sections rather than treat the `404` as an
error.

| Module        | Endpoints                                                                               |
| ------------- | --------------------------------------------------------------------------------------- |
| `customers`   | `/api/customers`, `/api/service-plans`, `/api/contracted-services`                      |
| `billing`     | `/api/bills`, `/api/billing-settings`, `/api/collection-accounts`, `/api/bank-accounts` |
| `quoting`     | `/api/quotations`                                                                       |
| `tickets`     | `/api/tickets`, `/api/technicians`                                                      |
| `enforcement` | `/api/enforcement/suspensions`, `/api/contracted-services/:id/enforcement`              |

Everything else (monitoring) is always present. A monitoring-only install
(`ENABLED_MODULES=monitoring`) serves none of the endpoints above.

---

## Authentication

All endpoints except the sign-in steps under `/api/auth` and the agent-facing `/agent/v1/*` (see Probe agents) require a session: the `nms_session` cookie, or a JWT in the `Authorization` header:

```
Authorization: Bearer <token>
```

Missing or invalid sessions return `401`. Insufficient role returns `403`.

> **⚠ Changed 2026-10-05 — the browser session is a cookie (IDN-066, IDN-084, IDN-085).**
> Every answer that signs in (the two-factor steps, a remembered-browser login,
> `POST /api/users/me/password`) sets the `nms_session` cookie: `HttpOnly`,
> `Secure`, `SameSite=Strict`, 24 hours. The dashboard should:
>
> - send every request with `credentials: 'include'` (axios: `withCredentials: true`);
> - stop storing the token from the answer body and stop sending `Authorization`
>   (the body still carries it, for non-browser clients);
> - stop storing `trustedBrowserToken` too — it comes as the `nms_trusted_browser`
>   cookie and goes back to login on its own;
> - open streams with `new EventSource(url, { withCredentials: true })` and no
>   `?token=`;
> - sign out with `POST /api/auth/logout`, which clears the cookie;
> - be served from the same main domain as the API (`app.x.com` + `api.x.com`),
>   and be listed in the backend's `ALLOWED_ORIGINS`.
>
> A cookie-signed `POST`/`PUT`/`PATCH`/`DELETE` whose `Origin` is not in
> `ALLOWED_ORIGINS` answers `403 Cross-site request refused`. Browsers send
> `Origin` on their own; nothing to add.

A token also stops working (`401 Invalid token`) as soon as its account is
disabled or has its role or password changed (IDN-065) — **on any `401`, drop the
token and send the user to the login screen.** The role that counts is the
account's current one; after a `401` the new login returns it. Tokens issued
before 2026-09-30 are all refused once, when this ships.

> **SSE exception:** the live streams (every `…/stream` endpoint) also accept
> `?token=<jwt>`, because the browser `EventSource` API cannot set headers. No
> other endpoint does. With the cookie it is no longer needed.

### Roles

| Role       | Allowed operations                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| `VENDOR`   | everything `ADMIN` has, plus manage-installation                                                                           |
| `ADMIN`    | read, create, update, delete, activate, bulk-import, manage-credentials, reveal-credentials, manage-users, manage-settings |
| `OPERATOR` | read, create, update, activate, bulk-import, reveal-credentials                                                            |
| `VIEWER`   | read only                                                                                                                  |

`VENDOR` is the company that sells and runs the install; `ADMIN` is the
customer's own administrator. There is one vendor account per install, set up
from the server's environment at boot (IDN-011) — it cannot be created through
the API. Wherever an endpoint below lists `ADMIN`, `VENDOR` is allowed too.

`manage-credentials` gates writes to `/api/devices/:id/credentials`: they carry
device passwords and SNMP keys, so they are not covered by the generic `update`
permission. Reading them stays on `read` because the response is masked. It
also gates downloading a configuration backup, which holds the same secrets
(BKP-041).

`reveal-credentials` gates seeing a device's secrets in plaintext
(`POST /api/devices/:id/credentials/reveal`) and the password re-check that
unlocks it (`POST /api/users/me/credential-reveal`). Operators hold it but
still cannot change credentials; viewers get `403` (IDN-035).

`manage-users` gates `/api/users` except `/api/users/me/password` and
`/api/users/me/credential-reveal` (IDN-140, IDN-086).

`manage-settings` gates changing the install's settings from the dashboard:
today `PUT /api/notification-settings` and its test message (IDN-034),
`PUT /api/billing-settings` (BIL-285), and `PUT /api/wireless/alert-thresholds`
(WLS-202).

`manage-installation` (VENDOR only, IDN-033) gates agent create, re-key and
revoke, the data-retention purge and the vendor's settings
(`/api/installation/settings`). **Hide those controls unless
`user.role === 'VENDOR'`**; for any other role they answer `403`.

### Rate limits (per authenticated user)

| Operation type                                   | Limit       |
| ------------------------------------------------ | ----------- |
| Read (`GET`)                                     | 100 / min   |
| Write (`POST`, `PATCH`, `PUT`)                   | 60 / min    |
| Delete (`DELETE`)                                | 60 / min    |
| Bulk import                                      | 5 / hr      |
| Agent enrollment (per IP)                        | 10 / 15 min |
| Failed sign-ins and codes (per IP)               | 10 / 15 min |
| Everything under `/api` and `/agent/v1` (per IP) | 1000 / min  |

Counters are keyed by user id, falling back to IP for unauthenticated requests,
so operators sharing one office address do not share a budget. Each resource
has its own counter — 60 device deletes and 60 vendor deletes in the same minute
is fine. Exceeding a bucket returns `429` with `{ success: false, error: 'Too many requests' }`.

The per-IP total (added 2026-10-05, IDN-104) is counted before the token is
checked, so requests without one or with a bad one count too. It is high enough
that an office sharing one address never meets it in normal use.

SSE streams are not rate-limited beyond opening them, which counts toward the
per-IP total — a connection held open for hours is the wrong thing to count per
minute. They are capped by concurrency instead: 5 streams per
user and 200 per server, exceeding either returns `429` with
`{ error: 'Too many streams' }`. The inbox stream
(`GET /api/notifications/stream`) has its own limit of 10 per user, since every
open tab holds one, but still counts toward the 200.

---

## Auth `/api/auth`

### `POST /api/auth/login` — Login

**Status:** 200 | 400 | 401 | 429  
**Auth required:** No

> **⚠ Changed 2026-10-05 — login no longer returns a session.** A right
> password returns a `challengeToken` and the next step; the session comes from
> `/two-factor/setup/confirm` or `/two-factor/verify` below (IDN-166). The
> frontend must follow this before the backend is deployed, or nobody can sign in.

```ts
// Request body
{
  email: string                 // required
  password: string              // required
  trustedBrowserToken?: string  // from an earlier "remember this browser" (IDN-171); browsers send the cookie instead
}

// Response 200 — the two-factor step
{
  success: true,
  data: {
    twoFactor: 'verify' | 'setup'  // 'setup' the first time, 'verify' after
    challengeToken: string         // Bearer token for the two-factor routes; 5 minutes
  }
}

// Response 200 — a remembered browser: the session, no code needed
{
  success: true,
  data: {
    token: string
    user: { id: string; email: string; role: 'VENDOR' | 'ADMIN' | 'OPERATOR' | 'VIEWER' }
  }
}
```

> **⚠ Changed 2026-10-05 — remembered browsers.** When `data.token` is present
> the person is signed in; otherwise follow `data.twoFactor`. A
> `trustedBrowserToken` that has expired or was revoked is ignored, never an
> error: the answer is the usual two-factor step.

> Returns `401` for a wrong password, an unknown email and a disabled account alike (identical error message — no credential enumeration).

**Sign-in flow**

1. `POST /api/auth/login` → `{ twoFactor, challengeToken }`.
2. `twoFactor === 'setup'`: `POST /two-factor/setup` → show the QR code of
   `otpauthUri` (and `secret` for typing in by hand), then
   `POST /two-factor/setup/confirm { code }` → session + recovery codes. Show the
   recovery codes once, with a "I saved them" confirmation.
3. `twoFactor === 'verify'`: `POST /two-factor/verify { code }`, or
   `{ recoveryCode }` behind a "lost my phone" link → session.
4. Offer a "remember this browser for 30 days" checkbox on the code screens and
   send it as `rememberBrowser: true`. The browser keeps the
   `nms_trusted_browser` cookie it returns and sends it with every later
   login on its own (a non-browser client sends `trustedBrowserToken`). It stops
   working after 30 days, or at once when the account's password, role or
   status changes or its two-factor is reset (IDN-171).

Send the challenge as `Authorization: Bearer <challengeToken>` on every
two-factor route. It does not work on any other route, and a session token does
not work here (IDN-167). On `401 Sign-in step expired. Sign in again.` go back
to the password screen.

> **⚠ Changed 2026-10-05 — two new `429` answers:**
>
> | When                                                                                                                                                                                            | Body `error`                                         |
> | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
> | The account had 5 wrong passwords in a row: it waits 1 minute, and each further wrong password doubles the wait, up to 15 minutes. Even the right password is refused while it waits (IDN-044). | `Too many failed sign-in attempts. Try again later.` |
> | The caller's address had 10 failed sign-ins in 15 minutes (IDN-103).                                                                                                                            | `Too many requests`                                  |
>
> Show both as "try again in a few minutes"; neither means the password is wrong.
> A new password set by an administrator lifts the account's wait at once.
> Wrong two-factor codes count toward both, the same as wrong passwords.

### `POST /api/auth/logout` — Sign out this browser

**Status:** 200  
**Auth required:** No

```ts
// No body
// Response 200
{ success: true, data: null }
```

> Clears the `nms_session` cookie (IDN-062). The remembered browser stays, so
> the next sign-in from here still skips the code. Tokens are not revoked: to
> end every session of an account, change its password.

### `POST /api/auth/password/forgot` — Ask for a password reset link

**Status:** 200 | 400 | 429  
**Auth required:** No

```ts
// Request body
{ email: string }

// Response 200 — the same whether or not the address has an account
{ success: true, data: null }
```

> When the address belongs to an active account, it gets an email with a link
> to `<APP_PUBLIC_URL>/reset-password#token=<token>` (IDN-182). The dashboard
> needs that page: read the token from `location.hash`, ask for the new
> password, and call `/password/reset`. Show the same "if the address has an
> account, we sent a link" message whatever happens.
> `429 Too many requests` after ten requests an hour from one address,
> counting `/password/reset` too (IDN-105).

### `POST /api/auth/password/reset` — Set a new password from the link

**Status:** 200 | 400 | 429  
**Auth required:** the link's token, in the body

```ts
// Request body
{
  token: string     // from the link's #token=
  password: string  // at least 12 characters
}

// Response 200
{ success: true, data: null }
```

> Signs nobody in: send the person to the login page. Every session of the
> account ends, and two-factor stays on (IDN-183).
> Also accepts an invitation's token (IDN-184).
>
> | Status | `error`                                   | When                                                         |
> | ------ | ----------------------------------------- | ------------------------------------------------------------ |
> | `400`  | `Reset link expired or already used`      | Older than an hour, used already, or the account is disabled |
> | `400`  | `Password must be at least 12 characters` | The link stays usable; ask again                             |

### `POST /api/auth/two-factor/setup` — Start two-factor setup

**Status:** 200 | 401 | 409 | 429  
**Auth required:** setup challenge (`twoFactor: 'setup'` from login)

```ts
// No body

// Response 200
{
  success: true,
  data: {
    secret: string      // base32, for typing into the app by hand
    otpauthUri: string  // otpauth://totp/... — render as a QR code
  }
}
```

> Calling it again before confirming gives a new secret; the old QR code stops
> working. `409 Two-factor sign-in is already on` when setup was already
> confirmed (IDN-168).

### `POST /api/auth/two-factor/setup/confirm` — Confirm setup and sign in

**Status:** 200 | 400 | 401 | 409 | 429  
**Auth required:** setup challenge

```ts
// Request body
{
  code: string               // the 6 digits the app shows
  rememberBrowser?: boolean  // default false (IDN-171)
}

// Response 200
{
  success: true,
  data: {
    token: string   // JWT session — Bearer token on all other requests; 24 hours
    user: {
      id: string
      email: string
      role: 'VENDOR' | 'ADMIN' | 'OPERATOR' | 'VIEWER'
    }
    recoveryCodes: string[]  // 10 codes like 'K7M2P-QX4RT'; shown only now
    trustedBrowserToken?: string  // only with rememberBrowser: true; 30 days
  }
}
```

| Status | `error`                                              | Meaning                                         |
| ------ | ---------------------------------------------------- | ----------------------------------------------- |
| `401`  | `Invalid code`                                       | Wrong code; counts as a failed sign-in          |
| `401`  | `Sign-in step expired. Sign in again.`               | Challenge missing, expired or of the wrong kind |
| `409`  | `Two-factor setup has not been started`              | Call `/two-factor/setup` first                  |
| `429`  | `Too many failed sign-in attempts. Try again later.` | Account paused (IDN-044)                        |

### `POST /api/auth/two-factor/verify` — Finish sign-in with a code

**Status:** 200 | 400 | 401 | 429  
**Auth required:** code challenge (`twoFactor: 'verify'` from login)

```ts
// Request body — exactly one of the two
{
  code?: string              // the 6 digits the app shows
  recoveryCode?: string      // one of the recovery codes; case, spaces and dash ignored
  rememberBrowser?: boolean  // default false (IDN-171)
}

// Response 200
{
  success: true,
  data: {
    token: string
    user: { id: string; email: string; role: 'VENDOR' | 'ADMIN' | 'OPERATOR' | 'VIEWER' }
    trustedBrowserToken?: string  // only with rememberBrowser: true; 30 days
  }
}
```

> `401 Invalid code` for a wrong code, a code already used and an unknown or
> spent recovery code alike. Each recovery code works once (IDN-170).
> Other errors as for `/setup/confirm`.
>
> Every sign-in finished here or at `/setup/confirm` emails the account a
> warning with the time and the caller's address (IDN-181). A login from a
> remembered browser sends none. The email never delays or fails the answer.

---

## Enums

```ts
type LocationType =
  | 'TOWER'
  | 'DATACENTER'
  | 'POINT_OF_PRESENCE'
  | 'OFFICE'
  | 'CUSTOMER_PREMISES'
  | 'OTHER';
type DeviceStatus =
  | 'INVENTORY'
  | 'COMMISSIONING'
  | 'ACTIVE'
  | 'DAMAGED'
  | 'DECOMMISSIONED';
type DeviceCategory =
  | 'CPE'
  | 'WIRELESS_CPE'
  | 'ACCESS_POINT'
  | 'GATEWAY'
  | 'AGGREGATION_SWITCH'
  | 'OTHER';
type DeviceOwner = 'COMPANY' | 'CLIENT';
type DeviceType =
  | 'ANTENNA'
  | 'OTHER'
  | 'RADIO'
  | 'ROUTER'
  | 'ROUTERBOARD'
  | 'SERVER'
  | 'SWITCH';
type PollingStatus = 'SUCCESS' | 'FAILED' | 'SKIPPED';
type BillStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
type DeviceOnlineStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN'; // UNKNOWN = not monitored / never polled — see "monitoring stopped"
type AlertSeverity = 'WARNING' | 'CRITICAL';
type AlertStatus = 'OPEN' | 'RESOLVED';
type TicketStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CANCELLED';
type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
type TicketCategory =
  | 'CONNECTIVITY'
  | 'INSTALLATION'
  | 'HARDWARE_FAILURE'
  | 'MAINTENANCE'
  | 'RELOCATION'
  | 'SITE_SURVEY' // visit a prospect to check signal / line of sight before installing
  | 'OTHER';
type TicketOrigin = 'MANUAL' | 'DEVICE_ALERT' | 'WIRELESS_ALERT';
```

> **`DeviceCategory` vs `DeviceType` — two different questions.**  
> `DeviceCategory` lives on the **device** and says _what role the unit plays in the network_: `ACCESS_POINT` serves subscribers, `WIRELESS_CPE` is the station end of that link, `GATEWAY` routes, `AGGREGATION_SWITCH` aggregates, `CPE` is customer equipment, `OTHER` is the escape hatch.  
> `DeviceType` lives on the **device model** and says _what kind of hardware it is_ (`ANTENNA`, `ROUTER`, `SWITCH`, …).  
> One box can be a `SWITCH` by type and an `AGGREGATION_SWITCH` by role — PoE, port count and so on are hardware traits and belong to the model, never to the category.
>
> **⚠ Breaking change (2026-07-29):** the category set changed, and a migration rewrote existing rows:
>
> | Old category       | New category         |                                                                                        |
> | ------------------ | -------------------- | -------------------------------------------------------------------------------------- |
> | `AP`               | `ACCESS_POINT`       | renamed for clarity                                                                    |
> | `ROUTERBOARD`      | `GATEWAY`            | the role is "where upstream internet enters"; `ROUTERBOARD` survives as a `DeviceType` |
> | `SMART_SWITCH`     | `AGGREGATION_SWITCH` | the node switch radios converge on                                                     |
> | `SMART_SWITCH_POE` | `AGGREGATION_SWITCH` | PoE is a hardware trait, not a role                                                    |
>
> `CPE`, `WIRELESS_CPE` and `OTHER` are unchanged. Any frontend picker, filter or badge map holding the old literals must be updated — sending an old value now returns `400`, and a device that used to read `SMART_SWITCH_POE` now reads `AGGREGATION_SWITCH`.
>
> **Since 2026-08-01, reading a device whose stored category is not one of the six fails with `500`** `"Data integrity violation: unrecognised DeviceCategory \"<value>\" in persistence store"`, instead of returning the stale value. A migrated database cannot reach this — the Postgres enum only permits the six — so if you see it, **your database is behind on migrations**; run them and retry rather than filing a bug. It applies to any endpoint that returns a device, `GET /api/devices` and `GET /api/locations/map` included.

---

## Shared Response Shapes

```ts
interface LocationDTO {
  id: string; // UUID
  name: string;
  type: LocationType;
  municipality: string | null;
  neighborhood: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

interface DeviceDTO {
  id: string; // UUID
  deviceModelId: string; // UUID
  locationId: string | null;
  agentId: string | null; // probe agent that polls it; null = polled by the server itself
  status: DeviceStatus;
  category: DeviceCategory | null;
  ownerType: DeviceOwner | null;
  name: string;
  serialNumber: string | null;
  macAddress: string | null;
  ipAddress: string | null;
  description: string | null;
  installedDate: string | null; // ISO 8601
  monitoringEnabled: boolean;
  createdAt: string;
  updatedAt: string;

  // Soft delete. Always null on anything you can fetch — a deleted device is
  // absent from every listing and 404s on GET. They are here because the
  // restore endpoint returns the record it just brought back.
  deletedAt: string | null; // ISO 8601
  deletedBy: string | null; // UUID of the user who deleted it

  // Replacement lineage. Both directions are readable; only one is stored.
  replacedAt: string | null; // when this unit took over from its predecessor
  replacesDeviceId: string | null; // the unit this one replaced
  replacedByDeviceId: string | null; // the unit that replaced this one

  // Topology (since 2026-10-28): the device this one hangs off on the network
  // — a CPE's AP, an AP's switch. null = a root. See "Topology" below.
  upstreamDeviceId: string | null;
}

interface VendorDTO {
  id: string; // UUID
  name: string;
  slug: string; // URL-safe lowercase, e.g. "tp-link"
  description: string | null;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

interface DeviceModelDTO {
  id: string; // UUID
  vendorId: string; // UUID
  vendorName: string; // e.g. "MikroTik"
  vendorSlug: string; // e.g. "mikrotik"
  model: string;
  deviceType: DeviceType;
  isWireless: boolean; // hardware has a radio — gates wireless configs
  poeSwitchOs: 'ROUTEROS' | 'SWOS' | null; // PoE-out switch firmware; null = not one
  createdAt: string; // ISO 8601
  updatedAt: string;
}

interface PaginatedResponse<T> {
  // (field name varies — see each endpoint below)
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
```

---

## Locations `/api/locations`

### `POST /api/locations` — Create

**Status:** 201

```ts
// Request body
{
  name: string                 // required, 1–150 chars
  type: LocationType           // required
  municipality?: string | null // max 100 chars
  neighborhood?: string | null // max 150 chars
  address?: string | null      // max 255 chars
  latitude?: number | null     // -90 to 90  ← must pair with longitude
  longitude?: number | null    // -180 to 180
  altitude?: number | null
}

// Response
{ success: true, data: LocationDTO }
```

> latitude and longitude must always be provided together or both null/omitted.
>
> **Address parts are independent (DEV-094).** `address` (street), `neighborhood` and `municipality` can each be sent alone or left out — send `null` for a part you do not know, not an empty string (a blank part is a 400). A `CUSTOMER_PREMISES` location still needs **coordinates or all three address parts** (DEV-096), otherwise `400` `"A CUSTOMER_PREMISES location must have coordinates or a complete address ..."` — a neighborhood plus coordinates is fine.

---

### `GET /api/locations` — List

**Status:** 200

```ts
// Query params (all optional)
limit?:  number   // 1–100, default 20
offset?: number   // ≥0, default 0
type?:   LocationType

// Response
{
  success: true,
  data: {
    locations: LocationDTO[]
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

---

### `GET /api/locations/map` — Map pins

**Status:** 200  
**Auth required:** Yes (any role)

Returns all locations that have coordinates, each with their nested devices. Intended for map rendering — one pin per location.

```ts
// Response
{
  success: true,
  data: {
    total: number       // number of pins returned
    pins: Array<{
      id: string            // location UUID
      name: string
      locationType: LocationType
      latitude: number      // never null — only geolocated locations included
      longitude: number
      altitude: number | null
      municipality: string | null
      neighborhood: string | null
      address: string | null
      devices: Array<{
        id: string
        name: string
        status: DeviceStatus
        category: DeviceCategory | null
        ipAddress: string | null
        macAddress: string | null
        monitoringEnabled: boolean
      }>
    }>
  }
}
```

> Locations without both `latitude` and `longitude` are excluded.  
> Devices are grouped under their location — no N+1 queries.  
> Use `locationType` to drive pin icon/colour on the frontend map.

---

### `GET /api/locations/:id` — Get by ID

**Status:** 200 | 404

```ts
// Response
{ success: true, data: LocationDTO }
```

---

### `DELETE /api/locations/:id` — Delete

**Status:** 204 | 400 | 404 | 409

```ts
// No request body
// Response: 204 No Content
```

> Returns 409 if any devices are assigned to this location — reassign or remove them first.  
> Returns 400 if the id is not a valid UUID v4, 404 if no location exists with that id.

---

### `PATCH /api/locations/:id` — Update

**Status:** 200 | 404

```ts
// Request body (all fields optional — send only what changes)
{
  name?: string
  type?: LocationType
  municipality?: string | null
  neighborhood?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  altitude?: number | null
}

// Response
{ success: true, data: LocationDTO }
```

> Each address part is updated on its own; omitted parts are kept, `null` clears one. On a `CUSTOMER_PREMISES` location without coordinates, clearing any part is refused with `400` (DEV-096).

---

## Devices `/api/devices`

### `POST /api/devices` — Create

**Status:** 201 | 400 | 404

```ts
// Request body
{
  deviceModelId: string        // required, UUID
  name: string                 // required, 1–150 chars
  ownerType?: DeviceOwner      // optional; omit or pass null → stored as null
  status?: DeviceStatus        // default: INVENTORY
  category?: DeviceCategory | null
  locationId?: string | null   // UUID
  agentId?: string | null      // UUID of a probe agent; see below
  upstreamDeviceId?: string | null // UUID of the device it hangs off; see Topology
  serialNumber?: string | null // max 100 chars
  macAddress?: string | null   // format AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF
  ipAddress?: string | null    // IPv4 or IPv6
  description?: string | null
  installedDate?: string | null // ISO 8601
  monitoringEnabled?: boolean  // default: false
}
```

**Business rules:**

- `deviceModelId` must name an existing device model — a well-formed UUID for a model that does not exist returns `404` with `Device model not found: <id>`
- `INVENTORY` / `DAMAGED` / `DECOMMISSIONED` status → at least one of `serialNumber` or `macAddress` required (status defaults to `INVENTORY`, so a minimal request must include at least one)
- `COMMISSIONING` status → `ipAddress` required; `monitoringEnabled` defaults to `true`, but an explicit `monitoringEnabled: false` in the same request is respected (staging a device without polling it yet is legitimate)
- `ACTIVE` status → `ipAddress` and `locationId` required
- `agentId` omitted → the device goes behind the only non-revoked agent; with no agents it stays `null`; with **two or more** the request is refused `400 agentId is required…` — show an agent picker whenever `GET /api/agents` lists more than one non-revoked agent. `agentId: null` always means "polled by the server". A revoked agent is `400`, an unknown one `404` (`DEV-164` … `DEV-166`)
- `installedDate` must be ISO 8601 — `YYYY-MM-DD` or `YYYY-MM-DDThh:mm[:ss[.sss]]` with an optional `Z`/`±hh:mm` offset. Locale forms (`March 5, 2020`) and impossible dates (`2024-02-31`) are rejected, not reinterpreted
- `upstreamDeviceId` follows the [link rules](#upstream-link-rules) — an unknown upstream is `404`, one off the network `400`; nothing is created when it is refused

```ts
// Response
{ success: true, data: DeviceDTO }
```

---

### `GET /api/devices` — List

**Status:** 200

```ts
// Query params (all optional)
limit?:            number          // 1–300, default 20
offset?:           number          // ≥0, default 0
status?:           DeviceStatus
category?:         DeviceCategory
owner?:            DeviceOwner
locationId?:       string          // UUID
agentId?:          string          // an agent's UUID, or 'none' — see below
deviceModelId?:    string          // UUID
monitoringEnabled?: 'true' | 'false'
deleted?:          'true' | 'false' | 'any'   // default: 'false' — see below
search?:           string          // free-text
connectivity?:     'UP' | 'DOWN' | 'UNKNOWN'  // monitored devices only — see below
sortBy?:           'createdAt' | 'updatedAt' | 'name' | 'status' | 'deletedAt' | 'ipAddress' | 'downSince'  // default: createdAt
sortOrder?:        'ASC' | 'DESC'  // default: DESC (ASC for downSince)

// Response
{
  success: true,
  data: {
    devices: DeviceListItemDTO[]
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

> `total` is the number of devices matching the filters, not the number returned
> in `devices`. Filtered and unfiltered listings both paginate in the database,
> so page size bounds the work the query does.

> `agentId=<uuid>` lists the devices behind that agent; `agentId=none` lists the
> devices this server polls itself (no agent). `total` counts only those, so
> it matches the agent's `deviceCount` for live devices (DEV-172). An unknown
> agent id returns an empty list. Anything else answers `400`.

> `sortBy=ipAddress` orders by address value (IPv4 and IPv6), not by the
> stored string — `"9.0.0.1"` sorts before `"10.0.0.1"`. Devices with no
> `ipAddress` sort last on `ASC`, first on `DESC` (Postgres's default null
> ordering).

**Connectivity (since 2026-09-26).** Each list item is a `DeviceDTO` plus the
device's current reachability, so the list needs no per-device polling calls:

```ts
interface DeviceListItemDTO extends DeviceDTO {
  connectivity: {
    status: 'UP' | 'DOWN' | 'UNKNOWN';
    downSince: string | null; // ISO 8601 — when the current outage began; null unless DOWN
    lastSeen: string | null; // ISO 8601 — last successful ping
  } | null; // null when monitoringEnabled is false
}
```

| Device                                                              | `connectivity`                                                                                       |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| monitored, polled                                                   | its recorded state                                                                                   |
| monitored, never polled                                             | `{ status: 'UNKNOWN', downSince: null, lastSeen: null }`                                             |
| monitoring off                                                      | `null`. A state recorded before it was switched off is stale and is not shown                        |
| behind an agent that is not reporting (offline, pending or revoked) | `{ status: 'UNKNOWN', downSince: null, lastSeen }` — the recorded state is stale, `lastSeen` is kept |

- `connectivity=DOWN` (or `UP`/`UNKNOWN`) matches **monitored devices only**,
  and `total` counts the same set. `UNKNOWN` includes monitored devices never
  polled and devices behind an agent that is not reporting; `UP` and `DOWN`
  leave those out. Combined with `monitoringEnabled=false` it returns nothing. Any
  other value is a `400`. The values are `UP`/`DOWN`/`UNKNOWN`, not
  `ONLINE`/`OFFLINE`.
- `sortBy=downSince` sorts by outage start: the default (`ASC`) puts the
  longest outage first, `DESC` the newest. Devices that are not down follow;
  unmonitored devices are always last. There is no `sortBy=connectivity`;
  filter by status and sort by `downSince` instead.
- `GET /api/devices/:id` returns a plain `DeviceDTO`, without `connectivity`.

```
GET /api/devices?connectivity=DOWN&sortBy=downSince   // what is down, worst first
```

**`deleted` — the recycle bin.** Soft-deleted devices are hidden from every
listing unless you ask for them:

| Value              | Returns                                                       |
| ------------------ | ------------------------------------------------------------- |
| omitted or `false` | live devices only — unchanged from before                     |
| `true`             | **deleted devices only** — this is the bin                    |
| `any`              | both; the only way a tombstone and a live device share a page |

Bin rows carry `deletedAt` and `deletedBy`. Pair it with
`sortBy=deletedAt&sortOrder=DESC` for most-recently-deleted first. It combines
with every other filter, so `?deleted=true&owner=CLIENT` is a customer-scoped
bin.

Needs only the `read` permission — seeing the bin is not the same as acting on
it. Restoring takes `delete` (ADMIN), and so does emptying.

```
GET /api/devices?deleted=true&sortBy=deletedAt&sortOrder=DESC
```

---

### `GET /api/devices/:id` — Get by ID

**Status:** 200 | 404

```ts
// Response
{ success: true, data: DeviceDTO }
```

---

**Device status lifecycle:**

| Transition             | Requirements                                  | Side effects                                                                               |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| any → `COMMISSIONING`  | `ipAddress` must be set on the device         | `monitoringEnabled` turned on **unless** the same request sends `monitoringEnabled: false` |
| any → `ACTIVE`         | `ipAddress` and `locationId` must both be set | —                                                                                          |
| any → `DAMAGED`        | `serialNumber` or `macAddress` must be set    | monitoring stopped (see below)                                                             |
| any → `DECOMMISSIONED` | `serialNumber` or `macAddress` must be set    | monitoring stopped (see below)                                                             |
| any → `INVENTORY`      | `serialNumber` or `macAddress` must be set    | monitoring stopped (see below)                                                             |

`DAMAGED` is a side-state (e.g. hardware failure) and can be set from any status.

**`INVENTORY`, `DAMAGED` and `DECOMMISSIONED` are the _retired_ statuses** — the
unit is off the network, so none of them polls and each needs an identifier you
can read off the box. They are also the only values
[`POST /api/devices/:id/replace`](#post-apidevicesidreplace--replace-hardware)
accepts for the outgoing unit.

> ⚠ **New status (2026-08-12): `DECOMMISSIONED`.** It means "retired for good" —
> as opposed to `DAMAGED` ("broken, still ours") and `INVENTORY` ("working,
> back in stock"). Add it to any status picker or filter. It existed before
> 2026-05-09, was removed, and is back because hardware replacement needs to
> distinguish an upgraded-but-working unit from a failed one. No existing row
> changed status: units remapped to `DAMAGED` in May stay `DAMAGED`.

> When transitioning to `DAMAGED` or `INVENTORY`, the backend stops monitoring the device automatically. There is no need to also send `monitoringEnabled: false`.

<a id="stopping-monitoring"></a>
**What "monitoring stopped" does (since 2026-08-03)**

Every route that stops monitoring performs the same transition — the status
change above, `PATCH /api/devices/:id` with `monitoringEnabled: false`, and
`POST`/`PATCH /api/devices/:id/polling/config` with `enabled: false`:

1. Polling stops. The polling config is **kept** (interval, failure threshold and IP survive), so re-enabling resumes with the same settings.
2. **`currentStatus` becomes `UNKNOWN`.** The last reading is not left standing — nothing will poll the device again to correct it, so presenting it as current would be a lie. `consecutiveFailures` resets to `0`, `lastPolled` / `nextScheduled` become `null`.
3. **`lastSeen` is kept**, so you can still show how stale the last real observation is.
4. Any **open `device_unreachable` alert is resolved**, and **no resolution notification is sent** — the device was not fixed, it just stopped being watched.
5. Ping history is untouched; only the 30-day retention purge removes it.

**Wireless polling follows the _status_ trigger only (since 2026-08-13).** Moving
a device to a retired status now also disables its `WirelessDeviceConfig`, so
`GET /api/devices/:id/wireless/config` will report an `enabled: false` you did
not set. The config is disabled, never deleted, so `intervalSecs` and
`linkCapacityKbps` survive and resuming is one `PATCH`.

Resuming is deliberately narrow, matching ICMP: **only a move to
`COMMISSIONING` turns wireless polling back on.** Restoring a device from the
recycle bin does not, and neither does going straight from a retired status to
`ACTIVE` — the same as `monitoringEnabled`, which `restore()` leaves off. After
either, the operator turns polling back on explicitly.

> ⚠ The other two triggers in this section do **not** touch wireless.
> `PATCH /api/devices/:id` with `monitoringEnabled: false` and
> `PATCH /api/devices/:id/polling/config` with `enabled: false` stop ICMP only —
> an `ACTIVE` device paused in the UI keeps collecting wireless snapshots. To
> stop wireless explicitly, send `PATCH /api/devices/:id/wireless/config` with
> `enabled: false`.

> **Frontend:** `UNKNOWN` no longer means only "never polled". It now also means
> "monitoring is off", which is the common case. Render it as a neutral/grey
> "not monitored" state rather than a warning — and read `pollingEnabled` to tell
> the two apart: `pollingEnabled: false` → paused; `pollingEnabled: true` with
> `UNKNOWN` → enabled but not yet polled.
>
> On re-enabling, the device is picked up on the next scheduler tick (≤10 s) and
> the first result does **not** raise a spurious "recovered" alert.

---

### `PATCH /api/devices/:id` — Update

**Status:** 200 | 404

```ts
// Request body (all fields optional — send only what changes)
{
  name?: string
  deviceModelId?: string       // UUID — INVENTORY devices only, see below
  status?: DeviceStatus
  category?: DeviceCategory | null
  ownerType?: DeviceOwner
  locationId?: string | null
  agentId?: string | null        // null = polled by the server; revoked agent → 400
  upstreamDeviceId?: string | null // null = a root; see Topology → link rules
  serialNumber?: string | null
  macAddress?: string | null
  ipAddress?: string | null
  description?: string | null
  installedDate?: string | null  // ISO 8601; null clears it
  monitoringEnabled?: boolean
}

// Response
{ success: true, data: DeviceDTO }
```

`installedDate` follows the same ISO 8601 rule as create — locale forms and
impossible calendar dates are rejected rather than reinterpreted.

**`deviceModelId` — correcting a mis-registered model**

Changing the model is a **data-entry correction**, not a way to record a hardware
replacement. It is accepted **only while the device's status is `INVENTORY`** —
the one status in which the unit has never been polled, so no collected metric
can end up attributed to the wrong hardware.

- Device is `ACTIVE`, `COMMISSIONING`, `DAMAGED` or `DECOMMISSIONED` → `400` `"Cannot change the device model of a device with status <status> — only an INVENTORY device may have its model corrected"`
- Target model does not exist → `404` `"Device model not found: <id>"`
- Sending the model the device **already has** is a no-op that succeeds in any
  status — so a UI that PATCHes the whole form back is safe.
- A single request may both correct the model and move the device out of
  `INVENTORY` (e.g. `{ deviceModelId, ipAddress, status: 'COMMISSIONING' }`) —
  the correction is applied first.

> **Frontend:** show the model picker as editable only on `INVENTORY` devices; on
> any other status render it read-only. Replacing a unit with different hardware
> is not this endpoint — a device is one physical box, and its metric history
> belongs to that box. Use
> [`POST /api/devices/:id/replace`](#post-apidevicesidreplace--replace-hardware),
> which creates the new unit, links the two, and carries the IP, credentials and
> contracted service across. **(Changed 2026-08-12 — this used to say the path
> did not exist. Stop telling operators to retire and re-create by hand.)**
> Two working units that physically traded places are a third case — use
> [`POST /api/devices/:id/swap-hardware`](#post-apidevicesidswap-hardware--swap-hardware-between-two-devices).

**`category` — frozen while a wireless config exists**

The device's category decides the radio mode of its wireless config, and that
mode is derived **once**, when the config is created. So while a config exists,
the category is locked:

- Device has a wireless config and the request changes `category` (to another
  value **or** to `null`) → `400` `"Cannot change the category of a device that has a wireless config. Delete the wireless config first, then recategorise the device."`
- Sending the category the device **already has** is not a change and succeeds.
- Every other field on the same request is unaffected — only `category` is
  blocked.
- No wireless config → `category` is freely editable.

To recategorise a device that has one, `DELETE /api/devices/:id/wireless/config`
first, then PATCH the category, then create the config again. The refusal
happens before anything is written, so a rejected request changes nothing.

> **Frontend:** on a device that has a wireless config, render the category
> field read-only and point the operator at the wireless config screen. A UI that
> PATCHes the whole form back unchanged is safe — same value is a no-op.

**Field combinations are validated as one end state**

A `PATCH` describes the state you want the device to end up in, and the whole
combination is checked at once — so any request that describes a legal end state
succeeds, whatever mix of fields it carries:

```ts
// Commission a device sitting in inventory — one request
PATCH /api/devices/:id  { ipAddress: '10.0.0.5', status: 'COMMISSIONING' }

// Install and activate — one request
PATCH /api/devices/:id  { locationId: '…', status: 'ACTIVE' }

// Retire: pull it off site and back to the shelf — one request
PATCH /api/devices/:id  { locationId: null, status: 'INVENTORY' }
```

Requests are all-or-nothing: if the resulting state would break a rule, the
response is `400` and **nothing is applied** — you never end up with a device
that got its location but not its status.

> The rules still hold on the end state, not on the individual fields. `{ status: 'ACTIVE' }`
> alone on a device with no location is still `400` "An ACTIVE device must have a
> location assigned" — supply the location in the same request and it succeeds.

---

### `DELETE /api/devices/:id` — Delete (soft)

**Status:** 204 | 400 | 404

```ts
// No request body

// Response: 204 No Content (no body)
```

**Since 2026-08-12 this is a soft delete.** The device disappears from every
read path immediately — `GET /api/devices/:id` returns `404`, listings omit it
and do not count it in `total` — but the row and all its collected history
(pings, alerts, wireless snapshots, credentials) survive for a **7-day grace
period**. Within that window
[`POST /api/devices/:id/restore`](#post-apidevicesidrestore--restore-a-deleted-device)
brings it back. After it, a daily job removes the row permanently and everything
hanging off it goes with it.

**Business rules:**

- The device must exist and not already be deleted → otherwise `404` `"Device not found: <id>"`. Deleting twice still fails; the second call cannot see the first one's tombstone
- A **live contracted service** blocks the delete → `400` `"Cannot delete a device with a live contracted service (status <status>). Cancel the service first."`. Any status except `CANCELLED` counts as live, so `PENDING`, `ACTIVE` and `SUSPENDED` all block
- **Open tickets** block the delete → `400` `"Cannot delete a device with <N> open ticket(s). Resolve or cancel them first."`. `RESOLVED` and `CANCELLED` tickets do not block
- Monitoring is turned off automatically — see [stopping monitoring](#stopping-monitoring). There is no need to also send `monitoringEnabled: false`
- The device's MAC and IP addresses are **released immediately** and can be reassigned to another device, without waiting for the grace period to lapse
- Every device that hung off it (`upstreamDeviceId` = this device) **becomes a root** — its link is cleared, and restoring the deleted device does not put it back (DEV-184)
- `400` if the id is not a valid UUID v4

> **Frontend:** the two guards are the ones worth surfacing well — both are `400`
> with an actionable sentence naming what is in the way. Neither is a validation
> error the user can fix in the delete dialog; both need them to go elsewhere
> first (cancel the service, close the tickets). Consider offering a link rather
> than just the message.
>
> **Build a recycle-bin view, not an undo toast.** `GET /api/devices?deleted=true`
> lists everything in the bin with `deletedAt` and `deletedBy`; from there
> `POST /:id/restore` puts one back and `DELETE /:id/purge` removes it for good.
> Nothing needs to hold onto an id after the delete. A toast with an inline undo
> is still a nice touch, but it is no longer the only way back.

---

### `POST /api/devices/:id/restore` — Restore a deleted device

**Status:** 200 | 400 | 403 | 404

```ts
// No request body

// Response
{ success: true, data: DeviceDTO }
```

Undoes a soft delete. Requires the **`delete`** permission (ADMIN only) —
restoring is the inverse of deleting, so the same authority governs both.

**Business rules:**

- Only inside the grace period → past it, `400` `"Cannot restore a device whose 7-day grace period expired"`. There is no recovery after that; the row is gone or about to be
- The device must actually be deleted → otherwise `400` `"Cannot restore a device that is not deleted"`
- Unknown id → `404` `"Device not found: <id>"`
- **Monitoring stays off.** The restored device comes back with `monitoringEnabled: false` regardless of what it had before

> **Frontend:** the restored device is not polling. If the user expects it back
> in service, they need a second action — `PATCH { monitoringEnabled: true }`,
> plus a status change if it was retired. Say so in the success message rather
> than letting them discover it from a grey status pill later.

---

### `DELETE /api/devices/:id/purge` — Empty the bin (permanent)

**Status:** 204 | 400 | 403 | 404

```ts
// No request body

// Response: 204 No Content (no body)
```

Removes a device that is **already in the recycle bin**, now, instead of
waiting out the grace period. Requires the **`delete`** permission (ADMIN).

This is the same destruction the nightly retention job performs, on demand.
Every ping result, alert, wireless snapshot, credential and polling
configuration belonging to the device goes with it. **There is no undo.**

**Business rules:**

- The device must already be soft-deleted → otherwise `400` `"Cannot permanently delete a device that is not in the recycle bin. Delete it first."`. This is deliberate: routing everything through `DELETE /api/devices/:id` first is what guarantees the live-contracted-service and open-ticket guards were applied
- Unknown id → `404` `"Device not found: <id>"`
- `400` if the id is not a valid UUID v4

> **Frontend:** this is the destructive twin of restore, so treat it that way —
> a confirmation step naming the device, and wording that says the history goes
> too. "Empty the whole bin" is this call per device; there is no bulk endpoint
> yet, and the `delete` rate limiter allows 60/minute, so a very large bin needs
> throttling or a bulk endpoint (ask the backend for one if you hit it).

---

### `POST /api/devices/agent-assignment` — Move devices between agents

**Status:** 200 | 400 | 401 | 403 | 404  
**Roles:** ADMIN, OPERATOR

```ts
// Request body — agentId plus exactly one selector
{
  agentId: string | null     // target agent; null = back to polling by the server
  deviceIds?: string[]       // 1–1000 device UUIDs
  fromAgentId?: string | null // every device currently behind this agent; null = every device polled by the server
}

// Response — each device is moved on its own
{ success: true, data: { assigned: string[]; failed: { id: string; error: string }[] } }
```

> Typical calls: first agent installed → `{ agentId, fromAgentId: null }`; PC replaced → `{ agentId: newAgent, fromAgentId: oldAgent }`; agent misbehaving → `{ agentId: null, fromAgentId: agent }`. Show `failed` to the user: a device whose other data breaks a rule (e.g. `ACTIVE` with no location) is listed there with that rule's message and is not moved. Unknown target agent `404`, revoked target `400`.

---

### `POST /api/devices/:id/replace` — Replace hardware

**Status:** 201 | 400 | 403 | 404

`:id` is the unit **being replaced**. Use this whenever a physical box is swapped
for a different one — a failure, or an upgrade. It is not
`PATCH { deviceModelId }`: a device record is one physical unit, and every
metric hangs off its id, so editing the model in place would retroactively
re-attribute months of readings to hardware that never produced them.

Requires the **`activate`** permission (ADMIN and OPERATOR).

```ts
// Request body
{
  deviceModelId: string   // required, UUID — the replacement's model
  retiredStatus: string   // required, INVENTORY | DAMAGED | DECOMMISSIONED
  name?: string           // defaults to the retired unit's name
  serialNumber?: string   // at least one of serialNumber / macAddress required
  macAddress?: string
  description?: string
  installedDate?: string  // ISO 8601, defaults to now
}
```

```ts
// Response
{
  success: true,
  data: {
    retiredDevice: DeviceDTO
    newDevice: DeviceDTO
    wirelessConfigRemoved: boolean
    credentialsTransferred: boolean
    contractedServiceTransferred: boolean
    downstreamDevicesMoved: number // devices that hung off the old unit, now off the new one
  }
}
```

**What it does, in one call:**

1. Retires `:id` into `retiredStatus` and **releases its IP address**
2. Creates a new device on `deviceModelId`, inheriting the retired unit's
   **location, agent, category and owner**, and taking over the released IP.
   It starts in `COMMISSIONING` if it inherited an address, `INVENTORY` if not
3. Links the two — `newDevice.replacesDeviceId` and
   `retiredDevice.replacedByDeviceId`
4. Moves `DeviceCredentials` onto the new unit
5. Re-points the customer's `ContractedService` at the new unit
6. Deletes the retired unit's wireless config **if the new model is not
   wireless** — reported as `wirelessConfigRemoved`
7. Moves the topology (DEV-185): the new unit hangs off the old unit's
   `upstreamDeviceId`, every device that hung off the old unit now hangs off
   the new one (`downstreamDevicesMoved`), and the retired unit's own link is
   cleared

**Business rules:**

- `retiredStatus` is **required** and must be one of `INVENTORY`, `DAMAGED`, `DECOMMISSIONED` → otherwise `400`. This is deliberately the caller's choice: a swap is not always a failure. An upgraded antenna that still works belongs back in `INVENTORY`; a failed one is `DAMAGED`; an obsolete one is `DECOMMISSIONED`
- At least one of `serialNumber` / `macAddress` → otherwise `400` `"The replacement device must have at least a serial number or MAC address"`. It is a different physical box with its own
- A device can be replaced **once per service life** → `400` `"Device has already been replaced"` while the unit is still retired. A unit put back into service after being superseded (an upgraded antenna redeployed from `INVENTORY`) can be replaced again, and gains a second successor. `replacedByDeviceId` always names the **most recent** one
- A deleted device cannot be replaced → `404` (it is invisible to reads)
- Unknown `deviceModelId` → `404` `"Device model not found: <id>"`. Nothing is retired when this fails

> **Frontend:** the retired unit keeps all of its history and the new one starts
> empty — that is the point. A device detail page can follow
> `replacesDeviceId` / `replacedByDeviceId` to offer "previous unit" /
> "current unit" navigation, which is what makes "this CPE, current box since
> March" answerable.
>
> Follow it as a **chain, not a single hop**. A unit can be replaced once per
> service life, so walking `replacesDeviceId` backwards may pass through several
> boxes. `replacedByDeviceId` names only the most recent successor — if the unit
> was superseded, redeployed and superseded again, its earlier successor is not
> reachable from this field. There is no endpoint that returns the whole chain
> in one call yet; walk it one `GET /api/devices/:id` at a time.
>
> Surface `wirelessConfigRemoved: true` prominently — it means wireless
> monitoring for that site has stopped because the new hardware has no radio,
> and nothing will re-create the config automatically.

---

### `POST /api/devices/:id/swap-hardware` — Swap hardware between two devices

**Status:** 200 | 400 | 401 | 403 | 404

Use this when **two units that already exist in the system physically traded
places** — for example a large antenna moved to a quieter site and a smaller one
moved in. Each site keeps its record, IP, SSID, customers and history; only the
box identity moves. It is not `/replace` (that creates a new record and retires
the old one) and not `PATCH { deviceModelId }` (INVENTORY-only correction).

Requires the **`activate`** permission (ADMIN and OPERATOR).

```ts
// Request body
{
  otherDeviceId: string; // required, UUID — the other record; :id is one of the two
}
```

```ts
// Response
{
  success: true,
  data: {
    device: DeviceDTO       // :id, now carrying the other unit's hardware
    otherDevice: DeviceDTO  // otherDeviceId, now carrying :id's former hardware
  }
}
```

**What moves:** `deviceModelId`, `serialNumber`, `macAddress` — exchanged between
the two records.

**What stays with each record:** `ipAddress`, `locationId`, `agentId`, `status`,
`monitoringEnabled`, name, credentials, contracted service, wireless config and
every reading, alert and snapshot. Which side is `:id` and which is
`otherDeviceId` makes no difference.

Both records change together or neither does — including the MAC exchange, which
would otherwise trip the "MAC already assigned to another device" check.

**Business rules:**

- `otherDeviceId` equal to `:id` → `400` `"Cannot swap a device with itself"`
- Either device deleted → `404` `"Device not found: <id>"` (deleted devices are invisible to reads)
- Either device retired **and** already replaced → `400` `"Cannot swap the hardware of a device that has already been replaced"`
- Both carry identical model, serial and MAC → `400` `"Cannot swap devices that carry identical hardware details — there is nothing to exchange"`
- A retired or replacement device that would end up with neither a serial number nor a MAC → `400` (`"A device with status <status> must have at least a serial number or MAC address"` / `"The replacement device must have at least a serial number or MAC address"`)
- A device with a wireless config would receive a model with no radio → `400` `"Cannot swap hardware: \"<name>\" has a wireless configuration and would receive a model with no radio"`
- Either id unknown → `404` `"Device not found: <id>"`; malformed UUID → `400`

> **Frontend:** a "swap hardware" action on the device detail page that asks for
> the second device. Show both records' new model/serial/MAC in the confirmation.
> After a swap, prompt the operator to review each device's wireless capacity
> figures (`linkCapacityKbps`, `clientsProvisionedLimit`) — they were probably set
> for the antenna that used to be there and are **not** changed by this call.
>
> History follows the **site**, not the box: readings taken before the swap now
> sit on a record that describes the other hardware. That is deliberate — see
> DEV-161.

---

## Topology `/api/topology`

> **New (2026-10-28).** Every device can record the device it hangs off on the
> network — its **upstream** (`DeviceDTO.upstreamDeviceId`): a CPE's AP, an
> AP's switch, a switch's router. Following the links up from any device ends at
> a root (`upstreamDeviceId: null` — the gateway, or a device nobody has linked
> yet). The tree is the network map, and it is also what keeps the devices
> behind a failed AP from paging one by one (since 2026-10-29 — see the outage
> note under [Alerts](#alerts-apialerts)).
>
> The link is set with `upstreamDeviceId` on `POST /api/devices` and
> `PATCH /api/devices/:id`, or in bulk from the
> [suggestions](#get-apitopologysuggestions--links-the-network-suggests) the
> network offers (since 2026-10-29). It replaces the wireless config's
> `parentApDeviceId` — see the breaking change under Wireless Monitoring.

### Upstream link rules

| Request                                                   | Result                                                                                          |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `upstreamDeviceId: null`                                  | `200` — the device becomes a root                                                               |
| the device's own id                                       | `400` `Cannot make a device its own upstream device` (DEV-181)                                  |
| a device that already hangs (at any depth) below this one | `400` `<upstream> is already downstream of <device> — linking them would form a loop` (DEV-182) |
| an unknown or deleted device                              | `404` `Upstream device not found: <id>` (DEV-183)                                               |
| a device that is not `ACTIVE` or `COMMISSIONING`          | `400` `The upstream device must be ACTIVE or COMMISSIONING, not <status>` (DEV-183)             |
| a malformed UUID                                          | `400` (validation)                                                                              |

- The status check applies when a link is **made**. Sending back the link a
  device already has is never re-checked, so a form that PATCHes every field
  still saves after the upstream went `DAMAGED`.
- Any category can have an upstream and any category can be one.
- A STATION radio with no upstream gets one by itself: on its first poll whose
  reported AP MAC matches a device, that device becomes its upstream
  (WLS-012). An upstream already set is never overwritten — a different AP
  shows up as an identity suggestion (WLS-151) and, after three polls, a
  `parent_ap_mismatch` warning (WLS-013).
- Deleting a device makes the devices directly below it roots (DEV-184);
  replacing one moves them onto the replacement (DEV-185).

### `GET /api/topology` — The whole network

**Status:** 200 | 401 · **Role:** any (`read`)

```ts
// Response
{
  success: true,
  data: {
    nodes: TopologyNodeDTO[]
    total: number
  }
}

interface TopologyNodeDTO {
  id: string                       // device UUID
  name: string
  status: DeviceStatus
  category: DeviceCategory | null
  ipAddress: string | null
  locationId: string | null
  locationName: string | null
  upstreamDeviceId: string | null  // always another node in `nodes`, or null
  reachability: 'UP' | 'DOWN' | 'UNREACHABLE' | 'UNKNOWN'
  downSince: string | null         // ISO 8601, only while DOWN or UNREACHABLE
  childCount: number               // devices directly below this one
}
```

- **Which devices:** every live `ACTIVE` or `COMMISSIONING` device, plus any live
  device another one hangs off whatever its status (so a CPE under a `DAMAGED`
  AP still has its parent in the list). `upstreamDeviceId` never points outside
  `nodes`.
- **`reachability`** (DEV-186):

| Value         | Meaning                                                                   |
| ------------- | ------------------------------------------------------------------------- |
| `UP`          | last ping answered                                                        |
| `DOWN`        | down, and nothing above it is down — **this is where the fault is**       |
| `UNREACHABLE` | down, and a device above it is down too — probably cut off, not broken    |
| `UNKNOWN`     | not monitored, never polled yet, or behind an agent that is not reporting |

An unmonitored or `UNKNOWN` device in the middle of a chain does not stop the
walk up: a CPE below an unmonitored switch below a `DOWN` router is
`UNREACHABLE`.

- Unordered for drawing purposes (it comes sorted by IP); build the tree from
  `upstreamDeviceId`.

> **Frontend:** draw it as a collapsible tree or graph rooted at the nodes with
> `upstreamDeviceId: null`. During an outage colour `DOWN` red and
> `UNREACHABLE` grey — the red node is the one to send a technician to.
> Locations carry coordinates (`GET /api/locations/map`), so a later version can
> draw links between pins where `locationId` differs between a node and its
> upstream; nothing extra is needed from the backend for that.

### `GET /api/topology/:deviceId/descendants` — What hangs off one device

**Status:** 200 | 400 | 401 | 404 · **Role:** any (`read`)

```ts
// Response — same shape as GET /api/topology
{ success: true, data: { nodes: TopologyNodeDTO[], total: number } }
```

- `nodes[0]` is the device itself, followed by everything below it,
  breadth-first.
- `reachability` is still judged against the devices **above** it, so an AP
  whose switch is down reads `UNREACHABLE` here too.
- `404` `Device not found in the topology: <id>` — unknown, deleted, or not on
  the network (e.g. `INVENTORY`) with nothing hanging off it
- `400` — malformed UUID

> **Frontend:** use it for an "affected devices" panel on an AP or switch page.

### `GET /api/topology/suggestions` — Links the network suggests

**Status:** 200 | 400 | 401 · **Role:** any (`read`) · **New (2026-10-29)**

Proposes an upstream for devices from data the system already collects, so
nobody has to type in hundreds of parents by hand. **Nothing is linked until an
operator accepts** (see the next endpoint).

```ts
// Query
?locationId=<uuid>   // optional: only devices at this location, and only this
                     // location's PoE switches are read

// Response
{
  success: true,
  data: {
    suggestions: UpstreamSuggestionDTO[]
    total: number
    // PoE switches that could not be read: POE suggestions for antennas they
    // power are missing. Show a notice when non-empty.
    unreadSwitches: { deviceId: string; name: string; reason: string }[]
  }
}

interface UpstreamSuggestionDTO {
  deviceId: string
  deviceName: string
  ipAddress: string | null
  locationName: string | null
  currentUpstreamDeviceId: string | null   // null = currently a root
  currentUpstreamDeviceName: string | null
  suggestedUpstreamDeviceId: string
  suggestedUpstreamDeviceName: string
  source: 'WIRELESS' | 'POE'
  matchedBy: 'MAC' | 'IP' | null   // WIRELESS only
  observedAt: string | null        // WIRELESS only: ISO 8601 of the radio reading
  port: string | null              // POE only: the switch port, e.g. "ether3"
}
```

| `source`   | Where it comes from (rule)                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `WIRELESS` | A STATION radio's latest reading names its AP: by the AP's MAC (`matchedBy: 'MAC'`) or, failing that, by its IP (`'IP'`, less certain) (DEV-190)                                                                               |
| `POE`      | A PoE switch port at the device's own location is labelled with the device's IP, and no other port is (DEV-191). Never offered for a STATION: at the far end of a backhaul the switch hangs off the station, not the other way |

- At most **one suggestion per device**. A device already linked to the
  suggested upstream, a proposal that would close a loop, and devices or
  upstreams that are not `ACTIVE`/`COMMISSIONING` are left out (DEV-192,
  DEV-193). When `currentUpstreamDeviceId` is set, the suggestion is a
  **change**, so show both names.
- The PoE switches are **read live** (DEV-195), so without `locationId` the call
  can take a few seconds on a large network. Sorted by device IP.
- `400` — malformed `locationId`.

> **Frontend:** a review table with a checkbox per row (default checked for
> `matchedBy: 'MAC'` and `POE` rows with no current upstream; unchecked for
> `IP` matches and for changes), a location filter, and an "Aceptar
> seleccionados" button that posts the checked rows to the endpoint below.

### `POST /api/topology/suggestions/accept` — Make the chosen links

**Status:** 200 | 400 | 401 | 403 · **Role:** `update` (operator, admin) · **New (2026-10-29)**

```ts
// Request
{
  links: { deviceId: string; upstreamDeviceId: string }[]   // 1–500, each device once
}

// Response — 200 even when some links were refused
{
  success: true,
  data: {
    results: {
      deviceId: string
      upstreamDeviceId: string
      outcome: 'LINKED' | 'UNCHANGED' | 'FAILED'
      error: string | null   // FAILED only: the same messages as the link rules table
    }[]                      // same order as the request
    linked: number
    failed: number
  }
}
```

- Each link goes through the same rules as `PATCH /api/devices/:id`
  (DEV-181..183), one after another in request order, so a later link is
  judged against the ones already made: accepting `A → B` and `B → A` together
  links the first and refuses the second as a loop (DEV-194).
- One refused link does not stop the rest. `UNCHANGED` = the device already hung
  there.
- Any pair can be sent, not only ones the suggestions listed. The suggestion is
  not re-checked.
- `400` — empty list, more than 500, a malformed UUID, or
  `Each device can appear only once in a request`.

> **Frontend:** after posting, keep the `FAILED` rows on screen with their
> `error`, and reload the suggestions.

---

## Device Credentials `/api/devices/:id/credentials`

> **Response envelope:** Credentials endpoints return raw data directly — **no `{ success, data }` wrapper**.  
> Success: the DTO object directly (or 204 No Content).  
> Error: `{ error: string }`.

Sensitive fields (`snmpCommunity`, `snmpV3AuthKey`, `snmpV3PrivKey`, `httpPassword`) are masked as `'***'` in every response except the reveal endpoint below, which returns them in plaintext after the user re-enters their password.

```ts
interface DeviceCredentialsResponseDTO {
  deviceId: string; // UUID
  snmpVersion: 1 | 2 | 3;
  snmpCommunity: '***' | null; // masked; null if not set
  snmpV3AuthUser: string | null;
  snmpV3AuthProto: 'MD5' | 'SHA' | null;
  snmpV3AuthKey: '***' | null; // masked; null if not set
  snmpV3PrivProto: 'DES' | 'AES' | null;
  snmpV3PrivKey: '***' | null; // masked; null if not set
  snmpPort: number; // default 161
  httpUsername: string | null;
  httpPassword: '***' | null; // masked; null if not set
  httpPort: number; // default 443
  sshPort: number; // default 22 — RouterOS backups log in here with the HTTP login
  apiPort: number; // default 8728 — live router traffic reads the RouterOS API here with the HTTP login
  hasSnmpCredentials: boolean; // true if the effective SNMP secret is present
  hasHttpCredentials: boolean; // true if both httpUsername and httpPassword are set
}
```

---

### `PUT /api/devices/:id/credentials` — Set Credentials

**Status:** 200 | 400 | 403 | 404  
**Roles:** ADMIN (`manage-credentials`)

Upserts the credentials for the device. A device needs **an HTTP login, SNMP access, or both**: AirOS radios are read over HTTP, Mimosa radios over SNMP only.

Every field is optional on its own: an omitted field keeps whatever is stored, and only an explicit `null` clears it. So a form that edits only the HTTP login never wipes the SNMP keys, and vice versa.

```ts
// Request body
{
  // HTTP / web-UI login — send both, null both to clear, or omit both to keep
  httpUsername?: string | null
  httpPassword?: string | null
  httpPort?: number   // 1–65535; omit to keep the stored value (default 443)
  sshPort?: number    // 1–65535; omit to keep the stored value (default 22).
                      // RouterOS backups log in on it with httpUsername/httpPassword.
  apiPort?: number    // 1–65535; omit to keep the stored value (default 8728).
                      // Live router traffic reads the RouterOS API on it with
                      // httpUsername/httpPassword (since 2026-10-14).

  // SNMP — Mimosa is polled with these.
  // Omit to keep the stored value; send null to clear it.
  snmpVersion?: 1 | 2 | 3        // required as soon as any SNMP field is sent

  // SNMP v1/v2 fields
  snmpCommunity?: string | null  // required when snmpVersion = 1 or 2

  // SNMP v3 fields
  snmpV3AuthUser?: string | null   // required when snmpVersion = 3
  snmpV3AuthProto?: 'MD5' | 'SHA' | null  // required when snmpVersion = 3
  snmpV3AuthKey?: string | null    // required when snmpVersion = 3
  snmpV3PrivProto?: 'DES' | 'AES' | null  // optional privacy protocol
  snmpV3PrivKey?: string | null    // required when snmpV3PrivProto is set

  snmpPort?: number   // 1–65535; default 161
}

// Response — DeviceCredentialsResponseDTO (raw, no wrapper)
```

**Business rules:**

- After merging with what is stored, the device must have a complete HTTP login or complete SNMP access, or the call fails with `400 { error: 'An HTTP login or SNMP access is required' }` and nothing is saved.
- `httpUsername` and `httpPassword` go together: both sent (neither blank), both `null`, or both omitted — otherwise `400 { error: 'httpUsername and httpPassword must be set together' }`.
- SNMP validation runs only when the request carries an SNMP field:
  - `snmpVersion` is required as soon as any other SNMP field is sent.
  - `snmpVersion = 1` or `2` → `snmpCommunity` is required.
  - `snmpVersion = 3` → `snmpV3AuthUser`, `snmpV3AuthProto`, and `snmpV3AuthKey` are required.
  - `snmpV3PrivKey` is required when `snmpV3PrivProto` is provided.
- Port values must be in range 1–65535.
- Returns 404 if the device does not exist.

---

### `GET /api/devices/:id/credentials` — Get Credentials

**Status:** 200 | 404  
**Roles:** ADMIN, OPERATOR, VIEWER (`read` — the response is masked)

```ts
// Response — DeviceCredentialsResponseDTO (raw, no wrapper)
```

> Returns 404 with `{ error: 'No credentials configured for this device' }` if no credentials have been saved yet.

---

### `POST /api/devices/:id/credentials/reveal` — Reveal Credentials

**Status:** 200 | 400 | 401 | 403 | 404  
**Roles:** ADMIN, OPERATOR (`reveal-credentials`) — never VIEWER

Returns the stored credentials with every secret in plaintext. The user must
first unlock with their password; the unlock lasts **5 minutes** and works for
any device in that time (DEV-134, IDN-086).

```ts
// Headers
X-Credential-Reveal-Token: string // revealToken from POST /api/users/me/credential-reveal

// No request body

// Response (raw, no wrapper), sent with Cache-Control: no-store
interface RevealedDeviceCredentialsDTO {
  deviceId: string;
  snmpVersion: 1 | 2 | 3;
  snmpCommunity: string | null;
  snmpV3AuthUser: string | null;
  snmpV3AuthProto: 'MD5' | 'SHA' | null;
  snmpV3AuthKey: string | null;
  snmpV3PrivProto: 'DES' | 'AES' | null;
  snmpV3PrivKey: string | null;
  snmpPort: number;
  httpUsername: string | null;
  httpPassword: string | null;
  httpPort: number;
  sshPort: number;
  apiPort: number;
}
```

> **Flow for the frontend:** on "show password", if no unlock is held or it has
> expired, ask for the user's password, call `POST /api/users/me/credential-reveal`,
> keep `revealToken` in memory only (never `localStorage`) for
> `expiresInSeconds`, then call this endpoint with the header. Hide the
> plaintext again when the unlock expires.
>
> `403 { success: false, error: 'Enter your password to see device credentials' }`
> — no unlock, an expired one, another user's, or the account's sessions ended
> since (password or role change). Ask for the password again.
> `403 { success: false, error: 'Forbidden' }` — the role lacks
> `reveal-credentials` (VIEWER); hide the "show" button for that role.
> `404 { error: 'No credentials configured for this device' }`.
>
> Every reveal is logged with the user and the device (DEV-135).

---

### `DELETE /api/devices/:id/credentials` — Delete Credentials

**Status:** 204 | 403 | 404  
**Roles:** ADMIN (`manage-credentials`)

```ts
// No request body
// Response: 204 No Content
```

> Removes all stored credentials for the device. Returns 404 if the device does not exist.

---

## Device Backups `/api/devices/:id/backups`

> **Response envelope:** raw data directly — **no `{ success, data }` wrapper**.
> Error: `{ error: string }`.

> **⚠ Breaking change (2026-10-26): one copy per device, no comparison, no
> change alert.** Only the latest configuration of a device is kept (BKP-030),
> so `backups` holds at most one entry; `GET /api/devices/:id/backups/diff` is
> gone (BKP-070, now 404), and so is the `config_changed` notification
> (BKP-060) — drop it from the mutable alert types. Customers' devices are no
> longer backed up; company **stations** now are (BKP-010).

Daily configuration backup of the company's own devices. A run starts from
03:00 Colombian time and backs up every device whose `owner` is `COMPANY`,
`ACTIVE` or `COMMISSIONING`, that is an **antenna** — a device wireless
monitoring polls as an access point or a station (enabled config) or, with no
polling config, whose category is `ACCESS_POINT` or `WIRELESS_CPE` — or whose
model is a **routerboard** or **switch**. A customer's device, a device with
no owner, and a model of type `ROUTER` (a Wi-Fi router) are never backed up
(BKP-010). A changed configuration replaces the device's copy; otherwise the
copy's `lastCheckedAt` moves forward. An AirOS file's write time and checksum
lines don't count as a change (BKP-056).

Supported for now: Ubiquiti AirOS antennas, APs and stations (HTTPS, `system.cfg`) and any
MikroTik (SSH `/export show-sensitive`, on the credentials' `sshPort` with the
HTTP username and password, BKP-054/055). On site this server reads every
device itself. Off site (`serverOnSite: false`) a device with an `agentId` is
read by its agent, which must run agent `0.5.0` or later, with the same
fetchers; a device behind no agent is left out of the nightly run and a
manual backup of it answers 409 (BKP-015, BKP-016, AGT-113, AGT-114).

**Alert** (Telegram, through the same publisher as device alerts, so quiet
hours and an expired subscription hold it back):

- `backup_failing` — the third failed attempt in a row, once per streak
  (BKP-061). Not sent for a device left out because backing it up is not
  available yet (not a company antenna, routerboard or switch, out of reach,
  unsupported vendor, an agent older than `0.5.0`); a missing IP address or
  login, an agent that is offline or does not answer, does count (BKP-063,
  BKP-016).

It can be muted for the whole install through `PUT /api/notification-mutes`.
It is a notification only; it does not appear in `GET /api/alerts`.

```ts
interface ConfigBackupDTO {
  id: string; // UUID
  deviceId: string; // UUID
  format: 'AIROS_CFG' | 'ROUTEROS_EXPORT';
  sizeBytes: number;
  trigger: 'SCHEDULED' | 'MANUAL';
  takenAt: string; // ISO 8601 — when this configuration was first saved
  lastCheckedAt: string; // ISO 8601 — last time the device still held it
}

interface DeviceBackupStateDTO {
  lastAttemptAt: string | null;
  lastOutcome: 'SAVED' | 'UNCHANGED' | 'FAILED' | null;
  lastError: string | null; // only while the last attempt failed
  lastSuccessAt: string | null;
  failingSince: string | null; // first failure of the current streak
  consecutiveFailures: number;
}
```

---

### `GET /api/devices/:id/backups` — The kept copy and the latest attempt

**Status:** 200 | 400 | 404
**Roles:** ADMIN, OPERATOR, VIEWER (`read`)

```ts
// Response
{
  deviceId: string
  state: DeviceBackupStateDTO | null  // null: never attempted
  backups: ConfigBackupDTO[]          // the kept copy, or []; never includes the file
}
```

---

### `POST /api/devices/:id/backups` — Back up now

**Status:** 201 | 200 | 400 | 403 | 404 | 409 | 502
**Roles:** ADMIN, OPERATOR (`update`)

```ts
// No request body
// Response
{
  outcome: 'SAVED' | 'UNCHANGED';
  backup: ConfigBackupDTO;
}
```

- **201** — the configuration changed (or was the first) and replaced the copy; **200** — the device still holds the kept one.
- **409** `Cannot back up this device: …` — the device was not asked: not a
  company antenna, routerboard or switch (`Only company antennas, routerboards
and switches are backed up for now`), off site and behind no agent, no IP
  address, no HTTP credentials, no backup support yet for this kind of device
  from its vendor (a Ubiquiti switch, for one), or its agent must be updated
  first (`The on-site agent must be updated to take backups`).
- **502** `Backup failed: …` — the device was asked and did not hand over its
  configuration (timeout, login refused, …), or its agent is not connected
  (`The on-site agent is not connected`) or did not answer within 45 s
  (`The on-site agent did not answer in time`). Through an agent this can
  take longer than the 30 s HTTP proxy allows for a large router; the attempt
  is still recorded, so reload the list if the request times out.

Every attempt, refused or failed included, updates the device's `state`.

---

### `GET /api/devices/:id/backups/:backupId/download` — Download the copy

**Status:** 200 | 400 | 403 | 404
**Roles:** ADMIN (`manage-credentials`)

Responds with the file exactly as the device sent it, not JSON: an AirOS
`system.cfg` (`.cfg`, which the device's own _Upload configuration_ takes
back) or a RouterOS export (`.rsc`, for `/import`):

```
Content-Type: text/plain; charset=utf-8
Content-Disposition: attachment; filename="<device-name>-<YYYYMMDD-HHmm>Z.cfg|.rsc"
Cache-Control: no-store
```

The file holds the device's passwords and wireless keys. Returns 404
`Backup not found` when the backup does not exist or belongs to another device.

---

## Power Control `/api/locations/:id/poe-ports`, `/api/devices/:id/power-source`

> **Response envelope:** raw data directly — **no `{ success, data }` wrapper**.
> Error: `{ error: string }`. Both responses carry `Cache-Control: no-store`.

Phase 1 of storm power control: **read only**. Nothing is stored, and nothing
on a switch is changed. Each request reads the switches live (10 s timeout per
switch, all at once). Off/on, timers and "turn off all at a site" come later.

A **PoE switch** is a device whose model has `poeSwitchOs` set, `ACTIVE` or
`COMMISSIONING`, at the location (PWR-001, PWR-010). It is read with its saved
device credentials' HTTP username and password: RouterOS on `apiPort`, SwOS
over plain HTTP on `httpPort`, where the 443 default means port 80 (PWR-012).
On site this server reads every switch. Off site none is read yet; a switch
behind an agent is listed with the reason (PWR-013).

Each port's **label** names the antenna it powers by that antenna's IP: the
first valid IPv4 in it (PWR-030). On RouterOS the label is the interface
comment, or the name when only the name holds an IP; on SwOS the port name.

```ts
type PoeMode = 'OFF' | 'AUTO' | 'FORCED_ON' | 'UNKNOWN';
type PoeStatus = 'POWERED' | 'NO_LOAD' | 'OFF' | 'FAULT' | 'UNKNOWN';

// MATCHED: a device holds the IP and is at this site
// MATCHED_OTHER_LOCATION: it is recorded at another site (or none) — fix one
// UNMATCHED: no IP in the label, or no device holds it
// DUPLICATE: the same IP is on more than one port at the site — fix the labels
type PoePortMatchKind =
  | 'MATCHED'
  | 'MATCHED_OTHER_LOCATION'
  | 'UNMATCHED'
  | 'DUPLICATE';

interface PoePortDTO {
  port: string; // "ether2" (RouterOS), "Port2" (SwOS)
  label: string; // as read from the switch
  mode: PoeMode; // what the port is set to
  status: PoeStatus; // what it is doing now
  powerWatts: number | null;
  voltage: number | null;
  match: {
    kind: PoePortMatchKind;
    ip: string | null; // the IP read from the label
    deviceId: string | null; // set for MATCHED and MATCHED_OTHER_LOCATION
    deviceName: string | null;
    deviceLocationName: string | null;
  };
}

interface PoeSwitchDTO {
  deviceId: string;
  name: string;
  ipAddress: string | null;
  firmware: 'ROUTEROS' | 'SWOS';
  firmwareVersion: string | null; // "6.49.10 (long-term)", "2.13"
  readable: boolean; // false: not tried, see reason
  reason: string | null; // why it was not tried (no IP, no login, off site)
  error: string | null; // tried and failed; ports is then empty
  ports: PoePortDTO[]; // PoE-out ports only, no PoE-in or SFP
}
```

---

### `GET /api/locations/:id/poe-ports` — PoE ports at a site

**Status:** 200 | 400 | 401 | 404
**Roles:** ADMIN, OPERATOR, VIEWER (`read`)

```ts
// Response
{
  locationId: string
  locationName: string
  switches: PoeSwitchDTO[]  // by name; [] when the site has none
}
```

One switch failing does not fail the request: it is listed with its `error`
and the others are shown (PWR-014).

---

### `GET /api/devices/:id/power-source` — Which port powers this device

**Status:** 200 | 400 | 401 | 404
**Roles:** ADMIN, OPERATOR, VIEWER (`read`)

Looks at the PoE switches at the device's own location only (PWR-041).

```ts
// Response
{
  deviceId: string;
  // FOUND: exactly one port · DUPLICATE: more than one, all in sources
  // NONE: every switch at the site was read and none names it
  // UNKNOWN: none found, but a switch in unreadSwitches could not be read
  kind: 'FOUND' | 'DUPLICATE' | 'NONE' | 'UNKNOWN';
  reason: string | null; // why NONE / UNKNOWN / DUPLICATE; null when FOUND
  sources: {
    switchDeviceId: string;
    switchName: string;
    port: string;
    mode: PoeMode;
    status: PoeStatus;
    powerWatts: number | null;
  }
  [];
  unreadSwitches: {
    deviceId: string;
    name: string;
    reason: string;
  }
  [];
}
```

`NONE` reasons: `The device has no IP address`,
`The device has no location, so no switch is looked at`,
`There is no PoE switch at the device location`,
`No PoE port at the device location is labelled with its IP`.

---

## Vendors `/api/vendors`

### `POST /api/vendors` — Create

**Status:** 201 | 400 | 409

```ts
// Request body
{
  name: string              // required, 1–100 chars
  slug: string              // required, 1–100 chars, lowercase letters/digits/hyphens only (e.g. "tp-link")
  description?: string | null  // max 500 chars
}

// Response
{ success: true, data: VendorDTO }
```

> Returns 409 if a vendor with the same slug **or the same name** already
> exists. Name comparison is case-insensitive — `Ubiquiti` and `ubiquiti`
> collide as the same name (their slugs would also collide, since slugs are
> lowercase by construction).

---

### `GET /api/vendors` — List

**Status:** 200

```ts
// Query params (all optional)
limit?:  number  // 1–100, default 20
offset?: number  // ≥0, default 0

// Response
{
  success: true,
  data: {
    vendors: VendorDTO[]
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

---

### `GET /api/vendors/:id` — Get by ID

**Status:** 200 | 404

```ts
// Response
{ success: true, data: VendorDTO }
```

---

### `PUT /api/vendors/:id` — Update

**Status:** 200 | 400 | 404 | 409

```ts
// Request body (at least one field required)
{
  name?: string
  slug?: string
  description?: string | null
}

// Response
{ success: true, data: VendorDTO }
```

> Returns 409 if the new slug or the new name is already taken by another
> vendor. Name comparison is case-insensitive, same as create. Submitting the
> vendor's own slug or name is not a conflict — including "renaming" to a
> different case of its own current name (e.g. `Mimosa` → `mimosa`).

---

### `DELETE /api/vendors/:id` — Delete

**Status:** 204 | 404 | 409

```ts
// No request body
// Response: 204 No Content
```

> Returns 409 if the vendor has associated device models. Remove all device models first.

---

## Device Models `/api/device-models`

### `POST /api/device-models` — Create

**Status:** 201 | 400 | 409

```ts
// Request body
{
  vendorId: string    // required, UUID
  model: string       // required, 1–150 chars
  deviceType: DeviceType  // required
  isWireless?: boolean    // default false
  poeSwitchOs?: 'ROUTEROS' | 'SWOS' | null  // default null (DEV-031)
}

// Response
{ success: true, data: DeviceModelDTO }
```

> Returns 409 if a model with the same name already exists for that vendor.
> Name comparison is case-insensitive and scoped to the vendor — `hAP ac3` and
> `HAP AC3` collide for the same vendor, but two different vendors may each
> have a model called "AC Lite" regardless of casing.
> `isWireless` marks the hardware as radio-capable; devices built on a model
> with `isWireless: false` are refused a wireless config. Getting it wrong here
> is cheap to fix later — but only until a device on the model is configured,
> see `PUT /api/device-models/:id`.
> `poeSwitchOs` marks a PoE-out switch model and the firmware it runs (hEX PoE
> → `ROUTEROS`, CSS106 → `SWOS`). Devices on such a model appear under
> `GET /api/locations/:id/poe-ports`. Any other value answers 400.

---

### `GET /api/device-models` — List

**Status:** 200

```ts
// Query params (all optional)
limit?:  number  // 1–100, default 20
offset?: number  // ≥0, default 0

// Response
{
  success: true,
  data: {
    deviceModels: DeviceModelDTO[]
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

---

### `GET /api/device-models/:id` — Get by ID

**Status:** 200 | 404

```ts
// Response
{ success: true, data: DeviceModelDTO }
```

---

### `PUT /api/device-models/:id` — Update

**Status:** 200 | 400 | 404 | 409

```ts
// Request body (at least one field required)
{
  vendorId?: string    // UUID
  model?: string       // 1–150 chars
  deviceType?: DeviceType
  isWireless?: boolean
  poeSwitchOs?: 'ROUTEROS' | 'SWOS' | null  // null clears it
}

// Response
{ success: true, data: DeviceModelDTO }
```

> Returns 409 if the resulting (vendor, model name) pair is already taken by
> a different device model — this applies whether `model` changes, `vendorId`
> changes, or both, so moving a model to a vendor that already has one with
> the same name is also rejected. Name comparison is case-insensitive and
> scoped to the vendor. Submitting the model's own name (or the vendor it's
> already on) is not a conflict — including "renaming" to a different case of
> its own current name.

**`isWireless: true → false` — refused while wireless configs exist**

Turning the flag off is blocked while **any** device built on this model still
has a wireless polling config (DEV-027) — those configs hold operator-entered
values (`linkCapacityKbps` / `clientsProvisionedLimit`) that a non-wireless
model has nowhere to keep, so they are never deleted for you:

- One or more devices on the model have a config → `409`
  `"Cannot mark device model as non-wireless: N device(s) built on it have a wireless config. Delete those wireless configs first."`
- Devices on the model with **no** config do not block it — the check is about
  configs, not devices, and not about their `category`.
- The refusal is all-or-nothing: no other field of the same request is applied,
  and the model stays wireless.
- Resubmitting the value the model already has is a no-op and always succeeds.

To make the model non-wireless, `DELETE /api/devices/:id/wireless/config` on
each listed device first, then send `isWireless: false`.

> The reverse (`false → true`) checks nothing and creates nothing — each config
> is created through `POST /api/devices/:id/wireless/config`.
>
> **Frontend:** the `N` in the message is the number of configs to clear. On a
> `409`, list the model's devices (`GET /api/devices?deviceModelId=…`) and point
> the operator at their wireless config screens rather than retrying.
>
> **Note:** devices already categorised `WIRELESS_CPE` / `ACCESS_POINT` keep that
> category when a model is made non-wireless. That combination is inert and
> legal — no config can be created for it — so don't treat it as an error state
> in the UI.

---

### `DELETE /api/device-models/:id` — Delete

**Status:** 204 | 400 | 404 | 409

```ts
// Query (optional)
?purgeBinnedDevices=true

// No request body
// Response: 204 No Content
```

**Query parameters**

| Param                | Type                | Default | Meaning                                                                   |
| -------------------- | ------------------- | ------- | ------------------------------------------------------------------------- |
| `purgeBinnedDevices` | `'true' \| 'false'` | `false` | Permanently delete the model's soft-deleted devices along with the model. |

**Business rules:** DEV-026, DEV-029, DEV-030.

> Returns 409 if **live** devices are assigned to this model. Reassign or remove those devices first.

**Two-step confirmation for deleted devices.** Soft-deleted devices (see
`DELETE /api/devices/:id`) still belong to the model even though they no longer
appear in any listing. Deleting a model whose only remaining devices are in the
recycle bin returns 409:

```
Cannot delete device model: it has 2 device(s) in the recycle bin.
Retry with purgeBinnedDevices=true to remove them permanently along with the model.
```

Show a confirmation dialog, then repeat the same request with
`?purgeBinnedDevices=true`. That permanently destroys those devices and all
their history — pings, alerts, snapshots, credentials, configs — and their
7-day restore window with it. To list exactly what would be destroyed before
asking, call `GET /api/devices?deleted=true&deviceModelId=<id>`.

The flag never overrides the live-device rule: a model with a live device is
still 409 with the "Reassign or remove" message, and nothing is purged.

The alternative is to wait — once the grace period expires and the scheduled
purge removes those devices, the plain delete succeeds with no flag.

---

## Polling `/api/devices/:id/polling/*`

> **Response envelope:** Polling endpoints return **raw data** — no `{ success, data }` wrapper.  
> Error: `{ error: string }`.

### `POST /api/devices/:id/poll` — Trigger Manual Poll

**Status:** 200 | 404 | 409

```ts
// No request body needed

// Response
{
  deviceId: string
  status: PollingStatus
  message: string
  timestamp: string           // ISO 8601
  metrics: { latencyMs: number } | null
  deviceStatus: DeviceOnlineStatus
}
```

> **⚠ Since 2026-08-03: a device whose monitoring is off cannot be polled on
> demand.** It returns `409` `"Monitoring is disabled for device <id> — enable
monitoring before polling it"`. A manual poll would write a real reading over
> the `UNKNOWN` state with nothing scheduled to correct it afterwards, and could
> raise an outage alert for a device nobody is watching.
>
> **Frontend:** disable the "poll now" button when `pollingEnabled` is `false`
> (from `GET /api/devices/:id/polling/status`) rather than letting the call fail;
> on a `409`, offer "enable monitoring" instead of a retry.

> **⚠ Changed 2026-10-01: a device behind an on-site agent (`agentId` set) is
> polled through that agent** (MON-022). The response is the same as for any
> other device, timed when the agent measured it. When the agent gives no
> reading, nothing is recorded and the error starts with
> `"Cannot poll device <id> — "`:
>
> | Status | Error ends with                                            | Show                                  |
> | ------ | ---------------------------------------------------------- | ------------------------------------- |
> | `409`  | `its on-site agent is not connected`                       | "the agent is offline"                |
> | `409`  | `its on-site agent must be updated to poll it on demand`   | "update the agent" (older than 0.3.0) |
> | `504`  | `its on-site agent did not answer in time` (25 s)          | a retry                               |
> | `502`  | `its on-site agent could not poll it: <the agent's error>` | the agent's error                     |
>
> **Frontend:** show "poll now" for agent devices again; it works on an
> install hosted off site too.

> On an install whose server is not on the monitored network
> (`SERVER_ON_SITE=false`), a device **without** an agent returns `409` > `"Cannot poll device <id> — this server is not on the monitored network"`
> (MON-023): such a server pings nothing. Hide "poll now" for devices
> without an agent when `GET /api/installation` says `serverOnSite: false`.

> A device whose status is not polled (e.g. `RETIRED`) also returns `409`,
> `"Cannot poll device <id> — Device is <STATUS> and is not polled"`. A deleted
> or non-existent device returns `404`,
> `"Cannot poll device <id> — the device no longer exists"`. Both returned
> `500` before 2026-09-25.

> **Since 2026-09-25: a manual poll makes at most 3 ping attempts**, whatever
> the device's `failuresBeforeDown` (a lower threshold is kept as is). It
> answers in under about 20 seconds even for an unreachable device, and an
> unreachable device is marked down after those 3 attempts. Scheduled polls
> still use the full threshold.

---

### `GET /api/devices/:id/polling/status` — Current Status

**Status:** 200 | 404

```ts
// Response
{
  deviceId: string
  pollingEnabled: boolean
  intervalSeconds: number
  failuresBeforeDown: number
  lastPolled: string | null          // ISO 8601
  nextScheduled: string | null       // lastPolled + intervalSeconds
  currentStatus: DeviceOnlineStatus
  consecutiveFailures: number
  lastResult: {
    id: string
    deviceId: string
    timestamp: string
    status: 'SUCCESS' | 'FAILED'
    metrics: { latencyMs: number } | null
    deviceStatus: DeviceOnlineStatus
  } | null
}
```

> `currentStatus: 'UNKNOWN'` means **nobody is watching this device** — either it
> has never been polled, or monitoring was turned off (see
> [What "monitoring stopped" does](#stopping-monitoring)). It is not an outage;
> `'OFFLINE'` is. Use `pollingEnabled` to distinguish the two causes. A third
> cause: the device sits behind an on-site agent that is not reporting
> (offline, pending or revoked) — `pollingEnabled` is still `true` and the
> other fields show the last reading the agent took. Show the agent's state
> (`GET /api/agents/:id`) rather than a device outage.
>
> While monitoring is off, `lastPolled` and `nextScheduled` are `null` and
> `consecutiveFailures` is `0`, but `lastResult` still shows the last ping that
> was actually taken — useful for "last checked N days ago" copy.

---

### `GET /api/devices/polling/statuses` — Current Status, Every Device

> **New 2026-10-13.** One request for the dashboard instead of one
> `GET /api/devices/:id/polling/status` per device, which spent the whole
> 100/min read budget on installs with more than ~100 monitored devices.

**Status:** 200 | 401

```ts
// Response — not wrapped, same as the single-device route
Array<{
  /* exactly the GET /api/devices/:id/polling/status shape */
}>;
```

One item per device that has a polling configuration, whether `pollingEnabled`
is `true` or `false`; filter on it client side. Deleted devices are left out.
A device never polled comes back with `lastPolled: null`, `lastResult: null`
and `currentStatus: 'UNKNOWN'`. `currentStatus` follows the same rules as the
single-device route, including `'UNKNOWN'` behind an agent that is not
reporting (MON-006). Unordered: key by `deviceId`. Any role can read it.

**Frontend:** poll this once per refresh and drop the per-device status
calls on the dashboard. Keep the single-device route for the device page.

---

### `GET /api/network/sweep/stream` — Network Sweep (SSE)

**Status:** 200 (`text/event-stream`) | 400 | 401 | 403 | 409 | 500  
**Roles:** `VENDOR`, `ADMIN`, `OPERATOR` (`create`, same as a manual poll) · **Since:** 2026-10-17 · **Updated:** 2026-10-17 (devices behind an agent are swept through it; `BEHIND_AGENT` removed, `agentName` added)

Pings every in-service device **once, now**, and streams what answered, device
by device. It's the "what is up after the outage?" button (MON-080 … MON-084).

- **It changes nothing.** No ping history, no device status, no alert. A device
  the sweep finds `DOWN` still shows `ONLINE` in
  `GET /api/devices/polling/statuses` until the scheduler says otherwise.
  Show sweep results as a separate, timestamped snapshot ("Barrido 14:32"),
  never merged into the live status. Nothing is stored server side: cache the
  last sweep in the browser if you want to show it again.
- **Which devices:** status `ACTIVE` or `COMMISSIONING`, not in the recycle
  bin. Stock and retired units aren't listed at all.
- **How fast:** up to 3 pings per device, 1 s each, stopping at the first reply;
  64 devices at a time. A few seconds for a few hundred mostly-live devices,
  up to about 30 s when most are dead. Results arrive as they come, backbone
  first (gateways, aggregation switches, access points, then the rest).
- **Devices behind an on-site agent** are pinged by that agent the same way,
  in batches of 32, so their results arrive in bursts of up to 32 at once. Each
  result has an `agentName`. If the agent is offline or too old (before
  `0.7.0`), its devices come back as `ERROR` with the reason in `detail`, never
  as `DOWN`.
- **One at a time per install.** A second request while one runs gets `409`.
  Closing the stream (`es.close()`) stops the sweep.
- `GET` because EventSource can only GET. Same authentication as the other
  streams: the session cookie (`new EventSource(url, { withCredentials: true })`),
  `?token=` or a Bearer header. It isn't counted against the
  5-streams-per-user cap.

**Query params** (all optional, combinable)

| Param        | Type             | Meaning                                                                                             |
| ------------ | ---------------- | --------------------------------------------------------------------------------------------------- |
| `token`      | string           | The JWT, for EventSource                                                                            |
| `locationId` | UUID             | Only devices at this location                                                                       |
| `category`   | `DeviceCategory` | Only this category: `CPE`, `WIRELESS_CPE`, `ACCESS_POINT`, `GATEWAY`, `AGGREGATION_SWITCH`, `OTHER` |

**Events**, in this order. Unlike the other streams, **this one ends by
itself**: after `sweep-done` the server closes it. Call `es.close()` on
`sweep-done`, or EventSource reconnects and starts a new sweep.

| Order          | Event          | Payload                  |
| -------------- | -------------- | ------------------------ |
| First          | `sweep-start`  | `NetworkSweepStartDTO`   |
| One per device | `sweep-result` | `NetworkSweepResultDTO`  |
| Last           | `sweep-done`   | `NetworkSweepSummaryDTO` |

```ts
type NetworkSweepOutcome = 'UP' | 'DOWN' | 'ERROR' | 'SKIPPED';

type NetworkSweepSkipReason =
  | 'MONITORING_DISABLED' // monitoring is off for the device
  | 'NO_IP_ADDRESS' // no IP in its polling configuration
  | 'NOT_ON_MONITORED_NETWORK'; // server hosted off site, device has no agent

interface NetworkSweepStartDTO {
  startedAt: string; // ISO 8601
  total: number; // every device that will get a sweep-result, skipped ones included
  toPing: number; // how many of them are actually pinged — use for the progress bar
  filters: { locationId?: string; category?: string };
}

interface NetworkSweepResultDTO {
  deviceId: string;
  deviceName: string;
  ipAddress: string | null;
  category: DeviceCategory | null;
  locationId: string | null;
  locationName: string | null;
  agentName: string | null; // the on-site agent that pinged it; null when the server did
  outcome: NetworkSweepOutcome;
  latencyMs: number | null; // UP only
  attempts: number; // pings sent: 1–3; 0 when skipped
  reason: NetworkSweepSkipReason | null; // SKIPPED only
  detail: string | null; // human-readable reason (SKIPPED) or why it could not be pinged (ERROR)
  at: string; // ISO 8601, when this device's answer came in
}

interface NetworkSweepSummaryDTO {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  total: number;
  up: number;
  down: number;
  error: number; // could not be pinged (ping program failed, agent offline/outdated/timed out) — not a dead device
  skipped: number;
  cancelled: false; // always false on the wire: a stopped sweep sends no sweep-done
}
```

```js
const params = new URLSearchParams({ token: jwt });
if (locationId) params.set('locationId', locationId);
const es = new EventSource(`/api/network/sweep/stream?${params}`);
const results = new Map();

es.addEventListener('sweep-start', (e) => {
  const { total, toPing } = JSON.parse(e.data); // size the progress bar
});
es.addEventListener('sweep-result', (e) => {
  const r = JSON.parse(e.data);
  results.set(r.deviceId, r);
});
es.addEventListener('sweep-done', (e) => {
  es.close(); // required — otherwise EventSource reconnects and sweeps again
  const summary = JSON.parse(e.data);
});
es.onerror = () => es.close(); // a refusal (409, 403, …) comes as JSON, which EventSource reports as an error
```

Skipped devices arrive right after `sweep-start`, before any pinged one.
Errors before the stream opens come as JSON with a status code, not as
events:

| Status | `error`                                     | Show                                        |
| ------ | ------------------------------------------- | ------------------------------------------- |
| `409`  | `A network sweep is already running`        | "a sweep is already running", retry shortly |
| `400`  | `category must be one of: …` / invalid UUID | a bug in the filter UI                      |
| `403`  | (VIEWER)                                    | hide the button for viewers                 |
| `500`  | `Failed to load the devices to sweep: …`    | a retry                                     |

`detail` values on `ERROR` results from devices behind an agent:

| `detail`                                         | Show                                    |
| ------------------------------------------------ | --------------------------------------- |
| `The agent is not connected`                     | "agent {agentName} offline": group them |
| `The agent must be updated to sweep the network` | "update agent {agentName}"              |
| `The agent did not answer in time`               | "agent {agentName} did not answer"      |
| anything else                                    | the text as is                          |

EventSource doesn't expose the status code. To show the `409` message, check
for it with a `fetch` to the same URL (Bearer header) when `onerror` fires
before `sweep-start`, or just say "the sweep could not start, try again in a
moment".

**Frontend:** a "Barrer red" button for operators and admins, with
optional location and category filters. While it runs, show progress
(`results.size` of `total`) and a live list sorted DOWN first. Show `ERROR`
devices as "unknown", not as down. When many share an `agentName` and
`detail`, collapse them into one line ("Agent Torre Norte offline — 120
devices not checked"): after an outage, a dead agent is the news.

---

### `GET /api/network/ping/stream` — Ping Tool (SSE)

**Status:** 200 (`text/event-stream`) | 400 | 401 | 403 | 404 | 409 | 500  
**Roles:** `VENDOR`, `ADMIN`, `OPERATOR` (`create`, same as a manual poll) · **Since:** 2026-10-27

Pings **any IP address** now, once a second, from the server or from an
agent, and streams each answer like a terminal's `ping` (MON-120 … MON-123).

- **Any address**, device or not: a customer's router, the provider's
  gateway, `8.8.8.8`. IPv4 or IPv6 only, no host names.
- **It changes nothing and nothing is stored.** No ping history, no device
  status, no alert.
- **From where:** without `agentId`, the server pings (2 s wait per reply).
  With `agentId`, that agent pings (5 s wait), so the result is what the
  agent's network sees. List agents with `GET /api/agents`. On an install
  hosted off site (`serverOnSite: false`) an agent is required: preselect one
  and hide the "server" option.
- **Agent problems:** if the agent is offline or too old, the first ping
  comes back `ERROR` with the reason, and the run ends (`stoppedEarly` in
  `ping-done`). A single slow agent answer is an `ERROR` for that ping only.
- **How many:** `count` pings, 4 by default, at most 100. Closing the stream
  (`es.close()`) stops it, so a "Stop" button can let the user ping up to 100
  and stop whenever they like.
- At most 10 runs at once across the install (`409`).
- Same authentication as the other streams: the session cookie, `?token=` or a
  Bearer header.

**Query params**

| Param     | Type             | Meaning                            |
| --------- | ---------------- | ---------------------------------- |
| `ip`      | IPv4/IPv6        | **Required.** The address to ping  |
| `agentId` | UUID             | Ping from this agent; omit: server |
| `count`   | integer, 1 – 100 | How many pings (default 4)         |
| `token`   | string           | The JWT, for EventSource           |

**Events**, in this order. **This stream ends by itself**: call `es.close()`
on `ping-done`, or EventSource reconnects and pings again.

| Order        | Event        | Payload              |
| ------------ | ------------ | -------------------- |
| First        | `ping-start` | `PingToolStartDTO`   |
| One per ping | `ping-reply` | `PingToolReplyDTO`   |
| Last         | `ping-done`  | `PingToolSummaryDTO` |

```ts
type PingToolOutcome = 'REPLY' | 'NO_REPLY' | 'ERROR';

interface PingToolStartDTO {
  ipAddress: string;
  source: 'SERVER' | 'AGENT';
  agentId: string | null;
  agentName: string | null;
  count: number;
  startedAt: string; // ISO 8601
}

interface PingToolReplyDTO {
  seq: number; // 1-based
  outcome: PingToolOutcome; // ERROR: the ping could not be sent — not a lost packet
  latencyMs: number | null; // REPLY only
  detail: string | null; // ERROR only, e.g. "The agent is not connected"
  at: string;
}

interface PingToolSummaryDTO {
  ipAddress: string;
  sent: number; // ERROR pings are not counted
  received: number;
  errors: number;
  lossPercent: number | null; // null when nothing could be sent
  minMs: number | null;
  avgMs: number | null;
  maxMs: number | null;
  startedAt: string;
  finishedAt: string;
  stoppedEarly: string | null; // why an agent problem ended the run early
  cancelled: false; // always false on the wire: a stopped run sends no ping-done
}
```

```js
const params = new URLSearchParams({ token: jwt, ip, count: '10' });
if (agentId) params.set('agentId', agentId);
const es = new EventSource(`/api/network/ping/stream?${params}`);
es.addEventListener('ping-reply', (e) => {
  const r = JSON.parse(e.data);
  // "Respuesta de 10.0.0.1: tiempo=7 ms" / "Tiempo agotado" / r.detail
});
es.addEventListener('ping-done', (e) => {
  es.close(); // required — otherwise EventSource reconnects and pings again
  const s = JSON.parse(e.data);
});
es.onerror = () => es.close(); // a refusal (400, 404, 409) comes as JSON, which EventSource reports as an error
```

Errors before the stream opens come as JSON with a status code:

| Status | `error`                                                                 | Show                       |
| ------ | ----------------------------------------------------------------------- | -------------------------- |
| `400`  | `ip must be a valid IPv4 or IPv6 address` / count / agentId messages    | under the field            |
| `404`  | `Agent not found`                                                       | refresh the agent list     |
| `409`  | `This server is not on the ISP's network: choose an agent to ping from` | ask for an agent           |
| `409`  | `Too many pings are running, try again in a moment`                     | the message, retry shortly |
| `403`  | (VIEWER)                                                                | hide the tool for viewers  |

**Frontend:** a "Ping" tool: an IP field, a "from" picker (Servidor + the
active agents), a count, Start/Stop. Print lines as they arrive, terminal
style, and the totals at the end. Offer it from a device's page too, with its
IP and agent filled in.

---

### `GET /api/network/speed-test/stream` — Internet Speed Test (SSE)

**Status:** 200 (`text/event-stream`) | 401 | 403 | 409 | 500  
**Roles:** `VENDOR`, `ADMIN`, `OPERATOR` (`create`) · **Since:** 2026-10-27

Measures **the server's own internet connection, now**, the way
speed.cloudflare.com does: latency and jitter, then download, then upload,
streaming the speed every second. The result is kept, and appears in
`GET /api/network/speed-tests` (MON-100 … MON-104).

- **What it measures:** the ISP's upstream link as seen from its on-site
  server, against the nearest Cloudflare data center (`serverLocation`, e.g.
  `BOG`). It says nothing about a customer's link.
- **How long:** about 25 s. Latency takes ~1 s (10 samples), then 10 s of
  download and 10 s of upload, 4 connections each. The first 2 s of each are
  left out of its result.
- **It uses the line.** At full speed it moves several hundred MB. Don't run
  it on a schedule or from a page load; only from a button.
- **One at a time per install** (`409`). Closing the stream (`es.close()`)
  stops the test, and a stopped test is **not** kept.
- **Server hosted off site** (`SERVER_ON_SITE=false`): always `409`; the test
  would measure the cloud server, not the ISP. Hide the button there — the
  same `serverOnSite` flag the other on-site-only buttons use.
- Same authentication as the other streams: the session cookie,
  `?token=` or a Bearer header.

**Query params:** `token` (optional, the JWT, for EventSource).

**Events**, in this order. **This stream ends by itself**: call
`es.close()` on `speed-test-done`, or EventSource reconnects and runs a new
test.

| Order                       | Event                 | Payload                |
| --------------------------- | --------------------- | ---------------------- |
| First                       | `speed-test-start`    | `SpeedTestStartDTO`    |
| Per latency sample / second | `speed-test-progress` | `SpeedTestProgressDTO` |
| Last                        | `speed-test-done`     | `SpeedTestResultDTO`   |

```ts
type SpeedTestPhase = 'LATENCY' | 'DOWNLOAD' | 'UPLOAD';

interface SpeedTestStartDTO {
  startedAt: string; // ISO 8601
  latencySamples: number; // 10
  downloadSeconds: number; // 10
  uploadSeconds: number; // 10
}

interface SpeedTestProgressDTO {
  phase: SpeedTestPhase;
  elapsedMs: number; // since this phase began
  mbps: number | null; // DOWNLOAD/UPLOAD: speed over the last second
  latencyMs: number | null; // LATENCY: this sample
}

interface SpeedTestResultDTO {
  id: string;
  status: 'COMPLETED' | 'FAILED';
  downloadMbps: number | null; // null when the test failed before measuring it
  uploadMbps: number | null;
  latencyMs: number | null; // median of the samples
  jitterMs: number | null;
  serverLocation: string | null; // Cloudflare data center code, e.g. "BOG", "MIA"
  error: string | null; // FAILED only, e.g. "Upload failed: the server answered 503" or "Download failed: Cloudflare is limiting tests from this connection, try again in 59 min"
  startedByEmail: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}
```

A test that fails part-way still ends with `speed-test-done`: `status:
'FAILED'`, the measures taken before the failure, and `error`. Show what is
there and the error.

```js
const es = new EventSource(
  `/api/network/speed-test/stream?token=${encodeURIComponent(jwt)}`
);
es.addEventListener('speed-test-start', (e) => {
  const plan = JSON.parse(e.data); // size the gauges / progress bar
});
es.addEventListener('speed-test-progress', (e) => {
  const p = JSON.parse(e.data); // move the gauge for p.phase
});
es.addEventListener('speed-test-done', (e) => {
  es.close(); // required — otherwise EventSource reconnects and tests again
  const result = JSON.parse(e.data);
});
es.onerror = () => es.close(); // a refusal (409, 403) comes as JSON, which EventSource reports as an error
```

Errors before the stream opens come as JSON with a status code:

| Status | `error`                                                                           | Show                                     |
| ------ | --------------------------------------------------------------------------------- | ---------------------------------------- |
| `409`  | `A speed test is already running`                                                 | "a test is already running", retry later |
| `409`  | `This server is not on the ISP's network, so its speed test would not measure it` | hide the button                          |
| `403`  | (VIEWER)                                                                          | hide the button for viewers              |

**Frontend:** a "Test de velocidad" button for operators and admins, with
three numbers (download, upload, latency) that fill in live like a
speed-test site, and the history table below it.

---

### `GET /api/network/speed-tests` — Speed Test History

**Status:** 200 | 400 | 401  
**Roles:** all (`read`) · **Since:** 2026-10-27

Every kept speed test, **newest first**, failed ones included (MON-103).

**Query params:** `limit` (1–100, default 20), `offset` (default 0).

```ts
// data
interface SpeedTestListResponseDTO {
  results: SpeedTestResultDTO[]; // see the stream above
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
```

**Frontend:** a table under the button (date, download, upload, latency,
location, who ran it); show `FAILED` rows with their `error`. Re-fetch after
`speed-test-done`, or prepend the result it carries.

---

### `GET /api/devices/:id/polling/history` — History + Stats

> For a device behind an on-site agent, history can fill in **after the fact**:
> when an agent reconnects it uploads what it measured while offline, with the
> times it was measured. Re-fetch after an agent comes back rather than
> assuming the past is final. Those backfilled samples never change the
> device's current status.

**Status:** 200

```ts
// Query params (all optional)
fromDate?: string   // ISO 8601 with offset, e.g. "2024-01-01T00:00:00-05:00"
toDate?:   string
status?:   string   // comma-separated: "SUCCESS,FAILED"
limit?:    number   // 1–1000
offset?:   number   // ≥0

// Response
{
  deviceId: string
  results: Array<{
    id: string
    deviceId: string
    timestamp: string
    status: 'SUCCESS' | 'FAILED'
    metrics: { latencyMs: number } | null
    deviceStatus: DeviceOnlineStatus
  }>
  totalCount: number          // rows matching every filter, status included
  statistics: {
    successRate: number        // 0–100 %
    averageResponseTime: number // ms
    minResponseTime: number
    maxResponseTime: number
    uptimePercentage: number   // 0–100 %, same value as successRate
  }
}
```

**`statistics` cover the whole date window (MON-043).** They are computed over
every ping for the device between `fromDate` and `toDate`, not over the
returned page. `limit` and `offset` do not change them, and neither does
`status`: `status=FAILED` lists only the failures, but `successRate` still
reports how the device did across the window. Latency figures cover pings that
answered and are `0` when none did. All five figures are computed from the same
set of pings. Before 2026-10-26 they came from the page and were wrong whenever
`totalCount > limit` (e.g. 3.5 % instead of 100 % for a day of pings at
`limit=50`), so a client that computes its own figures from the rows to work
around this can use these instead, without fetching up to 1,000 rows.

---

### `DELETE /api/devices/:id/polling/history` — Delete Ping History

**Status:** 200 | 400  
**Roles:** ADMIN

```ts
// Query params (both optional)
fromDate?: string   // ISO 8601 with offset
toDate?:   string

// Response
{ deletedCount: number }
```

> Permanently deletes stored `PingResult` rows for this device. Omitting both `fromDate` and `toDate` deletes the device's **entire** ping history; giving one or both scopes the deletion to that window.  
> ADMIN-only — this destroys diagnostic data at a scale (tens of thousands of rows per device) nothing else in this context reaches with one call. Doesn't change the `PING_RESULT_RETENTION_DAYS` retention window or the daily automatic sweep; it's a scoped, on-demand version of the same deletion.  
> Not scoped to another device, and there is no "delete for every device" variant — the automatic sweep and the admin's blanket data-retention purge already cover fleet-wide cleanup.

---

### `POST /api/devices/:id/polling/config` — Create / Upsert Polling Config

**Status:** 201 | 400 | 404

```ts
// Request body (all fields optional)
{
  ipAddress?: string | null        // IPv4 or IPv6; null clears it
  intervalSeconds?: number         // 1–86400; default: system default
  failuresBeforeDown?: number      // 1–100;   default: system default
  enabled?: boolean                // default: true
}

// Response
{
  id: string               // UUID
  deviceId: string         // UUID
  ipAddress: string | null
  intervalSeconds: number
  failuresBeforeDown: number
  enabled: boolean
}
```

> Creates the polling config if none exists, or updates the existing one (upsert). The device must exist.  
> Sending `enabled: false` performs the full stop-monitoring transition — see [What "monitoring stopped" does](#stopping-monitoring).

---

### `PATCH /api/devices/:id/polling/config` — Configure Polling

**Status:** 204 (no body) | 400 | 404

```ts
// Request body (at least one field required)
{
  intervalSeconds?: number    // 1–86400
  failuresBeforeDown?: number // ≥1
  enabled?: boolean
}

// Response: 204 No Content on success
```

> `enabled: false` performs the full stop-monitoring transition — see
> [What "monitoring stopped" does](#stopping-monitoring). Other fields in the same
> request (`intervalSeconds`, `failuresBeforeDown`) are still applied and kept.  
> `enabled: true` re-enables polling; it requires the config to have an IP address.

---

## Notification Policy `/api/devices/:id/notification-policy`, `/api/notification-policies/bulk`

> **Response envelope:** these endpoints return **raw data** — no `{ success, data }` wrapper.  
> Error: `{ error: string }`.

Controls, per device: **which quiet hours apply** — quiet hours mute outbound
alert notifications (device-down, device-recovery, and wireless alerts —
never the alert record itself, which still opens/lists normally) — and an
optional **override of the down-alert delay**
(the install's `downAlertDelayMinutes` from
[Notification Settings](#notification-settings-apinotification-settings)
otherwise).

> **Since 2026-10-26 a device follows the install's quiet hours unless it
> says otherwise (NOT-170).** `quietHoursMode` picks one of three:
>
> - **`INHERIT`** (default): the install's window (`quietHoursStart`/`quietHoursEnd`
>   in [Notification Settings](#notification-settings-apinotification-settings)),
>   or none if the install has none.
> - **`CUSTOM`**: the device's own `quietHoursStart`/`quietHoursEnd`, ignoring
>   the install's.
> - **`ALWAYS_NOTIFY`**: never silenced by quiet hours — the "important
>   device" case, e.g. the core router.
>
> `quietHoursStart`/`quietHoursEnd` are set **exactly when** the mode is
> `CUSTOM`. A device with no policy row is `INHERIT`. **Behaviour change:**
> a device with no window used to always notify; it now inherits — identical
> until the administrator saves an install window, after which a device that
> must keep paging needs `ALWAYS_NOTIFY`. Quiet hours are evaluated against
> the **server's local wall-clock time**, not the caller's timezone.
>
> Down-alert and wireless-alert notifications suppressed by quiet hours are
> retried automatically once the window ends (as long as the underlying
> condition is still true). A recovery or cleared-condition notification
> suppressed during quiet hours is simply not sent — there is no
> "catch up in the morning" for good news.
>
> **Device-down alerts open the instant a device goes unreachable**, not once
> the delay elapses — only the _notification_ waits for the effective delay.
> A blip that self-resolves inside that window still shows up (and later
> resolves) on `GET /api/alerts`; it just never pages anyone, and its
> recovery is silent too.

### `GET /api/devices/:id/notification-policy` — Get Effective Policy

**Status:** 200 | 400 | 404

```ts
// Response
{
  deviceId: string;
  quietHoursMode: 'INHERIT' | 'CUSTOM' | 'ALWAYS_NOTIFY'; // since 2026-10-26
  quietHoursStart: string | null; // "HH:mm", 24-hour; set only when CUSTOM
  quietHoursEnd: string | null;
  alertDelayMinutes: number | null; // override; null = use the system default
  updatedAt: string | null; // ISO 8601; null if never configured
}
```

> Returns the defaults (`quietHoursMode: 'INHERIT'`, `quietHoursStart`/`quietHoursEnd`/`alertDelayMinutes`/`updatedAt` all `null`) when no policy row has ever been saved for this device — this is not a `404`. The response shows the device's own setting, not the install window it inherits; read that from `GET /api/notification-settings`.

---

### `PUT /api/devices/:id/notification-policy` — Replace Policy

**Status:** 200 | 400 | 404  
**Roles:** ADMIN, OPERATOR

```ts
// Request body — full replace; both quiet-hours fields must be set together, or both omitted/null
{
  quietHoursMode?: 'INHERIT' | 'CUSTOM' | 'ALWAYS_NOTIFY' // omitted: CUSTOM if a window is sent, else INHERIT
  quietHoursStart?: string | null  // "HH:mm", 24-hour — required with CUSTOM, refused with the others
  quietHoursEnd?: string | null
  alertDelayMinutes?: number | null // ≥ 0
}

// Response: the resulting policy, same shape as GET
```

> Upserts — creates the policy row if none exists yet, or replaces it. The device must exist. Omitting a field (or sending it as `null`) clears that setting back to its default (inherit the install window / system default delay).
>
> `400` `"quietHoursStart and quietHoursEnd must be set when quietHoursMode is CUSTOM, and only then"` for `CUSTOM` without a window, or a window with `INHERIT`/`ALWAYS_NOTIFY`; `400` for an unknown mode.
>
> A screen fits a three-option control — "Horario de la red" (`INHERIT`), "Horario propio" (`CUSTOM`, shows the two time fields), "Notificar siempre" (`ALWAYS_NOTIFY`).

---

### `DELETE /api/devices/:id/notification-policy` — Reset to Defaults

**Status:** 204 (no body) | 400  
**Roles:** ADMIN, OPERATOR

> Resets the device to inheriting the install's quiet hours (`INHERIT`) with the system default delay by deleting its policy row. Idempotent — succeeds even if the device never had one, and does **not** 404 for an unknown device id (only a malformed UUID returns `400`).

---

### `PUT /api/notification-policies/bulk` — Configure Many Devices at Once

**Status:** 200 | 400  
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{
  deviceIds: string[]              // required, at least one
  quietHoursMode?: 'INHERIT' | 'CUSTOM' | 'ALWAYS_NOTIFY' // same rules as the single-device PUT
  quietHoursStart?: string | null
  quietHoursEnd?: string | null
  alertDelayMinutes?: number | null
}

// Response
{
  updated: Array<{                 // same shape as GET, one per successfully-updated device
    deviceId: string
    quietHoursMode: 'INHERIT' | 'CUSTOM' | 'ALWAYS_NOTIFY'
    quietHoursStart: string | null
    quietHoursEnd: string | null
    alertDelayMinutes: number | null
    updatedAt: string
  }>
  failed: Array<{ id: string; error: string }>
}
```

> Applies the same settings to every device in `deviceIds`, independently — a bad id (malformed or unknown) lands in `failed` without aborting the rest. Always `200` when the request itself is well-formed; check `failed` for partial failures.

---

## Notification Mutes `/api/notification-mutes`

> **Response envelope:** raw data, no `{ success, data }` wrapper.
> Error: `{ error: string }`.

A **global**, standing list of alert-type keys whose outbound notification is
suppressed everywhere — e.g. muting `cpu_load_percent` or `distance_m` stops
those wireless pushes for every device, forever, until unmuted. This is not
per-device (see Notification Policy above for that axis) and it never
touches the alert record: a muted condition still opens/lists normally on
`GET /api/alerts`, only the Telegram push is suppressed. Muting is by bare
metric name — `cpu_load_percent`, not `wireless:cpu_load_percent:WARNING` —
so one entry silences both its WARNING and CRITICAL severities.

Besides the device and wireless metrics, the backup notification
`backup_failing` is muted the same way (see Device Backups, BKP-061).
`config_changed` no longer exists (BKP-060, removed 2026-10-26).

### `GET /api/notification-mutes` — List Muted Alert Types

**Status:** 200
**Roles:** any authenticated role

```ts
// Response
{
  metrics: string[]; // e.g. ["cpu_load_percent", "distance_m"]
}
```

---

### `PUT /api/notification-mutes` — Replace the Muted Alert Type List

**Status:** 200 | 400
**Roles:** ADMIN, OPERATOR

```ts
// Request body — full replace, not incremental
{
  metrics: string[]; // lowercase letters, digits, underscores only; duplicates collapse
}

// Response: the resulting list, same shape as GET
```

> Wholesale replace, like the notification-policy bulk endpoint — there is no
> add/remove-one route. Sending `{ metrics: [] }` clears every mute. A
> malformed entry (uppercase, spaces, empty) is rejected with `400` before
> anything is written; an unknown-but-well-formed metric is accepted and
> simply never matches a real alert.

---

## Notification Settings `/api/notification-settings`

The install's own notification settings, edited by the customer's
administrator (NOT-200). A save applies from the next alert, with no restart.
Until the first save the values are the server's env defaults (NOT-201), so
`GET` always answers. Bot tokens are not here: they stay in the server's
environment.

```ts
interface NotificationSettingsDTO {
  telegramChatId: string | null; // '-1001234567890' or '@channel'; null = no chat, alerts are recorded but not sent
  downAlertDelayMinutes: number; // 0–1440: how long a device stays DOWN before its alert is sent (a device's own override wins)
  wirelessAlertsEnabled: boolean; // false: wireless alerts are recorded but not sent (NOT-203)
  alertTicketMode: 'SUGGEST' | 'AUTOMATIC'; // since 2026-10-14 — default SUGGEST (NOT-205)
  quietHoursStart: string | null; // since 2026-10-26 — install-wide quiet hours, "HH:mm" 24-hour (NOT-207)
  quietHoursEnd: string | null; // both null = no install quiet hours (the default)
}
```

`quietHoursStart`/`quietHoursEnd` are the **install's quiet hours** (NOT-207):
every device whose policy is `INHERIT` — or that has no policy at all —
withholds its notifications inside this window, the same way a device's own
window does (see [Notification Policy](#notification-policy-apidevicesidnotification-policy-apinotification-policiesbulk)).
A device on `CUSTOM` uses its own window instead and one on `ALWAYS_NOTIFY` is
never silenced. Overnight windows (`22:00`–`06:00`) cross midnight; start and
end cannot be equal. Server-local time.

`alertTicketMode` decides what a new alert does about tickets:

- **`SUGGEST`** (default): no ticket is opened. The alert list marks the alert
  `ticketSuggested: true`, and a person opens one with
  `POST /api/tickets/from-alert`. Show it as a "Crear ticket" action on the
  alert.
- **`AUTOMATIC`**: every alert opens a ticket on its own, one per device, as
  before.

On the settings screen, a two-option control such as "Sugerir tickets" /
"Crear tickets automáticamente" fits.

### `GET /api/notification-settings`

**Status:** 200 | 401  
**Roles:** all

```ts
{ success: true, data: NotificationSettingsDTO }
```

---

### `PUT /api/notification-settings` — Save

**Status:** 200 | 400 | 401 | 403  
**Roles:** ADMIN (`manage-settings`; OPERATOR and VIEWER get `403`)

```ts
// Request body — every field; alertTicketMode may be omitted (keeps the saved mode),
// and quietHoursStart/quietHoursEnd may be omitted together (keeps the saved window).
// Send both as null to remove the install's quiet hours.
NotificationSettingsDTO

// Response
{ success: true, data: NotificationSettingsDTO } // as stored: chat id trimmed, '' → null
```

> `400` with the rule's message, e.g.
> `"telegramChatId must be a numeric chat id or a @channel name"` or
> `"downAlertDelayMinutes must be a whole number from 0 to 1440"` or
> `"alertTicketMode must be one of: SUGGEST, AUTOMATIC"` or
> `"quietHoursStart and quietHoursEnd must both be set, or both be null"` or
> `"quietHoursStart and quietHoursEnd must be sent together"` or
> `"quiet hours start and end cannot be the same time"`.
> Warn before saving `telegramChatId: null`: alerts stop reaching anyone.

---

### `POST /api/notification-settings/test` — Send a test message

**Status:** 200 | 400 | 401 | 403 | 409 | 502  
**Roles:** ADMIN (`manage-settings`)

Sends one Spanish test message to a chat and stores nothing (NOT-202). Offer
it next to the chat field, sending the value **as typed**, before saving.

```ts
// Request body (optional) — omit telegramChatId to test the saved chat
{ telegramChatId?: string }

// Response
{ success: true, data: { telegramChatId: string } } // the chat it was sent to
```

> `400` for a chat id a save would refuse. `409` > `"No Telegram chat is configured for this install"` with nothing saved or
> given. `502` `"Test message not delivered: Telegram API error: …"` when
> Telegram refuses — most often `chat not found` (wrong id, or the bot was
> never added to that group). Show Telegram's reason to the user.

---

## Phone Notifications `/api/push`

Makes the dashboard installable on a phone (PWA) and sends every alert the
install's Telegram chat gets to the phones of users who turned notifications
on (NOT-220…228). Telegram keeps working as before. Every action applies
only to the **signed-in user's own phones**, and every role may use it.

### Frontend work this needs (not provided by the backend)

1. **Web app manifest**, `app/manifest.ts` in Next. It needs `name`,
   `short_name`, `start_url: '/'`, `display: 'standalone'`, `theme_color`,
   `background_color`, and icons at 192×192 and 512×512 (plus a `maskable`
   one). This is what gives the phone an icon on its home screen.
2. **A service worker** served from the root, `public/sw.js`, registered on
   load. It handles two events:
   ```js
   self.addEventListener('push', (event) => {
     const p = event.data.json(); // PushPayload, below
     event.waitUntil(
       self.registration.showNotification(p.title, {
         body: p.body,
         tag: p.tag,
         renotify: true,
         icon: '/icons/icon-192.png',
         badge: '/icons/badge-72.png',
         data: { url: p.url }
       })
     );
   });
   self.addEventListener('notificationclick', (event) => {
     event.notification.close();
     event.waitUntil(clients.openWindow(event.notification.data.url));
   });
   ```
3. **An "Activar notificaciones en este teléfono" switch**, for example in
   the user menu or the notification settings. It must be started by a tap,
   because iOS refuses a permission prompt that wasn't triggered by the user:

   1. `GET /api/push/public-key`. If `enabled` is `false`, hide the switch.
   2. `Notification.requestPermission()` must return `'granted'`.
   3. `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey })`.
      The key is base64url. Convert it to a `Uint8Array` first.
   4. `POST /api/push/subscriptions` with `subscription.toJSON()` as the body.
   5. Offer "Enviar prueba", which calls `POST /api/push/test`.

   Turning it off: `subscription.unsubscribe()`, then
   `DELETE /api/push/subscriptions`. The switch's state is whether
   `pushManager.getSubscription()` returns one.

   On each app load, if a subscription exists, `POST` it again. It's
   idempotent and keeps the server current when the browser rotates its keys
   or a different user signs in on the phone.

4. **iPhone:** push only works after the user taps Share → "Agregar a
   inicio" and opens the app from that icon (iOS 16.4+). In Safari, when not
   standalone (`!matchMedia('(display-mode: standalone)').matches`), show
   that instruction instead of the switch.

```ts
// What the service worker receives in each push
interface PushPayload {
  title: string; // '🔴 Torre Norte está caída desde las 10:02' — already has its icon
  body: string; // detail, may be ''
  url: string; // path on this origin: '/devices/:id' or '/alerts'
  tag: string; // a later message with the same tag replaces the earlier one (recovery replaces the outage)
  urgent: boolean;
}
```

### `GET /api/push/public-key`

**Status:** 200 | 401  
**Roles:** all

```ts
{ success: true, data: { enabled: boolean; publicKey: string | null } } // enabled: false → server has no VAPID keys, hide the feature
```

---

### `POST /api/push/subscriptions` — Turn on for this phone

**Status:** 200 | 400 | 401 | 503  
**Roles:** all

```ts
// Request body — PushSubscription.toJSON() as the browser gives it (extra fields like expirationTime are ignored)
{ endpoint: string; keys: { p256dh: string; auth: string } }

// Response
{ success: true, data: { endpoint: string; userAgent: string | null; createdAt: string } }
```

> Idempotent per `endpoint`: sending it again updates the keys. If another
> user signs in on the same phone and sends it, the phone moves to that user.
> `400` `"endpoint must be an https URL"` or a missing key. `503` > `"Phone notifications are not configured on this server"`.

---

### `DELETE /api/push/subscriptions` — Turn off for this phone

**Status:** 200 | 400 | 401  
**Roles:** all

```ts
// Request body
{ endpoint: string }

// Response
{ success: true, data: null } // also when nothing was subscribed there
```

---

### `POST /api/push/test` — Send a test notification

**Status:** 200 | 401 | 409 | 502 | 503  
**Roles:** all

Sends "✅ Notificación de prueba" to every phone the caller has subscribed.

```ts
// No body. Response:
{ success: true, data: { delivered: number } }
```

> `409` `"This user has no phone subscribed to notifications"`. `502` > `"Test notification not delivered to any phone"`. `503` when push isn't
> configured.

---

## Notification Inbox `/api/notifications`

**Since:** 2026-10-27 · **Roles:** all

Each user's **in-app inbox**: what the install told its staff, kept so it's still
there after a missed Telegram message or a closed tab (NOT-260…270). Every action
applies only to the **signed-in user's own inbox**.

**What lands in it** (NOT-266, NOT-267):

- Every notice the install sends its staff: device down and back, wireless
  alerts and their clearing, agent offline/back/clock, failing backups, paused
  sign-ins and two-factor resets.
- Every active account gets its own copy. `security` notices go to `ADMIN` and
  `VENDOR` accounts only.
- Quiet hours, muted types, an expired subscription and the wireless switch
  silence only Telegram and phones. The inbox still gets those notices.
- Each notice appears once, however many times its delivery is retried.
- A device that comes back always gets its "volvió a responder" notice next to
  the outage, even when the outage was held back from Telegram (NOT-270).
- Notices older than 90 days are deleted, read or not (NOT-268).

Errors from a request the user just made (a save that failed, a timeout) are
**not** inbox notifications. Keep showing those as frontend-only toasts.

```ts
type InboxCategory =
  | 'device' // device_unreachable
  | 'wireless' // wireless:<metric>:<severity>
  | 'agent' // agent_offline, agent_clock, …
  | 'backup' // backup_failing
  | 'security' // sign_in_paused, two_factor_reset
  | 'other';

interface InboxNotificationDTO {
  id: string;
  category: InboxCategory; // pick the icon from this
  severity: 'WARNING' | 'CRITICAL';
  resolved: boolean; // true for a recovery ("volvió a responder") — show it green
  type: string; // the alert type, e.g. 'device_unreachable'
  title: string; // one sentence, Spanish, ready to show
  body: string | null; // extra lines; may contain '\n'
  deviceId: string | null; // link to /devices/:id when set
  alertId: string | null; // link to the alert when set; null if the alert was deleted
  occurredAt: string; // ISO — when it happened
  readAt: string | null; // ISO — null means unread
  createdAt: string; // ISO — when it reached the inbox; the list is ordered by this
}
```

`deviceId` and `alertId` become `null` when the device or alert is deleted. The
notification itself stays.

---

### `GET /api/notifications` — List

**Status:** 200 | 400 | 401 | 429

| Query    | Type             | Default | Notes                |
| -------- | ---------------- | ------- | -------------------- |
| `unread` | `'true'/'false'` | `false` | `true` → unread only |
| `limit`  | 1–100            | `20`    |                      |
| `offset` | ≥ 0              | `0`     |                      |

Newest first.

```ts
{
  success: true,
  data: {
    notifications: InboxNotificationDTO[];
    total: number; // matching the filter
    unread: number; // the user's unread count, whatever the filter — use it for the badge
    hasMore: boolean;
    limit: number;
    offset: number;
  }
}
```

---

### `GET /api/notifications/unread-count` — Badge count

**Status:** 200 | 401 | 429

```ts
{ success: true, data: { unread: number } }
```

---

### `POST /api/notifications/:id/read` — Mark one read

**Status:** 200 | 400 | 401 | 404 | 429

No body. Returns the `InboxNotificationDTO`. Marking one that's already read
succeeds and keeps its original `readAt` (NOT-262). Call this when the user
opens or clicks the notification.

> `404` `"Notification not found"` also covers another user's notification
> (NOT-260). `400` for a malformed id.

---

### `POST /api/notifications/read-all` — Mark all read

**Status:** 200 | 401 | 429

No body. Marks every unread notification of the caller.

```ts
{ success: true, data: { marked: number } } // how many were unread
```

---

### `GET /api/notifications/stream` — Live inbox (SSE)

**Since:** 2026-10-27 · **Status:** 200 | 401 | 429 | 500

Server-Sent Events for the signed-in user's own inbox (NOT-265). Open one per
tab while the user is signed in:

```ts
const es = new EventSource('/api/notifications/stream', {
  withCredentials: true
});
es.addEventListener('unread', (e) => {
  const { unread } = JSON.parse(e.data) as { unread: number };
  setBadge(unread);
});
es.addEventListener('notification', (e) => {
  const { notification, unread } = JSON.parse(e.data) as {
    notification: InboxNotificationDTO;
    unread: number;
  };
  showFloatingCard(notification);
  setBadge(unread);
});
```

| Event          | Data                                                     | When                                                          |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| `unread`       | `{ unread: number }`                                     | first frame on open, then when the user marks one or all read |
| `notification` | `{ notification: InboxNotificationDTO; unread: number }` | a new notice reached this user's inbox (NOT-269)              |

- The first frame is always `unread`, so a reconnect brings the badge back in
  step. If the list page is open, refetch it on that first frame too.
- On `notification`, show the floating card and prepend it to an open list. Its
  `unread` already counts it, so don't add one yourself.
- Notices that arrive while no tab is open don't come as `notification` frames.
  The opening `unread` count includes them.
- Errors come as JSON before the stream opens: `401` (no or bad token), `429`
  `Too many streams` (10 per user, 200 per server).
- Accepts the session cookie, a Bearer header or `?token=<jwt>`.
- The server sends `: ping` comments every 15 s and asks the browser to wait
  5 s before reconnecting.

---

## Alerts `/api/alerts`

This is the **unified operational-alert list**. Every bounded context that detects an infrastructure problem records into this one store, so dashboards (and future ticketing) read a single place instead of chasing per-context lists. Both **device-availability** alerts and **wireless-link** alerts land here.

```ts
interface AlertDTO {
  id: string; // UUID
  deviceId: string; // UUID
  severity: AlertSeverity;
  source: string; // human-readable origin — e.g. "Disponibilidad", "Enlace inalámbrico"
  type: string; // machine discriminator (see table); at most one OPEN alert per (deviceId, type)
  description: string; // human-readable detail line, ready to display
  details: Record<string, unknown>; // producer-specific structured payload — shape varies by source (see table)
  status: AlertStatus;
  startedAt: string; // ISO 8601
  resolvedAt: string | null; // ISO 8601 — null while alert is open
  notifiedAt: string | null; // ISO 8601 — null if Telegram send failed
  recoveryNotifiedAt: string | null; // ISO 8601 — null if not yet resolved/sent
  durationSecs: number | null; // seconds device was offline; null while open
  // since 2026-10-29 — the upstream device's alert this outage is part of; null on its own
  causedByAlertId: string | null;
  // since 2026-10-29 — only on GET /api/alerts/:id; [] when nothing went down behind it
  affectedDevices?: AffectedDeviceDTO[];
}

interface AffectedDeviceDTO {
  deviceId: string;
  name: string;
  ipAddress: string | null;
  status: 'DOWN' | 'UP'; // UP once the device answered again
  viaDeviceId: string | null; // nearest affected device between it and the root
  viaDeviceName: string | null; // null when it hangs straight off the root
}
```

> **Outages behind an upstream device (since 2026-10-29, NOT-240..247).** When
> an AP, switch or backhaul goes down, the devices behind it (per
> [Topology](#topology-apitopology)) are **not** paged one by one. Their
> `device_unreachable` alerts are still recorded, but each one is attached to
> the alert of the **highest** device down above it, the _root alert_, through
> `causedByAlertId`, and is never notified (`notifiedAt` stays `null`).
> Only the root pages, and its message names the affected devices: up to 30 in
> Telegram, grouped under the intermediate device they hang from, then
> `…y N más (ver panel)`. A phone gets the first three. The ticket gets all of
> them. When the root recovers, its message says who came back and who is still
> down (`Volvieron 6 de 7. Siguen caídos: …`). A device still down once its own
> alert delay has passed since the root came back is detached
> (`causedByAlertId → null`) and pages on its own.
>
> **Frontend:** in the alert list, show an alert with `causedByAlertId` set
> under its root, or hide it behind the root's `affectedCount`, instead of as
> its own row. On the root's detail, `affectedDevices` is the full list, each
> with its current status. Group by `viaDeviceName` to match the Telegram
> message. If the root alert is deleted, its affected alerts fall back to
> `causedByAlertId: null`.

**Producers** — who writes alerts and what they put in `type` / `details`:

| `source`             | `type`                                                                   | `details` shape                                                                                  | Notes                                                                                     |
| -------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `Disponibilidad`     | `device_unreachable`                                                     | `{ consecutiveFailures: number, ipAddress: string \| null }`                                     | Device stopped answering ICMP ping. Resolves automatically on recovery.                   |
| `Enlace inalámbrico` | `wireless:<metric>:<severity>`<br>e.g. `wireless:signal_rx_dbm:CRITICAL` | `{ metric: string, severity: 'WARNING' \| 'CRITICAL', threshold: number, currentValue: number }` | One row per wireless metric + severity. Resolves automatically when the condition clears. |

> **Dedup:** at most **one OPEN alert per `(deviceId, type)`**. A repeated trigger for a condition that is already open does **not** create a duplicate — the existing open alert stands until it resolves.  
> `details` is a free-form JSON bag, easy to render but not queryable server-side — filter/sort in the frontend, don't expect a backend query param for its inner keys.  
> **Not the same as `/api/devices/:id/wireless/alerts`** (`WirelessAlertDTO`): those remain the live, per-poll wireless view. This `/api/alerts` list is the **persisted, cross-context record** — a wireless problem appears in both.

> **No new alerts are recorded for a device that is deleted, replaced or retired (since 2026-08-13).** The device is re-read at the moment the alert would be written, so a device deleted between the failed poll and the notification produces no alert row, no notification and no ticket. Existing alerts are unaffected: one opened while the device was still live can still be resolved and will keep appearing here. Expect fewer rows after a deletion, not a gap in history.

### `GET /api/alerts` — List

**Status:** 200

```ts
// Query params (all optional)
deviceId?: string                  // UUID — filter to a single device
status?:   'OPEN' | 'RESOLVED'     // since 2026-09-26
severity?: 'WARNING' | 'CRITICAL'  // since 2026-09-26
limit?:    number                  // 1–300, default 50
offset?:   number                  // ≥0, default 0

// Response
{
  success: true,
  data: {
    alerts: AlertListItemDTO[]
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

```ts
interface AlertListItemDTO extends AlertDTO {
  deviceName: string;
  // since 2026-10-14 — this alert's own live ticket (OPEN, ASSIGNED or IN_PROGRESS)
  ticket: { id: string; code: number; status: TicketStatus } | null;
  // since 2026-10-14 — open alert with no ticket of its own: offer "Crear ticket"
  ticketSuggested: boolean;
  // since 2026-10-29 — how many devices went down behind this one (NOT-243)
  affectedCount: number;
}
```

> **Tickets (NOT-206).** When `ticketSuggested` is `true`, show a "Crear ticket" action that calls `POST /api/tickets/from-alert`. When `ticket` is set, link to it (`#code`) instead. Only a ticket opened from **this** alert counts: two alerts on the same device each get their own suggestion. `ticketSuggested` is always `false` on a resolved alert and on an install without the tickets module. Re-fetch the list after creating a ticket.  
> Results are ordered by `startedAt` descending (newest first).  
> Omit `deviceId` to list alerts across all devices. Filters combine with AND, so `?status=OPEN&severity=CRITICAL` is the open critical alerts, wireless-link alerts included. An unknown `status` or `severity` is a `400`.  
> `deviceName` is the device's **current** name, so a renamed device's old alerts show the new name. Only the list carries it; `GET /api/alerts/:id` returns an `AlertDTO`.  
> **`total` is fixed since 2026-09-26.** It used to be the length of the page, so `hasMore` was always `false`. It now counts every alert matching the filters, and paging on `hasMore` works.

---

### `GET /api/alerts/:id` — Get by ID

**Status:** 200 | 400 | 404

```ts
// Response
{ success: true, data: AlertDTO } // with affectedDevices (since 2026-10-29)
```

> Returns 400 if the id is not a valid UUID, 404 if no alert exists with that id.
> `affectedDevices` lists every device attached to this alert (NOT-243), with
> whether it is still down; `[]` for an ordinary alert.

---

### `POST /api/alerts/:id/clear` — Clear

**Status:** 200 | 400 | 404  
**Roles:** ADMIN, OPERATOR

```ts
// No request body

// Response
{ success: true, data: AlertDTO }  // status: 'RESOLVED'
```

> Manually resolves an open alert — same effect as the system auto-resolving it (`resolvedAt` is stamped, `status` becomes `RESOLVED`). There is no separate "acknowledged" state: a clear is a real resolve, so it does **not** suppress the alert from reopening if the producer's next cycle still finds the fault.  
> **Idempotent.** Clearing an alert that is already resolved returns `200` with its current (already-resolved) state, not an error.  
> Returns 404 if no alert exists with that id.

---

### `POST /api/alerts/clear` — Bulk Clear

**Status:** 200 | 400  
**Roles:** ADMIN, OPERATOR

```ts
// Request body — exactly one of ids or deviceId
{
  ids?: string[]       // explicit alert UUIDs, any device
  deviceId?: string    // UUID — clear every currently OPEN alert for this device
}

// Response
{
  success: true,
  data: {
    cleared: AlertDTO[]
    skipped: { id: string, reason: string }[]   // e.g. already resolved
    failed:  { id: string, error: string }[]    // e.g. not found
  }
}
```

> Always returns `200` with a bucketed report — one bad id in a batch does not fail the rest, which is the point after an outage storm trips alerts across several devices at once.  
> Returns 400 if both `ids` and `deviceId` are provided, or neither.

---

### `DELETE /api/alerts/:id` — Delete

**Status:** 204 | 400 | 404 | 409  
**Roles:** ADMIN

```ts
// No request body
// Response: 204 No Content
```

> **Only resolved alerts can be deleted.** Deleting an alert that is still `OPEN` returns 409 `"Cannot delete an alert that is still open"` — clear it (`POST .../clear`) or let it auto-resolve first.  
> Returns 400 for a non-UUID id, 404 if no alert exists with that id.

---

### `DELETE /api/alerts` — Bulk Delete

**Status:** 200 | 400  
**Roles:** ADMIN

```ts
// Request body
{ ids: string[] }   // required, non-empty — no "delete all resolved" shortcut

// Response
{
  success: true,
  data: {
    deleted: string[]                             // ids actually removed
    skipped: { id: string, reason: string }[]      // still open — same guard as the single-delete route
    failed:  { id: string, error: string }[]       // not found
  }
}
```

> Always returns `200` with a bucketed report, same shape as bulk clear. An open alert in the batch is `skipped`, not a hard failure — the rest of the batch still deletes.  
> There is no filter-based "delete everything resolved" call: deleting alert history is destructive, so the caller must name what it's removing.

---

## Network Scan `/api/network/scan`

### `POST /api/network/scan` — Scan a network segment

**Status:** 200 | 400 | 404 | 409 | 500

```ts
// Request body
{
  segment: string   // required — IPv4 CIDR block, e.g. "192.168.1.0/24"; max range /22
}

// Response
{
  success: true,
  data: {
    segment: string            // the CIDR block that was scanned
    scannedCount: number       // total IP addresses probed
    responsiveCount: number    // hosts that replied to ICMP ping
    discoveredHosts: Array<{
      ipAddress: string
      latencyMs: number
      macAddress: string | null     // null when ARP resolution failed
      manufacturer: string | null   // null when MAC is unknown
    }>
  }
}
```

> Probes every host in the CIDR range via ICMP ping and returns all responsive hosts with their latency, MAC address, and manufacturer (where resolvable).  
> Returns 400 if the segment is invalid or the range exceeds /22 (1 024 usable hosts).  
> Returns 500 on unexpected infrastructure errors.
> Returns 409 `{ success: false, error: "Network scan is not available — this server is not on the monitored network" }`
> on an install whose server is not on the monitored network
> (`SERVER_ON_SITE=false`, DEV-171). Hide the scan screen on such installs.

---

## Wireless Monitoring

> **Response envelope:** Wireless endpoints return raw data directly — **no `{ success, data }` wrapper**.  
> Success: the DTO object or array directly.  
> Error: `{ error: string }`.

```ts
type WirelessDeviceType = 'STATION' | 'ACCESS_POINT';
type WirelessCollectionMethod = 'snmp' | 'http_api' | 'mixed';
type WirelessAlertSeverity = 'WARNING' | 'CRITICAL';
```

```ts
interface WirelessMetricsDTO {
  signalRxDbm: number | null;
  signalTxDbm: number | null;
  noiseFloorDbm: number | null;
  snrDb: number | null;
  ccqPercent: number | null;
  frequencyMhz: number | null;
  channelWidthMhz: number | null;
  throughputTxBps: number | null;
  throughputRxBps: number | null;
  throughputTxPps: number | null;
  throughputRxPps: number | null;
  lanStatus: string | null;
  lanSpeedMbps: number | null;
  lanDuplex: string | null;
  uptimeSeconds: number | null;
  cpuLoadPercent: number | null;
  memoryUsedPercent: number | null;
  firmwareVersion: string | null;
  deviceName: string | null;
  remoteApMac: string | null;
  remoteApName: string | null;
  distanceM: number | null;
  latencyMs: number | null;
  clientsConnected: number | null;
}

interface WirelessStatusDTO {
  deviceId: string; // UUID
  deviceType: WirelessDeviceType;
  collectedAt: string; // ISO 8601
  collectionMethod: WirelessCollectionMethod;
  metrics: WirelessMetricsDTO;
  activeAlerts: WirelessAlertDTO[];
  clients: WirelessClientDTO[];
}

interface WirelessThroughputDTO {
  deviceId: string; // UUID
  deviceType: WirelessDeviceType;
  collectedAt: string; // ISO 8601 — when the radio was read, not when you asked
  ageSeconds: number; // age of the reading; never negative
  stale: boolean; // ageSeconds > 2 × the device's intervalSecs, or no config
  throughputTxBps: number | null;
  throughputRxBps: number | null;
  throughputTotalBps: number | null; // null if either leg is null
  linkCapacityKbps: number | null; // effective capacity: contracted plan (down + up), else the config value; STATION-only (WLS-166)
  linkCapacitySource: 'CONTRACT' | 'MANUAL' | null; // which of the two applied; null exactly when linkCapacityKbps is
  utilisationPercent: number | null; // 2dp; null without a capacity, so always null for an AP
}

interface WirelessAlertDTO {
  id: string; // UUID
  deviceId: string; // UUID
  metric: string; // e.g. "signal_rx_dbm", "latency_ms", "clock_drift_s", "firmware_version_changed", "remote_ap_mac_changed", "parent_ap_mismatch"
  severity: WirelessAlertSeverity;
  threshold: number;
  lastValue: number;
  message: string;
  triggeredAt: string; // ISO 8601
  clearedAt: string | null; // ISO 8601 — null while active
  isActive: boolean;
}

interface WirelessClientDTO {
  macAddress: string;
  ipAddress: string | null; // last known IP (sta[].lastip)
  signalRxDbm: number | null; // signal AP receives from this client (dBm)
  noiseFloorDbm: number | null; // client-side noise floor (dBm)
  distanceM: number | null; // distance to AP (m)
  uptimeSeconds: number | null; // association uptime (s)
  txLatencyMs: number | null; // TX latency (ms)
  dlLinkScore: number | null; // downlink link score 0–100
  ulLinkScore: number | null; // uplink link score 0–100
  dlCapacityKbps: number | null; // airMAX downlink capacity (kbps)
  ulCapacityKbps: number | null; // airMAX uplink capacity (kbps)
  dlCinr: number | null; // downlink CINR (dB)
  ulCinr: number | null; // uplink CINR (dB)
  txBytesTotal: string | null; // cumulative TX bytes since association (serialised bigint)
  rxBytesTotal: string | null; // cumulative RX bytes since association (serialised bigint)
  txPps: number | null; // current TX packets/s
  rxPps: number | null; // current RX packets/s
  // Remote CPE info (from sta[].remote — AP-side view of the CPE)
  remoteHostname: string | null;
  remotePlatform: string | null; // CPE model string
  remoteVersion: string | null; // CPE firmware version
  remoteCpuLoad: number | null; // CPE CPU load %
  remoteTotalRam: number | null; // CPE total RAM (bytes)
  remoteFreeRam: number | null; // CPE free RAM (bytes)
  remoteSignal: number | null; // signal CPE receives from AP (dBm)
  remoteNoiseFloor: number | null; // CPE noise floor (dBm)
  remoteTxPower: number | null; // CPE TX power (dBm)
  remoteTxThroughputKbps: number | null;
  remoteRxThroughputKbps: number | null;
  remoteIpAddresses: string[]; // CPE IP addresses
}
```

---

### `POST /api/devices/:id/wireless/config` — Register Wireless Config

**Status:** 201 | 400 | 404 | 409

```ts
// Request body — deviceType is NOT accepted; it is derived (see below)
{
  ipAddress?: string | null                // IPv4 or IPv6; used for HTTP API polling
  intervalSecs?: number                    // 60–86400; default 3600
  enabled?: boolean                        // default true
  linkCapacityKbps?: number | null         // STATION only — fallback capacity in kbps, used only when no contracted plan covers the device
  clientsProvisionedLimit?: number | null  // ACCESS_POINT only — max expected clients
  provisionedLanSpeedMbps?: number | null  // one of 10/100/1000/2500/10000 — see note below; usually left unset
}

// Response
{
  id: string
  deviceId: string
  ipAddress: string | null
  enabled: boolean
  intervalSecs: number
  deviceType: 'STATION' | 'ACCESS_POINT'
  linkCapacityKbps: number | null
  clientsProvisionedLimit: number | null
  provisionedLanSpeedMbps: number | null
  lastPolledAt: string | null   // ISO 8601 — null until first poll
}
```

**`deviceType` is derived, not sent.** The radio mode follows the device's
`category`, which already encodes that distinction:

| Device `category` | Resulting `deviceType` |
| ----------------- | ---------------------- |
| `ACCESS_POINT`    | `ACCESS_POINT`         |
| `WIRELESS_CPE`    | `STATION`              |

Only those two categories may hold a wireless config at all — any other category
returns `400` `"Only WIRELESS_CPE and ACCESS_POINT devices can have a wireless
config"`. The derived value is still returned in the response, so read it from
there rather than assuming it.

**Business rules:**

- `linkCapacityKbps` may only be set (non-null) when the derived type is `STATION` — returns 400 for an `ACCESS_POINT` category device.
- `clientsProvisionedLimit` may only be set (non-null) when the derived type is `ACCESS_POINT` — returns 400 for a `WIRELESS_CPE` category device.
- `intervalSecs` must be **at least 60**. Polling AirOS faster than that overloads the embedded web server on the radio, so the floor is a hardware constraint, not a preference.
- `provisionedLanSpeedMbps`, when set, must be one of `10`, `100`, `1000`, `2500`, `10000` — returns 400 for any other value (WLS-165). The auto-captured baseline (WLS-099) is not subject to this check; it always mirrors whatever the radio reports.

> **`linkCapacityKbps` is usually left unset (WLS-166).** A station with an `ACTIVE` or `PENDING` contracted service takes its capacity from that service's plan (`downloadMbps + uploadMbps`), and the configured value is ignored while that holds. Set it for stations with no contract, such as backhauls and infrastructure links. The throughput DTO's `linkCapacitySource` shows which value is in effect.
>
> **It is in kbps, not bps.** A 50 Mbps link is `50000`. It feeds the link-saturation alert, which warns at 80 % of the capacity, so an entry off by 1000× either never fires or fires permanently.

> **`provisionedLanSpeedMbps` is usually not something you set (WLS-089/WLS-099).** It's the negotiated Ethernet speed (`10`, `100`, `1000`, `2500` or `10000` — WLS-165) this device's LAN port is expected to run at, and it auto-fills itself: the first poll that reports a speed for a device with no baseline yet stores that reading here, and every degradation warning after that compares against it instead of one fixed number shared by every device. Set it explicitly only to correct a baseline captured while the port was already degraded (e.g. right after this feature went live), or to pre-seed it before the first poll.

> ⚠ **Breaking change (2026-10-28): `parentApDeviceId` is gone from the wireless config.** A CPE's AP is now the device's **`upstreamDeviceId`**, set with `PATCH /api/devices/:id` — see [Topology](#topology-apitopology). Every value stored before was copied across, so read it from `DeviceDTO.upstreamDeviceId` instead. This endpoint and `PATCH` no longer return the field, and any `parentApDeviceId` sent to them is ignored — a `PATCH` whose body held only that field now returns `400`, as an empty update. Move the AP picker from the wireless config form to the device form. The field still drives the same things: the AP's expected-clients roster, the first-poll auto-declaration (WLS-012), the drift suggestion (WLS-151) and the `parent_ap_mismatch` warning (WLS-013).

> **Frontend:** set the device's `category` first (`PATCH /api/devices/:id`) — it decides which of the two fields this endpoint will accept, and creating this config **locks it**: the category cannot be changed again until the config is deleted. Sending `deviceType` in the body is now ignored by the schema.  
> Returns 404 if the device does not exist.  
> Returns 409 if a wireless config already exists for this device — use `PATCH` to update it.

---

### `GET /api/devices/:id/wireless/config` — Get Config

**Status:** 200 | 400 | 404

```ts
// Response — same shape as POST 201 above
```

> Returns 404 if the device exists but has no wireless config registered.

---

### `PATCH /api/devices/:id/wireless/config` — Update Config

**Status:** 200 | 400 | 404

```ts
// Request body (at least one field required)
{
  ipAddress?: string | null
  intervalSecs?: number                   // 60–86400
  enabled?: boolean
  linkCapacityKbps?: number | null        // kbps; STATION only (400 on an ACCESS_POINT); fallback when no contracted plan applies (WLS-166)
  clientsProvisionedLimit?: number | null // ACCESS_POINT only — returns 400 if config is STATION
  provisionedLanSpeedMbps?: number | null // one of 10/100/1000/2500/10000 — see the note under POST; null clears the auto-captured baseline
}

// Response — same shape as POST 201 above
```

> Returns 404 if no config exists for this device — use `POST` to create it first.  
> **`enabled` is not yours alone (since 2026-08-13).** The backend turns it off when the device is retired or deleted, and back on when the device is commissioned — see [What "monitoring stopped" does](#stopping-monitoring). A toggle bound to this field can therefore change without the operator touching it; re-read the config after any status change rather than assuming your last write still holds.  
> **`enabled: true` returns `400` for a device that cannot be polled** — deleted, replaced, retired, or not a `WIRELESS_CPE`/`ACCESS_POINT`. The message names the reason. `enabled: false` is never blocked, and every other field stays editable on a retired device, so a "save" that PATCHes the whole config back will fail rather than silently undoing a retirement.  
> The STATION / ACCESS_POINT check here runs against the config's **stored** `deviceType` — the value derived from the device's category at creation. The two can no longer drift apart: while this config exists, `PATCH /api/devices/:id` refuses to change the device's category at all. If the role really changed, delete this config, recategorise the device, then create it again.

---

### `DELETE /api/devices/:id/wireless/config` — Remove Config

**Status:** 204 | 400 | 404

```ts
// No request body
// Response: 204 No Content
```

> Removes wireless monitoring from the device. The device record itself is not affected.  
> Returns 404 if no config exists.  
> This is also the prerequisite for two other operations that refuse to destroy a config on their own: recategorising the device (`PATCH /api/devices/:id`) and marking its model non-wireless (`PUT /api/device-models/:id`).

---

### `GET /api/devices/:id/wireless/status` — Latest Snapshot

**Status:** 200 | 400 | 404

```ts
// Response — WirelessStatusDTO (raw, no wrapper)
{
  deviceId: string
  deviceType: WirelessDeviceType
  collectedAt: string
  collectionMethod: WirelessCollectionMethod
  metrics: WirelessMetricsDTO
  activeAlerts: WirelessAlertDTO[]
  clients: WirelessClientDTO[]
}
```

> Returns 404 if the device has never been polled (no snapshot exists) or does not exist.

---

### `GET /api/devices/:id/wireless/history` — Historical Snapshots

**Status:** 200 | 400

```ts
// Query params (from and to are required)
from: string   // ISO 8601 with offset, e.g. "2026-01-01T00:00:00Z"
to:   string   // ISO 8601 with offset
limit?: number // 1–1000

// Response
{
  snapshots: WirelessStatusDTO[]
  total: number
}
```

---

### `GET /api/devices/:id/wireless/clients` — Client List

**Status:** 200 | 400 | 404

```ts
// Response
{
  deviceId: string
  collectedAt: string        // ISO 8601
  clients: WirelessClientDTO[]
}
```

> Returns the connected client list from the most recent snapshot (AP devices only).  
> Returns 404 if no snapshot exists for this device.

---

### `GET /api/devices/:id/wireless/clients/expected` — Expected vs. Connected Clients

**Status:** 200 | 400 | 404

```ts
// Response
{
  apDeviceId: string
  collectedAt: string | null   // ISO 8601 from the latest snapshot; null if the AP has never been polled
  expected: Array<{
    deviceId: string
    deviceName: string
    macAddress: string | null  // from device-inventory, not from any poll
    connected: boolean
    client: WirelessClientDTO | null   // live stats when connected, else null
  }>
  missingCount: number
  unexpectedConnected: WirelessClientDTO[]   // live clients matching no declared CPE
}
```

> AP devices only — 404 (`NOT_AP:`-prefixed) if the target's own wireless
> config is `STATION`. Unlike `GET .../clients`, this does **not** require an
> existing snapshot: an AP that has never been polled returns `collectedAt: null`
> with every declared CPE reported as not connected, rather than 404.  
> `expected` lists every `STATION` whose device's `upstreamDeviceId` is
> this device (see [Topology](#topology-apitopology)) — it is
> empty if no CPE hangs off this AP, regardless of who is
> actually connected. Matching is by MAC address; a declared CPE with no MAC
> on file in device-inventory always shows `connected: false`.  
> **Frontend:** this is the view for "who's supposed to be here and isn't" —
> pair `missingCount` with `unexpectedConnected.length` for an at-a-glance
> health indicator on the AP's detail page.

---

### `GET /api/devices/:id/wireless/identity/suggestions` — Identity Suggestions

**Status:** 200 | 400 | 404

```ts
// Response
{
  deviceId: string;
  polled: boolean; // false if the device has never been polled
  collectedAt: string | null; // ISO 8601 from the latest snapshot
  suggestions: Array<{
    field: 'name' | 'macAddress' | 'upstreamDeviceId' | 'deviceModel'; // was 'parentApDeviceId' before 2026-10-28
    currentValue: string | null; // from device-inventory
    suggestedValue: string | null; // from the latest AirOS poll; null only for deviceModel not in the catalog
    currentLabel: string | null; // upstreamDeviceId: declared AP's name; deviceModel: model on file
    suggestedLabel: string | null; // upstreamDeviceId: reported AP's name; deviceModel: reported model
    actions: Array<'UPDATE' | 'REPLACE' | 'SWAP'>; // how to accept it, best first (since 2026-10-27)
    swapWith: { deviceId: string; name: string } | null; // set only when actions is ['SWAP']
  }>;
}
```

> **Hardware changes (WLS-152, WLS-153, since 2026-10-27).** A `deviceModel`
> suggestion appears when the model the radio reports differs from the one on
> file (case, spaces and hyphens ignored). `suggestedValue` is the matching
> catalog model's id, or `null` when the catalog has none — then offer to add
> `suggestedLabel` to the catalog first. Each suggestion's `actions` says how to
> accept it; show the first as the main button and any others as secondary:
>
> | Action | Call |
> |---|---|
> | `UPDATE` | `PATCH /api/devices/:id` with the suggested value (`{ deviceModelId: suggestedValue }` for a model) |
> | `REPLACE` | `POST /api/devices/:id/replace` — pre-fill `deviceModelId` (from the `deviceModel` suggestion's `suggestedValue`) and `macAddress` (from the `macAddress` suggestion) |
> | `SWAP` | `POST /api/devices/:id/swap-hardware` with `{ otherDeviceId: swapWith.deviceId }` — name `swapWith.name` in the confirmation |
>
> A device in service that reports a different MAC gets `['REPLACE', 'UPDATE']`
> (most likely a new box, possibly a typo when the MAC was entered); a different
> model gets `['REPLACE']`. While the device is in `INVENTORY` both get
> `['UPDATE']`. When the reported MAC is on another device, both get `['SWAP']`.
> When `macAddress` and `deviceModel` suggestions both say `REPLACE` or `SWAP`,
> they describe one hardware change — show them as one card with one button.

> Read-only diff between what AirOS last reported about its own hostname/MAC
> and what's on file in device-inventory (WLS-164) — never auto-written. Name
> matching is trim + case-insensitive; MAC matching is separator/case-normalized
> the same way `.../clients/expected` matches. A device that has never been
> polled returns `polled: false` and an empty `suggestions` array rather than 404. Serial number is never compared — AirOS does not expose one.  
> **Frontend:** render each suggestion as an accept/dismiss row; accepting one
> means the call its first `actions` entry names (see above) — this endpoint
> never writes to device-inventory itself.
>
> **Parent AP (WLS-151, STATION only).** An `upstreamDeviceId` suggestion
> appears when the AP from the latest poll differs from the declared one
> (`currentValue: null` when none is declared). The AP is matched by the
> MAC the radio reports and, failing that, by the AP IP it reports. Values
> are device ids, so show `currentLabel`/`suggestedLabel`. Accepting one
> means calling `PATCH /api/devices/:id` with
> `{ upstreamDeviceId: suggestedValue }` — the same call as every other
> suggestion now. Because a poll already declares the
> AP when the MAC match is exact and none is declared (WLS-012), this
> suggestion usually means drift or an IP-only match.
>
> **Drift alert (WLS-013).** When the radio reports an AP other than the
> declared one for three polls in a row, a `WARNING` alert with metric
> `parent_ap_mismatch` (type `wireless:parent_ap_mismatch:WARNING` on
> `/api/alerts`) opens and is notified. Its message names both APs. It is the
> same mismatch this suggestion offers, so a link from the alert to this
> device's suggestions is the fix. Accepting the suggestion closes the alert
> on the next poll. It opens no ticket. It can be muted like any wireless
> metric (`parent_ap_mismatch`).

---

### `GET /api/devices/:id/wireless/throughput/stream` — Live Throughput (SSE)

**Status:** 200 (`text/event-stream`) | 400 | 401 | 404 | 429

A Server-Sent Events stream, not a JSON endpoint. Errors are still plain JSON —
the failure path runs before any stream header is written, so a 404 looks like
every other 404 here.

**Authentication.** These two routes, the diagnosis stream below and the
router traffic stream (`GET /api/routers/traffic/stream`) and the network
sweep (`GET /api/network/sweep/stream`) accept
`?token=<jwt>` in addition to `Authorization: Bearer` — the browser
`EventSource` API cannot set headers. Every other route in this document
remains header-only.

```js
const es = new EventSource(
  `/api/devices/${deviceId}/wireless/throughput/stream?token=${jwt}`
);
es.addEventListener('throughput', (e) => render(JSON.parse(e.data)));
```

The first `throughput` event arrives immediately with the current reading; each
later one arrives when the poller stores a new snapshot for this device. There
is no fixed cadence — it tracks the device's `intervalSecs`.

```
retry: 5000

event: throughput
data: {"deviceId":"…","deviceType":"STATION","collectedAt":"2026-08-12T10:00:00.000Z",
       "ageSeconds":12,"stale":false,"throughputTxBps":8000000,"throughputRxBps":2000000,
       "throughputTotalBps":10000000,"linkCapacityKbps":50000,"linkCapacitySource":"CONTRACT",
       "utilisationPercent":20}

: ping
```

> `: ping` comment frames arrive every 15s to keep proxies from reaping an idle
> connection. `retry: 5000` tells `EventSource` to reconnect after 5s.

Returns 404 when the device has never been polled — there is no reading to
stream. Returns 429 once a user holds 5 concurrent streams, or the server holds
200; the body is `{ "error": "Too many streams" }`.

---

### `GET /api/wireless/throughput/stream` — Live Fleet Throughput (SSE)

**Status:** 200 (`text/event-stream`) | 401 | 429

Same transport and authentication as the per-device stream. **The opening frame
has a different event name and a different shape from the ones that follow:**

| Order       | Event                 | Payload                                         |
| ----------- | --------------------- | ----------------------------------------------- |
| First only  | `throughput-snapshot` | `{ devices: WirelessThroughputDTO[], total }`   |
| Every later | `throughput`          | A single `WirelessThroughputDTO` for one device |

> A client that assumes a full list on every frame will render wrong. Seed state
> from `throughput-snapshot`, then upsert each `throughput` delta by `deviceId`.

```js
const es = new EventSource(
  `/api/wireless/throughput/stream?token=${jwt}`
);
const fleet = new Map();

es.addEventListener('throughput-snapshot', (e) => {
  for (const d of JSON.parse(e.data).devices)
    fleet.set(d.deviceId, d);
});
es.addEventListener('throughput', (e) => {
  const d = JSON.parse(e.data);
  fleet.set(d.deviceId, d);
});
```

Devices that have never been polled are absent — a row of nulls would read as
idle rather than unknown. An empty fleet is `{ "devices": [], "total": 0 }`, not
a 404.

---

### `GET /api/routers/traffic/stream` — Live Router Traffic (SSE)

**Status:** 200 (`text/event-stream`) | 401 | 429 | 500  
**Roles:** every role (`read`) · **Since:** 2026-10-14

What the **main routers** carry right now, per interface, read from the router
itself every 2 seconds while the stream is open (MON-060 … MON-066). This is the
live traffic page's source; unlike `/api/wireless/throughput/stream`, it does
not wait for a poll, so the numbers are at most ~2 s old.

- **Which routers:** every device with `category: 'GATEWAY'`, status `ACTIVE` or
  `COMMISSIONING`, not in the recycle bin, by name. Setting a device's category
  to `GATEWAY` is how a router gets onto the page.
- **What is needed to read one:** a MikroTik with an IP address, an HTTP
  username/password saved in its credentials, and the RouterOS **API** service
  enabled on the credentials' `apiPort` (default 8728). On an install hosted
  off site, the router must also be assigned to an agent running `0.6.0` or
  newer.
- **Which interfaces:** the router's static, enabled interfaces (ether, sfp,
  bridge, vlan, …), at most 64. Dynamic ones — one PPPoE/L2TP session per
  customer — are left out.

Same transport and authentication as the throughput streams. **The opening
frame has a different event name and shape from the ones that follow:**

| Order       | Event                     | Payload                                    |
| ----------- | ------------------------- | ------------------------------------------ |
| First only  | `router-traffic-snapshot` | `RouterTrafficSnapshotDTO`                 |
| Every later | `router-traffic`          | A single `RouterTrafficDTO` for one router |

```ts
interface RouterInterfaceTrafficDTO {
  name: string; // 'ether1-wan'
  type: string; // RouterOS's own type: 'ether', 'sfp-sfpplus', 'bridge', 'vlan', …
  running: boolean; // link up
  rxBps: number; // bits per second received on this interface
  txBps: number; // bits per second sent
}

interface RouterTrafficDTO {
  deviceId: string;
  deviceName: string;
  at: string | null; // ISO time of the last read; null until the first one finishes
  // Why there are no rates. Set → interfaces is []. Show it on the router's card.
  error: string | null;
  interfaces: RouterInterfaceTrafficDTO[];
}

interface RouterTrafficSnapshotDTO {
  intervalSeconds: number; // 2 — how often a router's frame arrives
  routers: RouterTrafficDTO[]; // every main router, readable or not
}
```

```js
const es = new EventSource(
  `/api/routers/traffic/stream?token=${jwt}`
);
const routers = new Map();

es.addEventListener('router-traffic-snapshot', (e) => {
  for (const r of JSON.parse(e.data).routers)
    routers.set(r.deviceId, r);
});
es.addEventListener('router-traffic', (e) => {
  const r = JSON.parse(e.data);
  routers.set(r.deviceId, r); // replace the router's card; append rates to its chart
});
```

> The opening frame of the **first** viewer has `at: null` and empty
> `interfaces` for every router — the routers are only asked once someone
> opens the page; their first `router-traffic` frame follows within a couple
> of seconds. A viewer who joins later opens with the newest reading.

`error` values the page should expect:

| `error`                                                 | Meaning                                                               |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| `Live traffic is read from MikroTik routers only`       | The GATEWAY is another vendor's                                       |
| `The router has no IP address`                          | Set the device's IP                                                   |
| `The router has no username and password saved`         | Save an HTTP login in the device's credentials                        |
| `The router is not behind an agent`                     | Off site only: assign the router to the site's agent                  |
| `The agent must be updated to read router traffic`      | Off site only: the agent is older than `0.6.0`                        |
| `The agent is not connected` / `The agent disconnected` | Off site only: the agent is offline                                   |
| `The agent did not answer in time`                      | Off site only: no answer within 8 s                                   |
| `RouterOS API error: …`                                 | The router refused the login, the API service is off, or it timed out |

No frame for a router means its read is still out; a slow router is skipped,
not queued. Nothing is stored — closing every viewer stops the reads. An empty
list is `{ "intervalSeconds": 2, "routers": [] }`, not a 404. `500` with
`{ "error": "Database error listing main routers: …" }` when the list cannot be
read; `429` as for the other streams (the 5-per-user cap counts every stream a
user holds).

---

### `GET /api/devices/:id/wireless/alerts` — Active Alerts for Device

**Status:** 200 | 400

```ts
// Response — raw array
WirelessAlertDTO[]
```

> Returns all currently active wireless alerts for the given device.  
> Returns an empty array if the device has no active alerts (does not 404 on unknown device IDs).

---

### `GET /api/devices/:id/wireless/alerts/history` — Alert History for Device

**Status:** 200 | 400

```ts
// Query params (all optional)
from?:  string  // ISO 8601 with offset
to?:    string  // ISO 8601 with offset
limit?: number  // 1–500

// Response — raw array
WirelessAlertDTO[]
```

> Returns all alerts (active and cleared) for the device within the optional time window.  
> Returns an empty array for unknown device IDs.

---

### `POST /api/devices/:id/wireless/alerts/:alertId/clear` — Clear Alert

**Status:** 200 | 400 | 404  
**Roles:** ADMIN, OPERATOR

```ts
// No request body

// Response
WirelessAlertDTO; // isActive: false
```

> Manually clears an active alert — the same transition `PollWirelessDeviceUseCase` makes automatically when a metric recovers, including the recovery notification/ticket-close side effects.  
> **Idempotent.** Clearing an already-cleared alert returns `200` with its current state, not an error.  
> Returns 404 if the alert doesn't exist, or exists but belongs to a **different** device than `:id` (the two cases aren't distinguished in the response, so a client can't probe another device's alert ids).

---

### `POST /api/devices/:id/wireless/alerts/clear` — Bulk Clear Alerts

**Status:** 200 | 400  
**Roles:** ADMIN, OPERATOR

```ts
// Request body (optional)
{ ids?: string[] }   // omit entirely to clear every active alert for this device

// Response
{
  cleared: WirelessAlertDTO[]
  skipped: { id: string, reason: string }[]   // e.g. already cleared
  failed:  { id: string, error: string }[]    // e.g. not found, or belongs to another device
}
```

> Always returns `200` with a bucketed report — clearing alerts one at a time doesn't scale after a device trips several metrics at once.  
> Omitting `ids` clears the device's full active-alert list without the caller having to fetch it first.

---

### `POST /api/devices/:id/wireless/poll` — Trigger Immediate Poll

**Status:** 202 | 400 | 404 | 409 | 502 | 504

```ts
// No request body

// Response (202)
{
  deviceId: string
  collectedAt: string         // ISO 8601
  metricsCollected: boolean
  alertsTriggered: number
  alertsCleared: number
  collectionMethod: string    // 'http_api' (Ubiquiti AirOS) | 'snmp' (Mimosa)
  skipped?: boolean           // true if polling was disabled and forceExecution not set
}
```

> Triggers an on-demand poll. Returns 404 if the device has no wireless polling configuration.  
> The collector is chosen by the vendor of the device's model (WLS-053): Ubiquiti devices are polled over the AirOS HTTP API with the device's HTTP credentials, Mimosa devices over SNMP with its SNMP credentials. Returns 400 `Wireless polling is not supported for vendor '<slug>'` for any other vendor.  
> The poll attempts real device connectivity — expect 400/500 in environments without reachable devices.

> **⚠ Changed 2026-10-01 — off-site server (WLS-029):** on an install whose
> server is not on the monitored network (`SERVER_ON_SITE=false`), a device
> behind an on-site agent (`agentId` set) is read through that agent. The
> response is the same as for any other device, with `collectedAt` when the
> agent read the radio. When the agent gives no reading, nothing is recorded
> and the error starts with `"Cannot poll device — "`:
>
> | Status | Error ends with                                            | Show                                  |
> | ------ | ---------------------------------------------------------- | ------------------------------------- |
> | `409`  | `its on-site agent is not connected`                       | "the agent is offline"                |
> | `409`  | `its on-site agent must be updated to read it on demand`   | "update the agent" (older than 0.3.0) |
> | `504`  | `its on-site agent did not answer in time` (25 s)          | a retry                               |
> | `502`  | `its on-site agent could not read it: <the agent's error>` | the agent's error                     |
>
> A device **without** an agent still answers `409` > `"Cannot poll device — this server is not on the monitored network"`.
>
> **Frontend:** on such installs, show the wireless "poll now" button for
> devices with an `agentId` and hide it for the rest. An on-site install (the
> default) keeps it working for every device, reading each radio from the
> server.

---

### `POST /api/devices/:id/wireless/reboot` — Reboot Device (AirOS 8)

**Status:** 202 | 400 | 404 | 409 | 500  
**Roles:** ADMIN, OPERATOR

Reboots the antenna remotely via its AirOS 8 HTTP API. Requires the device to have a **wireless config** (source of the IP) and **HTTP credentials** (`httpUsername`/`httpPassword` via `PUT /api/devices/:id/credentials`).

```ts
// No request body

// Response (202) — raw, no wrapper
{
  deviceId: string; // UUID
  requestedAt: string; // ISO 8601 — when the reboot was accepted
}
```

> **202 means the device acknowledged the reboot request** — it then goes offline for ~1–2 minutes while restarting. Expect polls/status to fail during that window; show a "rebooting…" state rather than an error.  
> Returns 404 if the device has no wireless polling configuration.  
> Returns 400 if credentials are not configured, the device has SNMP access but no HTTP login (`"HTTP credentials not configured for device"`), or it has no IP address.  
> Returns 500 if the device is unreachable or authentication against it fails.  
> This is a destructive-ish action — put it behind a confirmation dialog in the UI.

> **Off-site server (WLS-029):** on an install whose server is not on the
> monitored network (`SERVER_ON_SITE=false`), every device — with or without
> an `agentId` — answers `409` `"Cannot reboot device — this server is not on the monitored network"`.
> Hide the reboot button for every device on such installs. An on-site
> install (the default) keeps it working for every device.

---

### `POST /api/devices/:id/wireless/key/reveal` — Reveal Wi-Fi Key (AirOS)

**Status:** 200 | 400 | 401 | 403 | 404 | 409 | 502 | 504  
**Roles:** ADMIN, OPERATOR (`reveal-credentials`) — never VIEWER

Reads the radio's Wi-Fi security **live from the radio** (its `system.cfg`)
and returns the SSID and the WPA key in plaintext (WLS-220, WLS-221). Same
unlock as the credential reveal: the user's password, valid **5 minutes**
for any device (IDN-086). Needs a **wireless config** (the IP) and an **HTTP
login** in the device credentials. AirOS (Ubiquiti) radios only (WLS-222).

```ts
// Headers
X-Credential-Reveal-Token: string // revealToken from POST /api/users/me/credential-reveal

// No request body

// Response (raw, no wrapper), sent with Cache-Control: no-store
interface RevealedWirelessKeyDTO {
  deviceId: string;
  // What the radio's configuration says, which may differ from the role the
  // device was registered with.
  role: 'ACCESS_POINT' | 'STATION';
  ssid: string | null;
  // WPA_PSK: `key` holds the shared key. OPEN: no security. OTHER: WPA
  // Enterprise or WEP — nothing to show, `key` is null.
  security: 'WPA_PSK' | 'OPEN' | 'OTHER';
  key: string | null;
  readAt: string; // ISO 8601
}
```

> **Flow for the frontend:** the same as "show password" on the credentials
> screen — reuse the held `revealToken` if it has not expired, otherwise ask
> for the password first. Expect it to take a few seconds: the radio is read
> each time.
>
> `403 { success: false, error: 'Enter your password to see device credentials' }`
> — no unlock or an expired one; ask for the password again.
> `403 { success: false, error: 'Forbidden' }` — VIEWER; hide the button.
> `404` — no wireless config.
> `400` — no HTTP login, no IP address, or not an AirOS radio
> (`"... this vendor's radios are not supported yet ..."`).
> `409` — off site, the radio has no agent, or its agent is not connected.
> `502` — the radio, or the agent on its behalf, could not read it (wrong
> login, unreachable); `error` says what it answered.
> `504` — the agent did not answer in time.
>
> Every reveal is logged with the user and the device. Off site the agent
> reads the file with the request it already uses for backups, so agents
> from 0.5.0 on answer it.

---

### `PUT /api/devices/:id/wireless/hostname` — Rename Radio (AirOS)

**Status:** 200 | 400 | 401 | 403 | 404 | 409 | 502 | 504  
**Roles:** ADMIN, OPERATOR (`update`)

Changes the **name the radio gives itself** (AirOS "Device Name", the
`hostname` the wireless status shows). It does **not** rename the device in
the inventory. The change is saved on the radio and applied at once, with no
restart, so the link stays up (WLS-224). Done over SSH with the device's HTTP
login, on its `sshPort`.

```ts
// Request
{
  hostname: string; // 1–32 characters: letters, digits, spaces, . - _ (no accents)
}

// Response (200) — raw, no wrapper
{
  deviceId: string;
  hostname: string; // as saved, trimmed
  renamedAt: string; // ISO 8601
}
```

> `400` — a name outside the rule above (`"Radio name must be ..."`, WLS-223),
> no HTTP login, no IP address, or not an AirOS radio.
> `404` — no wireless config.
> `409` — off site, the radio has no agent, its agent is not connected, or its
> agent is older than **0.8.0** (`"... its on-site agent must be updated first ..."`, AGT-120).
> `502` — the radio refused: SSH off or on another port, wrong login, or it
> did not confirm the change. `error` carries what it said.
> `504` — the agent did not answer in time.
>
> The wireless status shows the new name after the next poll; trigger one
> with `POST /api/devices/:id/wireless/poll` to see it at once.

> **Known issue (2026-10-27):** renaming does not work on an **AirOS 6** radio
> (old BusyBox shell). A hardware test still failed after two fixes: the name
> check no longer uses `grep -x`, and the name is applied through
> `/proc/sys/kernel/hostname` because there is no `hostname` command. Expect a
> `502` there. Not yet verified on AirOS 8. Left as is for now.

---

### Live Link Diagnosis

A time-boxed, on-demand check of one radio, meant for a technician looking at a
failing antenna. While a session runs the server:

- **pings the device every second**, and its **parent AP** too for a STATION,
  so the report can say whether the fault is on this link or upstream
- **reads the radio every 2 s** (AirOS `status.cgi`) for live throughput,
  signal, SNR, CCQ, airMAX capacity, radio latency and LAN state
- rebuilds a **report** after every radio read: ping statistics per hop, the
  findings, a verdict and a likely fault location

Nothing is stored. A session lives in server memory, is readable for 15 minutes
after it ends, and never opens alerts or sends notifications. Start it with
`POST`, then watch it on the stream.

```ts
type DiagnosisVerdict =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'FAILING'
  | 'INCONCLUSIVE';
// TARGET_LINK: this radio or its own link; UPSTREAM: the parent AP or backhaul
type FaultLocation =
  | 'NONE'
  | 'TARGET_LINK'
  | 'UPSTREAM'
  | 'UNDETERMINED';

interface PingSampleDTO {
  hop: 'TARGET' | 'PARENT';
  at: string; // ISO 8601
  latencyMs: number | null; // null = no reply within 1 s
}

interface RadioSampleDTO {
  at: string;
  ok: boolean; // false = the read failed; see error
  error: string | null;
  throughputTxBps: number | null; // from interface byte counters between reads
  throughputRxBps: number | null;
  capacityTxKbps: number | null; // airMAX estimate
  capacityRxKbps: number | null;
  signalRxDbm: number | null;
  signalTxDbm: number | null;
  noiseFloorDbm: number | null;
  snrDb: number | null;
  ccqPercent: number | null;
  radioLatencyMs: number | null; // the radio's own tx latency, not the ping
  cpuLoadPercent: number | null;
  lanStatus: 'UP' | 'DOWN' | null;
  lanSpeedMbps: number | null;
}

interface PingStatisticsDTO {
  sent: number;
  received: number;
  lossPercent: number;
  minMs: number | null;
  avgMs: number | null;
  maxMs: number | null;
  jitterMs: number | null; // mean delta between consecutive replies
  spikeCount: number; // replies >= 150 ms
}

interface DiagnosisFindingDTO {
  code: string; // 'unreachable' | 'packet_loss' | 'high_latency' | 'latency_spikes'
  //   | 'jitter' | 'radio_unreadable' | any wireless alert metric, e.g. 'signal_rx_dbm'
  hop: 'TARGET' | 'PARENT' | 'RADIO';
  severity: 'WARNING' | 'CRITICAL';
  value: number | null;
  threshold: number | null;
  message: string; // Spanish, ready to display
}

interface LinkDiagnosisReportDTO {
  verdict: DiagnosisVerdict;
  faultLocation: FaultLocation;
  summary: string; // Spanish one-liner, ready to display
  findings: DiagnosisFindingDTO[];
  target: PingStatisticsDTO;
  parent: PingStatisticsDTO | null; // null when there is no parent hop
  radio: {
    samples: number;
    failures: number;
    throughput: {
      avgTxBps: number | null;
      avgRxBps: number | null;
      peakTxBps: number | null;
      peakRxBps: number | null;
      linkCapacityKbps: number | null; // contracted plan, else the manual value
    };
  };
  generatedAt: string;
}

interface LinkDiagnosisDTO {
  deviceId: string;
  deviceType: 'STATION' | 'ACCESS_POINT';
  status: 'RUNNING' | 'COMPLETED' | 'STOPPED';
  startedAt: string;
  endsAt: string;
  endedAt: string | null;
  durationSeconds: number;
  target: {
    deviceId: string | null;
    ipAddress: string;
    name: string | null;
  };
  parent: {
    deviceId: string | null;
    ipAddress: string;
    name: string | null;
  } | null;
  report: LinkDiagnosisReportDTO;
  samples?: { ping: PingSampleDTO[]; radio: RadioSampleDTO[] }; // GET and stream only
}
```

#### `POST /api/devices/:id/wireless/diagnosis` — Start (or Join) a Diagnosis

**Status:** 201 | 200 | 400 | 401 | 403 | 404 | 409 | 429 | 500  
**Roles:** ADMIN, OPERATOR

```ts
// Request (body optional)
{ durationSeconds?: number } // integer 10–300, default 60

// Response (201 started / 200 joined) — raw, no wrapper
{
  started: boolean; // false = a session was already running and was joined
  diagnosis: LinkDiagnosisDTO; // without samples
}
```

> Only one session runs per device. A second start while one is running
> returns **200** with that session and its original duration. It does not
> restart it.  
> Needs the same things as a poll: a wireless config with an IP, HTTP
> credentials and a supported vendor.  
> 400: bad duration, no credentials, no IP, unsupported vendor.  
> 404: no wireless config, or the device does not exist.  
> 409: the device may not be polled (monitoring disabled, retired…); the
> body says why.  
> 429 `Too many diagnosis sessions running`: the server runs at most
> `DIAGNOSIS_MAX_SESSIONS` sessions at once (default 5).

> **Off-site server (WLS-029):** on an install whose server is not on the
> monitored network (`SERVER_ON_SITE=false`), every device — with or without
> an `agentId` — answers `409` `"Cannot diagnose device — this server is not on the monitored network"`.
> Hide the diagnosis button for every device on such installs. An on-site
> install (the default) keeps it working for every device.
> The `GET`, `DELETE` and stream routes below then answer `404`: no session can
> exist for such a device.

#### `GET /api/devices/:id/wireless/diagnosis` — Current or Last Diagnosis

**Status:** 200 | 400 | 401 | 404  
**Roles:** all

Returns the running session, or the last one if it ended less than 15 minutes
ago, **with its samples**. 404 when there is neither.

#### `DELETE /api/devices/:id/wireless/diagnosis` — Stop a Diagnosis

**Status:** 200 | 400 | 401 | 403 | 404  
**Roles:** ADMIN, OPERATOR

Stops the running session early and returns it with `status: 'STOPPED'` and its
final report. 404 when nothing is running for the device.

#### `GET /api/devices/:id/wireless/diagnosis/stream` — Live Diagnosis (SSE)

**Status:** 200 (`text/event-stream`) | 400 | 401 | 404 | 429

Same transport, `?token=` authentication and connection caps as the throughput
streams. Opening this stream only **watches**. It does not start anything, so
start the session first. Reconnects and extra viewers add no load on the radio.

| Event       | When                        | `data`                              |
| ----------- | --------------------------- | ----------------------------------- |
| `diagnosis` | once, on connect            | `LinkDiagnosisDTO` **with** samples |
| `ping`      | each probe, ~1/s per hop    | `PingSampleDTO`                     |
| `radio`     | each radio read, ~every 2 s | `RadioSampleDTO`                    |
| `report`    | right after each `radio`    | `LinkDiagnosisReportDTO`            |
| `end`       | once, when the session ends | `LinkDiagnosisDTO` without samples  |

```js
await api.post(`/api/devices/${id}/wireless/diagnosis`, {
  durationSeconds: 60
});
const es = new EventSource(
  `/api/devices/${id}/wireless/diagnosis/stream?token=${jwt}`
);
es.addEventListener('diagnosis', (e) => hydrate(JSON.parse(e.data)));
es.addEventListener('ping', (e) =>
  pushLatencyPoint(JSON.parse(e.data))
);
es.addEventListener('radio', (e) =>
  pushRadioPoint(JSON.parse(e.data))
);
es.addEventListener('report', (e) =>
  renderVerdict(JSON.parse(e.data))
);
es.addEventListener('end', (e) => {
  renderVerdict(JSON.parse(e.data).report);
  es.close(); // required — otherwise EventSource reconnects into a finished session
});
```

> **Close the `EventSource` on `end`.** The server keeps the connection open
> after a session ends. If the client doesn't close it, the browser reconnects
> and gets the finished session's `diagnosis` frame again.  
> 404 when there is no session to watch (not started, or ended over 15
> minutes ago).

---

### `GET /api/wireless/hardware-changes` — Hardware Changes (Global)

**Status:** 200 | 401

Since 2026-10-27. Requires the `read` permission (every role).

```ts
// Response — no envelope
{
  devices: Array<{
    deviceId: string;
    name: string; // from device-inventory
    collectedAt: string; // ISO 8601, the poll the comparison used
    // Same shape as the per-device identity suggestions, but only
    // 'macAddress' and 'deviceModel' entries.
    suggestions: DeviceIdentitySuggestion[];
  }>; // sorted by name, not paged
}
```

> Every radio being polled (wireless config enabled, device not deleted) whose
> last poll reports a different model, or a different MAC than the one on file
> (WLS-154). A MAC reported where none is on file does not list a device by
> itself. Its suggestions follow the same rules as
> `GET /api/devices/:id/wireless/identity/suggestions` (WLS-152, WLS-153), so
> the `actions` table there applies as-is.
>
> **Frontend:** a "Hardware changes" screen, one card per device: the name, what
> changed (`currentLabel`/`currentValue` → `suggestedLabel`/`suggestedValue`)
> and one button for the first action of the device's suggestions. `SWAP`
> devices come in pairs, each pointing at the other; accepting either fixes
> both, so refetch after any action. An empty `devices` array means nothing to
> fix. Show a count on the menu entry if it helps; the list is cheap to fetch.

---

### `GET /api/wireless/alerts` — All Active Alerts (Global)

**Status:** 200 | 400

```ts
// Query params (all optional)
deviceId?: string  // UUID — filter to a single device

// Response — raw array
WirelessAlertDTO[]
```

> Returns all currently active wireless alerts across all devices, or filtered by deviceId.

---

### `GET /api/wireless/alerts/history` — Alert History (Global, filtered by device)

**Status:** 200 | 400

```ts
// Query params
deviceId: string   // UUID — required (use /api/devices/:id/wireless/alerts/history for the same)
from?:    string   // ISO 8601 with offset
to?:      string   // ISO 8601 with offset
limit?:   number   // 1–500

// Response — raw array
WirelessAlertDTO[]
```

> Note: `deviceId` is **required** even though the route appears global. Omitting it returns 400.  
> Prefer `GET /api/devices/:id/wireless/alerts/history` for per-device history.

---

## Wireless Alert Thresholds `/api/wireless/alert-thresholds`, `/api/devices/:id/wireless/alert-thresholds`

> **Response envelope:** unlike the other wireless endpoints, these use
> `{ success: true, data }` / `{ success: false, error }`.

The limits the wireless alert rules open at (WLS-200). The install has one set,
edited by its administrator. Until the first save it is the defaults below, so
`GET` always answers. A device can override any group of it (WLS-201), e.g. a
long backhaul allowed 20 km at 40 MHz. A save applies from the next poll, with
no restart. A live diagnosis started afterwards uses it too.

```ts
interface SeverityThresholdsDTO {
  warning: number;
  critical: number;
}

interface AlertThresholdsDTO {
  signalDbm: SeverityThresholdsDTO; // whole, −100…−40; warning above critical. Rx and Tx
  snrDb: SeverityThresholdsDTO; // whole, 1…60; warning above critical
  ccqPercent: SeverityThresholdsDTO; // whole, 1…95; warning above critical. M-series only
  latencyMs: SeverityThresholdsDTO; // whole, 1…10000; warning BELOW critical
  cpuPercent: number; // whole, 10…99
  memoryPercent: number; // whole, 10…99
  clockDriftSeconds: number; // whole, 10…86400
  saturationPercent: number; // whole, 10…100 — share of link capacity
  clientDropPercent: number; // whole, 10…90 — share of an AP's clients lost between polls
  minCapacityMbps: Record<string, number>; // channel width (MHz) → floor; whole, 1…10000
  maxDistanceKm: Record<string, number>; // channel width (MHz) → maximum; 0.1…200, decimals allowed
  confirmBeforeAlerting: boolean; // re-read the radio before opening a flicker-prone alert (WLS-203)
}
```

Channel-width keys must be one of `5, 10, 20, 30, 40, 50, 60, 80, 160`. A width
missing from a table is not checked at all. Defaults:

| Group                   | Default                              |
| ----------------------- | ------------------------------------ |
| `signalDbm`             | warning −70, critical −80            |
| `snrDb`                 | warning 15, critical 10              |
| `ccqPercent`            | warning 75, critical 50              |
| `latencyMs`             | warning 50, critical 150             |
| `cpuPercent`            | 80                                   |
| `memoryPercent`         | 85                                   |
| `clockDriftSeconds`     | 300                                  |
| `saturationPercent`     | 80                                   |
| `clientDropPercent`     | 50                                   |
| `minCapacityMbps`       | `{ "20": 50, "40": 100, "80": 200 }` |
| `maxDistanceKm`         | `{ "20": 15, "40": 10, "80": 5 }`    |
| `confirmBeforeAlerting` | `true`                               |

Each rule still clears slightly past its threshold (signal and SNR 2 dB, CCQ 3 %
warning / 5 % critical, CPU and memory 5 %), so the margin moves with the value
you set (WLS-081). An alert already open when a threshold changes is re-judged
on the next poll. It clears once the reading passes the new clear line.

**`confirmBeforeAlerting`** (WLS-203) is an on/off switch, not a limit. While it
is on, a CCQ, latency, signal (Rx/Tx), SNR or capacity alert does not open on
the poll that first sees it. The server re-reads the radio 5 times, 4 s apart,
and opens the alert only if most of those readings breach too. A low CCQ on an
idle link (under 0.5 Mbps of traffic) does not count (WLS-204). An alert that
is not confirmed is not re-checked for 10 minutes. Alerts that pass the check
open about 25 s later than before. Other alerts and every clear are unaffected.
Show it as a toggle, e.g. "Confirmar antes de alertar".

### `GET /api/wireless/alert-thresholds`

**Status:** 200 | 401  
**Roles:** all

```ts
{
  success: true,
  data: {
    thresholds: AlertThresholdsDTO; // what the install alerts at
    defaults: AlertThresholdsDTO;   // for a "restore defaults" button
  }
}
```

---

### `PUT /api/wireless/alert-thresholds` — Save

**Status:** 200 | 400 | 401 | 403  
**Roles:** ADMIN (`manage-settings`; OPERATOR and VIEWER get `403`)

```ts
// Request body — every group, nothing else. Replaces the set as a whole.
// confirmBeforeAlerting may be left out: the install keeps its current value.
AlertThresholdsDTO;

// Response — same shape as GET
```

> `400` with the rule's message, e.g.
> `"signalDbm.warning must be higher than signalDbm.critical"`,
> `"maxDistanceKm.40 must be from 0.1 to 200"` or
> `"minCapacityMbps channel width must be one of 5, 10, 20, 30, 40, 50, 60, 80, 160 MHz"`.

---

### `GET /api/devices/:id/wireless/alert-thresholds`

**Status:** 200 | 400 | 401 | 404  
**Roles:** all

```ts
{
  success: true,
  data: {
    deviceId: string;
    overrides: Partial<AlertThresholdsDTO>; // {} when the device follows the install
    install: AlertThresholdsDTO;            // the install's set, to show what is inherited
    effective: AlertThresholdsDTO;          // what this device actually alerts at
  }
}
```

> `404` when the device has no wireless config.

---

### `PUT /api/devices/:id/wireless/alert-thresholds` — Override

**Status:** 200 | 400 | 401 | 403 | 404  
**Roles:** ADMIN, OPERATOR (`update`; VIEWER gets `403`)

```ts
// Request body — replaces the device's overrides as a whole
{
  overrides: Partial<AlertThresholdsDTO>;
} // {} returns the device to the install

// Response — same shape as GET
```

> A group in `overrides` replaces the install's group whole: send both
> `warning` and `critical`. The two channel-width tables are the exception:
> they merge per width, so `{ "maxDistanceKm": { "40": 20 } }` changes 40 MHz
> only and keeps the install's 20 and 80 MHz values. A device cannot remove a
> width the install checks. To stop checking one, set a generous value.
> `{ "confirmBeforeAlerting": false }` turns the confirmation off for this
> device only.  
> `400` with the same messages as the install `PUT`. `404` when the device
> has no wireless config.

---

## Probe agents `/api/agents`

On-site agents that measure a customer's network from inside it and report to this backend (ADR 0002). The vendor creates an agent and gets a **pairing key** — the only thing the installer asks for. The key is shown **once**, in the create (or re-key) response; store nothing, show it with a copy button and a "this will not be shown again" warning.

**Lifecycle:** `PENDING → ACTIVE → REVOKED`. `PENDING` until the installer pairs; the key expires 24 h after it was issued (`pairingExpiresAt`) — offer "new key" for an expired pending agent. `REVOKED` is final. `lastSeenAt`, `agentVersion` and `clockOffsetMs` are set each time the agent connects and every 30 s while connected (`null` until it first connects). `clockDriftSince` is set when the PC's clock is more than a minute off and cleared once it is back within 30 s — show a "fix this PC's clock" hint while it is set; the results themselves are already corrected.

**On the PC:** the key is pasted into the agent's installer (or passed as `--pair <key>` on Linux); the agent pairs itself, which turns it `ACTIVE`. A key the backend refuses is thrown away by the agent, so the fix is always "new key", never "retry". Revoking makes the connected agent delete its token, its device list and its unsent results, then wait for a new key — the same PC can be paired again without reinstalling (`AGT-060`, `AGT-066`).

**What still runs from the server:** ping of a device with an `agentId` is always the agent's, a manual poll included, which asks the agent (MON-022). When the server sits on the monitored network (the default, and Insetel's case) it pings every device with no agent, and wireless poll, reboot and link diagnosis stay with it for every device. An install hosted off site (`SERVER_ON_SITE=false`) talks to no device itself: it pings nothing, reads a radio behind an agent through that agent, on schedule and on demand (WLS-029), backs up a device's configuration through its agent (BKP-015, BKP-016), answers `409` for manual ping and wireless poll of a device with no agent and for reboot and diagnosis of any device, and refuses the network scan (MON-023, WLS-029, DEV-171). There a device with no agent shows `UNKNOWN` and raises no down alert (MON-006, NOT-101) until it is moved behind an agent. Read the setting from `GET /api/installation` (`serverOnSite`) and, when it is `false`, hide reboot and diagnosis for every device, hide ping and wireless poll for devices with no agent, and point those at "move to an agent".

**Updates:** agents update themselves (`AGT-080` … `AGT-085`). The vendor copies a signed release (`nms-agent-<version>.manifest.json` plus one `nms-agent-<version>-<platform>.gz` per platform) into `INSTALLERS_DIR`, next to the installers. Every connected agent running an older version is offered it within a minute, downloads it, checks the vendor's signature and installs it; `agentVersion` then shows the new version. `lastUpdate` tells how the last attempt ended: `INSTALLED`, `ROLLED_BACK` (the new version never reached the backend, so the previous one was put back) or `REJECTED` (size, checksum, signature or self-test failed; nothing changed), with the agent's `reason` for a failure. Show a failure as a warning on the agent page; the agent keeps measuring with the version it runs, and the vendor gets one Telegram message. A release that failed on an agent is not offered to it again — the vendor publishes a newer one. Agents installed before self-update (`0.1.0`) need one manual reinstall to get it.

**Online / offline:** an `ACTIVE` agent silent for 5 minutes (since `lastSeenAt`, or since `enrolledAt` if it never connected) gets `offlineSince` set, checked once a minute; its next contact clears it. `offlineSince !== null` is the offline badge — no need to compare `lastSeenAt` against the clock. `PENDING` and `REVOKED` agents are never offline. Going offline and coming back each send one Telegram message (to the install's chat and the vendor's); they are not device alerts, so they do not appear in `GET /api/alerts`.

```ts
interface AgentDTO {
  id: string; // UUID
  name: string; // unique, 1–60 chars
  status: 'PENDING' | 'ACTIVE' | 'REVOKED';
  pairingExpiresAt: string | null; // set only while PENDING
  enrolledAt: string | null;
  revokedAt: string | null;
  lastSeenAt: string | null;
  agentVersion: string | null;
  clockOffsetMs: number | null;
  offlineSince: string | null; // set only while ACTIVE and offline
  clockDriftSince: string | null; // set while the PC clock is >1 min off
  // How the last self-update ended (AGT-084); null until the agent reports one.
  lastUpdate: {
    version: string; // the version it tried to install
    outcome: 'INSTALLED' | 'ROLLED_BACK' | 'REJECTED';
    reason: string | null; // the agent's words; null once INSTALLED
    at: string;
  } | null;
  deviceCount: number; // live devices behind it; the recycle bin is not counted (AGT-010)
  createdAt: string;
  updatedAt: string;
}

interface AgentPairingDTO {
  agent: AgentDTO;
  pairingKey: string; // 'pk1.aHR0cHM6Ly9hcGkuZXhhbXBsZS5jb20.3q2-…' — shown once
}
```

### `POST /api/agents` — Create

**Status:** 201 | 400 | 409 | 503  
**Roles:** VENDOR (`manage-installation`; the customer's ADMIN gets `403`)

```ts
// Request body
{ name: string } // 1–60 chars, unique across all agents (revoked included)

// Response
{ success: true, data: AgentPairingDTO }
```

> 409 if the name is taken. 503 if the server has no `AGENT_PUBLIC_URL` configured — pairing is unavailable on this install.

---

### `GET /api/agents` — List

**Status:** 200  
**Roles:** all

```ts
// Response — oldest first, no pagination
{ success: true, data: { agents: AgentDTO[] } }
```

---

### `GET /api/agents/:id` — Get by ID

**Status:** 200 | 400 | 404  
**Roles:** all

```ts
{ success: true, data: AgentDTO }
```

---

### `GET /api/agents/:id/outages` — Offline history

**Status:** 200 | 400 | 401 | 404  
**Roles:** all

```ts
// Query params (optional)
limit?:  number // 1–100, default 20
offset?: number // ≥0, default 0

interface AgentOutageDTO {
  id: string; // UUID
  silentSince: string; // last contact before the silence: when it really began
  offlineSince: string; // when it was marked offline, ~5 min later
  endedAt: string | null; // null while the agent is still offline
  endReason: 'RECONNECTED' | 'REVOKED' | null;
}

// Response — newest first
{
  success: true,
  data: {
    outages: AgentOutageDTO[];
    total: number; // this agent's outages, all pages
    limit: number;
    offset: number;
    hasMore: boolean;
  }
}
```

> One entry per time the agent went offline (AGT-026). An open entry
> (`endedAt: null`) is the current outage and matches the agent's
> `offlineSince`. Show the length as `endedAt − silentSince`, or
> `now − silentSince` while open. History starts on 2026-09-29: an agent
> already offline then got one open entry; earlier outages are not recorded.
> 404 for an unknown agent; an agent that was never offline answers an empty
> page.

---

### `POST /api/agents/:id/pairing-key` — Issue a new pairing key

**Status:** 200 | 400 | 404 | 409 | 503  
**Roles:** VENDOR (`manage-installation`; the customer's ADMIN gets `403`)

```ts
// No body. Response
{ success: true, data: AgentPairingDTO }
```

> Only for a `PENDING` agent (409 otherwise). The previous key stops working immediately.

---

### `POST /api/agents/:id/revoke` — Revoke

**Status:** 200 | 400 | 404 | 409  
**Roles:** VENDOR (`manage-installation`; the customer's ADMIN gets `403`)

```ts
// No body. Response
{ success: true, data: AgentDTO } // status: 'REVOKED'
```

> Final. The agent's token and any unused key stop working. 409 if already revoked.

---

### `GET /agent/v1/ws` — Agent WebSocket (agents only)

The agents' live connection, authenticated with the agent token from enrollment (`Authorization: Bearer <token>`); never called by the dashboard. Protocol and close codes: `src/agent/protocol/` and `docs/business-rules/probe-agents.md` (`AGT-040` … `AGT-045`, updates `AGT-082`, `AGT-084`, requests from the backend `AGT-100` … `AGT-118`). An agent names what it answers in its hello: `probe` from `0.3.0`, `enforce` from `0.4.0`, `backup` from `0.5.0`, `traffic` from `0.6.0`.

---

### `GET /agent/v1/updates/:fileName` — Download a release binary (agents only)

Outside `/api`; the agent token is the credential (`Authorization: Bearer <token>`), a user's JWT is refused. Serves only a binary that a valid, signed release in `INSTALLERS_DIR` lists (`AGT-083`). Never called by the dashboard.

**Status:** 200 (`application/gzip`) | 400 (not a release binary name) | 401 (checked before the name) | 404 | 402 (subscription locked)

---

### `POST /agent/v1/enroll` — Pair an agent (called by the installer, not the dashboard)

Outside `/api`, no JWT — the pairing code is the credential. Documented so the frontend knows it exists; the dashboard never calls it.

**Status:** 201 | 400 | 401 | 429

```ts
// Request body — the code segment of the pairing key
{ pairingCode: string }

// Response — the token is returned once
{ success: true, data: { token: string; agentName: string } }
```

> 401 `Invalid or expired pairing code` for any unusable code (unknown, used, expired, revoked) — deliberately indistinguishable.

---

## Customers `/api/customers`

> **⚠ Breaking change (2026-10-26): `paymentDay` left the customer.** The 15th/30th collection group now belongs to each contracted service, because one customer can hold several services that fall due on different days (CUS-024).
>
> - `CustomerDTO` no longer has `paymentDay`.
> - `POST /api/customers` and `PUT /api/customers/:id` no longer accept it. It is ignored if sent, and a `PUT` whose only field is `paymentDay` gets `400` (`At least one field must be provided for update`).
>
> **Frontend:** remove the payment-day field from the customer form and the customer detail view, and ask for it on each service instead (see [Contracted Services](#contracted-services-apicontracted-services)). The migration copied each customer's old day onto all of their services, so nothing changes for existing data.

```ts
interface CustomerDTO {
  id: string; // UUID
  fullName: string;
  phone: string;
  email: string | null;
  cedula: string | null;
  createdAt: string; // ISO 8601
  updatedAt: string;
}
```

### `POST /api/customers` — Create

**Status:** 201 | 400

```ts
// Request body
{
  fullName: string         // required, 1–150 chars
  phone: string            // required, 7–20 chars, digits/spaces/()/.-/+ allowed
  email?: string | null    // max 255 chars, valid email format
  cedula?: string | null   // 6–15 chars, digits/dots/spaces
}

// Response
{ success: true, data: CustomerDTO }
```

---

### `GET /api/customers` — List

**Status:** 200

```ts
// Query params (all optional)
limit?:  number  // 1–100, default 20
offset?: number  // ≥0, default 0

// Response
{
  success: true,
  data: {
    customers: CustomerDTO[]
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

---

### `GET /api/customers/:id` — Get by ID

**Status:** 200 | 404

```ts
// Response
{ success: true, data: CustomerDTO }
```

---

### `PUT /api/customers/:id` — Update

**Status:** 200 | 400 | 404

```ts
// Request body (at least one field required)
{
  fullName?: string
  phone?: string
  email?: string | null
  cedula?: string | null
}

// Response
{ success: true, data: CustomerDTO }
```

---

### `DELETE /api/customers/:id` — Delete

**Status:** 204 | 400 | 404

```ts
// No request body
// Response: 204 No Content
```

---

## Service Plans `/api/service-plans`

```ts
interface ServicePlanDTO {
  id: string; // UUID
  name: string;
  downloadMbps: number; // positive integer
  uploadMbps: number; // positive integer
  monthlyPrice: number; // non-negative decimal
  description: string | null;
  isActive: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string;
}
```

### `POST /api/service-plans` — Create

**Status:** 201 | 400 | 409

```ts
// Request body
{
  name: string             // required, 1–100 chars
  downloadMbps: number     // required, positive integer (Mbps)
  uploadMbps: number       // required, positive integer (Mbps)
  monthlyPrice: number     // required, non-negative decimal
  description?: string | null  // max 500 chars
  isActive?: boolean       // default true
}

// Response
{ success: true, data: ServicePlanDTO }
```

> Returns 409 if a plan with the same name already exists. Name comparison is
> case-insensitive — `Plan 10 Mbps` and `plan 10 mbps` collide.

---

### `GET /api/service-plans` — List

**Status:** 200

```ts
// Query params (all optional)
limit?:  number  // 1–100, default 20
offset?: number  // ≥0, default 0

// Response
{
  success: true,
  data: {
    servicePlans: ServicePlanDTO[]
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

---

### `GET /api/service-plans/:id` — Get by ID

**Status:** 200 | 404

```ts
// Response
{ success: true, data: ServicePlanDTO }
```

---

### `PUT /api/service-plans/:id` — Update

**Status:** 200 | 400 | 404 | 409

```ts
// Request body (at least one field required)
{
  name?: string
  downloadMbps?: number
  uploadMbps?: number
  monthlyPrice?: number
  description?: string | null
  isActive?: boolean
}

// Response
{ success: true, data: ServicePlanDTO }
```

> Returns 409 if the new name is already taken by another plan, compared
> case-insensitively. Submitting the plan's own name is not a conflict —
> including "renaming" to a different case of its own current name.

---

### `DELETE /api/service-plans/:id` — Delete

**Status:** 204 | 400 | 404

```ts
// No request body
// Response: 204 No Content
```

---

## Contracted Services `/api/contracted-services`

> **⚠ Breaking change (2026-10-26): each service has its own `paymentDay`** (`15 | 30`, CUS-024), the day of the month its bill falls due. It used to be on the customer.
>
> - `ContractedServiceDTO.paymentDay`, and so also `ContractedServiceDetailDTO`, is always present.
> - `POST /api/contracted-services` takes `paymentDay?: 15 | 30`; omitted means `30` (CUS-025).
> - `PUT /api/contracted-services/:id` takes `paymentDay?: 15 | 30`. It can be the only field sent. A cancelled service refuses it with `409`.
> - Any other number → `400` `"Payment day must be one of 15, 30"`; a non-integer (e.g. `"15"` as a string) → `400` from validation.
>
> **Frontend:** add a "Fecha de corte / día de pago" selector (15 or 30, default 30) to the create-service form and the edit-service form, and show it in the service list and detail. The automatic cut and restore also act on one service now, not on the whole customer (BIL-310, BIL-311). A customer can therefore have one service `SUSPENDED` and another `ACTIVE` at the same time, so show status per service, not per customer.

```ts
type ContractedServiceStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'CANCELLED';

interface ContractedServiceDTO {
  id: string; // UUID
  customerId: string; // UUID
  servicePlanId: string; // UUID
  deviceId: string | null; // UUID — the CPE device assigned to this service
  status: ContractedServiceStatus;
  startDate: string; // ISO 8601
  paymentDay: 15 | 30; // the day of the month this service's bill is due (CUS-024)
  createdAt: string; // ISO 8601
  updatedAt: string;
}

// Returned by GET /:id and by every GET / response (filtered or not).
// Read-only summaries next to the id fields — the id fields stay.
interface ContractedServiceDetailDTO extends ContractedServiceDTO {
  customer: {
    id: string;
    fullName: string;
    phone: string;
    email: string | null;
    cedula: string | null;
  };
  servicePlan: {
    id: string;
    name: string;
    downloadMbps: number;
    uploadMbps: number;
    monthlyPrice: number;
    isActive: boolean;
  };
  device: {
    id: string;
    name: string;
    ipAddress: string | null;
    macAddress: string | null;
    status: DeviceStatus;
    category: DeviceCategory | null;
    deletedAt: string | null; // ISO 8601 — set when the device is in the trash
  } | null; // null exactly when deviceId is null
}
```

> `POST` and `PUT` still return the plain `ContractedServiceDTO`. Re-fetch `GET /:id` if you need the summaries after a write.

**Device link — what to expect:**

- **A device backs at most one contracted service, and cancelling releases it.** A `CANCELLED` service always has `deviceId: null` and `device: null` — it no longer records which device it used. So `?deviceId=` returns **0 or 1** items, and that item is never `CANCELLED`: it is the device's current service.
- **Cancelling also retires the device** (automatically, a moment after the `PUT` returns), going by the device's `ownerType`: `COMPANY` → `INVENTORY` (back to stock, free for the next customer); `CLIENT` → `DECOMMISSIONED` (the customer kept it); not set → left as it was. A retired device has monitoring off and its `ipAddress` cleared. A device already `DAMAGED`/`DECOMMISSIONED` is not touched. Re-fetch the device if you show its status after cancelling.
- **Soft-deleted device** (in the trash): a device with a non-cancelled service cannot be deleted, and cancelling releases it, so in practice no service points at one — `device.deletedAt` is there for completeness and will be `null`.
- **Hard-deleted device** (permanent delete or trash purge): same as above — no service can still point at it; if one did, its `deviceId` and `device` would be `null`.
- **No device yet** (a `PENDING` service waiting for installation, or one whose device was released after suspending): `deviceId: null`, `device: null`.

### `POST /api/contracted-services` — Create

**Status:** 201 | 400

```ts
// Request body
{
  customerId: string        // required, UUID
  servicePlanId: string     // required, UUID
  deviceId?: string | null  // UUID — CPE device for this service
  startDate?: string        // ISO 8601 datetime; defaults to now if omitted
  paymentDay?: number       // integer, 15 or 30; default 30 (CUS-024, CUS-025)
}

// Response
{ success: true, data: ContractedServiceDTO }
```

> New services are **always created as `PENDING`** — the create endpoint does not accept a `status` field. To activate one, assign a device (if not done at creation) and send `PUT /:id` with `{ status: 'ACTIVE' }`.  
> **Billing only includes `ACTIVE` services** — `POST /api/bills/generate` returns 409 for a service that is PENDING/SUSPENDED/CANCELLED.  
> **Payment day (since 2026-10-26):** the 15th/30th collection group belongs to the service, not the customer — two services of one customer can fall due on different days, and each gets its own bill. Any other day → `400` `"Payment day must be one of 15, 30"`; a non-integer → `400` from validation.

**Contracted service status lifecycle:**

| Transition                         | Requirements           | Notes                                                                                                                                                                                 |
| ---------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (create) → `PENDING`               | —                      | only possible initial status                                                                                                                                                          |
| `PENDING` / `SUSPENDED` → `ACTIVE` | `deviceId` must be set | 409 `"Cannot activate a contracted service without a device assigned"` otherwise                                                                                                      |
| `PENDING` / `ACTIVE` → `SUSPENDED` | —                      | triggers suspension side effects (see below)                                                                                                                                          |
| any → `CANCELLED`                  | —                      | **terminal** — every later update returns 409 `"Cannot modify a cancelled contracted service"`. Releases the device (`deviceId` → `null`) and retires it by owner — see _Device link_ |
| any → `PENDING`                    | **not allowed**        | `PENDING` is not a valid `status` value on `PUT` — returns 400                                                                                                                        |

**Suspension side effects (automatic, server-side):**

When a service transitions **into `SUSPENDED`**, the backend automatically (when the deployment has them configured):

1. **Throttles the customer's internet to 1 kbps** — a queue targeting the assigned device's IP is created on the core MikroTik router. Requires the service to have a `deviceId` with an IP address.
2. **Sends a WhatsApp notification** to the customer's `phone` (pre-approved template with the customer's name).

When a service transitions **out of `SUSPENDED`** (→ `ACTIVE` or `CANCELLED`), the throttle is removed automatically. Reactivation does not send a WhatsApp message.

> **The API contract is unchanged** — the `PUT` request/response shapes are exactly as documented above; side effects are fire-and-forget and never block or fail the status update.  
> Enforcement is **eventually consistent**: it is attempted immediately, and a background reconciler repairs any miss (router briefly unreachable, queue edited by hand) within ~60 seconds.  
> To show whether the throttle is **actually applied** on the router, use the [Suspension Enforcement Status](#suspension-enforcement-status) endpoints below.  
> If the service has **no device assigned** (or the device has no IP), the status still changes but the throttle cannot be applied — worth surfacing in the UI when suspending a device-less service.

---

### `GET /api/contracted-services` — List

**Status:** 200

```ts
// Query params (all optional)
customerId?: string  // UUID — filter by customer
deviceId?:   string  // UUID — filter by device; combines with customerId (AND)
limit?:      number  // 1–100, default 20
offset?:     number  // ≥0, default 0

// Response
{
  success: true,
  data: {
    contractedServices: ContractedServiceDetailDTO[]
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

- **Filtered by `customerId` and/or `deviceId`:** returns the whole matching set, newest `startDate` first. `limit` and `offset` are ignored; the response reports `limit: <count>`, `offset: 0`, `hasMore: false`.
- **Unfiltered:** paged with `limit`/`offset`, newest `createdAt` first.
- A well-formed `deviceId` or `customerId` that matches nothing returns **200 with an empty list**, never 404. A malformed one returns 400.
- **Device page:** `GET /api/contracted-services?deviceId=<id>` returns 0 or 1 item (see _Device link_ above). The live service is the one whose `status !== 'CANCELLED'`.

---

### `GET /api/contracted-services/:id` — Get by ID

**Status:** 200 | 400 | 404

```ts
// Response
{ success: true, data: ContractedServiceDetailDTO }
```

---

### `PUT /api/contracted-services/:id` — Update

**Status:** 200 | 400 | 404 | 409

```ts
// Request body (at least one field required)
{
  servicePlanId?: string         // UUID — change the plan (plan must exist → 404 otherwise)
  deviceId?: string | null       // UUID — assign CPE; null releases it
  status?: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'   // ⚠ PENDING is NOT accepted → 400
  paymentDay?: number            // 15 or 30 — moves the service to the other collection group; 409 on a cancelled service
}

// Response
{ success: true, data: ContractedServiceDTO }
```

**Business rules:**

- `status: 'PENDING'` is rejected with 400 — services can never return to PENDING.
- `status: 'ACTIVE'` requires the service to have a device (either already assigned or included as `deviceId` in the same request) — otherwise 409 `"Cannot activate a contracted service without a device assigned"`.
- `deviceId: null` on an **ACTIVE** service returns 409 `"Cannot release the device of an ACTIVE service; suspend it first"`.
- A device can belong to only one contracted service — assigning a taken device returns 409 `"This device is already assigned to another contracted service"`.
- **CANCELLED is terminal** — any update to a cancelled service returns 409.
- **Cancelling releases the device** — the response already has `deviceId: null`, even for an `ACTIVE` service (no need to suspend first). The device is then set to `INVENTORY` or `DECOMMISSIONED` by its owner (see _Device link_).
- Fields in one request are applied in a fixed order: plan change → suspend → device change → activate → cancel. So a single `PUT` can do `{ status: 'SUSPENDED', deviceId: null }` (suspend then release) or `{ deviceId: '…', status: 'ACTIVE' }` (assign then activate).

---

### `DELETE /api/contracted-services/:id` — Delete

**Status:** 204 | 400 | 404

```ts
// No request body
// Response: 204 No Content
```

---

## Suspension Enforcement Status

Live view of which suspensions are **actually enforced on the router** (vs. just `status: SUSPENDED` in the DB). These endpoints query the MikroTik router in real time — the answer is always current, but each call costs a router round-trip (~100–300 ms).

On an install hosted off site (`serverOnSite: false`) the router is read and changed through the agent the router device belongs to, which must run agent `0.4.0` or later; an offline or older agent, or a router with no agent, fails the call like an unreachable router (SVC-070, AGT-110).

A suspended service is "enforced" when its throttle queue exists on the router. It can be un-enforced because: the service has no device/IP, the router was unreachable when suspension happened (the reconciler will fix it within ~60 s), or someone removed the queue by hand.

Uses the standard `{ success, data }` envelope.

### `GET /api/enforcement/suspensions` — All Enforced Suspensions

**Status:** 200 | 503

```ts
// No query params

// Response
{
  success: true,
  data: {
    checkedAt: string      // ISO 8601 — when the router was queried
    enforcements: Array<{
      contractedServiceId: string  // UUID — join against your contracted services
      targetIp: string             // the IP currently being throttled
    }>
  }
}
```

> **One router call for everything** — prefer this on list views: fetch once, build a `Set` of enforced `contractedServiceId`s, and badge each SUSPENDED row as "throttled" / "not yet throttled".  
> Returns `503` when enforcement is not configured on the backend, or the router is unreachable — treat as "enforcement status unknown", not as "not enforced".

---

### `GET /api/contracted-services/:id/enforcement` — Enforcement Status for One Service

**Status:** 200 | 400 | 503

```ts
// Response
{
  success: true,
  data: {
    contractedServiceId: string
    enforced: boolean           // true = throttle queue exists on the router
    targetIp: string | null     // IP being throttled; null when not enforced
    checkedAt: string           // ISO 8601
  }
}
```

> Use on the service/customer detail view, or as a "verify now" refresh after suspending.  
> `enforced: false` for an `ACTIVE` service is normal (nothing to enforce). `enforced: false` for a `SUSPENDED` service means the throttle isn't applied (yet) — show a warning and re-check after ~60 s before escalating.  
> Returns `400` for a non-UUID id, `503` when enforcement is not configured or the router is unreachable (= status unknown).

---

## Bills `/api/bills`

> **⚠ Breaking change (2026-10-26): bills are per contracted service, not per customer** (BIL-007).
>
> - `POST /api/bills/generate` takes **`contractedServiceId`** instead of `customerId`. Sending only `customerId` now gets `400`. Errors: `404` unknown service; `409` `"Contracted service is not active and cannot be billed"`; `409` when a non-cancelled bill already exists for that service and period.
> - `POST /api/bills/generate-bulk`: one bill per ACTIVE service, so a customer with two services gets two bills. The `skipped[]` and `failed[]` entries carry **`contractedServiceId`** instead of `customerId`.
> - `BillDTO` is unchanged and still has `customerId`. New bills have exactly one entry in `lineItems`, and `lineItems[0].contractedServiceId` names the service. Bills from before this date may have several lines.
> - The due date of an automatic bill is the service's `paymentDay`.
>
> **Frontend:** the "generate bill" dialog must pick a **service** (e.g. the customer's ACTIVE services, from `GET /api/contracted-services?customerId=`), not a customer. Update the bulk-result view to read `contractedServiceId`. In a customer's bill list, expect several bills for the same period and label each with its service or plan (`lineItems[0].planName`).

One bill per **contracted service** per billing period (`'YYYY-MM'`) — a customer with two services gets two bills a month, each due on its service's `paymentDay` (BIL-007, since 2026-10-26). New bills have exactly one line item; bills issued before that date may hold several. Line items snapshot the plan name and price **at generation time** — later plan price changes never affect existing bills. Each line's `amount` is what it charges: the monthly price, or a prorated share on bills from the daily automatic run (BIL-287…290). `total` is the sum of the line amounts.

**Lifecycle:** `PENDING → PAID | OVERDUE | CANCELLED`. `PAID` and `CANCELLED` are terminal. `OVERDUE` bills can still be paid or cancelled.

```ts
interface BillLineItemDTO {
  contractedServiceId: string; // UUID
  servicePlanId: string; // UUID
  planName: string; // snapshot at generation time
  monthlyPrice: number; // snapshot at generation time
  amount: number; // charged: monthlyPrice, or a prorated share in whole pesos
  serviceFrom: string | null; // 'YYYY-MM-DD', first day charged; null on lines before 2026-10-06
  serviceTo: string | null; // 'YYYY-MM-DD', last day charged (included)
}

type PaymentMethod =
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'NEQUI'
  | 'DAVIPLATA'
  | 'BRE_B'
  | 'OTHER';

interface BillPaymentDTO {
  method: PaymentMethod;
  reference: string | null; // receipt or transaction number
  amount: number; // always the bill's total
  paidAt: string; // ISO 8601 — when the customer paid
  recordedByUserId: string | null; // UUID of the user who entered it
}

interface BillDTO {
  id: string; // UUID
  customerId: string; // UUID
  period: string; // 'YYYY-MM', e.g. '2026-07'
  status: BillStatus;
  issueDate: string; // ISO 8601
  dueDate: string; // ISO 8601
  paidAt: string | null; // ISO 8601 — null until marked paid
  payment: BillPaymentDTO | null; // null until paid, and on bills paid before 2026-10-06
  total: number; // sum of lineItems amount
  lineItems: BillLineItemDTO[];
  createdAt: string; // ISO 8601
  updatedAt: string;
}
```

### `POST /api/bills/generate` — Generate Bill for a Contracted Service

**Status:** 201 | 400 | 404 | 409 | 500  
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{
  contractedServiceId: string   // required, UUID — ⚠ was customerId before 2026-10-26
  year: number         // required, integer 2000–2100
  month: number        // required, integer 1–12
  issueDate?: string   // ISO 8601 datetime; default: now
  dueDate?: string     // ISO 8601 datetime; default: issueDate + 15 days
}

// Response
{ success: true, data: BillDTO }
```

**Business rules:**

- One line item: the service's plan. The bill's `customerId` is the service's customer.
- The line charges the full monthly price for the whole month (`serviceFrom`/`serviceTo` = the period's first and last day), whatever the service's start date. Only the automatic run prorates (BIL-291).
- Returns 409 `"Contracted service is not active and cannot be billed"` if the service is not ACTIVE.
- Returns 409 if a non-cancelled bill already exists for this service + period. Cancelled bills don't block regeneration. Another service of the same customer is billed separately.
- Returns 404 if the service does not exist.

---

### `POST /api/bills/generate-bulk` — Generate Bills for All Active Services

**Status:** 200 | 400  
**Roles:** ADMIN, OPERATOR  
**Rate limit:** bulk-import bucket — 5 / hr

Generates one bill for **every ACTIVE contracted service** (a customer with two gets two). Per-service failures never abort the run — inspect the three result buckets.

```ts
// Request body
{
  year: number         // required, integer 2000–2100
  month: number        // required, integer 1–12
  issueDate?: string   // ISO 8601 datetime; default: now
  dueDate?: string     // ISO 8601 datetime; default: issueDate + 15 days
}

// Response — always 200 even if some services failed
{
  success: true,
  data: {
    period: string   // 'YYYY-MM'
    generated: BillDTO[]
    skipped: Array<{ contractedServiceId: string; reason: string }>  // e.g. bill already exists — ⚠ was customerId
    failed:  Array<{ contractedServiceId: string; error: string }>
  }
}
```

---

### `GET /api/bills` — List

**Status:** 200 | 400

```ts
// Query params (all optional)
customerId?: string      // UUID
status?:     BillStatus
year?:       number      // 2000–2100 ← must pair with month
month?:      number      // 1–12
limit?:      number      // 1–100, default 20
offset?:     number      // ≥0, default 0

// Response
{
  success: true,
  data: {
    bills: BillDTO[]
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

> `year` and `month` must always be provided together (400 otherwise).  
> Results are ordered by `createdAt` descending (newest first).

---

### `GET /api/bills/:id` — Get by ID

**Status:** 200 | 400 | 404

```ts
// Response
{ success: true, data: BillDTO }
```

---

### `GET /api/bills/:id/pdf` — Download as PDF

**Status:** 200 | 400 | 404

Returns the bill as a **PDF document** — not the JSON envelope.

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="bill-<period>-<billId>.pdf"
```

The PDF includes the bill header (period, status, issue/due/paid dates), the customer block (name, phone, email, cedula), one row per line item with its snapshot price, and the total.

> Error responses (400/404) still use the standard JSON envelope `{ success: false, error }`.  
> Frontend tip: fetch with the Bearer token and download via a blob URL — a plain `<a href>` won't carry the Authorization header.

---

### `POST /api/bills/:id/pay` — Record a Payment

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{
  method: PaymentMethod      // required
  reference?: string | null  // max 100 chars, trimmed; blank = none
  amount?: number            // default: the bill's total; any other amount → 400
  paidAt?: string            // ISO 8601 datetime; default: now; future → 400
}

// Response — BillDTO with status 'PAID', paidAt = the payment's paidAt, and payment set
{ success: true, data: BillDTO }
```

> Allowed from `PENDING` or `OVERDUE`. Returns 409 if the bill is already `PAID` or `CANCELLED`. The signed-in user is recorded as `recordedByUserId`. One payment per bill, never edited (BIL-300…303). With the automatic cut on, paying a bill reactivates each suspended service on it that has no other `OVERDUE` bill, right after the response; the customer's other services are not touched (BIL-311). **Breaking:** `method` is now required; a body-less request gets 400.

---

### `POST /api/bills/:id/overdue` — Mark as Overdue

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// No request body

// Response
{ success: true, data: BillDTO }
```

> Allowed only from `PENDING`, and only once the bill is **past its due date** — returns 409 otherwise. While automatic billing is on, the daily run does this on its own (BIL-286); otherwise the frontend (or an operator) triggers it.

---

### `POST /api/bills/:id/cancel` — Cancel

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// No request body

// Response — BillDTO with status 'CANCELLED'
{ success: true, data: BillDTO }
```

> Allowed from `PENDING` or `OVERDUE`. Returns 409 for a `PAID` bill ("Cannot cancel a paid bill") or an already-cancelled one.  
> Cancelling frees the customer + period for regeneration via `POST /generate`.

---

## Billing Settings `/api/billing-settings`

The install's billing cycle (BIL-280), edited by the ISP's administrator. Until
the first save the defaults apply, with automatic billing **off** (BIL-281), so
`GET` always answers. A save applies from the next daily run, with no restart.

While `automaticBillingEnabled` is true, a daily run (from 6:00, Colombian time)
issues each service's bill on its own and marks unpaid bills `OVERDUE`:

- A service's bill is due at the end of its `paymentDay` (15 or 30; the 30th
  is the month's last day in February) — see `ContractedServiceDTO.paymentDay`.
- It is issued from `issueLeadDays` before that day; a run missed that day
  issues it on any later day up to the due date (BIL-283).
- Only `ACTIVE` services are billed, one bill each; a service's period that
  already has a bill — even a cancelled one — is never billed again by the run
  (BIL-284).
- Its bills are prorated: a service that started inside the billed month is
  charged from its start day, at monthly price × days ÷ days in that month, in
  whole pesos; one starting after the month waits for the next bill
  (BIL-287, BIL-288, BIL-290). In `ADVANCE` mode a service started on or after
  last month's issue day that no bill for last month holds also pays last
  month's remaining days (BIL-289).
- After the due date, every `PENDING` bill goes `OVERDUE`, hand-made ones too
  (BIL-286).
- With `automaticCutEnabled`, the day after the last grace day each `ACTIVE`
  service on an `OVERDUE` bill is suspended — only that service, not the
  customer's others — and again each morning while it stays unpaid (BIL-310).
  Recording a payment reactivates each suspended service on the paid bill that
  has no other `OVERDUE` bill, hand-suspended ones included (BIL-311).
- Each bill the run issues is emailed with its PDF to customers who have an
  email (BIL-320) and, when `billWhatsAppTemplate` is set, sent by WhatsApp
  with the PDF as the template's document header (BIL-324). That template
  takes four body parameters: name, period, amount, last day to pay. A failed
  send never un-issues the bill (BIL-325). With the cut on, customers with an `OVERDUE` bill are
  reminded on the last two grace days by email and, when
  `reminderWhatsAppTemplate` is set, by WhatsApp — once per bill per day
  (BIL-321…323). The WhatsApp template takes four body parameters: name,
  period, amount, cut day. Email needs the `SMTP_*` settings.

```ts
type BillingMode = 'ADVANCE' | 'ARREARS';

interface BillingSettingsDTO {
  automaticBillingEnabled: boolean; // false: nothing is issued or marked overdue on its own
  billingMode: BillingMode; // ADVANCE: a bill due in October is for October; ARREARS: for September
  issueLeadDays: number; // 1–14: days before the due date the bill is issued
  graceDays: number; // 0–14: days after the due date before service is cut
  automaticCutEnabled: boolean; // false (default): nobody is cut or restored on their own
  reminderWhatsAppTemplate: string | null; // Meta-approved template for payment reminders; null = email only
  billWhatsAppTemplate: string | null; // Meta-approved template with a document header for issued bills; null = email only
}
```

### `GET /api/billing-settings`

**Status:** 200 | 401  
**Roles:** all

```ts
{ success: true, data: BillingSettingsDTO }
```

---

### `PUT /api/billing-settings` — Save

**Status:** 200 | 400 | 401 | 403  
**Roles:** ADMIN (`manage-settings`; OPERATOR and VIEWER get `403`)

```ts
// Request body — all seven, nothing else
BillingSettingsDTO

// Response
{ success: true, data: BillingSettingsDTO }
```

> `400` with the rule's message, e.g.
> `"issueLeadDays must be a whole number from 1 to 14"` or
> `"billingMode must be one of ADVANCE, ARREARS"`.

---

## Cuentas de cobro `/api/collection-accounts`

A one-off charge for work outside the internet service — camera installs, equipment, repair visits — downloadable as a PDF titled **CUENTA DE COBRO**. Completely separate from bills: no billing period, no subscriptions, free-text line items, and **no effect on service** (never overdue, never triggers suspension). The customer can be an existing `Customer` or typed in freely; either way the details are a **snapshot captured at creation**.

**Lifecycle:** `PENDING → PAID | CANCELLED`. Both are terminal. There is no edit endpoint — to fix a mistake, cancel and issue a new one.

```ts
type CollectionAccountStatus = 'PENDING' | 'PAID' | 'CANCELLED';

interface CollectionAccountLineItemDTO {
  description: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number; // unitPrice × quantity
}

interface PaymentAccountDTO {
  bankName: string;
  accountType: 'SAVINGS' | 'CHECKING';
  accountNumber: string;
  label: string; // 'Bancolombia · Ahorros · 39500002227'
}

interface CollectionAccountDTO {
  id: string; // UUID
  code: number | null; // database sequence
  number: string | null; // 'CC-0007' — what is printed on the document
  status: CollectionAccountStatus;
  customerId: string | null; // UUID when linked to a Customer
  customerName: string;
  customerDocument: string | null; // cédula / NIT
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  lineItems: CollectionAccountLineItemDTO[];
  total: number; // sum of lineTotal
  paymentAccounts: PaymentAccountDTO[]; // copied at creation — printed under "Forma de pago"
  issueDate: string; // ISO 8601
  dueDate: string | null; // ISO 8601 — optional
  notes: string | null; // printed as "Observaciones"
  paidAt: string | null;
  cancelledAt: string | null;
  createdBy: string | null; // UUID of the user who issued it
  createdAt: string;
  updatedAt: string;
}
```

### `POST /api/collection-accounts` — Create

**Status:** 201 | 400 | 404 | 500  
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{
  customerId?: string        // UUID — link an existing customer
  customerName?: string      // required when customerId is absent, ≤ 150
  customerDocument?: string  // ≤ 20; ignored if the linked customer has a cédula
  customerPhone?: string     // ≤ 20; ignored when customerId is given
  customerEmail?: string     // email; ignored when customerId is given
  customerAddress?: string   // ≤ 255
  issueDate?: string         // ISO 8601 datetime; default: now
  dueDate?: string           // ISO 8601 datetime; optional, must be ≥ issueDate
  notes?: string
  lineItems: Array<{         // at least one
    description: string      // 1–500 chars
    unitPrice: number        // ≥ 0
    quantity: number         // positive integer
  }>
  bankAccountIds?: string[]  // UUIDs from /api/bank-accounts, ≤ 5
                             // omitted → every registered account; [] → none
}

// Response
{ success: true, data: CollectionAccountDTO }
```

- With `customerId`, name, phone, email and cédula are copied from the customer record; the address comes from the request.
- Returns 404 if `customerId` does not exist.
- `createdBy` is taken from the token, never the body.
- Returns 404 if any `bankAccountIds` entry does not exist. The chosen accounts are **copied** onto the document — editing or deleting a bank account later never changes an issued cuenta de cobro.

---

### `GET /api/collection-accounts` — List

**Status:** 200 | 400

```ts
// Query: customerId?: UUID, status?: CollectionAccountStatus, limit?: 1–100 (default 20), offset?: ≥ 0

// Response — newest first
{
  success: true,
  data: {
    collectionAccounts: CollectionAccountDTO[]
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

---

### `GET /api/collection-accounts/:id` — Get by ID

**Status:** 200 | 400 | 404

```ts
{ success: true, data: CollectionAccountDTO }
```

---

### `GET /api/collection-accounts/:id/pdf` — Download as PDF

**Status:** 200 | 400 | 404 | 409

Returns the document as a **PDF** — not the JSON envelope.

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="cuenta-de-cobro-CC-0007.pdf"
```

The PDF shows the issuer header, the `CC-NNNN` number, city and issue date, due date (if any), the customer block, "DEBE A" / "LA SUMA DE" with the total written in Spanish words, the line items table, total, observaciones, "Forma de pago" (one line per payment account, e.g. _Transferencia a cuenta de ahorros Bancolombia No. 39500002227_) and a signature line. Paid and cancelled documents are stamped `PAGADA` / `ANULADA`. Issuer name, NIT, address and contact details come from `src/infrastructure/billing/config/collectionAccountIssuerConfig.ts`.

> Error responses (400/404/409) still use the standard JSON envelope. Fetch with the Bearer token and download via a blob URL.
> `409` `"Cannot print the cuenta de cobro: the issuer is not configured"` until the vendor sets the issuer (BIL-232).

---

### `POST /api/collection-accounts/:id/pay` — Mark as Paid

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// No request body
{ success: true, data: CollectionAccountDTO } // status 'PAID', paidAt set
```

> Only from `PENDING` — 409 otherwise.

---

### `POST /api/collection-accounts/:id/cancel` — Cancel

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// No request body
{ success: true, data: CollectionAccountDTO } // status 'CANCELLED', cancelledAt set
```

> Only from `PENDING` — a paid document cannot be cancelled (409).

---

## Bank accounts `/api/bank-accounts`

The company's own accounts that customers pay into. Register them once, then pick which ones appear on each cuenta de cobro (`bankAccountIds`). Each comes with a `label` ready to show in a selector.

```ts
interface BankAccountDTO {
  id: string; // UUID
  bankName: string;
  accountType: 'SAVINGS' | 'CHECKING'; // ahorros | corriente
  accountNumber: string;
  label: string; // 'Bancolombia · Ahorros · 39500002227'
  createdAt: string;
  updatedAt: string;
}
```

### `POST /api/bank-accounts` — Create

**Status:** 201 | 400 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{
  bankName: string       // 1–100 chars
  accountType: 'SAVINGS' | 'CHECKING'
  accountNumber: string  // 4–30 digits, spaces or dashes allowed between
}

// Response
{ success: true, data: BankAccountDTO }
```

> 409 if the same number is already registered at the same bank.

---

### `GET /api/bank-accounts` — List

**Status:** 200  
**Roles:** all

```ts
// Response — oldest first, no pagination
{ success: true, data: { bankAccounts: BankAccountDTO[] } }
```

---

### `GET /api/bank-accounts/:id` — Get by ID

**Status:** 200 | 400 | 404

```ts
{ success: true, data: BankAccountDTO }
```

---

### `PATCH /api/bank-accounts/:id` — Update

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// Request body — any subset
{ bankName?: string; accountType?: 'SAVINGS' | 'CHECKING'; accountNumber?: string }

// Response
{ success: true, data: BankAccountDTO }
```

> Already-issued cuentas de cobro keep the details they were created with.

---

### `DELETE /api/bank-accounts/:id` — Delete

**Status:** 204 | 400 | 404  
**Roles:** ADMIN

> Always safe: issued cuentas de cobro hold their own copy of the account.

---

## Quotations `/api/quotations`

A sales proposal ("cotización"): catalog hardware from `device-inventory` picked by a technician, priced by hand for this quote alone, sent to a customer or free-text prospect, and exportable as a PDF. Unlike bills, a quotation's customer info (name, phone, email, address) is a **snapshot captured at creation** and never re-read live — `Customer` has no address field at all, so it's the only option, and a quote must keep saying what it said when it was built.

**Lifecycle:** `DRAFT → SENT → ACCEPTED | REJECTED | EXPIRED`. `ACCEPTED`, `REJECTED` and `EXPIRED` are terminal. Line items and details (`validUntil`, `notes`, customer snapshot) can only be edited while `DRAFT`.

```ts
interface QuotationLineItemDTO {
  deviceModelId: string | null; // UUID — null if the catalog entry was later deleted
  deviceModelName: string; // snapshot at add-time
  vendorName: string; // snapshot at add-time
  deviceType: string; // snapshot at add-time
  imageUrl: string | null; // snapshot at add-time
  description: string; // editable; defaults to "<vendor> <model>"
  unitPrice: number; // entered by hand — there is no catalog price
  quantity: number; // positive integer
  lineTotal: number; // unitPrice * quantity
}

interface QuotationDTO {
  id: string; // UUID
  code: number | null; // DB-assigned sequence number; null only before the first save
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  customerId: string | null; // UUID — optional link, for traceability only
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  lineItems: QuotationLineItemDTO[];
  subtotal: number; // sum of lineItems lineTotal
  total: number; // currently equals subtotal — no tax logic yet
  validUntil: string; // ISO 8601
  notes: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  expiredAt: string | null;
  createdBy: string | null; // UUID — from the authenticated user, never the request body
  createdAt: string; // ISO 8601
  updatedAt: string;
}
```

### `POST /api/quotations` — Create

**Status:** 201 | 400 | 404 | 500
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{
  customerId?: string        // UUID — optional link to an existing Customer
  customerName?: string      // required if customerId is omitted
  customerPhone?: string
  customerEmail?: string
  customerAddress?: string   // free text — Customer has no address field to read this from
  validUntil: string         // required, ISO 8601 datetime
  notes?: string
  lineItems: Array<{
    deviceModelId: string    // required, UUID — must exist in device-inventory
    description?: string     // defaults to "<vendor> <model>"
    unitPrice: number        // required, >= 0
    quantity: number         // required, positive integer
  }>                          // at least one required
}

// Response
{ success: true, data: QuotationDTO }
```

**Business rules:**

- Either `customerId` or `customerName` is required (400 otherwise).
- When `customerId` is given, the customer's name/phone/email are snapshotted from the `Customer` record at this moment; `customerAddress` (if any) always comes from the request body.
- Each `deviceModelId` must reference an existing device model (404 otherwise) — its name, vendor, type and image are snapshotted onto the line item.
- Returns 404 if `customerId` does not reference an existing customer.

---

### `GET /api/quotations` — List

**Status:** 200 | 400

```ts
// Query params (all optional)
customerId?: string       // UUID
status?:     'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
limit?:      number       // 1–100, default 20
offset?:     number       // ≥0, default 0

// Response
{
  success: true,
  data: {
    quotations: QuotationDTO[]
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

> Results are ordered by `createdAt` descending (newest first).

---

### `GET /api/quotations/:id` — Get by ID

**Status:** 200 | 400 | 404

```ts
// Response
{ success: true, data: QuotationDTO }
```

---

### `GET /api/quotations/:id/pdf` — Download as PDF

**Status:** 200 | 400 | 404

Returns the quotation as a **PDF document** — not the JSON envelope.

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="cotizacion-<code>.pdf"
```

The PDF includes a branded header with the quote number and validity date, the customer block, an itemized table (thumbnail, description, quantity, unit price, line total), a subtotal/total block, and a terms/call-to-action footer. A missing or broken line item image never fails the PDF — it falls back to a placeholder.

> Error responses (400/404) still use the standard JSON envelope `{ success: false, error }`.
> Frontend tip: fetch with the Bearer token and download via a blob URL — a plain `<a href>` won't carry the Authorization header.

---

### `PATCH /api/quotations/:id/line-items` — Replace Line Items

**Status:** 200 | 400 | 404 | 409
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{
  lineItems: Array<{
    deviceModelId: string
    description?: string
    unitPrice: number
    quantity: number
  }>   // at least one required — replaces the entire set
}

// Response
{ success: true, data: QuotationDTO }
```

> Allowed only while `DRAFT` — returns 409 for a `SENT` or terminal quotation ("Cannot modify line items of a sent quotation"). There is no incremental add/remove; this replaces the full line-item set.

---

### `PATCH /api/quotations/:id` — Update Details

**Status:** 200 | 400 | 404 | 409
**Roles:** ADMIN, OPERATOR

```ts
// Request body (all optional — only supplied fields change)
{
  validUntil?: string
  notes?: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  customerAddress?: string
}

// Response
{ success: true, data: QuotationDTO }
```

> Allowed only while `DRAFT` — returns 409 otherwise ("Cannot update details of a sent quotation").

---

### `POST /api/quotations/:id/send` — Send

**Status:** 200 | 400 | 404 | 409
**Roles:** ADMIN, OPERATOR

```ts
// No request body

// Response — QuotationDTO with status 'SENT' and sentAt set
{ success: true, data: QuotationDTO }
```

> Allowed only from `DRAFT`. Returns 409 otherwise.

---

### `POST /api/quotations/:id/accept` — Accept

**Status:** 200 | 400 | 404 | 409
**Roles:** ADMIN, OPERATOR

```ts
// No request body

// Response — QuotationDTO with status 'ACCEPTED' and acceptedAt set
{ success: true, data: QuotationDTO }
```

> Allowed only from `SENT`. Returns 409 otherwise (a quote that was never sent cannot be accepted).

---

### `POST /api/quotations/:id/reject` — Reject

**Status:** 200 | 400 | 404 | 409
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{ reason: string }   // required, non-empty, ≤255 characters

// Response — QuotationDTO with status 'REJECTED', rejectedAt and rejectionReason set
{ success: true, data: QuotationDTO }
```

> Allowed only from `SENT`. Returns 400 if `reason` is missing or blank, 409 if the quotation isn't `SENT`.

---

### `POST /api/quotations/:id/expire` — Mark Expired

**Status:** 200 | 400 | 404 | 409
**Roles:** ADMIN, OPERATOR

```ts
// No request body

// Response — QuotationDTO with status 'EXPIRED' and expiredAt set
{ success: true, data: QuotationDTO }
```

> Allowed only from `SENT`, and only once the quotation is **past its `validUntil` date** — returns 409 otherwise. There is no automatic expiry job; the frontend (or an operator) triggers this explicitly, matching how bills are marked overdue.

---

## Tickets `/api/tickets`

Field work orders. A ticket is the unit of work a technician is dispatched to do: what broke, who to call, which device, and where to go.

**Lifecycle:**

```
OPEN ──assign──▶ ASSIGNED ──start──▶ IN_PROGRESS ──resolve──▶ RESOLVED
 │                  │                    │
 └──────────────────┴───────cancel───────┴──────────────────▶ CANCELLED
```

`RESOLVED` and `CANCELLED` are terminal — **no field can change afterwards**, and every write endpoint returns `409` on a terminal ticket. Use `POST /:id/cancel` to close a ticket that should not be worked; `DELETE` is for tickets raised in error.

**Scheduling is a calendar day plus an optional time block.** `scheduledFor` is always `'YYYY-MM-DD'` in both directions — sending an ISO datetime returns `400`. A ticket may also carry a block on that day as `startTime` / `endTime`, each a wall-clock `'HH:mm'` (24-hour, zero-padded) in local business time — never a datetime, never UTC. Without a block the ticket is "any time that day", like an all-day calendar event.

- `startTime` and `endTime` travel **together** — sending one without the other is `400`.
- `endTime` must be later than `startTime`; blocks cannot cross midnight (`400`).
- A block needs a day: `startTime`/`endTime` with no `scheduledFor` is `400`.
- **Overlapping blocks for the same technician are allowed.** The backend does not detect double-booking — highlight it in the calendar if it matters.

To place a block on a calendar, combine the fields client-side: `` `${scheduledFor}T${startTime}` `` in the business timezone (`America/Bogota`).

```ts
interface TicketAddressDTO {
  street: string;
  municipality: string;
  neighborhood: string;
  reference: string | null; // e.g. "casa azul, portón negro"
  latitude: number | null;
  longitude: number | null;
}

interface TicketCustomerContactDTO {
  id: string; // UUID
  fullName: string;
  phone: string;
  email: string | null;
}

interface TicketDeviceSummaryDTO {
  id: string; // UUID
  name: string;
  ipAddress: string | null;
  macAddress: string | null;
  status: DeviceStatus;
  category: DeviceCategory | null;
  modelName: string | null; // e.g. "LiteBeam 5AC Gen2"
  vendorName: string | null; // e.g. "Ubiquiti"
  locationName: string | null;
}

// Free-text person to ask for on site — typically a prospect with no customer record
interface TicketContactDTO {
  name: string;
  phone: string | null; // digits only, leading '+' kept
}

interface TechnicianSummaryDTO {
  id: string; // UUID
  fullName: string;
  phone: string;
  email: string | null;
  isActive: boolean;
}

interface TicketDTO {
  id: string; // UUID
  code: number; // human-readable ticket number, e.g. 42 — quote this on the phone
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  title: string;
  description: string;
  customerId: string | null;
  deviceId: string | null;
  technicianId: string | null;
  address: TicketAddressDTO | null;
  contact: TicketContactDTO | null;
  scheduledFor: string | null; // 'YYYY-MM-DD' — calendar day, never a datetime
  startTime: string | null; // 'HH:mm' on scheduledFor; null = any time that day
  endTime: string | null; // 'HH:mm'; null exactly when startTime is null
  origin: TicketOrigin;
  originAlertId: string | null; // the alert that raised this ticket; null when MANUAL
  resolutionNotes: string | null;
  cancelReason: string | null;
  createdBy: string | null; // UUID of the user who filed it
  assignedAt: string | null; // ISO 8601
  startedAt: string | null;
  resolvedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// TicketDTO plus the collaborators resolved — returned by GET /:id and /my-day
interface TicketDetailDTO extends TicketDTO {
  customer: TicketCustomerContactDTO | null;
  device: TicketDeviceSummaryDTO | null;
  technician: TechnicianSummaryDTO | null;
}
```

> **`code` vs `id`.** `id` is the UUID for every API call. `code` is a gapless integer allocated by the database, and it is what a technician says out loud when they phone the office. Show `code`, send `id`.

---

### `GET /api/tickets/my-day` — Technician's Day Sheet

**Status:** 200 | 400 | 404  
**Roles:** ADMIN, OPERATOR, VIEWER

**This is the endpoint the technician view is built on.** One call returns everything needed before leaving: today's tasks in the order they should be worked, each with the customer to call, the suspected failure, the related device, and the address to drive to.

```ts
// Query params
{
  technicianId: string   // required, UUID
  date?: string          // 'YYYY-MM-DD'; default: today (UTC)
}

// Response
{
  success: true,
  data: {
    technician: TechnicianSummaryDTO
    date: string                   // 'YYYY-MM-DD', echoed back
    tickets: TicketDetailDTO[]
    total: number                  // === tickets.length; the day sheet is never paginated
  }
}
```

**Ordering is the instruction, not a preference:** tickets with a time block come first, in `startTime` order — they are appointments with a customer. Tickets without a block follow, `URGENT → HIGH → NORMAL → LOW`, then oldest first within a priority. Render the list in the order given.

**What is excluded:**

- tickets scheduled for any other day, and tickets with no `scheduledFor` at all
- `RESOLVED` and `CANCELLED` tickets — resolve one and it drops off the sheet immediately
- other technicians' work

`IN_PROGRESS` tickets **are** included, so a half-finished job still shows.

An empty day returns `200` with `tickets: []` and `total: 0` — not `404`. `404` means the technician does not exist.

> **No ownership scoping yet.** `technicianId` is an explicit query param and any authenticated reader may pass any id, so today this is a dispatcher view. A technician-facing app must supply the id itself; the backend will not infer it from the token.

---

### `POST /api/tickets` — Create

**Status:** 201 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{
  title: string            // required, 1–150 chars
  description: string      // required, 1–5000 chars
  category: TicketCategory // required
  priority?: TicketPriority        // default: 'NORMAL'
  customerId?: string | null       // UUID
  deviceId?: string | null         // UUID
  technicianId?: string | null     // UUID — assigns on creation
  address?: {                      // all three parts required together, or omit entirely
    street: string
    municipality: string
    neighborhood: string
    reference?: string | null
    latitude?: number | null       // -90..90, paired with longitude
    longitude?: number | null      // -180..180
  } | null
  contact?: {                      // on-site contact, e.g. a prospect not yet a customer
    name: string                   // required, 1–150 chars
    phone?: string | null          // 7–15 digits; spaces, dashes, dots and parentheses are stripped
  } | null
  scheduledFor?: string | null     // 'YYYY-MM-DD'
  startTime?: string | null        // 'HH:mm' — needs scheduledFor and endTime
  endTime?: string | null          // 'HH:mm' — later than startTime
}

// Response
{ success: true, data: TicketDTO }
```

**Business rules:**

- **`customerId`, `deviceId` and `contact` are all optional, in any combination — including none.** A ticket is any task on a technician's calendar: an internal errand needs none of them, a repair usually has a customer or a device, and a site survey for a prospect has only a `contact`.
- **Prospects go in `contact`, not in customers.** It is a snapshot kept on the ticket. When the prospect signs up, link the new customer with `PUT /:id` — the contact stays as a record of who was visited. A contact phone with no name is refused (400).
- The address is a **snapshot**, stored on the ticket and never re-resolved. A partial address is refused (400) — a street with no municipality is not navigable. There is no customer address anywhere else in the system, so this is the only place a visit location lives.
- Passing `technicianId` assigns immediately: the ticket comes back `ASSIGNED` with `assignedAt` set. Assigning an **inactive** technician returns 409.
- `createdBy` is taken from the JWT and **ignored if sent in the body**.
- Always created with `origin: 'MANUAL'` and `originAlertId: null`. Sending an `originAlertId` is rejected.
- 404 if the referenced customer or device does not exist.

---

### `POST /api/tickets/from-alert` — Create from an alert

_Since 2026-10-14 (TKT-115)._

**Status:** 201 | 400 | 401 | 403 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{ alertId: string } // UUID of an alert from GET /api/alerts

// Response
{ success: true, data: TicketDTO }
```

**Business rules:**

- The ticket is built from the alert: `origin` `WIRELESS_ALERT` or `DEVICE_ALERT`, `originAlertId` the alert, the alert's device, the device's customer (if any), title `"<device name>: <alert description>"`, and priority `URGENT` for a `CRITICAL` alert, otherwise `HIGH`. `createdBy` is the caller.
- **Any alert works, open or resolved.** The alert gets its own ticket even when the device already has one for another alert.
- `409` while the alert already has a live ticket (`"A live ticket already exists for this alert: #<code>"`). A resolved or cancelled ticket does not block a new one.
- `404` if the alert does not exist; `400` for a malformed id.
- Edit the result like any ticket: `PUT /:id` to change the title or priority, `POST /:id/assign` to dispatch.

---

### `GET /api/tickets` — List

**Status:** 200 | 400  
**Roles:** ADMIN, OPERATOR, VIEWER

```ts
// Query params — all optional
{
  status?: TicketStatus
  priority?: TicketPriority
  category?: TicketCategory
  technicianId?: string    // UUID
  customerId?: string      // UUID
  deviceId?: string        // UUID
  scheduledFrom?: string   // 'YYYY-MM-DD', inclusive
  scheduledTo?: string     // 'YYYY-MM-DD', inclusive
  unassignedOnly?: boolean // 'true' | 'false' — the dispatcher's inbox
  openOnly?: boolean       // 'true' | 'false' — excludes RESOLVED and CANCELLED
  limit?: number           // 1–100, default 20
  offset?: number          // default 0
}

// Response
{
  success: true,
  data: {
    tickets: TicketDTO[]   // flat — no customer/device/technician; use GET /:id for those
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

Results are ordered by `scheduledFor` (unscheduled last), then `startTime` (tickets without a block after the blocked ones on the same day), then priority. A `scheduledFrom`/`scheduledTo` window is exactly what a calendar week or month view needs.

> **Two filter pairs contradict, and one side wins silently — do not send both:**  
> `unassignedOnly=true` overrides `technicianId` ("nobody" wins), and `openOnly=true` overrides `status`.  
> `scheduledFrom` later than `scheduledTo` returns 400.

---

### `GET /api/tickets/:id` — Get by ID

**Status:** 200 | 400 | 404  
**Roles:** ADMIN, OPERATOR, VIEWER

```ts
// Response — the enriched shape, same as the day sheet entries
{ success: true, data: TicketDetailDTO }
```

> `customer`, `device` and `technician` are each `null` when the ticket does not reference one. A referenced record that has since been deleted also reads `null` — the FKs are `SET NULL`, so the ticket survives.

---

### `PUT /api/tickets/:id` — Update

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// Request body — at least one field required
{
  title?: string
  description?: string
  category?: TicketCategory
  priority?: TicketPriority
  customerId?: string | null
  deviceId?: string | null
  address?: { … } | null   // same shape as create; null clears it
  contact?: { … } | null   // same shape as create; null clears it
}

// Response
{ success: true, data: TicketDTO }
```

**Business rules:**

- 409 on a `RESOLVED` or `CANCELLED` ticket — terminal tickets are history.
- Does not change status, technician or schedule — use the action endpoints below.

---

### `DELETE /api/tickets/:id` — Delete

**Status:** 204 | 400 | 404  
**Roles:** ADMIN

```ts
// No response body
```

> For tickets raised in error. Cancelling is the normal way to close one, and it keeps the record and the reason.

---

### `POST /api/tickets/:id/assign` — Assign to a Technician

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{
  technicianId: string     // required, UUID
  scheduledFor?: string | null   // 'YYYY-MM-DD' — set the visit day in the same call
  startTime?: string | null      // 'HH:mm' — only together with scheduledFor and endTime
  endTime?: string | null        // 'HH:mm'
}

// Response — TicketDTO with status 'ASSIGNED' and assignedAt set
{ success: true, data: TicketDTO }
```

**Business rules:**

- Allowed from `OPEN` or `ASSIGNED`. **Reassignment is allowed until work starts** and re-stamps `assignedAt`.
- 409 from `IN_PROGRESS` — someone is on site; swapping the technician mid-visit would lose who did what. Resolve or cancel first.
- 409 if the technician is inactive; 404 if they do not exist.
- With `scheduledFor`, the schedule is **replaced**: the new day plus the given block, or no block if the times are omitted. Without `scheduledFor`, the existing day and block are kept untouched.

---

### `POST /api/tickets/:id/schedule` — Set or Move the Visit Day

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{
  scheduledFor: string | null   // required key; 'YYYY-MM-DD', or null to clear
  startTime?: string | null     // 'HH:mm' — omit both for "any time that day"
  endTime?: string | null       // 'HH:mm'
}

// Response
{ success: true, data: TicketDTO }
```

> **The whole schedule is replaced on every call.** Moving a blocked ticket to another day without resending the times drops the block; `scheduledFor: null` clears the day and the block together. This is the endpoint to call on a calendar drag or resize.

> **A past date is accepted on purpose** — work done off the books gets entered afterwards. 409 on a terminal ticket.

---

### `POST /api/tickets/:id/start` — Start Work

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// No request body

// Response — TicketDTO with status 'IN_PROGRESS' and startedAt set
{ success: true, data: TicketDTO }
```

> Allowed **only** from `ASSIGNED` — 409 from `OPEN` (nobody owns it) or from `IN_PROGRESS` (already started; restarting would overwrite `startedAt`).

---

### `POST /api/tickets/:id/resolve` — Resolve

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{
  resolutionNotes: string   // required, 1–5000 chars
}

// Response — TicketDTO with status 'RESOLVED' and resolvedAt set
{ success: true, data: TicketDTO }
```

**Business rules:**

- Allowed from `ASSIGNED` or `IN_PROGRESS`. Resolving straight from `ASSIGNED` is normal — plenty of faults are fixed remotely without a visit.
- 409 from `OPEN`: nobody is attached, so there is no one whose work the notes describe.
- Notes are **required and non-blank** (400) — they are the only record of what was done.
- The ticket drops off `/my-day` immediately.

---

### `POST /api/tickets/:id/cancel` — Cancel

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{
  reason: string   // required, 1–255 chars
}

// Response — TicketDTO with status 'CANCELLED' and cancelledAt set
{ success: true, data: TicketDTO }
```

> Allowed from `OPEN`, `ASSIGNED` or `IN_PROGRESS`. 409 for a `RESOLVED` ticket ("Cannot cancel a resolved ticket") or an already-cancelled one.  
> The reason is required — a cancelled ticket with no reason is indistinguishable from one dropped by mistake, and the same fault gets reported again next week.

---

### Tickets from alerts

**Since 2026-10-14 the default is to suggest, not open (NOT-205).** In `SUGGEST` mode (`alertTicketMode` in [Notification Settings](#notification-settings-apinotification-settings)) no ticket opens on its own: the alert list marks the alert `ticketSuggested: true` and a person opens one with [`POST /api/tickets/from-alert`](#post-apiticketsfrom-alert--create-from-an-alert). Everything below describes `AUTOMATIC` mode.

When a **new** alert is recorded — ICMP device-down or wireless — the backend opens a ticket for it with `origin: 'DEVICE_ALERT'` or `'WIRELESS_ALERT'` and `originAlertId` set to the alert. The exception is `wireless:parent_ap_mismatch:WARNING` (WLS-013), an inventory correction that is fixed by accepting the parent AP suggestion, not by a site visit.

Two levels of deduplication mean the technician does not drown:

1. The same alert re-firing (monitoring re-emits every poll while the fault persists) reuses the existing ticket.
2. A **second alert on a device that already has a live alert-origin ticket** folds into that ticket — a device breaching five metrics is one site visit, not five jobs.

A new ticket is only opened once the earlier one reaches `RESOLVED` or `CANCELLED`. Severity maps to priority: `CRITICAL → URGENT`, everything else `→ HIGH`.

Filter these with `GET /api/tickets?openOnly=true` and read `origin` to badge them apart from phoned-in work.

---

## Technicians `/api/technicians`

The field workers tickets are dispatched to. Separate from `User` (the login accounts): a technician does not need to log in, and `userId` is an optional link for when they do.

```ts
interface TechnicianDTO {
  id: string; // UUID
  fullName: string;
  phone: string; // normalized to '+' + digits, e.g. '+573001112233'
  email: string | null; // lowercased
  userId: string | null; // optional link to a login account
  isActive: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string;
}
```

---

### `POST /api/technicians` — Create

**Status:** 201 | 400 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{
  fullName: string      // required, 1–150 chars
  phone: string         // required, 7–15 digits; '+57 (300) 111-2233' is accepted
  email?: string | null
  userId?: string | null // UUID of a login account
  isActive?: boolean     // default: true
}

// Response
{ success: true, data: TechnicianDTO }
```

**Business rules:**

- **Phone is the natural key and must be unique** (409). It is normalized before comparison, so `+57 300 111 2233` and `+573001112233` collide.
- Email must be unique when present (409). Any number of technicians may have none.
- New technicians are active — someone being added is someone about to be given work.

---

### `GET /api/technicians` — List

**Status:** 200 | 400  
**Roles:** ADMIN, OPERATOR, VIEWER

```ts
// Query params
{
  activeOnly?: boolean  // 'true' | 'false' — use for assignment pickers
  limit?: number        // 1–100, default 20
  offset?: number       // default 0
}

// Response
{
  success: true,
  data: {
    technicians: TechnicianDTO[]   // ordered by fullName
    total: number                  // respects activeOnly
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

---

### `GET /api/technicians/:id` — Get by ID

**Status:** 200 | 400 | 404  
**Roles:** ADMIN, OPERATOR, VIEWER

```ts
{ success: true, data: TechnicianDTO }
```

---

### `PUT /api/technicians/:id` — Update

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// Request body — at least one field required
{
  fullName?: string
  phone?: string
  email?: string | null   // null clears it
  userId?: string | null  // null unlinks the login account
  isActive?: boolean      // false takes them off the rota
}

// Response
{ success: true, data: TechnicianDTO }
```

> A technician may keep their own phone or email — only a collision with a **different** technician returns 409.  
> **`isActive: false` is how you retire someone.** They stop being assignable immediately, existing tickets keep their name, and history stays intact.

---

### `DELETE /api/technicians/:id` — Delete

**Status:** 204 | 400 | 404 | 409  
**Roles:** ADMIN

```ts
// No response body
```

> **409 if any ticket references them** — open or closed. The FK is `SET NULL`, so deleting would silently blank the technician on every ticket they ever worked and erase who did what. Deactivate instead (`PUT` with `isActive: false`); the error message says so.

---

## Subscription `/api/subscription`

The install's subscription (ADR 0002, R17). When a payment is missed the
install escalates in stages; drive the banner and the lock screen from
`state`:

| `state`        | What the backend does                                         | Show                                                    |
| -------------- | ------------------------------------------------------------- | ------------------------------------------------------- |
| `NOT_ENFORCED` | Nothing                                                       | Nothing                                                 |
| `ACTIVE`       | Nothing                                                       | Optional "renews on" hint in the last 5 days            |
| `GRACE`        | Nothing yet                                                   | Warning banner: read-only from `graceEndsAt`            |
| `READ_ONLY`    | Every write is `402`; monitoring, agents and alerts stopped   | Notice: nothing is being monitored, locks at `lockedAt` |
| `LOCKED`       | Every `/api` route is `402` except `/api/auth/*` and this one | Lock screen only                                        |

While read-only, disable every edit control rather than letting users hit
`402`, and say plainly that alerts are off, so an empty alert feed is not
mistaken for a quiet network. Nothing is deleted in any stage.

### `GET /api/subscription`

Any role, in every stage (including `LOCKED`).

```ts
interface SubscriptionStatusDTO {
  state: 'NOT_ENFORCED' | 'ACTIVE' | 'GRACE' | 'READ_ONLY' | 'LOCKED';
  paidThrough: string | null; // ISO 8601 — first instant no longer paid for
  graceEndsAt: string | null; // ISO 8601 — READ_ONLY from here
  lockedAt: string | null; // ISO 8601 — LOCKED from here
  readOnly: boolean; // READ_ONLY or LOCKED
  locked: boolean; // LOCKED
}
```

`NOT_ENFORCED` (all dates `null`) means the install is not billed by
subscription. The terms are the vendor's, changed through
[`/api/installation/settings`](#vendor-settings-apiinstallationsettings)
(VENDOR only); the new terms apply on the next request.

### `402 Payment Required`

Any `/api` route (and `POST /agent/v1/enroll`, `GET /agent/v1/updates/:fileName`) can answer `402` once the
subscription is past its grace:

```ts
{ success: false, error: 'Subscription expired: the service is read-only until payment is received' }
{ success: false, error: 'Subscription expired: the service is locked until payment is received' }
```

On any `402`, re-read `GET /api/subscription` and switch to the matching
screen. On a locked install `402` comes before authentication, so it can
arrive instead of `401`.

## Installation `/api/installation`

### `GET /api/installation`

**Status:** 200 | 401 | 402  
**Roles:** all

What this install runs, fixed when the backend starts (INS-009). Read it once
after sign-in and hide what the install does not offer, rather than letting a
click fail.

```ts
interface InstallationDTO {
  modules: {
    customers: boolean; // /api/customers, /api/service-plans, /api/contracted-services
    billing: boolean; // /api/bills, /api/billing-settings, /api/collection-accounts, /api/bank-accounts
    quoting: boolean; // /api/quotations
    tickets: boolean; // /api/tickets, /api/technicians
    enforcement: boolean; // /api/enforcement/suspensions, /api/contracted-services/:id/enforcement
  };
  serverOnSite: boolean; // false: the server talks to no device — hide manual ping, wireless poll, reboot, diagnosis and the network scan; devices with no agent show UNKNOWN
  agentPairingAvailable: boolean; // false: creating an agent or a new key answers 503
  installersAvailable: boolean; // false: hide installer downloads — the routes below answer 503
}

{ success: true, data: InstallationDTO }
```

> Device inventory, monitoring, wireless, alerts, notifications, agents and
> the network scan are the core and always present. A module that is off has
> no routes at all (`404`). The values change only when the vendor edits the
> install's settings and restarts it, so there is no need to poll.

---

### `GET /api/installation/installers` — Agent installers

**Status:** 200 | 401 | 402 | 503  
**Roles:** all

The agent installers the vendor has placed in the install's installer folder
(INS-042). Newest first, so the first entry of a platform is the one to offer.

```ts
interface InstallerDTO {
  fileName: string; // 'nms-agent-setup-0.1.0.exe' — also the download path segment
  platform: 'windows' | 'linux'; // .exe/.msi → windows, .tar.gz → linux
  version: string | null; // read from the file name ('0.1.0'); null if it has none
  sizeBytes: number;
  modifiedAt: string; // ISO
}

{ success: true, data: { installers: InstallerDTO[] } } // may be empty
```

> `503` when the install has no installer folder (`installersAvailable: false`)
> or the folder cannot be read. Works while the subscription is read-only;
> a locked install answers `402` like every other route.

---

### `GET /api/installation/installers/:fileName` — Download an installer

**Status:** 200 | 400 | 401 | 402 | 404 | 503  
**Roles:** all

Streams the file as `application/octet-stream` with
`Content-Disposition: attachment; filename="<fileName>"` and `Content-Length`.
It needs the Bearer token, so a plain `<a href>` will not work: fetch it as a
blob and save it (or show progress from `Content-Length`).

> `404` for any name the list above does not return (INS-043). `400` for a
> name with `/`, `\` or a leading `.`. Error bodies are the usual JSON
> envelope.

## Vendor Settings `/api/installation/settings`

What the vendor runs this install with (INS-028): its own Telegram chat for
agent alerts, the customer's subscription terms, how long data is kept, the
issuer printed on cuentas de cobro, WhatsApp, and the enforcement router.
**VENDOR only, reads included** — the customer's `ADMIN` gets `403`; show this
screen only when `user.role === 'VENDOR'`. A save applies on the next request,
alert or purge, with no restart. Until the first save the values are the
server's env defaults (INS-029). Secrets are not here: bot tokens and the
WhatsApp access token stay in env.

The route is exempt from the subscription guard (INS-030): it answers on a
read-only or **locked** install, so the vendor can record a payment there. Give
the vendor a way to reach this screen from the lock screen.

```ts
interface VendorSettingsDTO {
  vendorTelegramChatId: string | null; // '8468052749' or '@channel'; null = agent alerts go to the install's chat only
  subscriptionPaidUntil: string | null; // 'YYYY-MM-DD', last day paid (covered to its end, Colombian time); null = not enforced
  subscriptionGraceDays: number; // 0–90, full service after paidUntil
  subscriptionReadOnlyDays: number; // 0–90, read-only after grace, then locked
  pingResultRetentionDays: number; // 1–3650
  alertRetentionDays: number; // 1–3650, resolved alerts only
  wirelessSnapshotRetentionDays: number; // 1–3650
  wirelessAlertRecordRetentionDays: number; // 1–3650, cleared records only
  issuer: {
    // null = not configured: cuenta de cobro PDFs answer 409 (BIL-232)
    name: string;
    documentLabel: string; // 'NIT'
    document: string;
    address: string;
    city: string;
    contactPhone: string;
    contactEmail: string; // an email address
    accentColorHex: string; // '#1F4E79'
  } | null;
  whatsApp: {
    // null = not configured: subscriber notices fail and are logged (NOT-115)
    phoneNumberId: string; // digits
    templateName: string; // lowercase, digits, underscores
    templateLanguage: string; // 'es', 'es_CO'
    apiVersion: string; // 'v21.0'
  } | null;
  enforcementRouter: {
    // null = not configured: /api/enforcement/* answers 503 (SVC-060)
    deviceId: string; // UUID of the MikroTik in the inventory
    apiPort: number; // 1–65535, default 8728
  } | null;
}
```

### `GET /api/installation/settings`

**Status:** 200 | 401 | 403  
**Roles:** VENDOR (`manage-installation`)

```ts
{ success: true, data: VendorSettingsDTO }
```

---

### `PUT /api/installation/settings` — Save

**Status:** 200 | 400 | 401 | 403  
**Roles:** VENDOR (`manage-installation`)

```ts
// Request body — all eight, nothing else
VendorSettingsDTO

// Response
{ success: true, data: VendorSettingsDTO } // as stored: strings trimmed, '' → null
```

> `400` with the rule's message, e.g.
> `"subscriptionPaidUntil must be a real date as YYYY-MM-DD"`,
> `"Grace days must be a whole number from 0 to 90"` or
> `"alertRetentionDays must be a whole number from 1 to 3650"`,
> `"issuer.contactEmail must be an email address"`,
> `"enforcementRouter.deviceId must be a device id"`. A group is all or
> nothing: send it complete, or `null`.
> To record a payment, send the new last paid day; `GET /api/subscription`
> reflects it immediately. Shortening a retention window deletes the older
> data at the next daily purge (or the manual purge) — confirm before saving.

---

## Users `/api/users`

The customer's staff accounts (IDN-140). `ADMIN` (and `VENDOR`) manage them;
every role changes its own password.

```ts
interface UserAccountDTO {
  id: string; // UUID
  email: string;
  role: 'VENDOR' | 'ADMIN' | 'OPERATOR' | 'VIEWER';
  disabled: boolean;
  disabledAt: string | null;
  twoFactorEnabled: boolean; // added 2026-10-05
  createdAt: string;
  updatedAt: string;
}
```

### `GET /api/users` — List

**Status:** 200 | 401 | 403  
**Roles:** ADMIN (`manage-users`)

```ts
{ success: true, data: { users: UserAccountDTO[] } } // oldest first, no pagination
```

> The vendor account is left out unless the caller is the vendor.

---

### `POST /api/users` — Create

**Status:** 201 | 400 | 401 | 403 | 409 | 503  
**Roles:** ADMIN (`manage-users`)

```ts
// Request body
{
  email: string; // stored lowercase; unique
  password?: string; // 12–200 chars; leave out to invite (IDN-184)
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER'; // VENDOR is refused (400)
}

// Response
{ success: true, data: UserAccountDTO }
```

> `409` when the email is taken (case-insensitive).
>
> Without `password`, the person gets an email with a seven-day link to
> `<APP_PUBLIC_URL>/accept-invitation#token=<token>` and chooses their own
> (IDN-184). That page works like `/reset-password`: read the token from
> `location.hash` and call `POST /api/auth/password/reset`. Prefer this to
> typing a password for someone. `503` with
> `The invitation email could not be sent. Try again, or set a password instead.`
> when email or `APP_PUBLIC_URL` is not set up, or the mail server refused;
> nothing is created then.

---

### `PATCH /api/users/:id` — Change role, status or password

**Status:** 200 | 400 | 401 | 403 | 404  
**Roles:** ADMIN (`manage-users`)

```ts
// Request body — at least one field; no others allowed
{
  role?: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  disabled?: boolean; // true disables, false re-enables
  password?: string; // 12–200 chars — a reset, no current password needed
}

// Response
{ success: true, data: UserAccountDTO }
```

> Every change signs the user out everywhere (re-enabling excepted); a
> disabled account cannot sign in. `403` for the vendor account (`The vendor
account is managed by the vendor`) and for the caller's own account — hide
> these actions on the vendor's row and on the signed-in user's row. There is
> no delete: disable instead.

---

### `POST /api/users/:id/two-factor/reset` — Reset two-factor sign-in

**Status:** 200 | 400 | 401 | 403 | 404 | 409  
**Roles:** ADMIN (`manage-users`); only VENDOR resets an `ADMIN` account

```ts
// No body

// Response
{ success: true, data: UserAccountDTO } // twoFactorEnabled: false
```

> For someone who lost their phone and their recovery codes (IDN-172). Signs
> the account out everywhere and forgets its remembered browsers; at the next
> sign-in it sets two-factor up again. Every reset sends an alert to the
> install's chat (IDN-173, type `two_factor_reset`).
>
> | Status | `error`                                                           |
> | ------ | ----------------------------------------------------------------- |
> | `403`  | `Only the vendor can reset an administrator's two-factor sign-in` |
> | `403`  | `The vendor account is managed by the vendor`                     |
> | `409`  | `Two-factor sign-in is not on`                                    |
>
> Show the action only on rows with `twoFactorEnabled: true`, never on the
> vendor's row, and on `ADMIN` rows only when the signed-in user is the vendor.

---

### `POST /api/users/me/password` — Change my password

**Status:** 200 | 400 | 401  
**Roles:** all

```ts
// Request body
{ currentPassword: string; newPassword: string } // new: 12–200 chars (was 8 before 2026-10-05)

// Response
{ success: true, data: { token: string } }
```

> The change signs this account out everywhere, this session included: **replace
> the stored token with the one returned**. `400 Current password is incorrect`
> on a wrong current password.

---

### `POST /api/users/me/credential-reveal` — Unlock device credentials

**Status:** 200 | 400 | 401 | 403 | 429  
**Roles:** ADMIN, OPERATOR (`reveal-credentials`) — never VIEWER

```ts
// Request body
{ password: string } // the signed-in user's own password

// Response
{ success: true, data: { revealToken: string; expiresInSeconds: number } } // 300
```

> Send `revealToken` as `X-Credential-Reveal-Token` to
> `POST /api/devices/:id/credentials/reveal`. It is not a session token and
> opens nothing else (IDN-086).
> `400 Password is incorrect` on a wrong password. Wrong passwords count toward
> the same pause as sign-in (IDN-044): after five, this endpoint and login answer
> `429 Too many failed sign-in attempts. Try again later.` until the pause ends.

---

## Admin `/api/admin`

### `POST /api/admin/data-retention/purge` — Purge stale data now

**Status:** 200  
**Roles:** VENDOR (`manage-installation`)

```ts
// No body. Response
{
  success: true,
  data: {
    pingResultsDeleted: number;
    alertsDeleted: number; // resolved alerts only
    wirelessSnapshotsDeleted: number;
    wirelessAlertRecordsDeleted: number; // cleared records only
  }
}
```

> Runs the daily retention sweep immediately (NOT-131): every table past its configured window, open alerts and active wireless alert records never touched. A vendor maintenance action — do not show it to the customer.

---

## Other

### `GET /health`

```ts
{ status: 'ok', timestamp: string }
```

### Unknown routes → 404

```ts
{ success: false, error: 'Not found' }
```

---

## Error Status Codes

| Code | Meaning                                                                                                                                                                     |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400  | Validation error or business rule violation (e.g. duplicate MAC/IP)                                                                                                         |
| 401  | Missing, expired, or invalid JWT                                                                                                                                            |
| 403  | Valid token but insufficient role for this operation                                                                                                                        |
| 404  | Resource not found                                                                                                                                                          |
| 409  | Conflict — resource already exists, or cannot be deleted/changed while dependents exist (e.g. vendor has models, model has devices, model has wireless configs)             |
| 402  | Subscription expired — read-only (writes refused) or locked (everything but sign-in and `GET /api/subscription` refused). See [Subscription](#subscription-apisubscription) |
| 429  | Rate limit exceeded                                                                                                                                                         |
| 500  | Unexpected server error                                                                                                                                                     |
| 503  | Dependent system unavailable — enforcement router unreachable or enforcement not configured (enforcement endpoints only)                                                    |

Error body: `{ success: false, error: string }` (standard endpoints) / `{ error: string }` (credentials, polling, wireless)
