# Device Inventory — Bounded Context Schema Design

## Entity Relationship Summary

```
Tenant (1) ───────────┬──── (N) Location
                      ├──── (N) DeviceModel ── (M:N) ── Protocol
                      └──── (N) Device
                                  ├──── (N) DeviceInterface
                                  ├──── (M:N) DeviceProtocol ── Protocol
                                  ├──── (1) DeviceModel
                                  └──── (0..1) Location
```

## Key Design Decisions

### 1. Unified Device Entity (merged Dispositivo + Dispositivo Red)

The `Device` table represents a single device across its entire lifecycle. Network-specific
fields (`ip_address`, `management_port`, etc.) are nullable — they become populated when
the device transitions from `INVENTORY` to `INSTALLED` or `ACTIVE`.

**Why:** Avoids a mandatory JOIN on every monitoring query. The lifecycle is modeled through
the `status` enum, not through table inheritance. A device in the warehouse and a device
on a tower are the same entity in different states.

**Rule:** The monitoring module queries `WHERE status = 'ACTIVE'`. Asset management queries
all statuses.

### 2. Multi-Tenancy via `tenant_id`

Every entity that is tenant-specific carries a `tenant_id` FK. The only exception is
`Protocol`, which is a global reference table shared across all tenants.

**PostgreSQL RLS setup** (to be applied via migration):

```sql
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON devices
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Repeat for: locations, device_models, device_protocols, device_interfaces
```

In NestJS, set the tenant context per request:

```typescript
// middleware or guard
await prisma.$executeRawUnsafe(
  `SET LOCAL app.current_tenant_id = '${tenantId}'`
);
```

### 3. Protocol as M:N (not a single column)

A device supports multiple protocols simultaneously. The relationship is modeled at two levels:

- `ModelProtocol`: What the hardware model supports out of the box (e.g., hAP ac² → SNMP, SSH, Winbox, HTTP, HTTPS, API).
- `DeviceProtocol`: What's actually enabled on a specific device, with optional port overrides.

**Workflow:** When a new device is created, the system can auto-populate `DeviceProtocol`
rows from the model's `ModelProtocol` entries (all enabled, default ports). The technician
then disables what's not needed and overrides ports if necessary.

### 4. DeviceInterface as First-Class Entity

Interfaces are not attributes of a device — they are child entities. A MikroTik hAP ac²
has 5 ethernet ports, 2 wireless radios, bridge interfaces, VLAN interfaces, etc.

**Why this matters for monitoring:** Traffic metrics (throughput in/out, errors, drops)
are per-interface, not per-device. The monitoring context needs `snmp_index` (ifIndex)
to poll specific OIDs like `ifHCInOctets.{ifIndex}`.

`is_monitored` allows operators to exclude noisy or irrelevant interfaces (e.g., loopback,
management VLANs) from the polling cycle.

### 5. Soft Delete via `deleted_at`

Devices are never hard-deleted. Setting `deleted_at` preserves historical references from
the monitoring context (metrics, alerts) without breaking FK constraints.

**Query pattern:** All application queries should include `WHERE deleted_at IS NULL` unless
explicitly querying historical records. Consider a Prisma middleware for this.

### 6. Enums vs Reference Tables

Stable, well-defined sets use PostgreSQL enums via Prisma: `DeviceStatus`, `DeviceType`,
`InterfaceType`, `LocationType`, etc.

`Protocol` is a reference table (not an enum) because:

- It has associated data (default port, category).
- It participates in M:N relationships.
- New protocols can be added without a migration.

If a tenant later needs custom device categories or location types beyond the enum values,
you can migrate from enum to reference table. For now, enums are simpler and faster.

---

## Seed Data

### Protocols (global — run once at deployment)

```typescript
const protocols = [
  {
    name: 'SNMP',
    defaultPort: 161,
    category: 'MONITORING',
    description: 'Simple Network Management Protocol'
  },
  {
    name: 'ICMP',
    defaultPort: 0,
    category: 'MONITORING',
    description: 'Ping / latency check'
  },
  {
    name: 'SSH',
    defaultPort: 22,
    category: 'MANAGEMENT',
    description: 'Secure Shell'
  },
  {
    name: 'WINBOX',
    defaultPort: 8291,
    category: 'MANAGEMENT',
    description: 'MikroTik Winbox protocol'
  },
  {
    name: 'HTTP',
    defaultPort: 80,
    category: 'MANAGEMENT',
    description: 'Web management (unsecured)'
  },
  {
    name: 'HTTPS',
    defaultPort: 443,
    category: 'MANAGEMENT',
    description: 'Web management (TLS)'
  },
  {
    name: 'TELNET',
    defaultPort: 23,
    category: 'MANAGEMENT',
    description: 'Telnet (legacy, insecure)'
  },
  {
    name: 'API',
    defaultPort: 8728,
    category: 'BOTH',
    description: 'RouterOS API'
  },
  {
    name: 'API_SSL',
    defaultPort: 8729,
    category: 'BOTH',
    description: 'RouterOS API over TLS'
  }
];
```

---

## Exported Service Contract

This bounded context exposes the following interfaces to other modules.
**Other modules must never import repositories directly.**

```typescript
// ─── Queries (read-only, consumed by Monitoring, Topology, etc.) ───

interface IDeviceQueryService {
  /** Returns all active, monitorable devices for a tenant */
  findMonitorableDevices(
    tenantId: string
  ): Promise<MonitorableDeviceDto[]>;

  /** Full device with interfaces and enabled protocols */
  getDeviceDetail(deviceId: string): Promise<DeviceDetailDto | null>;

  /** Lightweight summary for dashboards and lists */
  listDevices(
    tenantId: string,
    filters: DeviceFilters
  ): Promise<DeviceSummaryDto[]>;

  /** Returns interfaces marked as monitored for a specific device */
  getMonitoredInterfaces(
    deviceId: string
  ): Promise<InterfaceSummaryDto[]>;
}

// ─── DTOs ───

interface MonitorableDeviceDto {
  id: string;
  name: string;
  ipAddress: string; // guaranteed non-null for active devices
  managementPort: number | null;
  category: DeviceCategory;
  location: { id: string; name: string } | null;
  model: {
    manufacturer: string;
    model: string;
    operatingSystem: OperatingSystem;
  };
  enabledProtocols: {
    name: string; // 'SNMP', 'SSH', etc.
    port: number; // resolved: device override or protocol default
    category: ProtocolCategory;
  }[];
  interfaces: {
    id: string;
    name: string;
    snmpIndex: number | null;
    type: InterfaceType;
  }[];
}

interface DeviceFilters {
  status?: DeviceStatus[];
  category?: DeviceCategory[];
  locationId?: string;
  search?: string; // searches name, IP, serial, MAC
}

// ─── Commands (write, consumed by API controllers and internal services) ───

interface IDeviceCommandService {
  createDevice(
    tenantId: string,
    data: CreateDeviceInput
  ): Promise<DeviceDetailDto>;
  deployDevice(
    deviceId: string,
    data: DeployDeviceInput
  ): Promise<void>;
  decommissionDevice(deviceId: string): Promise<void>;
  syncInterfaces(
    deviceId: string,
    interfaces: SyncInterfaceInput[]
  ): Promise<void>;
  updateDeviceProtocols(
    deviceId: string,
    protocols: UpdateProtocolInput[]
  ): Promise<void>;
}

// ─── Domain Events (published for other contexts to react) ───

type DeviceInventoryEvent =
  | { type: 'device.created'; tenantId: string; deviceId: string }
  | {
      type: 'device.deployed';
      tenantId: string;
      deviceId: string;
      ipAddress: string;
    }
  | {
      type: 'device.ip_changed';
      tenantId: string;
      deviceId: string;
      oldIp: string;
      newIp: string;
    }
  | {
      type: 'device.decommissioned';
      tenantId: string;
      deviceId: string;
    }
  | {
      type: 'device.interfaces_synced';
      tenantId: string;
      deviceId: string;
    };
```

### How Monitoring Consumes This

The Monitoring module's `PollingOrchestrator` calls `findMonitorableDevices(tenantId)` on
each polling cycle. It receives a flat list of devices with their IPs, protocols, and
interfaces — everything it needs to construct SNMP/API/ICMP requests. It never touches
the Device Inventory database directly.

When a `device.deployed` event fires, Monitoring automatically adds the device to the
poll cycle. When `device.decommissioned` fires, it removes it and closes any active alerts.

---

## Indexing Strategy

| Table               | Index                            | Purpose                                              |
| ------------------- | -------------------------------- | ---------------------------------------------------- |
| `devices`           | `(tenant_id, status)`            | Monitoring: find all active devices per tenant       |
| `devices`           | `(tenant_id, location_id)`       | Dashboard: devices by site                           |
| `devices`           | `(tenant_id, category)`          | Dashboard: devices by network layer                  |
| `devices`           | `(ip_address)`                   | Reverse lookup from IP to device (alert correlation) |
| `devices`           | `(deleted_at)`                   | Partition active vs soft-deleted                     |
| `device_interfaces` | `(device_id, is_monitored)`      | Polling: get monitorable interfaces fast             |
| `device_interfaces` | `(device_id, snmp_index)` UNIQUE | Prevent duplicate ifIndex per device                 |
| `locations`         | `(tenant_id, type)`              | Filter locations by purpose                          |

---

## Migration Notes

### From Current Draw.io Model

1. Merge `Dispositivo` + `Dispositivo Red` → `Device`
2. Move `numero_serie`, `garantia_hasta` from old `Dispositivo` → `Device.serialNumber` (warranty tracking moves to Asset Management context)
3. Move `protocolo_gestion` from column → `Protocol` + `DeviceProtocol` (M:N)
4. Move `tipo_conectividad` from column → resolved per-interface via `DeviceInterface.type`
5. Drop `Monitoreo Dispositivo` from this context → becomes `DeviceCurrentStatus` + `MetricSample` in Monitoring context
6. Move `Software Dispositivo`, `Seguridad Dispositivo`, `Energia Dispositivo` → Device Configuration context
7. Move `Radioantena`, `Access Point`, `Enlace` → Network Topology context
8. Move `Proveedor`, `Compra`, `Dispositivos Proveedor`, `Mantenimiento Dispositivo`, `Técnico` → Asset Management context
