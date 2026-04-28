# Postman Sample Requests

Base URL: `http://localhost:3000`

---

## Health Check

### GET /health

No body or params required.

**Expected response (200):**
```json
{ "status": "ok", "timestamp": "2026-04-06T12:00:00.000Z" }
```

---

## Locations — `/api/locations`

### POST /api/locations — Create location (full)
```json
{
  "name": "Tower Norte",
  "type": "TOWER",
  "municipality": "São Paulo",
  "neighborhood": "Santana",
  "address": "Av. Cruzeiro do Sul, 1000",
  "latitude": -23.5205,
  "longitude": -46.6333,
  "altitude": 760
}
```

### POST /api/locations — Create location (minimal)
```json
{
  "name": "Warehouse Central",
  "type": "WAREHOUSE"
}
```

### GET /api/locations — List all (no filters)
```
GET /api/locations
```

### GET /api/locations — List with filters
```
GET /api/locations?limit=10&offset=0&type=TOWER
```

Query params:
| Param  | Example   | Notes              |
|--------|-----------|--------------------|
| limit  | `10`      | 1–100, default 20  |
| offset | `0`       | ≥0, default 0      |
| type   | `TOWER`   | TOWER \| NODE \| DATACENTER \| POP \| WAREHOUSE \| OFFICE |

### GET /api/locations/:id — Get by ID
```
GET /api/locations/a1b2c3d4-e5f6-4789-ab01-cdef01234567
```

### PATCH /api/locations/:id — Update location
URL: `PATCH /api/locations/a1b2c3d4-e5f6-4789-ab01-cdef01234567`
```json
{
  "name": "Tower Norte Renamed",
  "municipality": "Guarulhos",
  "latitude": -23.4637,
  "longitude": -46.5333
}
```
All body fields are optional. Include only what you want to change.

---

## Devices — `/api/devices`

### POST /api/devices — Create device (full)
```json
{
  "deviceModelId": "b2c3d4e5-f6a7-4890-bc12-def012345678",
  "name": "Core Router SP01",
  "ownerType": "COMPANY",
  "status": "ACTIVE",
  "category": "CORE",
  "locationId": "a1b2c3d4-e5f6-4789-ab01-cdef01234567",
  "serialNumber": "SN-00123456",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "ipAddress": "192.168.1.1",
  "description": "Primary core router at São Paulo datacenter",
  "installedDate": "2025-01-15T00:00:00.000Z",
  "monitoringEnabled": true
}
```

### POST /api/devices — Create device (minimal)
```json
{
  "deviceModelId": "b2c3d4e5-f6a7-4890-bc12-def012345678",
  "name": "Access Point Floor 3",
  "ownerType": "CLIENT"
}
```

Field enums:
- `ownerType`: `COMPANY` | `CLIENT`
- `status`: `INVENTORY` | `ACTIVE` | `MAINTENANCE` | `DAMAGED` | `DECOMMISSIONED`
- `category`: `CORE` | `DISTRIBUTION` | `POE` | `ACCESS_POINT` | `CLIENT_CPE`

### GET /api/devices — List all (no filters)
```
GET /api/devices
```

### GET /api/devices — List with filters
```
GET /api/devices?limit=20&offset=0&status=ACTIVE&category=CORE&owner=COMPANY&monitoringEnabled=true&sortBy=name&sortOrder=ASC
```

Query params:
| Param             | Example          | Notes                                        |
|-------------------|------------------|----------------------------------------------|
| limit             | `20`             | 1–100, default 20                            |
| offset            | `0`              | ≥0, default 0                                |
| status            | `ACTIVE`         | DeviceStatus enum                            |
| category          | `CORE`           | DeviceCategory enum                          |
| owner             | `COMPANY`        | COMPANY \| CLIENT                            |
| locationId        | `<uuid>`         | Filter by location                           |
| deviceModelId     | `<uuid>`         | Filter by model                              |
| monitoringEnabled | `true`           | `true` or `false`                            |
| search            | `router`         | Free-text search on name, serial, MAC, IP    |
| sortBy            | `name`           | createdAt \| updatedAt \| name \| status     |
| sortOrder         | `ASC`            | ASC \| DESC                                  |

### GET /api/devices/:id — Get by ID
```
GET /api/devices/c3d4e5f6-a7b8-4901-cd23-ef0123456789
```

### PATCH /api/devices/:id — Update device
URL: `PATCH /api/devices/c3d4e5f6-a7b8-4901-cd23-ef0123456789`
```json
{
  "name": "Core Router SP01 - Updated",
  "status": "MAINTENANCE",
  "ipAddress": "192.168.1.2",
  "monitoringEnabled": false
}
```
All body fields are optional. Include only what you want to change.

---

## Device Models — `/api/device-models`

Device models are read-only (seeded in the database). No POST/PATCH.

### GET /api/device-models — List all
```
GET /api/device-models
```

### GET /api/device-models — List with pagination
```
GET /api/device-models?limit=10&offset=0
```

### GET /api/device-models/:id — Get by ID
```
GET /api/device-models/d4e5f6a7-b8c9-4012-de34-f01234567890
```

---

## Polling — `/api/devices/:id/poll` and `/api/devices/:id/polling/*`

Replace `:id` with the target device UUID in all URLs.

### POST /api/devices/:id/poll — Trigger manual ping
```
POST /api/devices/c3d4e5f6-a7b8-4901-cd23-ef0123456789/poll
```
No request body required.

**Expected response (200):**
```json
{
  "success": true,
  "data": {
    "deviceId": "c3d4e5f6-a7b8-4901-cd23-ef0123456789",
    "isUp": true,
    "latencyMs": 4,
    "checkedAt": "2026-04-06T12:00:00.000Z"
  }
}
```

### GET /api/devices/:id/polling/status — Current polling status
```
GET /api/devices/c3d4e5f6-a7b8-4901-cd23-ef0123456789/polling/status
```

### GET /api/devices/:id/polling/history — Ping history
```
GET /api/devices/c3d4e5f6-a7b8-4901-cd23-ef0123456789/polling/history
```

### GET /api/devices/:id/polling/history — With filters
```
GET /api/devices/c3d4e5f6-a7b8-4901-cd23-ef0123456789/polling/history?limit=50&offset=0&status=UP&fromDate=2026-04-01T00:00:00Z&toDate=2026-04-06T23:59:59Z
```

Query params:
| Param    | Example                    | Notes              |
|----------|----------------------------|--------------------|
| limit    | `50`                       | 1–1000             |
| offset   | `0`                        | ≥0                 |
| status   | `UP`                       | UP \| DOWN         |
| fromDate | `2026-04-01T00:00:00Z`     | ISO 8601 with TZ   |
| toDate   | `2026-04-06T23:59:59Z`     | ISO 8601 with TZ   |

### PATCH /api/devices/:id/polling/config — Configure polling
URL: `PATCH /api/devices/c3d4e5f6-a7b8-4901-cd23-ef0123456789/polling/config`
```json
{
  "intervalSeconds": 30,
  "failuresBeforeDown": 3,
  "enabled": true
}
```

Minimal (at least one field required):
```json
{
  "enabled": false
}
```

Field constraints:
- `intervalSeconds`: integer, 1–86400
- `failuresBeforeDown`: integer, ≥1
- `enabled`: boolean

---

## Common Error Shapes

**400 Validation error:**
```json
{
  "success": false,
  "errors": [
    { "field": "name", "message": "Device name cannot be empty" }
  ]
}
```

**404 Not found:**
```json
{
  "success": false,
  "error": "Device not found"
}
```

**500 Internal error:**
```json
{
  "success": false,
  "error": "Internal server error"
}
```
