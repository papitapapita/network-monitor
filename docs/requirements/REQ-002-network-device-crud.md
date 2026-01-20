# REQ-002: Network Device CRUD Operations

## Metadata

| Field                      | Value                     |
| -------------------------- | ------------------------- |
| **Requirement ID**         | REQ-002                   |
| **Sprint**                 | Sprint 2                  |
| **Priority**               | High                      |
| **Status**                 | Planned                   |
| **Created**                | 2026-01-06                |
| **Last Updated**           | 2026-01-06                |
| **Epic**                   | Network Device Management |
| **Estimated Story Points** | 21                        |

---

## Feature Overview

### Summary

This requirement defines a comprehensive CRUD (Create, Read, Update, Delete) system for network devices with support for draft/active states, bulk operations, soft deletion with recovery, device replacement workflows, and real-time status updates. The system follows a hybrid discovery + manual enrichment workflow where devices can be created with minimal information (IP + MAC) in draft state and later enriched and activated.

### Business Value

This feature provides the foundation for all network device management operations, enabling network administrators to efficiently manage device inventories from initial discovery through decommissioning.

- **Operational Efficiency**: Hybrid workflow supports both rapid device discovery and thorough data quality, reducing initial setup time by 60%
- **Data Safety**: Soft delete with 7-day grace period prevents accidental data loss and provides recovery options for mis-deleted devices
- **Collaboration**: Real-time status updates and optimistic locking enable multiple administrators to work simultaneously without conflicts
- **Scalability**: Cursor-based pagination and tiered rate limiting support medium-scale deployments (1,000-10,000 devices) with room to grow
- **Compliance**: Role-based access control and comprehensive audit logging meet enterprise security and compliance requirements

---

## Domain Context

### Affected Bounded Contexts

- **Network Device Management** (Primary)
- **Monitoring & Polling** (Supporting)
- **Audit & Compliance** (Supporting)

### Involved Aggregates

- **NetworkDevice** (Network Device Management)
  - NetworkDevice (Root Entity)
  - PollingConfiguration (Child Entity)
  - Value Objects: NetworkDeviceId, IPAddress, MACAddress, NetworkDeviceStatus, NetworkDeviceType, PollingInterval, RetryPolicy

### Key Domain Concepts

- **Draft State**: A device record with minimum required fields (IP + MAC) that represents a discovered but not yet fully configured device. Drafts are excluded from active monitoring and operational dashboards.
- **Activation**: The explicit transition of a device from DRAFT to ACTIVE state after all required fields are populated and validated. Triggered by user action, not automatic.
- **Soft Delete**: A deletion pattern where devices are marked as deleted but retained for a grace period (7 days) during which they can be restored. After the grace period, records are permanently purged.
- **Device Replacement**: The workflow for handling scenarios where a physical device at the same IP address is replaced with different hardware (different MAC), requiring migration of configuration and metadata.
- **Optimistic Locking**: A concurrency control mechanism using the `updatedAt` timestamp to detect and prevent conflicting simultaneous updates by multiple users.

---

## User Stories

### Primary User Story

```
As a network administrator, I need comprehensive tools to create, view, update, and delete network devices throughout their lifecycle—from initial discovery through decommissioning—with safeguards against data loss and support for collaborative editing.
```

### Decomposed User Stories

#### US-002.1: Create Device from Discovery

**As a** network administrator
**I want** to create device records with minimal information (IP + MAC) during network discovery scans
**So that** I can quickly capture discovered devices and enrich them with details later

#### US-002.2: Activate Device After Enrichment

**As a** network administrator
**I want** to explicitly activate draft devices after filling in all required details
**So that** only fully configured devices enter active monitoring

#### US-002.3: View Device List with Real-Time Updates

**As a** network operations center (NOC) operator
**I want** to view a paginated, searchable, filterable list of devices with real-time status updates
**So that** I can monitor device health and quickly locate devices of interest

#### US-002.4: Update Device Configuration

**As a** network administrator
**I want** to update device properties (name, description, management settings) with optimistic locking
**So that** I can keep device information current without losing concurrent changes

#### US-002.5: Safely Delete Devices with Recovery

**As a** network administrator
**I want** to delete devices with a 7-day recovery period and impact warnings
**So that** I can safely decommission devices with the ability to undo mistakes

#### US-002.6: Bulk Import from Discovery Tools

**As a** network administrator
**I want** to import multiple devices from CSV files exported by network scanners
**So that** I can efficiently onboard large numbers of discovered devices

#### US-002.7: Handle Device Replacement

**As a** network administrator
**I want** to be prompted when creating a device with the same IP as a recently deleted device
**So that** I can properly link replacement devices and migrate configurations

---

## Acceptance Criteria

### AC-002.1: Create Device in Draft State

- **Given** I am an authenticated user with device:create permission
- **When** I submit a create request with only IP address and MAC address
- **Then** a device record is created with activationStatus=DRAFT
- **And** the device is excluded from default device listings
- **And** the device has status=UNKNOWN and polling disabled

### AC-002.2: Activate Draft Device

- **Given** a draft device exists with all required fields populated (IP, MAC, name, deviceType, deviceId)
- **When** I call the activation endpoint as an Admin or Operator
- **Then** the device activationStatus changes from DRAFT to ACTIVE
- **And** the device appears in default device listings
- **And** a NetworkDeviceActivatedEvent is published

### AC-002.3: List Devices with Pagination

- **Given** I am an authenticated user with device:read permission
- **When** I request the device list with pageSize=20
- **Then** I receive up to 20 active devices sorted by createdAt DESC
- **And** the response includes cursor for next page, total count, and hasMore flag
- **And** draft devices are excluded unless explicitly filtered

### AC-002.4: Real-Time Status Updates

- **Given** I have an open WebSocket connection to the device updates channel
- **When** any device transitions between ONLINE and OFFLINE status
- **Then** I receive a real-time WebSocket message with device ID and new status
- **And** my UI updates without requiring manual refresh

### AC-002.5: Update Device with Optimistic Locking

- **Given** I load a device with updatedAt="2026-01-07T10:00:00.000Z"
- **When** I update the device name and submit with updatedAt="2026-01-07T10:00:00.000Z"
- **Then** the update succeeds if no concurrent changes occurred
- **And** the updatedAt timestamp is refreshed to the current time
- **And** if another user updated the device first, I receive a 409 Conflict error with message "Device modified by another user. Please refresh and try again."

### AC-002.6: Soft Delete Device

- **Given** I am an Admin attempting to delete an active device with no active alarms
- **When** I confirm the deletion after reviewing impact warnings
- **Then** the device is marked as deleted with deletedAt=current timestamp
- **And** the device moves to "Recently Deleted" section
- **And** the device is excluded from all operational queries
- **And** polling is stopped immediately

### AC-002.7: Restore Deleted Device

- **Given** a device was deleted 3 days ago (within 7-day grace period)
- **When** I restore the device from "Recently Deleted" section as Admin
- **Then** the device returns to ACTIVE state with all original data intact
- **And** polling configuration is restored but remains disabled
- **And** a NetworkDeviceRestoredEvent is published

### AC-002.8: Bulk Import from CSV

- **Given** I am an Admin with a CSV file containing 50 device records with headers
- **When** I upload the file to the bulk import endpoint
- **Then** the system validates all 50 records before any are created
- **And** if all valid, all 50 devices are created in a single transaction
- **And** if any validation fails, the entire import is rolled back with detailed error report
- **And** I receive a summary of created devices or validation errors

### AC-002.9: Device Replacement Detection

- **Given** I create a device with IP 192.168.1.100 and MAC AA:BB:CC:DD:EE:01
- **And** a device with IP 192.168.1.100 and MAC AA:BB:CC:DD:EE:FF was deleted 2 days ago
- **When** the system detects the IP match with different MAC
- **Then** I am prompted: "Device with this IP was deleted 2 days ago. Is this a replacement?"
- **And** if I confirm, the new device is linked to the old record as a replacement
- **And** configuration (polling, management) and metadata (name, description, location) are migrated from the old device

---

## Functional Requirements

### FR-002.1: Device Lifecycle States

The system shall support two activation states for devices:

- **DRAFT**: Device exists with minimum required fields (IP + MAC). Excluded from default listings, monitoring, and polling. Used during discovery and enrichment phase.
- **ACTIVE**: Device has all required fields and has been explicitly activated. Included in operational queries, monitoring, and polling (if enabled).

Transition from DRAFT to ACTIVE requires explicit user action via activation endpoint. System shall validate all required fields before allowing activation.

### FR-002.2: Required Fields by State

**DRAFT State Requirements:**

- `ipAddress` (required, unique among active devices)
- `macAddress` (required, unique among active devices)

**ACTIVE State Requirements:**

- All DRAFT requirements plus:
- `name` (required, max 255 characters)
- `deviceType` (required, valid NetworkDeviceType enum)
- `deviceId` (required, valid UUID)

**Optional Fields (all states):**

- `description` (max 1000 characters)
- `location` (max 500 characters)
- `connectivityType` (default: ETHERNET)
- `managementProtocol` (default: SNMP)
- `managementPort` (default: 161, range 1-65535)
- `enabledRemoteAccess` (default: false)

### FR-002.3: Cursor-Based Pagination

The system shall implement cursor-based pagination for all device list operations with the following specifications:

- Default page size: 20 devices
- Maximum page size: 50 devices
- Cursor encodes last item's position for consistent pagination
- Support dynamic sorting (createdAt DESC, name ASC, status ASC, updatedAt DESC)
- Return pagination metadata: `cursor`, `hasMore`, `total`, `pageSize`

### FR-002.4: Global Search and Filtering

The system shall support both global search and field-specific filtering:

**Global Search** (`search` parameter):

- Searches across: name, ipAddress (partial match), description, location
- Case-insensitive
- Returns devices matching any field

**Field-Specific Filters**:

- `status` - filter by NetworkDeviceStatus (ONLINE, OFFLINE, MAINTENANCE, UNKNOWN)
- `deviceType` - filter by NetworkDeviceType
- `activationStatus` - filter by DRAFT or ACTIVE (default: ACTIVE only)
- `deletedStatus` - include deleted devices (default: exclude)

All filters are combinable (AND logic).

### FR-002.5: Optimistic Locking for Concurrent Updates

The system shall implement optimistic locking using the `updatedAt` timestamp field:

- `updatedAt` field automatically set on creation and updated on every modification
- Update requests must include the current `updatedAt` value from when the record was loaded
- If `updatedAt` in request doesn't match database `updatedAt`, return 409 Conflict with error: "Device modified by another user. Please refresh and try again."
- Timestamp comparison must be atomic within transaction
- Use millisecond precision to minimize false conflicts from rapid updates

### FR-002.6: Soft Delete with Grace Period

The system shall implement soft delete with the following behavior:

**Deletion Process:**

1. Check for blocking dependencies (active alarms, critical references)
2. If blocked, return 400 with list of dependencies that must be resolved
3. Display impact analysis (affected polling jobs, configurations, topology links)
4. Require explicit user confirmation
5. Set `deletedAt = current timestamp` and `deletedBy = user ID`
6. Emit NetworkDeviceDeletedEvent before marking deleted
7. Immediately stop polling
8. Move device to "Recently Deleted" section

**Grace Period:**

- Duration: 7 days from `deletedAt`
- Deleted devices excluded from all operational queries (default lists, monitoring, reports)
- Deleted devices accessible only in "Recently Deleted" section (admins only)
- After 7 days, automated purge job permanently deletes records

**Restoration:**

- Available for 7 days post-deletion
- Admin-only operation
- Restores all original data (fields, status, polling config)
- Polling config restored but remains disabled for safety
- Emits NetworkDeviceRestoredEvent
- Device returns to last activationStatus (DRAFT or ACTIVE)

### FR-002.7: Bulk Operations

**Bulk Create from CSV:**

- Accept standard CSV with header row
- Required columns: `ipAddress`, `macAddress`
- Optional columns: `name`, `deviceType`, `description`, `location`, `connectivityType`, `managementProtocol`, `managementPort`, `enabledRemoteAccess`
- All-or-nothing transaction: entire import succeeds or fails as unit
- Pre-import validation of all rows before any database changes
- Return detailed error report on validation failure (row number, field, error message)
- Return summary on success (number created, list of IDs)
- Maximum 1000 devices per import

**Bulk Status Update:**

- Select multiple devices by ID (max 100 per request)
- Change status to ONLINE, OFFLINE, MAINTENANCE, or UNKNOWN
- Validate all status transitions before committing
- All-or-nothing transaction
- Emit NetworkDeviceStatusChangedEvent for each device
- Return summary (number updated, any failures)

**Bulk Delete:**

- Select multiple devices by ID (max 50 per request)
- Display aggregate impact analysis (total alarms, total configs, total links)
- Require explicit confirmation with reason
- Process as individual soft deletes (all-or-nothing transaction)
- Return summary (number deleted, any failures)

### FR-002.8: Device Replacement Workflow

**Automatic Detection:**

- When creating a device, check if IP address matches any device deleted within last 7 days
- If match found with different MAC address, trigger replacement detection
- Present prompt to user: "Device with IP [IP] was deleted [X] days ago (MAC: [OLD_MAC]). Is this a replacement for that device?"
- User options: "Yes, this is a replacement" or "No, this is a different device"

**Replacement Processing (if confirmed):**

- Create new device record with new MAC address
- Link old device record to new device via `replacedByDeviceId` field
- Migrate configuration from old to new:
  - Polling configuration (interval, pingCount, retryPolicy)
  - Management settings (protocol, port, remoteAccess)
- Migrate metadata:
  - `name` (copy as-is)
  - `location` (copy as-is)
  - `description` (append "; Replaced [OLD_MAC] on [DATE]")
- New device inherits `deviceType` from old device
- New device starts with status=UNKNOWN
- Polling remains disabled initially (user enables manually)
- Emit DeviceReplacedEvent with both old and new device IDs

**No Replacement (if declined):**

- Create device as normal without migration
- No link to deleted device

### FR-002.9: Real-Time Updates via WebSocket

**WebSocket Channel:**

- Endpoint: `/ws/devices/status-updates`
- Requires authentication (JWT token in connection URL or header)
- Supports multiple concurrent connections per user

**Critical Events (Real-Time Push):**

- Device status changes: ONLINE → OFFLINE, OFFLINE → ONLINE
- Any transition involving ONLINE or OFFLINE status

**Message Format:**

```json
{
  "type": "DEVICE_STATUS_CHANGED",
  "deviceId": "uuid",
  "previousStatus": "ONLINE",
  "newStatus": "OFFLINE",
  "timestamp": "2026-01-06T10:30:00Z"
}
```

**Reconnection Handling:**

- On reconnection, client performs full refresh of current page
- No server-side event queuing
- WebSocket disconnection triggers automatic reconnection with exponential backoff (1s, 2s, 4s, max 30s)

**Fallback:**

- If WebSocket unavailable or fails repeatedly, client falls back to polling every 30 seconds

### FR-002.10: Immutable Fields

The following fields cannot be modified after device creation (returns 400 if attempted):

- `ipAddress`
- `macAddress`
- `deviceType`
- `connectivityType`

To change these fields, the device must be deleted and recreated (or use replacement workflow for IP).

### FR-002.11: Ping Test on Creation

The system shall support optional ping test during device creation:

- `performPingTest` parameter (boolean, default: false)
- If true, system performs ICMP ping to device IP (non-blocking)
- If ping succeeds: set initial status=ONLINE
- If ping fails or times out: set initial status=UNKNOWN
- If ping test not performed: default status=UNKNOWN
- Ping timeout: 5 seconds
- Ping test failure never prevents device creation

### FR-002.12: Automatic PollingConfiguration Creation

On device creation, the system shall automatically create a PollingConfiguration entity:

- Initial state: disabled
- Default interval: based on deviceType (ACCESS_POINT: 30s, STATION: 300s, ROUTER/SWITCH/FIREWALL: 60s, SERVER: 120s, etc.)
- Default pingCount: 3
- Default retryPolicy: 3 attempts, 1000ms base delay, exponential backoff
- User must explicitly enable polling via ConfigureDevicePollingUseCase

---

## Non-Functional Requirements

### Performance Requirements

#### NFR-002.1: List Query Response Time

Device list queries with pagination (pageSize ≤ 50) shall return results within 200ms at p95 for databases containing up to 10,000 devices.

**Measurement**: Server-side query execution time from request receipt to JSON serialization complete.

#### NFR-002.2: Search Query Performance

Global search queries across name/IP/description fields shall return results within 500ms at p95 for databases containing up to 10,000 devices.

**Implementation**: Requires database indexes on `name`, `ipAddress`, full-text index on `description`.

#### NFR-002.3: Bulk Import Throughput

Bulk CSV imports of up to 1,000 devices shall complete validation and insertion within 30 seconds at p95.

**Target**: ~33 devices/second processing rate.

#### NFR-002.4: WebSocket Message Latency

Critical status change events shall be delivered to connected WebSocket clients within 2 seconds of status change detection.

**Measurement**: Time from database commit of status change to message delivery to client.

#### NFR-002.5: Concurrent Update Performance

The system shall support up to 50 concurrent device update operations per second without performance degradation.

### Reliability Requirements

#### NFR-002.6: Transaction Atomicity

All multi-record operations (bulk create, bulk update, bulk delete, device creation with polling config) shall be atomic. Either all records succeed or all fail with complete rollback.

**Implementation**: Use database transactions with proper isolation level (READ_COMMITTED minimum).

#### NFR-002.7: Optimistic Locking Consistency

Timestamp-based optimistic locking shall have zero false positives (never incorrectly report conflict) and zero false negatives (never miss a conflict).

**Implementation**: Atomic compare-and-swap on updatedAt timestamp field within transaction. Use millisecond precision to minimize collision risk.

#### NFR-002.8: WebSocket Reliability

WebSocket connections shall automatically reconnect on network failures with exponential backoff (1s, 2s, 4s, 8s, 16s, max 30s).

Clients shall gracefully degrade to polling if WebSocket infrastructure unavailable.

#### NFR-002.9: Soft Delete Data Integrity

Soft-deleted devices shall be completely isolated from operational queries with zero risk of appearing in active device lists, monitoring, or reports.

**Implementation**: All queries must filter by `deletedAt IS NULL` via default scope or explicit WHERE clause.

### Usability Requirements

#### NFR-002.10: Error Message Clarity

All validation errors, conflict errors, and operational errors shall include:

- Clear, non-technical description of the problem
- Specific field(s) that caused the error
- Actionable guidance on how to resolve
- Unique error code for support/troubleshooting

**Example**: "The IP address 192.168.1.100 is already in use by device 'Router-Main' (ID: abc-123). Please use a different IP address or remove the existing device first. [ERROR_CODE: DEVICE_IP_DUPLICATE]"

#### NFR-002.11: Responsive UI Updates

Device list UI shall reflect status changes within 3 seconds of occurrence for critical events (ONLINE/OFFLINE transitions).

Non-critical updates (metadata changes) may use 30-second polling.

---

## Technical Constraints

### TC-002.1: Cursor Pagination Limitation

Cursor-based pagination requires consistent sorting. Changing sort criteria resets pagination to first page. Clients cannot randomly jump to middle pages (no "go to page 5").

**Tradeoff**: Performance and consistency over traditional pagination features.

### TC-002.2: WebSocket Scalability

WebSocket implementation requires sticky sessions in load-balanced environments or dedicated WebSocket server with pub/sub (Redis).

For initial implementation, single-server WebSocket is acceptable for up to 1,000 concurrent connections.

### TC-002.3: Full-Text Search Limitations

Global search uses database LIKE queries, not full-text search engine. Performance degrades with very large datasets (>50,000 devices).

For enterprise scale (>10,000 devices), migration to Elasticsearch recommended.

### TC-002.4: CSV Import Memory Constraints

Bulk import loads entire CSV into memory for validation. Maximum file size: 10MB (~10,000 devices).

For larger imports, split into multiple batches.

### TC-002.5: Optimistic Locking UI Complexity

Optimistic locking requires client-side timestamp tracking. Frontend must include updatedAt timestamp in update requests and handle 409 Conflict with user-friendly "refresh and retry" workflow.

---

## Dependencies

### Internal Dependencies

- **NetworkDevice Aggregate** (`src/domain/aggregates/NetworkDevice.ts`): Core domain model for device entity
- **PollingConfiguration Entity** (`src/domain/entities/PollingConfiguration.ts`): Nested entity for polling settings, auto-created with device
- **INetworkDeviceRepository** (`src/domain/repository/INetworkDeviceRepository.ts`): Repository interface for persistence
- **PrismaNetworkDeviceRepository** (`src/infrastructure/persistence/PrismaNetworkDeviceRepository.ts`): Prisma implementation of repository
- **Value Objects**: IPAddress, MACAddress, NetworkDeviceId, NetworkDeviceStatus, NetworkDeviceType, PollingInterval, RetryPolicy
- **Domain Events**: NetworkDeviceCreatedEvent, NetworkDeviceUpdatedEvent, NetworkDeviceStatusChangedEvent, NetworkDeviceDeletedEvent, NetworkDeviceActivatedEvent (new), NetworkDeviceRestoredEvent (new), DeviceReplacedEvent (new)
- **DomainEvents Dispatcher** (`src/domain/core/DomainEvents.ts`): Event publishing infrastructure
- **UseCase Base Class** (`src/application/core/UseCase.ts`): Template method pattern for use case execution
- **Result Pattern** (`src/domain/core/Result.ts`): Functional error handling

### External Dependencies

- **Prisma ORM**: Database access layer for PostgreSQL
- **WebSocket Library** (ws or socket.io): Real-time communication infrastructure
- **CSV Parser** (csv-parse): Parsing uploaded CSV files
- **Node.js ICMP** (ping or net-ping): Ping test functionality (optional)

### Infrastructure Dependencies

- **PostgreSQL 14+**: Primary database with support for indexes, transactions, unique constraints
- **Redis** (optional, future): Pub/Sub for multi-server WebSocket scaling
- **Authentication Service**: JWT validation for API and WebSocket authentication

---

## Assumptions

### Business Assumptions

- Network administrators are trustworthy and trained; no approval workflow needed for device creation/deletion
- Device replacement scenarios (same IP, different MAC) occur infrequently enough that manual confirmation prompts are acceptable
- Deleted devices can be permanently purged after 7 days without legal/compliance issues
- 1,000-10,000 device scale is sufficient for foreseeable future (next 2 years)
- Device discovery tools can export to standard CSV format

### Technical Assumptions

- Database can handle 10,000 device records with sub-second query performance using proper indexing
- Network latency between server and devices is low enough for ping tests to complete within 5 seconds
- WebSocket connections are stable enough for real-time updates; polling fallback is acceptable degradation
- Single-server deployment is sufficient; horizontal scaling not required initially
- PostgreSQL unique constraints provide sufficient IP/MAC uniqueness enforcement without application-level double-checking

---

## Risk Analysis

### Risk 1: Optimistic Locking User Frustration

**Severity**: Medium
**Probability**: Medium
**Description**: In collaborative environments with frequent concurrent edits, users may encounter frequent 409 Conflict errors, leading to frustration and perceived system instability.

**Indicators**:

- High frequency of 409 Conflict responses in logs (>5% of update requests)
- User complaints about "losing work" or "having to retry"
- Support tickets related to concurrent editing

**Mitigation**:

- Implement clear, friendly error messaging explaining conflict and resolution
- Add UI indicators showing "UserX is currently editing this device" (requires WebSocket broadcasting of edit locks)
- Consider field-level merge for non-overlapping updates in future enhancement
- Monitor conflict rate; if >5%, re-evaluate locking strategy

### Risk 2: Soft Delete Storage Growth

**Severity**: Low
**Probability**: High
**Description**: Accumulation of soft-deleted devices over time may cause storage bloat and query performance degradation if automated purge job fails or is disabled.

**Indicators**:

- `deletedAt IS NOT NULL` rows growing unbounded
- Increasing query times despite proper indexing
- Database storage growth exceeding expected rate

**Mitigation**:

- Implement robust automated purge job with monitoring and alerting
- Add database partition on `deletedAt` field for faster purging (future optimization)
- Include deleted device count in system health dashboard
- Set up alert if deleted devices >10% of total devices (indicates purge job failure)

### Risk 3: WebSocket Connection Limit

**Severity**: High
**Probability**: Medium
**Description**: Single-server WebSocket implementation may hit connection limits (typically 1,000-5,000) as user base grows, causing new connections to fail and degrading to polling for all users.

**Indicators**:

- WebSocket connection failures in client logs
- Server hitting file descriptor limits
- Memory pressure from maintaining many idle connections

**Mitigation**:

- Set hard limit of 1,000 concurrent WebSocket connections in initial implementation
- Monitor active WebSocket connections; alert if >800
- Implement graceful degradation: reject new connections with clear error, fallback to polling
- Plan migration to Redis pub/sub for horizontal scaling before reaching limit
- Document WebSocket scaling plan for future implementation

### Risk 4: Bulk Import Data Quality

**Severity**: Medium
**Probability**: Medium
**Description**: Bulk CSV imports may introduce low-quality data (generic names like "Device1", missing descriptions, incorrect device types) if users import discovery scan results without cleanup.

**Indicators**:

- High percentage of devices with auto-generated names
- Many devices in DRAFT state for extended periods
- High percentage of devices with status=UNKNOWN

**Mitigation**:

- Provide CSV template with clear column descriptions and examples
- Implement data quality scoring (completeness %, calculated from filled optional fields)
- Add "Incomplete Devices" dashboard showing devices needing enrichment
- Consider requiring minimum data quality score for activation (e.g., 60% complete)
- Provide bulk edit capability for enriching multiple devices simultaneously

### Risk 5: Device Replacement False Positives

**Severity**: Low
**Probability**: Medium
**Description**: Auto-detection of device replacements may produce false positives if IP addresses are reassigned to completely different devices, causing incorrect configuration migration.

**Indicators**:

- User reports of devices with wrong configurations after creation
- Support tickets about "device inherited wrong settings"
- Frequent user selections of "No, this is a different device" in replacement prompts

**Mitigation**:

- Only prompt for replacement if deleted device is within 7-day grace period (fresh deletion)
- Show full details of old device in prompt (MAC, name, type) to help user decide
- Make migration opt-in (explicit confirmation required), not opt-out
- Log all replacement decisions for audit trail
- Allow users to "unlink" replacement relationship if incorrect

---

## Alternative Solutions Considered

### Alternative 1: Auto-Activation on Field Completion

**Description**: Instead of requiring explicit activation action, automatically transition devices from DRAFT to ACTIVE when all required fields are filled.

**Pros**:

- Simpler workflow - one less step for users
- Faster device onboarding
- Less cognitive load (no need to remember to activate)

**Cons**:

- Loss of control - users may want to prepare devices without activating
- Risk of accidental activation during editing
- Harder to implement "review before activate" workflows
- Less clear audit trail of when device became operational

**Decision**: Rejected. Explicit activation provides clearer intent and better control. The extra step is acceptable for the safety and clarity it provides.

### Alternative 2: Hard Delete Only (No Soft Delete)

**Description**: Implement immediate hard delete without grace period or recovery.

**Pros**:

- Simpler implementation (no deletedAt field, no purge job)
- Cleaner database without deleted record accumulation
- Clearer semantics (deleted means gone)

**Cons**:

- No recovery from accidental deletions
- Loss of historical audit trail
- User anxiety about deletion operations
- Common user expectation is "trash can" pattern with recovery

**Decision**: Rejected. User safety and recovery capability outweigh implementation simplicity. 7-day grace period is industry standard and expected.

### Alternative 3: Last-Write-Wins (No Optimistic Locking)

**Description**: Allow concurrent updates without conflict detection. Latest update always succeeds.

**Pros**:

- Simpler implementation (no timestamp comparison, no conflict handling)
- No user-facing 409 errors
- Faster updates (no concurrency check)

**Cons**:

- Silent data loss - users unaware their changes were overwritten
- Violates principle of least surprise
- Difficult to debug "why did my change disappear?"
- Poor UX in collaborative environments

**Decision**: Rejected. Data integrity and user awareness of conflicts outweigh simplicity. Timestamp-based optimistic locking is necessary for multi-user safety.

### Alternative 4: Separate Draft and Device Tables

**Description**: Store drafts in separate `device_drafts` table, move to `devices` table on activation.

**Pros**:

- Cleaner separation of concerns
- Active device queries never touch draft data (performance)
- Different schemas possible for draft vs active

**Cons**:

- Complex activation logic (cross-table transaction)
- Duplicate schema maintenance
- Harder to query "all devices regardless of state"
- More complex repository implementation

**Decision**: Rejected. Single table with `activationStatus` field is simpler and sufficient. Performance can be addressed with partial indexes if needed.

### Alternative 5: Elasticsearch for Search

**Description**: Use Elasticsearch for global search instead of database LIKE queries.

**Pros**:

- Better full-text search capabilities (stemming, relevance scoring)
- Scales to enterprise levels (100k+ devices)
- Advanced query syntax support
- Better performance for complex searches

**Cons**:

- Additional infrastructure dependency
- Sync complexity between PostgreSQL and Elasticsearch
- Higher operational overhead (monitoring, backup, updates)
- Overkill for 1,000-10,000 device scale

**Decision**: Deferred. Database LIKE queries sufficient for medium scale (1,000-10,000). Migrate to Elasticsearch if scale exceeds 10,000 devices or search performance becomes issue.

---

## Security Considerations

### SEC-002.1: Role-Based Access Control

**Requirement**: Enforce role-based permissions for all CRUD operations.

**Implementation**:

- Implement authorization middleware checking user role before use case execution
- Roles: Admin, Operator, Viewer
- Permissions matrix (see User Roles & Permissions section)
- Unauthorized access returns 403 Forbidden with clear error message
- All authorization failures logged for security audit

### SEC-002.2: Rate Limiting

**Requirement**: Prevent abuse and runaway scripts via tiered rate limiting.

**Implementation**:

- Use token bucket algorithm per user/IP address
- Limits:
  - Read operations (GET): 100 requests/minute
  - Create/Update operations (POST/PUT): 20 requests/minute
  - Delete operations (DELETE): 10 requests/minute
  - Bulk import: 5 requests/hour
- Exceeded limits return 429 Too Many Requests with Retry-After header
- Rate limit state stored in Redis (or in-memory for single-server)
- Admin role exempt from rate limits (configurable)

### SEC-002.3: Input Validation and Sanitization

**Requirement**: Prevent injection attacks and malformed data.

**Implementation**:

- All inputs validated against Zod schemas before use case execution
- IP address regex validation (both IPv4 and IPv6)
- MAC address format validation
- SQL injection prevention via Prisma parameterized queries
- XSS prevention via output encoding in presentation layer
- File upload validation: max size 10MB, allowed MIME types (text/csv, application/json)
- CSV injection prevention: strip leading `=`, `+`, `-`, `@` from CSV cells

### SEC-002.4: Authentication Requirements

**Requirement**: All CRUD endpoints require authentication; no anonymous access.

**Implementation**:

- JWT-based authentication required for all HTTP endpoints
- WebSocket connections require JWT in connection URL parameter or header
- Token expiration: 24 hours (configurable)
- Invalid/expired tokens return 401 Unauthorized
- Token validation performed by authentication middleware before routing

### SEC-002.5: Audit Logging

**Requirement**: Log all CRUD operations for compliance and security analysis.

**Implementation**: See Audit & Logging Requirements section for detailed specification.

---

## User Roles & Permissions

| Role         | Create Device | Read Device | Update Device | Delete Device | Activate Device | Restore Deleted | Bulk Import | Bulk Delete |
| ------------ | ------------- | ----------- | ------------- | ------------- | --------------- | --------------- | ----------- | ----------- |
| **Admin**    | ✓             | ✓           | ✓             | ✓             | ✓               | ✓               | ✓           | ✓           |
| **Operator** | ✓             | ✓           | ✓             | ✗             | ✓               | ✗               | ✓           | ✗           |
| **Viewer**   | ✗             | ✓           | ✗             | ✗             | ✗               | ✗               | ✗           | ✗           |

**Notes**:

- Admins have full access to all operations
- Operators can create and update devices but cannot delete (prevents accidental data loss)
- Viewers have read-only access for monitoring and reporting
- Restore and Bulk Delete are high-risk operations restricted to Admins only

---

## Audit & Logging Requirements

### CRUD Operation Logs

**Retention**: 90 days in primary database, 1 year in archive storage

**Required Fields**:

- `timestamp` (ISO 8601 with timezone)
- `userId` (who performed the action)
- `userRole` (role at time of action)
- `action` (CREATE, UPDATE, DELETE, ACTIVATE, RESTORE)
- `deviceId` (affected device)
- `ipAddress` (client IP)
- `result` (SUCCESS, FAILURE)
- `errorCode` (if failure)
- `requestId` (correlation ID for tracing)

**Example**:

```json
{
  "timestamp": "2026-01-06T14:32:15.234Z",
  "userId": "user-abc-123",
  "userRole": "ADMIN",
  "action": "DELETE",
  "deviceId": "device-xyz-789",
  "deviceName": "Router-Main",
  "ipAddress": "10.20.30.40",
  "clientIp": "192.168.1.50",
  "result": "SUCCESS",
  "requestId": "req-456-def",
  "metadata": {
    "deleteReason": "Device decommissioned",
    "softDelete": true
  }
}
```

### Failed Operation Logs

**Retention**: 30 days

**Required Fields**: All CRUD fields plus:

- `validationErrors` (array of validation failures)
- `conflictDetails` (for optimistic locking conflicts)

**Example**:

```json
{
  "timestamp": "2026-01-06T14:35:22.111Z",
  "userId": "user-abc-123",
  "userRole": "OPERATOR",
  "action": "CREATE",
  "result": "FAILURE",
  "errorCode": "DEVICE_IP_DUPLICATE",
  "validationErrors": [
    {
      "field": "ipAddress",
      "value": "192.168.1.100",
      "error": "IP address already in use by device 'Router-Main'"
    }
  ],
  "requestId": "req-789-ghi"
}
```

### Performance Metrics Logs

**Retention**: 7 days (aggregated to 90 days)

**Required Fields**:

- `timestamp`
- `operation` (LIST, GET, CREATE, UPDATE, DELETE)
- `duration` (milliseconds)
- `resultSize` (number of records returned)
- `queryComplexity` (simple, filtered, searched)

**Aggregated Metrics**:

- P50, P95, P99 response times per operation
- Request volume per operation per hour
- Error rate per operation

---

## Testing Requirements

### Unit Testing

- All use cases must have unit tests with ≥ 90% code coverage
- All domain entities and value objects must have unit tests with ≥ 95% coverage
- Mock repository interfaces to isolate use case logic
- Test all validation rules, business logic, and error paths
- **Coverage Target**: >90% overall

**Key Test Scenarios**:

- Create device in DRAFT state with minimum fields
- Create device in DRAFT state with all fields
- Activate draft device successfully
- Fail activation with missing required fields
- Update device with valid version (optimistic locking success)
- Update device with stale version (optimistic locking conflict)
- Soft delete device and verify exclusion from queries
- Restore deleted device within grace period
- Attempt restore after grace period expiration (should fail)
- Device replacement detection and migration
- All value object validations (IPAddress, MACAddress formats)

### Integration Testing

- Test complete CRUD workflows from HTTP endpoint to database
- Verify database transactions commit/rollback correctly
- Test bulk operations with various success/failure scenarios
- Verify WebSocket message delivery on status changes
- Test concurrent updates from multiple users (optimistic locking)
- Verify soft delete exclusion from queries
- Test CSV import with valid and invalid data
- Verify rate limiting enforcement

**Key Test Scenarios**:

- Complete workflow: Create DRAFT → Enrich → Activate → Update → Delete → Restore
- Bulk import CSV with 100 valid devices
- Bulk import CSV with 1 invalid device (should rollback all)
- Concurrent updates by 2 users on same device (one should fail)
- WebSocket connection, status change, message received
- Device replacement workflow with migration
- Soft delete + 7-day purge job execution

### Performance Testing

- Load test device list endpoint with 10,000 devices in database
  - **Target**: p95 < 200ms
- Load test global search with 10,000 devices
  - **Target**: p95 < 500ms
- Stress test bulk import with 1,000 devices
  - **Target**: complete < 30s
- Concurrent update test with 50 simultaneous updates
  - **Target**: all complete < 5s, success rate > 95%
- WebSocket load test with 500 concurrent connections
  - **Target**: message delivery < 2s for all clients

### End-to-End Testing

- Complete user journey: Discovery → Import → Enrich → Activate → Monitor → Update → Decommission
- Multi-user collaborative editing scenario
- Network failure/WebSocket reconnection handling
- Device replacement workflow from start to finish

---

## Integration Requirements

### INT-002.1: Polling Service Integration

When a device is created, updated, activated, or deleted, the Polling Service must be notified to start/stop/reconfigure polling jobs.

**Integration Points**:

- Subscribe to `NetworkDeviceCreatedEvent` → Create polling job (disabled initially)
- Subscribe to `NetworkDeviceActivatedEvent` → Enable polling if device type requires monitoring
- Subscribe to `PollingConfigurationChangedEvent` → Update polling job schedule
- Subscribe to `NetworkDeviceDeletedEvent` → Stop and remove polling job

**Implementation**: Event-driven via Domain Events dispatcher. Polling service registers event handlers.

### INT-002.2: Notification Service Integration

Send notifications to administrators for important device lifecycle events.

**Integration Points**:

- Subscribe to `NetworkDeviceCreatedEvent` → Notify admins of new device
- Subscribe to `NetworkDeviceStatusChangedEvent` (ONLINE → OFFLINE) → Send alert
- Subscribe to `NetworkDeviceDeletedEvent` → Notify admins of decommission

**Implementation**: Event-driven. Notification service filters events based on criticality rules.

### INT-002.3: Audit Service Integration

Record all CRUD operations in centralized audit log for compliance.

**Integration Points**:

- Audit logging middleware intercepts all HTTP requests/responses
- Enriches logs with user context, timestamps, results
- Writes to audit log database (separate from operational database)

**Implementation**: HTTP middleware + separate audit log repository.

### INT-002.4: Network Topology Service Integration (Future)

When devices are created or deleted, update network topology graph.

**Integration Points**:

- Subscribe to `NetworkDeviceCreatedEvent` → Add node to topology
- Subscribe to `NetworkDeviceDeletedEvent` → Remove node and edges from topology

**Implementation**: Event-driven. Topology service maintains separate graph database synced via events.

---

## Failover & Redundancy

### FAIL-002.1: Database Failover

**Description**: In event of primary PostgreSQL database failure, system shall automatically failover to read replica.

**Implementation**:

- PostgreSQL streaming replication with automatic failover (via Patroni or similar)
- Connection pool configured with multiple endpoints (primary + replicas)
- Read-heavy operations (LIST, GET) can use read replicas
- Write operations (CREATE, UPDATE, DELETE) must use primary
- Health checks detect primary failure within 10 seconds
- Failover to promoted replica completes within 30 seconds
- During failover, write operations return 503 Service Unavailable

### FAIL-002.2: WebSocket Server Failover

**Description**: If WebSocket server fails, clients shall gracefully degrade to polling.

**Implementation**:

- Client detects connection failure via WebSocket close event
- Attempts reconnection with exponential backoff (max 3 attempts)
- After 3 failed reconnections, switches to HTTP polling (30s interval)
- Polling continues until WebSocket server recovers
- Background reconnection attempts every 5 minutes to restore WebSocket

### FAIL-002.3: Bulk Import Failure Recovery

**Description**: If bulk import fails mid-transaction, ensure complete rollback with zero partial imports.

**Implementation**:

- All bulk imports wrapped in database transaction
- Transaction isolation level: READ_COMMITTED
- If any device fails validation or insertion, entire transaction rolled back
- Return detailed error report to user with failed row numbers
- No cleanup required - transaction rollback handles all state

---

## Maintenance & Support Requirements

### Error Reporting

All errors shall include:

- **Error Code**: Unique identifier (e.g., `DEVICE_IP_DUPLICATE`, `VERSION_CONFLICT`)
- **User Message**: Clear, non-technical description of problem and resolution
- **Technical Details**: Stack trace, request ID, timestamp (logged, not returned to user)
- **HTTP Status Code**: Appropriate RESTful status (400, 404, 409, 500, etc.)

**Example Error Response**:

```json
{
  "success": false,
  "errorCode": "DEVICE_IP_DUPLICATE",
  "message": "The IP address 192.168.1.100 is already in use by device 'Router-Main' (ID: abc-123). Please use a different IP address or remove the existing device first.",
  "field": "ipAddress",
  "value": "192.168.1.100",
  "requestId": "req-123-abc",
  "timestamp": "2026-01-06T14:32:15.234Z"
}
```

### Diagnostic Tools

- **Health Check Endpoint**: `GET /api/health/devices` returns status of device repository, database connection, WebSocket server
- **Metrics Endpoint**: `GET /api/metrics/devices` returns statistics (total devices, by status, by type, draft count, deleted count)
- **Admin Dashboard**: UI showing system health, recent errors, performance metrics, deleted device count
- **Database Queries**: Provide sample SQL queries for common troubleshooting (find duplicate IPs, find orphaned polling configs, find stale deleted devices)

### Documentation

- **API Documentation**: OpenAPI/Swagger specification for all endpoints with examples
- **Developer Guide**: Architecture overview, layer responsibilities, extending CRUD operations
- **Operations Manual**: Deployment, monitoring, backup/restore procedures, troubleshooting runbook
- **User Guide**: Step-by-step workflows for common tasks (create device, bulk import, delete and restore, device replacement)

---

## Definition of Done

This requirement is considered complete when:

- [ ] All acceptance criteria met and verified in staging environment
- [ ] All functional requirements implemented and tested
- [ ] All non-functional requirements met (performance, reliability, usability targets)
- [ ] Unit tests written with >90% coverage for use cases and >95% for domain logic
- [ ] Integration tests pass covering all CRUD workflows
- [ ] Performance tests meet targets (p95 response times, throughput)
- [ ] Security requirements implemented (RBAC, rate limiting, input validation)
- [ ] Audit logging fully functional and tested
- [ ] WebSocket real-time updates working with reconnection handling
- [ ] Code reviewed and approved by at least 2 team members
- [ ] API documentation (OpenAPI spec) completed and published
- [ ] User documentation completed (workflows, UI guides)
- [ ] Operations documentation completed (deployment, monitoring, troubleshooting)
- [ ] Deployed to staging environment and passed UAT
- [ ] Load testing completed with 10,000 device dataset
- [ ] Security review passed (no critical or high-severity vulnerabilities)
- [ ] Database migration scripts created and tested
- [ ] Rollback plan documented and tested
- [ ] Production deployment approved by product owner
- [ ] Monitoring and alerting configured for production

---

## Related Documents

- [ARCHITECTURE.md](/docs/ARCHITECTURE.md) - Overall system architecture
- [DOMAIN-MODEL.md](/docs/DOMAIN-MODEL.md) - Domain-Driven Design model
- [DOMAIN-AGGREGATES-STANDARD.md](/docs/rules/DOMAIN-AGGREGATES-STANDARD.md) - Aggregate design standards
- [API-GUIDELINES.md](/docs/API-GUIDELINES.md) - API design principles
- [SECURITY-POLICY.md](/docs/SECURITY-POLICY.md) - Security requirements and practices

---

## Notes

### Open Questions

1. **Should we support IPv6 for device IP addresses in the initial release?**

   - **Proposal**: Yes, IPAddress value object already supports IPv6 validation. Include in initial release to avoid migration later.
   - **Decision**: Pending product owner confirmation.

2. **What should be the default behavior when a device is deleted but has historical polling data?**

   - **Proposal**: Keep historical polling data (PollingResult records) even after device permanent purge. Link to deletedDeviceId instead of deviceId. Allows historical analysis.
   - **Decision**: Pending product owner confirmation.

3. **Should device replacement migration include historical polling data linkage?**
   - **Proposal**: Defer to future enhancement. Initial implementation migrates config/metadata only. Historical data linkage is complex (time-series data, graph continuity) and can be added later if needed.
   - **Decision**: Deferred to REQ-002.2 (future enhancement).

### Future Enhancements

- **Field-Level Change Tracking**: Extend audit logging to track individual field changes (old value → new value) for detailed audit trail
- **Advanced Search Syntax**: Support query syntax like `name:router AND status:offline` for power users
- **Bulk Edit**: Allow updating multiple devices simultaneously (e.g., set all selected devices to MAINTENANCE status, update location for batch)
- **Device Templates**: Define device templates with pre-filled common configurations, apply template on creation
- **Change Approval Workflow**: Require approval from senior admin before critical changes (delete, bulk operations) take effect
- **Historical Polling Data Linkage**: For device replacements, create time-series linkage so graphs show old + new device as continuous timeline
- **Elasticsearch Migration**: For deployments exceeding 10,000 devices, migrate to Elasticsearch for advanced search and analytics
- **Device Grouping/Tags**: Allow grouping devices into logical collections (locations, networks, functions) for easier filtering and bulk operations
- **Export Device List**: Export filtered device lists to CSV/Excel for reporting and external processing
- **Device Comparison**: Side-by-side comparison of two devices (configs, status, history) for troubleshooting

---

## Appendix A: System Flow Diagram

### Layer Flow for CREATE Device Operation

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER                             │
│  src/presentation/http/routes/network-device.routes.ts                  │
│  src/presentation/http/controllers/NetworkDeviceController.ts           │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 │ 1. HTTP POST /api/network-devices
                                 │    Body: CreateNetworkDeviceDTO
                                 │    { ipAddress, macAddress, name?, ... }
                                 │
                                 ▼
                         ┌───────────────┐
                         │  Middleware   │
                         │  Chain        │
                         └───────┬───────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                    │
            ▼                    ▼                    ▼
    ┌──────────────┐   ┌──────────────┐    ┌──────────────┐
    │ Auth Check   │   │ Validate     │    │ Rate Limit   │
    │ (JWT)        │   │ Request      │    │ Check        │
    │ → 401 if no  │   │ (Zod schema) │    │ → 429 if     │
    │   token      │   │ → 400 if     │    │   exceeded   │
    │              │   │   invalid    │    │              │
    └──────┬───────┘   └──────┬───────┘    └──────┬───────┘
           │                  │                    │
           └──────────────────┼────────────────────┘
                              │
                              │ 2. Valid request, proceed
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                               │
│  src/application/use-cases/CreateNetworkDeviceUseCase.ts                │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 │ 3. UseCase.execute(dto)
                                 │
                    ┌────────────▼────────────┐
                    │  beforeExecute()        │
                    │  ─────────────────      │
                    │  • Validate IP format   │
                    │  • Check IP uniqueness  │
                    │  • Check MAC uniqueness │
                    │  • Check permissions    │
                    └────────────┬────────────┘
                                 │
                                 │ If validation fails → Result.fail()
                                 │ If passes ↓
                                 │
                    ┌────────────▼──────────────────────────────┐
                    │  executeImpl()                            │
                    │  ────────────────                         │
                    │  Step 1: Extract data from DTO            │
                    │    NetworkDeviceMapper.extractCreateData()│
                    │                                           │
                    │  Step 2: Validate business rules          │
                    │    (required fields, constraints)         │
                    │                                           │
                    │  Step 3: Create Value Objects             │
                    │    IPAddress.create(ipString)             │
                    │    MACAddress.create(macString)           │
                    │    NetworkDeviceType.from(typeString)     │
                    │                                           │
                    │  Step 4: Create Domain Aggregate          │
                    │    NetworkDevice.create({...})            │
                    │    (includes PollingConfiguration)        │
                    │                                           │
                    │  Step 5: Optional ping test               │
                    │    If performPingTest=true, ping IP       │
                    │    Set status based on result             │
                    │                                           │
                    │  Step 6: Save to repository               │
                    │    repository.save(device)                │
                    │                                           │
                    │  Step 7: Map to Response DTO              │
                    │    NetworkDeviceMapper.toDTO(device)      │
                    │                                           │
                    │  Step 8: Return Result<ResponseDTO>       │
                    └────────────┬──────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            DOMAIN LAYER                                 │
│  src/domain/aggregates/NetworkDevice.ts                                 │
│  src/domain/value-objects/IPAddress.ts, MACAddress.ts, etc.             │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 │ 4. Domain validation & creation
                                 │
                    ┌────────────▼────────────┐
                    │ Value Object Creation   │
                    │ ───────────────────     │
                    │ IPAddress.create()      │
                    │  → Validate IPv4/IPv6   │
                    │  → Result<IPAddress>    │
                    │                         │
                    │ MACAddress.create()     │
                    │  → Validate format      │
                    │  → Result<MACAddress>   │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────────────┐
                    │ NetworkDevice.create()           │
                    │ ────────────────────             │
                    │ • Guard.combine() validation     │
                    │   - Name, type, IP, MAC required │
                    │   - Port range, field lengths    │
                    │ • Create PollingConfiguration    │
                    │   - Default interval by type     │
                    │   - Disabled initially           │
                    │ • Set initial status (UNKNOWN)   │
                    │ • Emit NetworkDeviceCreatedEvent │
                    │ • Return Result<NetworkDevice>   │
                    └────────────┬─────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       INFRASTRUCTURE LAYER                              │
│  src/infrastructure/persistence/PrismaNetworkDeviceRepository.ts        │
│  src/infrastructure/mappers/NetworkDeviceMapper.ts                      │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 │ 5. Persist to database
                                 │
                    ┌────────────▼──────────────────────┐
                    │ PrismaNetworkDeviceRepository     │
                    │ ────────────────────────────      │
                    │ save(networkDevice)               │
                    └────────────┬──────────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────────────┐
                    │ Infrastructure Mapper            │
                    │ ────────────────────             │
                    │ NetworkDeviceMapper.toPersistence│
                    │  • Extract primitive values      │
                    │  • Map domain enums → Prisma     │
                    │  • Map deviceType → deviceGroup  │
                    └────────────┬─────────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────────────┐
                    │ Prisma Transaction               │
                    │ ────────────────                 │
                    │ prisma.$transaction(() => {      │
                    │   1. Insert NetworkDevice        │
                    │   2. Insert PollingConfiguration │
                    │ })                               │
                    │                                  │
                    │ If success:                      │
                    │   • Dispatch domain events       │
                    │   • Convert back to domain       │
                    │   • Return Result<NetworkDevice> │
                    │                                  │
                    │ If failure:                      │
                    │   • Rollback                     │
                    │   • Return Result.fail(error)    │
                    └────────────┬─────────────────────┘
                                 │
                                 │ Database (PostgreSQL)
                                 ▼
                    ┌──────────────────────────────────┐
                    │ Tables Created:                  │
                    │ ──────────────                   │
                    │ • network_devices                │
                    │   - id, ip, mac, name, type,     │
                    │     status, version, ...         │
                    │                                  │
                    │ • polling_configurations         │
                    │   - id, network_device_id,       │
                    │     enabled, interval, ...       │
                    └────────────┬─────────────────────┘
                                 │
                                 │ 6. Events dispatched
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          EVENT HANDLERS                                 │
│  (Asynchronous, after transaction commit)                               │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                  ┌──────────────┼──────────────┐
                  │              │              │
                  ▼              ▼              ▼
         ┌────────────┐  ┌────────────┐  ┌─────────────┐
         │ Polling    │  │ Audit      │  │ Notification│
         │ Service    │  │ Logger     │  │ Service     │
         ├────────────┤  ├────────────┤  ├─────────────┤
         │ Create     │  │ Log device │  │ Notify      │
         │ polling    │  │ creation   │  │ admins of   │
         │ job        │  │ with full  │  │ new device  │
         │ (disabled) │  │ context    │  │             │
         └────────────┘  └────────────┘  └─────────────┘

                                 │
                                 │ 7. Response back to client
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER (Response)                      │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ HTTP Response           │
                    │ ───────────             │
                    │ Status: 201 Created     │
                    │ Body: {                 │
                    │   success: true,        │
                    │   data: {               │
                    │     id: "uuid",         │
                    │     name: "Router-1",   │
                    │     ipAddress: "...",   │
                    │     status: "UNKNOWN",  │
                    │     activationStatus:   │
                    │       "DRAFT",          │
                    │     pollingConfig: {...}│
                    │   }                     │
                    │ }                       │
                    └─────────────────────────┘
```

### Key Component Interactions

```
┌─────────────────┐
│  HTTP Request   │
└────────┬────────┘
         │
         │ (1) Route → Controller
         ▼
┌─────────────────────────┐
│  NetworkDevice          │
│  Controller             │
├─────────────────────────┤
│ • Extract DTO from body │
│ • Call use case         │
│ • Map result to HTTP    │
└────────┬────────────────┘
         │
         │ (2) Execute use case
         ▼
┌──────────────────────────────────┐
│  CreateNetworkDeviceUseCase      │
├──────────────────────────────────┤
│ • Validate (beforeExecute)       │
│ • Orchestrate domain creation    │
│ • Call repository                │
│ • Map to DTO (NetworkDeviceMapper)│
└────────┬─────────────────────────┘
         │
         │ (3) Create domain aggregate
         ▼
┌──────────────────────────────────┐
│  NetworkDevice (Aggregate)       │
├──────────────────────────────────┤
│ • Validate business rules        │
│ • Create value objects           │
│ • Create PollingConfiguration    │
│ • Emit domain event              │
└────────┬─────────────────────────┘
         │
         │ (4) Persist
         ▼
┌──────────────────────────────────┐
│  PrismaNetworkDeviceRepository   │
├──────────────────────────────────┤
│ • Map to Prisma schema           │
│ • Save in transaction            │
│ • Dispatch events                │
└────────┬─────────────────────────┘
         │
         │ (5) Database commit
         ▼
┌──────────────────────────────────┐
│  PostgreSQL Database             │
├──────────────────────────────────┤
│ • Unique constraints enforced    │
│ • Transaction isolation          │
│ • Indexes applied                │
└──────────────────────────────────┘
```

### Data Transformation Flow

```
HTTP Request Body (JSON)
    ↓
CreateNetworkDeviceDTO (Zod validated)
    ↓
Raw Extracted Data (NetworkDeviceMapper.extractCreateData)
    ↓
Value Objects (IPAddress, MACAddress, NetworkDeviceType)
    ↓
NetworkDevice Aggregate (Domain Model)
    ↓
Prisma Model (Infrastructure Mapper)
    ↓
Database Row (PostgreSQL)
    ↓
Prisma Model (Query result)
    ↓
NetworkDevice Aggregate (Infrastructure Mapper)
    ↓
NetworkDeviceResponseDTO (Application Mapper)
    ↓
HTTP Response Body (JSON)
```
