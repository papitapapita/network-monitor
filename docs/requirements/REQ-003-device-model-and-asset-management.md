# REQ-003: Device Model and Asset Management

## Metadata

| Field                      | Value                                   |
| -------------------------- | --------------------------------------- |
| **Requirement ID**         | REQ-003                                 |
| **Sprint**                 | Sprint 2                                |
| **Priority**               | High                                    |
| **Status**                 | Planned                                 |
| **Created**                | 2026-01-09                              |
| **Last Updated**           | 2026-01-09                              |
| **Epic**                   | Asset & Inventory Management            |
| **Estimated Story Points** | 13                                      |

---

## Feature Overview

### Summary

Implement a comprehensive device catalog and asset management system that separates hardware product information (DeviceModel) from physical device instances (Device) and their network deployment (NetworkDevice). This establishes a clear separation between product catalog management, asset inventory tracking, and network operations.

### Business Value

This feature provides critical infrastructure for managing the entire device lifecycle from procurement to deployment and decommissioning, enabling better asset tracking, warranty management, and operational efficiency.

- **Asset Tracking**: Complete visibility of all physical devices regardless of deployment status (warehouse, deployed, maintenance, decommissioned)
- **Cost Management**: Track purchase orders, warranties, and device ownership for accurate financial reporting and budgeting
- **Operational Efficiency**: Streamline device replacement workflows by maintaining clear relationships between physical assets and network deployments
- **Catalog Management**: Maintain a standardized product catalog enabling consistent device specifications across the organization
- **Multi-tenancy Support**: Track device ownership (company-owned, client-owned, third-party) for accurate asset allocation

---

## Domain Context

### Affected Bounded Contexts

- **Product Catalog** (Primary) - Device models, specifications, manufacturers
- **Asset Management** (Primary) - Physical device inventory, ownership, warranties
- **Network Management** (Supporting) - Deploys devices to network infrastructure
- **Procurement** (Supporting) - Purchase orders, suppliers, acquisition tracking

### Involved Aggregates

- **DeviceModel** (Product Catalog)
  - Root Entity: DeviceModel
  - Encapsulates: manufacturer, hardware type, OS, specifications

- **Device** (Asset Management)
  - Root Entity: Device
  - References: DeviceModel (many-to-one), Location (optional one-to-one), PurchaseOrder (many-to-one)
  - Child Entities: None

- **NetworkDevice** (Network Management)
  - Root Entity: NetworkDevice (existing from REQ-002)
  - References: Device (optional one-to-one) - updated to reference Device instead of string deviceId

### Key Domain Concepts

- **DeviceModel**: Immutable product specification representing a model/SKU from a manufacturer (e.g., "Ubiquiti Litebeam 5AC Gen2"). Defines what the hardware fundamentally IS (DeviceType: RADIO, ROUTER, SWITCH).
- **Device**: Physical device instance with unique serial number. Represents a real piece of hardware that can be tracked through its lifecycle (purchased → warehouse → deployed → maintenance → decommissioned).
- **DeviceType**: Immutable hardware classification (ROUTER, SWITCH, RADIO, etc.) that describes the fundamental nature of the hardware. Lives in DeviceModel, NOT NetworkDevice.
- **DeviceRole**: What the device DOES in the network (ROUTING, FIREWALL, WIRELESS_ACCESS, etc.). Lives in NetworkDevice as it describes network function, not hardware capabilities.
- **Device Status**: Asset status (ACTIVE, INACTIVE, MAINTENANCE, OUT_OF_SERVICE, DAMAGED) tracking the physical device's operational state.
- **Device Owner**: Tracks who owns the physical asset (COMPANY, CLIENT, THIRD_PARTY) for multi-tenancy and cost allocation.

---

## User Stories

### Primary User Story

```
Como administrador de red, necesito gestionar un catálogo de modelos de dispositivos y rastrear cada dispositivo físico individual desde su compra hasta su despliegue en la red, para mantener un inventario preciso y facilitar el reemplazo de equipos.
```

**Translation**: _As a network administrator, I need to manage a catalog of device models and track each individual physical device from purchase to network deployment, to maintain accurate inventory and facilitate equipment replacement._

### Decomposed User Stories

#### US-003.1: Manage Device Model Catalog

**As a** network administrator
**I want** to create and manage device models with complete specifications
**So that** I can maintain a standardized product catalog for procurement and deployment decisions

#### US-003.2: Track Physical Device Assets

**As an** inventory manager
**I want** to register physical devices with serial numbers and link them to device models
**So that** I can track individual hardware assets through their entire lifecycle

#### US-003.3: Link Devices to Network Deployments

**As a** network administrator
**I want** to associate physical devices with network device configurations
**So that** I know which specific hardware is deployed at each network location

#### US-003.4: Manage Device Ownership and Warranties

**As an** asset manager
**I want** to track device ownership, purchase orders, and warranty information
**So that** I can manage costs and ensure timely warranty claims

#### US-003.5: Query Device Deployment Status

**As a** network administrator
**I want** to see whether a device is in warehouse, deployed, or maintenance
**So that** I can make informed decisions about device allocation and replacement

---

## Acceptance Criteria

### AC-003.1: Device Model Creation

- **Given** I am a network administrator
- **When** I create a new device model with name "Ubiquiti Litebeam 5AC Gen2", manufacturer "UBIQUITI", type "RADIO", OS "AIRMAXOS"
- **Then** the system creates a unique DeviceModelId
- **And** the DeviceType is immutable after creation
- **And** the model can be referenced by multiple Device instances

### AC-003.2: Device Registration with Serial Number

- **Given** a DeviceModel exists in the catalog
- **When** I register a new Device with serial number "LBE5AC2-001234" referencing that model
- **Then** the system creates a unique DeviceId
- **And** the serial number is validated as unique across all devices
- **And** the Device status defaults to INACTIVE
- **And** the Device owner defaults to COMPANY

### AC-003.3: Device-to-NetworkDevice Association

- **Given** a Device exists in the asset inventory
- **When** I deploy it to the network by creating a NetworkDevice with deviceId reference
- **Then** the NetworkDevice maintains a foreign key to the Device
- **And** each Device can have at most one active NetworkDevice association
- **And** I can query the device model specifications through Device → DeviceModel relationship

### AC-003.4: Device Lifecycle Status Tracking

- **Given** a Device exists
- **When** I update its status to MAINTENANCE
- **Then** the Device status changes independently of NetworkDevice status
- **And** audit logs record the status change with timestamp and user

### AC-003.5: Device Replacement Workflow Support

- **Given** a NetworkDevice is marked for deletion (from REQ-002)
- **When** I create a new NetworkDevice with a different deviceId (new Device with different serial number)
- **Then** the system maintains the replacement relationship through REQ-002's replacedByDeviceId
- **And** I can trace the physical device replacement history
- **And** both old and new Device records remain in asset inventory

### AC-003.6: Prevent Duplicate Serial Numbers

- **Given** a Device exists with serial number "LBE5AC2-001234"
- **When** I attempt to create another Device with the same serial number
- **Then** the system rejects the operation with error "Serial number must be unique"

### AC-003.7: Query Device Model Information from NetworkDevice

- **Given** a NetworkDevice references a Device which references a DeviceModel
- **When** I query the NetworkDevice
- **Then** I can retrieve device model name, manufacturer, DeviceType, and OS
- **And** these values are NOT duplicated in NetworkDevice aggregate

### AC-003.8: Location Tracking

- **Given** a Device exists
- **When** I assign a physical Location with coordinates, city, neighborhood, address
- **Then** the Device maintains a one-to-one relationship with Location
- **And** the Location tracks the physical storage/installation site (not network topology)

---

## Functional Requirements

### FR-003.1: DeviceModel Aggregate

The system shall implement a DeviceModel aggregate root with the following:
- Unique identifier (DeviceModelId value object)
- Model name (string, required, max 255 characters)
- Manufacturer (Vendors enum, required)
- DeviceType (enum, required, immutable after creation)
- Operating system (OperatingSystems enum, optional)
- Specifications (string, optional, technical details/JSON)
- Many-to-many relationship with Suppliers
- One-to-many relationship with Device instances

**Immutability**: DeviceType cannot be changed after creation as it represents fundamental hardware characteristics.

### FR-003.2: Device Aggregate

The system shall implement a Device aggregate root with the following:
- Unique identifier (DeviceId value object)
- Serial number (SerialNumber value object, unique constraint)
- Device model reference (DeviceModelId, required)
- Device status (DeviceStatus enum: ACTIVE, INACTIVE, MAINTENANCE, OUT_OF_SERVICE, DAMAGED)
- Device owner (DeviceOwner enum: COMPANY, CLIENT, THIRD_PARTY)
- Purchase order reference (PurchaseOrderId, required)
- Guarantee end date (DateTime, optional)
- Physical location reference (LocationId, optional one-to-one)
- Creation and update timestamps

**Business Rules**:
- Serial numbers must be globally unique
- Device can exist independently of NetworkDevice deployment
- Device status is independent of NetworkDeviceStatus (asset vs network operational state)
- Location represents physical placement, not network topology

### FR-003.3: NetworkDevice Reference Update

Update the existing NetworkDevice aggregate to:
- Replace `deviceId: string` with `deviceId: DeviceId` (reference to Device aggregate)
- Remove deviceType property (retrieve from Device → DeviceModel)
- Add deviceRoles: DeviceRole[] property (network functions, not hardware type)
- Maintain optional relationship (NetworkDevice can exist without Device for backward compatibility during migration)

### FR-003.4: Supplier and PurchaseOrder Management

The system shall support:
- Supplier entity with name, contact info, location
- PurchaseOrder entity with order number, date, observations, total price, supplier reference
- Many-to-many relationship between Suppliers and DeviceModels (multiple suppliers can offer same model)
- One-to-many relationship between PurchaseOrder and Devices

### FR-003.5: Location Entity

The system shall implement a Location entity with:
- Unique identifier (LocationId)
- Coordinates (string, GPS coordinates)
- City (string, required)
- Neighborhood (string, required)
- Address (string, optional, full street address)
- One-to-one relationship with Device

**Note**: This is physical location for asset tracking, distinct from NetworkDevice's logical network location/topology.

### FR-003.6: Query Capabilities

The system shall provide:
- List all devices for a specific device model
- Find device by serial number
- Query devices by status (ACTIVE, INACTIVE, etc.)
- Query devices by owner (COMPANY, CLIENT, THIRD_PARTY)
- List devices not deployed to network (no NetworkDevice association)
- List devices with expired warranties
- Retrieve device model specifications from NetworkDevice

---

## Non-Functional Requirements

### Performance Requirements

#### NFR-003.1: Serial Number Uniqueness Check

Serial number uniqueness validation must complete within 100ms for 99th percentile with up to 100,000 devices in the database.

**Implementation**: Database unique constraint on `Device.serialNumber` field.

#### NFR-003.2: Device Model Lookup

Retrieving device model information from a NetworkDevice through the Device relationship must complete within 200ms for 99th percentile.

**Implementation**: Database indexes on foreign key relationships (Device.deviceModelId, NetworkDevice.deviceId).

### Reliability Requirements

#### NFR-003.3: Data Consistency

Device-DeviceModel-NetworkDevice relationships must maintain referential integrity through database foreign key constraints with appropriate cascade rules.

### Usability Requirements

#### NFR-003.4: Clear Entity Separation

API responses must clearly distinguish between:
- Device hardware type (from DeviceModel.deviceType)
- Device network roles (from NetworkDevice.deviceRoles)
- Device asset status (from Device.status)
- Device network status (from NetworkDevice.status)

---

## Technical Constraints

### TC-003.1: Existing NetworkDevice Compatibility

The update to NetworkDevice aggregate must:
- Support gradual migration from string deviceId to DeviceId value object
- Maintain backward compatibility during transition period
- Not break existing REQ-001 and REQ-002 functionality

### TC-003.2: Database Schema Alignment

Domain model must align with existing Prisma schema entities:
- DeviceModel (already exists in schema)
- Device (already exists in schema)
- Supplier (already exists in schema)
- PurchaseOrder (already exists in schema)
- Location (already exists in schema)

### TC-003.3: Value Object Serialization

DeviceId, DeviceModelId, and SerialNumber value objects must serialize correctly for:
- Prisma ORM persistence
- API responses (JSON)
- Domain event payloads

---

## Dependencies

### Internal Dependencies

- **NetworkDevice Aggregate (REQ-002)**: Must update to reference Device aggregate
- **Domain Value Objects**: Requires DeviceId, DeviceModelId, SerialNumber value objects
- **Infrastructure Repositories**: Requires IDeviceRepository, IDeviceModelRepository
- **Mappers**: Requires DeviceMapper, DeviceModelMapper for persistence

### External Dependencies

- **PostgreSQL Database**: For relational storage with foreign key constraints
- **Prisma ORM**: For entity mapping and migrations

---

## Assumptions

### Business Assumptions

- Every physical device has a unique serial number assigned by manufacturer
- Device models are relatively stable (not frequently changed once created)
- A device can only be deployed to one network location at a time (one-to-one Device-NetworkDevice)
- Physical devices may be purchased before being deployed to network
- Device ownership tracking is required for financial reporting and multi-tenancy

### Technical Assumptions

- Serial numbers are string format (varying lengths and formats across manufacturers)
- Device specifications can be stored as JSON string for flexibility
- Physical location coordinates are stored as strings (GPS format)
- DeviceType enum covers all necessary hardware categories

---

## Risk Analysis

### Risk 1: Migration Complexity for Existing NetworkDevices

**Severity**: High
**Probability**: Medium
**Description**: Existing NetworkDevice records reference deviceId as string. Migrating to Device aggregate references requires data migration and potential service disruption.

**Indicators**:
- Existing NetworkDevice records in production database
- String deviceId values that don't correspond to Device UUIDs

**Mitigation**:
- Implement migration script to create Device records from existing NetworkDevice.deviceId strings
- Use database transaction to ensure atomicity of migration
- Support optional Device reference initially (nullable foreign key)
- Implement backward compatibility layer in repositories
- Test migration on staging environment with production data snapshot

### Risk 2: Serial Number Format Variations

**Severity**: Medium
**Probability**: High
**Description**: Different manufacturers use varying serial number formats (alphanumeric, length, special characters), which may cause validation or uniqueness issues.

**Indicators**:
- Serial number validation failures during Device creation
- Duplicate serial numbers from different manufacturers (unlikely but possible)

**Mitigation**:
- Store serial numbers as strings without strict format validation
- Implement case-insensitive uniqueness check
- Combine serialNumber + manufacturer for true uniqueness if needed
- Document serial number format expectations per manufacturer

### Risk 3: God Class Anti-pattern in NetworkDevice

**Severity**: Medium
**Probability**: Medium
**Description**: Without clear boundaries, developers may add Device or DeviceModel properties directly to NetworkDevice, defeating the purpose of separation.

**Indicators**:
- Pull requests adding DeviceModel fields to NetworkDevice
- Duplication of data across aggregates
- Confusion about which aggregate owns which data

**Mitigation**:
- Document clear ownership boundaries in architecture docs
- Implement code review checklist for aggregate boundary violations
- Use TypeScript visibility modifiers to enforce encapsulation
- Provide helper methods on NetworkDevice to access Device/DeviceModel data through relationships

---

## Alternative Solutions Considered

### Alternative 1: Embedded Device Information in NetworkDevice

**Description**: Store all device model and asset information directly in NetworkDevice aggregate as value objects or embedded entities.

**Pros**:
- Simpler initial implementation (no additional aggregates)
- Fewer database joins for queries
- Single source of truth per network device

**Cons**:
- Cannot track devices before network deployment
- No asset management capabilities (warehouse inventory, maintenance tracking)
- Duplicates device model information across all devices of same model
- Cannot track device ownership independently of network deployment
- Makes device replacement workflows complex (REQ-002)
- Violates single responsibility principle (network operations vs asset management)

**Decision**: ❌ Rejected. Asset management is a distinct bounded context requiring separate aggregates. The slight complexity of relationships is justified by clear separation of concerns and support for full device lifecycle management.

### Alternative 2: Device Model as Value Object

**Description**: Treat DeviceModel as a value object embedded in Device rather than separate aggregate.

**Pros**:
- Simpler relationship model
- No additional repository needed

**Cons**:
- Cannot share device models across devices (duplication)
- Cannot manage device catalog independently
- Makes procurement and supplier relationships complex
- Difficult to update device specifications retroactively

**Decision**: ❌ Rejected. DeviceModel has its own identity and lifecycle, making it a proper aggregate root. Multiple devices share the same model, requiring a proper entity relationship.

### Alternative 3: Combine Device and NetworkDevice

**Description**: Merge Device asset information into NetworkDevice, making NetworkDevice represent both the physical asset and network deployment.

**Pros**:
- One aggregate handles everything
- Simpler for cases where devices are always network-deployed

**Cons**:
- Cannot represent devices in warehouse or maintenance (not deployed)
- Forces network management context to handle asset management concerns
- Makes device replacement complex (need to track old serial numbers in network context)
- Violates bounded context separation
- Tightly couples procurement/asset tracking with network operations

**Decision**: ❌ Rejected. Asset management and network operations are distinct bounded contexts with different lifecycles and responsibilities.

---

## Security Considerations

### SEC-003.1: Serial Number Privacy

**Requirement**: Serial numbers may contain sensitive information for warranty/RMA claims
**Implementation**:
- Include serial numbers in audit logs for device operations
- Implement role-based access control for viewing full serial numbers
- Consider masking serial numbers in general user interfaces (show last 4 digits only)

### SEC-003.2: Purchase Order Data Protection

**Requirement**: Purchase order information contains financial data that must be protected
**Implementation**:
- Restrict purchase order access to roles: ADMIN, ASSET_MANAGER, PROCUREMENT
- Encrypt purchase order total price in database (optional based on compliance requirements)
- Audit all access to purchase order information

### SEC-003.3: Supplier Contact Information

**Requirement**: Supplier contact information is business-sensitive
**Implementation**:
- Restrict supplier management to ADMIN and PROCUREMENT roles
- Audit all supplier information modifications
- Do not expose supplier details in public APIs

---

## User Roles & Permissions

| Role                 | Create DeviceModel | Create Device | Update Device | View Device | Manage Suppliers | View Purchase Orders |
| -------------------- | ------------------ | ------------- | ------------- | ----------- | ---------------- | -------------------- |
| **ADMIN**            | ✓                  | ✓             | ✓             | ✓           | ✓                | ✓                    |
| **ASSET_MANAGER**    | ✗                  | ✓             | ✓             | ✓           | ✗                | ✓                    |
| **NETWORK_ADMIN**    | ✗                  | ✗             | ✗             | ✓           | ✗                | ✗                    |
| **PROCUREMENT**      | ✓                  | ✓             | ✗             | ✓           | ✓                | ✓                    |
| **TECHNICIAN**       | ✗                  | ✗             | ✗             | ✓           | ✗                | ✗                    |
| **VIEWER**           | ✗                  | ✗             | ✗             | ✓           | ✗                | ✗                    |

---

## Audit & Logging Requirements

### Device Lifecycle Logs

**Retention**: 7 years (asset management compliance)

**Required Fields**:
- timestamp
- userId (who performed action)
- deviceId
- action (created, updated, status_changed, deployed, decommissioned)
- previousValues (for updates)
- newValues (for updates)

**Example**:

```json
{
  "timestamp": "2026-01-09T14:30:00Z",
  "userId": "user-123",
  "deviceId": "device-456",
  "serialNumber": "LBE5AC2-001234",
  "action": "status_changed",
  "previousValues": {
    "status": "ACTIVE"
  },
  "newValues": {
    "status": "MAINTENANCE"
  }
}
```

### Device Model Changes Logs

**Retention**: 5 years

**Required Fields**:
- timestamp
- userId
- deviceModelId
- action (created, updated, specifications_modified)
- changedFields[]
- previousValues
- newValues

### Device Deployment Logs

**Retention**: 7 years

**Required Fields**:
- timestamp
- userId
- deviceId
- networkDeviceId
- action (deployed, removed, replaced)
- location (physical or network)

---

## Testing Requirements

### Unit Testing

- DeviceModel aggregate creation with all field variations
- Device aggregate creation with valid/invalid serial numbers
- Serial number uniqueness validation
- Device status transitions
- DeviceId and SerialNumber value object validation
- **Coverage Target**: > 90%

### Integration Testing

- Create DeviceModel → Create Device → Create NetworkDevice flow
- Device replacement workflow (delete old NetworkDevice, create new with different Device)
- Query NetworkDevice with Device and DeviceModel joins
- Serial number uniqueness constraint violation handling
- Foreign key constraint enforcement (Device → DeviceModel, NetworkDevice → Device)
- Location assignment and one-to-one constraint

### Performance Testing

- Serial number uniqueness check with 100,000 devices: < 100ms p99
- DeviceModel lookup from NetworkDevice with joins: < 200ms p99
- List devices by status with 50,000 devices: < 500ms p99
- **Target**: Support 100,000+ devices in inventory

### Domain Testing

- DeviceType immutability after DeviceModel creation
- Device can exist without NetworkDevice deployment
- NetworkDevice can reference Device and retrieve model specifications
- Device status changes independently of NetworkDeviceStatus

---

## Integration Requirements

### INT-003.1: NetworkDevice Integration

**Description**: Update existing NetworkDevice aggregate and repositories to reference Device aggregate

**Integration Points**:
- Replace string deviceId with DeviceId value object in NetworkDevice aggregate
- Update NetworkDeviceProps interface
- Update NetworkDeviceRepository to join Device table
- Update NetworkDeviceMapper to handle Device reference
- Provide query methods to retrieve DeviceModel info from NetworkDevice

### INT-003.2: REQ-002 Device Replacement Integration

**Description**: Ensure device replacement workflow (REQ-002) works with new Device aggregate

**Integration Points**:
- DeviceReplacedEvent should include both old and new Device serial numbers
- Replacement workflow should verify new Device exists in inventory before deployment
- Query device replacement history with Device details

---

## Failover & Redundancy

### FAIL-003.1: Foreign Key Constraint Handling

**Description**: Handle database foreign key constraint violations gracefully

**Implementation**:
- Catch constraint violations in repositories
- Return domain-friendly error messages (e.g., "Device model not found")
- Implement retry logic for transient database errors
- Log constraint violations for debugging

### FAIL-003.2: Migration Rollback Strategy

**Description**: Support rollback if NetworkDevice → Device migration fails

**Implementation**:
- Backup NetworkDevice table before migration
- Run migration in transaction with explicit commit
- Implement rollback script to restore string deviceId references
- Test rollback procedure in staging environment

---

## Maintenance & Support Requirements

### Error Reporting

Error messages shall clearly distinguish between:
- Device not found vs DeviceModel not found
- Serial number uniqueness violation vs validation failure
- Device already deployed vs Device not in inventory

### Diagnostic Tools

Provide CLI/admin tools for:
- List devices without NetworkDevice deployment (in warehouse)
- Find orphaned NetworkDevices (referencing non-existent Devices)
- Validate referential integrity across Device → DeviceModel → NetworkDevice
- Generate device inventory reports by status, owner, or model

### Documentation

- Domain model diagram showing DeviceModel → Device → NetworkDevice relationships
- Migration guide for existing deployments
- API documentation for device and device model endpoints
- Asset management workflow guide
- Device replacement procedure documentation

---

## Definition of Done

This requirement is considered complete when:

- [x] DeviceModel aggregate implemented with domain logic and tests
- [x] Device aggregate implemented with domain logic and tests
- [ ] DeviceId, DeviceModelId, SerialNumber value objects implemented
- [ ] NetworkDevice aggregate updated to reference Device
- [ ] Device and DeviceModel repositories implemented
- [ ] Infrastructure mappers for Prisma persistence implemented
- [ ] Database migration script created and tested
- [ ] Use cases implemented: CreateDeviceModel, CreateDevice, GetDeviceBySerialNumber, ListDevicesByStatus
- [ ] Unit tests written with > 90% coverage
- [ ] Integration tests pass for device lifecycle flows
- [ ] Performance tests meet NFR targets
- [ ] Device replacement workflow (REQ-002) tested with new Device references
- [ ] API endpoints implemented and documented
- [ ] Code reviewed and approved by tech lead
- [ ] Documentation completed (domain model, migration guide, API docs)
- [ ] Migration script tested on staging with production data snapshot
- [ ] UAT passed with asset management scenarios
- [ ] Deployed to production with migration plan

---

## Related Documents

- [REQ-002: Network Device Lifecycle Management](/docs/requirements/REQ-002-network-device-crud.md) - Device replacement integration
- [DOMAIN-SERVICES-STANDARD.md](/docs/rules/DOMAIN-SERVICES-STANDARD.md) - Domain service patterns
- [APPLICATION-USE-CASES-STANDARD.md](/docs/rules/APPLICATION-USE-CASES-STANDARD.md) - Use case implementation
- [INFRASTRUCTURE-REPOSITORY-IMPLEMENTATIONS-STANDARD.md](/docs/rules/INFRASTRUCTURE-REPOSITORY-IMPLEMENTATIONS-STANDARD.md) - Repository patterns
- [Prisma Schema](/prisma/schema.prisma) - Existing database models

---

## Notes

### Open Questions

1. **Should DeviceType be truly immutable, or allow controlled updates?**
   - **Proposal**: Keep immutable. If device type is wrong, create new DeviceModel and deprecate old one. Prevents data inconsistency.

2. **Should we support multiple serial numbers per device (some devices have multiple labels)?**
   - **Proposal**: Start with single serial number. Add SecondarySerialNumber field later if needed. Most devices have one primary serial.

3. **How to handle devices purchased in bulk with sequential serial numbers?**
   - **Proposal**: Implement BulkCreateDevice use case that accepts serial number range or CSV import. Not in initial scope, add in future sprint.

4. **Should Location be shared across multiple Devices or truly one-to-one?**
   - **Proposal**: Keep one-to-one for now (Prisma schema shows this). Location represents storage/installation site. Multiple devices at same site can have separate Location records with same address.

5. **What cascade rules for Device deletion? Should it cascade to NetworkDevice?**
   - **Proposal**:
     - DeviceModel deletion: RESTRICT (cannot delete if Devices reference it)
     - Device deletion: SET NULL on NetworkDevice (preserve network config history)
     - Consider soft-delete for Device similar to NetworkDevice

### Future Enhancements

- **Bulk Device Import**: CSV import for registering multiple devices at once (for large procurement orders)
- **Device History Tracking**: Track device lifecycle events (purchased → warehouse → deployed → maintenance → decommissioned)
- **Warranty Expiration Alerts**: Automated notifications when device warranties are nearing expiration
- **Device Specifications Schema**: Structured JSON schema for device specifications instead of free-form string
- **Device Images**: Store product images for DeviceModel catalog
- **RMA Tracking**: Track return merchandise authorization for warranty claims
- **Device Configuration Templates**: Link DeviceModel to default configuration templates for faster deployment
- **Multi-location Support**: Track device movements between physical locations
- **Asset Depreciation**: Calculate and track device depreciation for financial reporting
- **Supplier Performance**: Track supplier reliability metrics and delivery times
