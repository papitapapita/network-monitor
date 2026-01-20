# Use Case Design Specification (DDD-Compliant)

**Version:** 1.0
**Last Updated:** 2025-12-12
**Status:** Authoritative Standard

---

## Table of Contents

1. [Purpose of Use Cases in DDD](#1-purpose-of-use-cases-in-ddd)
2. [Responsibilities of a Use Case](#2-responsibilities-of-a-use-case)
3. [Boundaries of a Use Case](#3-boundaries-of-a-use-case)
4. [Connections with Other Layers](#4-connections-with-other-layers)
5. [Use Case Lifetime / Execution Flow](#5-use-case-lifetime--execution-flow)
6. [Use Case Structure Template](#6-use-case-structure-template)
7. [Orthogonality Principles](#7-orthogonality-principles)
8. [Naming Conventions](#8-naming-conventions)
9. [Error Handling Patterns](#9-error-handling-patterns)
10. [Transaction Management](#10-transaction-management)
11. [Testing Strategy](#11-testing-strategy)
12. [Examples](#12-examples)

---

## 1. Purpose of Use Cases in DDD

### Definition

Use Cases (also called Application Services) are the **orchestration layer** of the application. They coordinate domain objects to fulfill a single business intention or user story.

### Core Principles

- **Single Responsibility**: One use case = one business action
- **Single Aggregate Modification**: One use case modifies **one aggregate root only**
- **Orchestration Only**: Coordinate domain objects, don't implement business logic
- **Transaction Boundary**: Define where transactions begin and end (implementation in infrastructure)
- **Event-Driven Communication**: Use domain events for cross-aggregate operations
- **Application Logic**: Handle workflows that don't belong in domain
- **Presentation Independence**: No knowledge of HTTP, UI, or delivery mechanisms

### Why Use Cases Exist

1. **Separate application workflow from domain behavior**
2. **Provide clear entry points** for business operations
3. **Enforce application-level security and authorization**
4. **Define transaction boundaries** explicitly
5. **Isolate domain from infrastructure concerns**

---

## 2. Responsibilities of a Use Case

### ✅ What Use Cases DO

#### Application Orchestration

- **Direct application flow** for a single business intention
- **Coordinate domain objects** (entities, aggregates, domain services)
- **Control execution order** of domain operations

#### Value Object and Entity Creation

- **Create Value Objects** using static factory methods (e.g., `IPAddress.create()`)
- **Validate structural creation parameters** before calling domain factories
- **Map enum strings to domain enums** (business decisions)
- **Create domain aggregates** via aggregate factories (e.g., `NetworkDevice.create()`)

#### Repository Operations

- **Load aggregates** from repositories
- **Persist aggregates** to repositories
- **Coordinate multiple repository operations** within transaction boundaries
- **Handle repository errors** and convert to application results

#### DTO Transformation

- **Extract raw data from input DTOs** using mappers
- **Validate only structural and application-level rules** on extracted data
- **Convert domain results to output DTOs** using mappers
- **Structure responses** for presentation layer

#### Business Rules Enforcement (Application-Level)

- **Enforce uniqueness constraints through repository call** (e.g., check if email already exists)
- **Calls domain services to evaluate cross-aggregate business rules**
- **Validate application preconditions** before domain operations

#### Authorization and Security

- **Check user permissions** calling an authorization service / policy before executing operations
- **Validate request authorization** (can user perform this action?)
- **Log security-relevant operations** calling a logging service
- **Filter results** based on user access rights

#### Transaction Management

- **Define transaction boundaries** (begin/commit/rollback)
- **Ensure atomicity** of operations
- **Handle transaction failures** gracefully

---

## 3. Boundaries of a Use Case

### ❌ What Use Cases MUST NOT DO

#### Infrastructure Concerns

- ❌ **No HTTP logic** (no controllers, no status codes, no headers)
- ❌ **No database details** (no SQL, no ORM queries, no connection pooling)
- ❌ **No file system operations** (use application services/gateways)
- ❌ **No network calls** (use domain services or gateways)
- ❌ **No framework-specific code** (no Express, no NestJS decorators)

#### Domain Logic

- ❌ **No business calculations** that belong in entities (e.g., calculating jitter)
- ❌ **No domain invariant enforcement** (delegate to Value Objects and Entities)
- ❌ **No aggregate state management** (aggregates manage their own state)
- ❌ **No domain event creation** (aggregates raise their own events)

#### Presentation Logic

- ❌ **No HTML generation**
- ❌ **No JSON formatting** (mappers handle DTO structure)
- ❌ **No view-specific transformations**
- ❌ **No UI state management**

#### Data Transformation

- ❌ **No structural DTO transformations** (mappers handle this)
- ❌ **No field renaming for presentation** (mappers handle this)
- ❌ **No data formatting** (dates, numbers, etc. - mappers handle this)

#### Cross-Cutting Concerns

- ❌ **No logging infrastructure setup** (use injected logger)
- ❌ **No metrics collection infrastructure** (use injected metrics service)
- ❌ **No configuration management** (inject configuration)

---

## 4. Single Aggregate Rule & Event-Driven Design

### ⚠️ CRITICAL RULE: One Aggregate Per Use Case

**A use case must modify ONLY ONE aggregate root per transaction.**

This is a foundational DDD principle that maintains:

- **Aggregate boundaries** and consistency
- **Transaction scope** clarity
- **Testability** and maintainability
- **Clear ownership** of data changes

```typescript
// ✅ GOOD - Single aggregate modification
class UpdateNetworkDeviceNameUseCase {
  async execute(request: UpdateNameRequest) {
    // Load ONE aggregate
    const device = await this.repository.findById(request.deviceId);

    // Modify ONE aggregate
    device.updateName(request.newName);

    // Save ONE aggregate
    await this.repository.save(device);

    // Domain event emitted automatically by aggregate
    // Other aggregates will react via event handlers
  }
}

// ❌ BAD - Multiple aggregate modifications
class TransferDeviceOwnershipUseCase {
  async execute(request: TransferRequest) {
    const device = await this.deviceRepository.findById(
      request.deviceId
    );
    const oldOwner = await this.userRepository.findById(
      device.ownerId
    );
    const newOwner = await this.userRepository.findById(
      request.newOwnerId
    );

    // WRONG: Modifying multiple aggregates in one use case
    device.transferOwnership(newOwner.id);
    oldOwner.removeDevice(device.id);
    newOwner.addDevice(device.id);

    await this.deviceRepository.save(device);
    await this.userRepository.save(oldOwner); // ❌ NO!
    await this.userRepository.save(newOwner); // ❌ NO!
  }
}
```

### ✅ Correct Pattern: Event-Driven Cross-Aggregate Operations

When one aggregate change must trigger changes in another aggregate, use **domain events**:

#### Step 1: First aggregate emits event

```typescript
// NetworkDevice aggregate
class NetworkDevice extends AggregateRoot {
  transferOwnership(newOwnerId: UserId): Result<void> {
    // Update state
    this.props.ownerId = newOwnerId;

    // Emit domain event
    this.addDomainEvent(
      new DeviceOwnershipTransferredEvent({
        aggregateId: this.id,
        deviceId: this.id,
        oldOwnerId: this.props.previousOwnerId,
        newOwnerId: newOwnerId,
        dateTimeOccurred: new Date()
      })
    );

    return Result.ok();
  }
}
```

#### Step 2: Use case modifies only one aggregate

```typescript
// Use case modifies ONLY NetworkDevice
class TransferDeviceOwnershipUseCase {
  async execute(request: TransferRequest) {
    // Load device
    const device = await this.deviceRepository.findById(
      request.deviceId
    );

    // Modify device (emits event internally)
    const result = device.transferOwnership(request.newOwnerId);
    if (result.isFailure) {
      return Result.fail(result.error);
    }

    // Save device (repository dispatches events automatically)
    await this.repository.save(device);

    // Event handler will update User aggregates
    return Result.ok();
  }
}
```

#### Step 3: Event handler modifies second aggregate

```typescript
// Event handler reacts to event
@DomainEventHandler(DeviceOwnershipTransferredEvent)
class UpdateUserDeviceListHandler {
  constructor(private readonly userRepository: IUserRepository) {}

  async handle(
    event: DeviceOwnershipTransferredEvent
  ): Promise<void> {
    // Load old owner
    const oldOwner = await this.userRepository.findById(
      event.oldOwnerId
    );
    if (oldOwner) {
      oldOwner.removeDevice(event.deviceId);
      await this.userRepository.save(oldOwner);
    }

    // Load new owner
    const newOwner = await this.userRepository.findById(
      event.newOwnerId
    );
    if (newOwner) {
      newOwner.addDevice(event.deviceId);
      await this.userRepository.save(newOwner);
    }
  }
}
```

### Benefits of Event-Driven Approach

1. **Respects Aggregate Boundaries**

   - Each aggregate is modified in its own transaction
   - Aggregates remain independent and consistent

2. **Eventual Consistency**

   - Changes propagate asynchronously
   - System remains responsive and scalable

3. **Loose Coupling**

   - First aggregate doesn't know about second aggregate
   - Easy to add new reactions to events

4. **Clear Responsibility**
   - Use case: Modify one aggregate
   - Event handler: React to domain events
   - No confusion about transaction scope

### When to Use Event-Driven Pattern

| Scenario                          | Pattern                      |
| --------------------------------- | ---------------------------- |
| Update single aggregate           | Direct use case modification |
| Changes must affect 2+ aggregates | Emit event → Event handler   |
| Changes can be eventual           | Emit event → Event handler   |
| Cross-bounded-context changes     | Emit event → Event handler   |
| Audit log / notification needed   | Emit event → Event handler   |

### Exception: Read-Only Multi-Aggregate Queries

**Query use cases** (read-only) MAY load multiple aggregates:

```typescript
// ✅ ALLOWED - Read-only query
class GetDeviceWithOwnerInfoUseCase {
  async execute(request: GetDeviceRequest) {
    // Read multiple aggregates
    const device = await this.deviceRepository.findById(
      request.deviceId
    );
    const owner = await this.userRepository.findById(device.ownerId);

    // Combine into response DTO
    return {
      device: DeviceMapper.toDTO(device),
      owner: UserMapper.toDTO(owner)
    };
  }
}
```

**Rule**: If you're **modifying**, stick to one aggregate. If you're only **reading**, you can load multiple.

---

## 5. Connections with Other Layers

### Layer Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│              (Controllers, GraphQL Resolvers)               │
└────────────────────────┬────────────────────────────────────┘
                         │ Input DTOs
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Use Cases  │ ←→ │   Mappers    │ ←→ │     DTOs     │   │
│  └──────┬───────┘    └──────────────┘    └──────────────┘   │
│         │                                                   │
│         │ Orchestrates                                      │
│         ↓                                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           Domain Layer Interface                    │    │
│  │  (Aggregates, Entities, VOs, Domain Services,       │    │
│  │   Repository Interfaces)                            │    │
│  └─────────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────┘
                         │ Repository Interfaces
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   Infrastructure Layer                      │
│        (Repository Implementations, Database, APIs)         │
└─────────────────────────────────────────────────────────────┘
```

### Interaction Patterns

#### With Application Layer

**Input DTOs** (Commands/Queries)

```typescript
// Use case receives command DTO
interface CreateDeviceCommand {
  name: string;
  ipAddress: string;
  deviceType: string;
  // ...
}
```

**Mappers**

```typescript
// Use case delegates DTO extraction to mapper
const data = NetworkDeviceMapper.extractCreateData(command);
```

**Output DTOs** (Responses)

```typescript
// Use case converts domain to DTO via mapper
const responseDTO = NetworkDeviceMapper.toDTO(device);
return Result.ok(responseDTO);
```

#### With Domain Layer

**Value Object Creation**

```typescript
// Use case creates VOs with domain validation
const ipAddress = IPAddress.create(data.ipAddress);
if (ipAddress.isFailure) {
  return Result.fail(ipAddress.error);
}
```

**Aggregate Operations**

```typescript
// Use case calls aggregate methods
const updateResult = device.updateName(newName);
if (updateResult.isFailure) {
  return Result.fail(updateResult.error);
}
```

**Repository Operations**

```typescript
// Use case loads/persists via repository interface
const device = await this.repository.findById(deviceId);
await this.repository.save(device);
```

**Domain Services**

```typescript
// Use case delegates complex operations to domain services
const result = await this.pingService.performPing(ipAddress);
```

#### With Infrastructure Layer

**Through Repository Implementations** (Dependency Injection)

```typescript
constructor(
  private readonly deviceRepository: INetworkDeviceRepository,
  private readonly logger: ILogger
) {}
```

**Through Application Gateways** (Never Directly)

```typescript
// ✅ GOOD - Through interface
interface IEmailGateway {
  sendEmail(
    to: string,
    subject: string,
    body: string
  ): Promise<Result<void>>;
}

// ❌ BAD - Direct infrastructure dependency
import { SendGridEmailService } from '../../infrastructure/email/SendGridEmailService';
```

---

## 5. Use Case Lifetime / Execution Flow

### Canonical Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Use Case Execution                       │
└─────────────────────────────────────────────────────────────┘

1. beforeExecute() [Optional Pre-validation]
   ├─→ Validate command structure
   ├─→ Check required fields
   └─→ Early return if validation fails

2. executeImpl() [Main Orchestration]
   ├─→ Extract raw data from DTO (via Mapper)
   │
   ├─→ Validate business rules
   │   ├─→ Check structural field constraints
   │   ├─→ Validate application preconditions
   │   └─→ Return failure if invalid
   │
   ├─→ Create Value Objects
   │   ├─→ Call VO.create() for each VO
   │   ├─→ Check for failures
   │   └─→ Return failure if any VO invalid
   │
   ├─→ Load Aggregate(s) from Repository
   │   ├─→ Query repository
   │   ├─→ Check existence with domain checkers
   │   └─→ Return failure if not found
   │
   ├─→ Apply Domain Logic
   │   ├─→ Call aggregate methods
   │   ├─→ Invoke domain services if needed
   │   ├─→ Check operation results
   │   └─→ Return failure if operation fails
   │
   ├─→ Persist Aggregate(s)
   │   ├─→ Call repository.save()
   │   └─→ Return failure if persistence fails
   │
   ├─→ Convert to Response DTO (via Mapper)
   │   └─→ Mapper.toDTO(aggregate)
   │
   └─→ Return success Result with DTO

3. afterExecute() [Optional Post-processing]
   ├─→ Log operation
   ├─→ Emit integration events
   └─→ Clean up resources
```

### Detailed Flow Steps

#### Step 1: Pre-validation (beforeExecute)

```typescript
protected beforeExecute(request: CreateDeviceCommand): Result<void> | null {
  // Structural validation only - business validation in executeImpl

  // Check required fields
  if (!request.name || !request.ipAddress) {
    return Result.fail('Name and IP address are required');
  }

  // Check for at least one field in update operations
  if (Object.keys(request).length === 0) {
    return Result.fail('At least one field must be provided');
  }

  return null; // null means validation passed
}
```

#### Step 2: Main Orchestration (executeImpl)

```typescript
protected async executeImpl(
  request: CreateDeviceCommand
): Promise<Result<DeviceResponseDTO>> {

  // 2.1: Extract raw data from DTO (Mapper responsibility)
  const data = NetworkDeviceMapper.extractCreateData(request);

  // 2.2: Validate business rules (Use case responsibility)
  const validation = this.validateBusinessRules(data);
  if (validation.isFailure) {
    return Result.fail(validation.error);
  }

  // 2.3: Create Value Objects (Domain validation)
  const ipAddress = IPAddress.create(data.ipAddress);
  if (ipAddress.isFailure) {
    return Result.fail(`Invalid IP: ${ipAddress.error}`);
  }

  // 2.4: Check uniqueness (Application-level business rule)
  const exists = await this.repository.existsByIpAddress(ipAddress.value);
  if (exists) {
    return Result.fail('Device with this IP already exists');
  }

  // 2.5: Map business enums (Use case determines behavior)
  const deviceType = this.mapDeviceType(data.deviceType);

  // 2.6: Create domain aggregate
  const device = NetworkDevice.create({
    name: data.name,
    ipAddress: ipAddress.value,
    deviceType,
    // ...
  });

  if (device.isFailure) {
    return Result.fail(device.error);
  }

  // 2.7: Persist aggregate
  const saveResult = await this.repository.save(device.value);
  if (saveResult.isFailure) {
    return Result.fail(saveResult.error);
  }

  // 2.8: Convert to response DTO
  const dto = NetworkDeviceMapper.toDTO(device.value);

  // 2.9: Return success
  return Result.ok(dto);
}
```

#### Step 3: Post-processing (afterExecute)

```typescript
protected afterExecute(
  request: CreateDeviceCommand,
  result: Result<DeviceResponseDTO>
): void {
  // Logging
  if (result.isSuccess) {
    this.logger.info(`Device created: ${result.value.id}`);
  } else {
    this.logger.error(`Device creation failed: ${result.error}`);
  }

  // Domain events are auto-dispatched by repository
  // No manual event handling needed here
}
```

---

## 6. Use Case Structure Template

### Base Use Case Class

```typescript
/**
 * Base class for all use cases.
 * Implements template method pattern for use case execution.
 */
export abstract class UseCase<TRequest, TResponse> {
  /**
   * Main entry point for use case execution.
   * Implements template method pattern with hooks.
   */
  public async execute(
    request: TRequest
  ): Promise<Result<TResponse>> {
    // Hook 1: Pre-validation
    const preValidation = this.beforeExecute(request);
    if (preValidation !== null) {
      return preValidation as Result<TResponse>;
    }

    // Hook 2: Main execution
    const result = await this.executeImpl(request);

    // Hook 3: Post-processing
    this.afterExecute(request, result);

    return result;
  }

  /**
   * Pre-execution validation hook.
   * Use for structural validation and early rejection.
   * @returns Result.fail() to reject, or null to proceed
   */
  protected beforeExecute(request: TRequest): Result<void> | null {
    return null; // Default: no pre-validation
  }

  /**
   * Main execution logic.
   * Override this method to implement use case orchestration.
   */
  protected abstract executeImpl(
    request: TRequest
  ): Promise<Result<TResponse>>;

  /**
   * Post-execution hook.
   * Use for logging, metrics, cleanup.
   * Cannot affect the result.
   */
  protected afterExecute(
    request: TRequest,
    result: Result<TResponse>
  ): void {
    // Default: no post-processing
  }

  /**
   * Helper to create success result.
   */
  protected ok<U>(value: U): Result<U> {
    return Result.ok(value);
  }

  /**
   * Helper to create failure result.
   */
  protected fail<U>(error: string): Result<U> {
    return Result.fail(error);
  }
}
```

### Complete Use Case Template

```typescript
/**
 * CreateNetworkDeviceUseCase
 *
 * Business Intent: Create a new network device in the system
 *
 * Flow:
 * 1. beforeExecute: Validate required fields
 * 2. executeImpl: Orchestrate device creation
 * 3. afterExecute: Log operation
 *
 * Business Rules:
 * - IP address must be unique
 * - Name must not exceed 255 characters
 * - Device type determines default polling interval
 * - All devices start in OFFLINE status
 *
 * Dependencies:
 * - INetworkDeviceRepository: Persist and query devices
 * - ILogger: Log operations
 */
export interface CreateNetworkDeviceRequest {
  name: string;
  ipAddress: string;
  macAddress: string;
  deviceType: string;
  description?: string;
  // ...
}

export class CreateNetworkDeviceUseCase extends UseCase<
  CreateNetworkDeviceRequest,
  NetworkDeviceResponseDTO
> {
  constructor(
    private readonly deviceRepository: INetworkDeviceRepository,
    private readonly logger: ILogger
  ) {
    super();
  }

  /**
   * Pre-execution validation.
   * Checks structural requirements before main execution.
   */
  protected beforeExecute(
    request: CreateNetworkDeviceRequest
  ): Result<void> | null {
    // Check required fields
    if (!request.name || !request.ipAddress || !request.macAddress) {
      return Result.fail(
        'Name, IP address, and MAC address are required'
      );
    }

    return null; // Validation passed
  }

  /**
   * Main execution: Orchestrate device creation.
   */
  protected async executeImpl(
    request: CreateNetworkDeviceRequest
  ): Promise<Result<NetworkDeviceResponseDTO>> {
    // 1. Extract raw data from DTO (Mapper)
    const data = NetworkDeviceMapper.extractCreateData(request);

    // 2. Validate business rules (Use case)
    const validation = this.validateCreateData(data);
    if (validation.isFailure) {
      return this.fail(validation.error);
    }

    // 3. Create Value Objects (Domain)
    const ipAddress = IPAddress.create(data.ipAddress);
    if (ipAddress.isFailure) {
      return this.fail(`Invalid IP: ${ipAddress.error}`);
    }

    const macAddress = MACAddress.create(data.macAddress);
    if (macAddress.isFailure) {
      return this.fail(`Invalid MAC: ${macAddress.error}`);
    }

    // 4. Check uniqueness (Application rule)
    const existsByIp = await this.deviceRepository.existsByIpAddress(
      ipAddress.value
    );
    if (existsByIp) {
      return this.fail('Device with this IP address already exists');
    }

    // 5. Map enum (Business logic)
    const deviceType = this.mapDeviceType(data.deviceType);

    // 6. Determine business defaults
    const defaultInterval = getDefaultPollingInterval(deviceType);
    const pollingInterval =
      PollingInterval.create(defaultInterval).value;

    // 7. Create polling configuration
    const pollingConfig = PollingConfiguration.create({
      networkDeviceId: deviceId,
      interval: pollingInterval,
      enabled: true,
      pingCount: 4,
      retryPolicy: RetryPolicy.createDefault(),
      lastScheduledAt: null,
      nextScheduledAt: null
    });

    if (pollingConfig.isFailure) {
      return this.fail(pollingConfig.error);
    }

    // 8. Create aggregate
    const device = NetworkDevice.create({
      name: data.name,
      deviceType,
      status: NetworkDeviceStatus.OFFLINE,
      ipAddress: ipAddress.value,
      macAddress: macAddress.value,
      description: data.description,
      pollingConfiguration: pollingConfig.value
      // ...
    });

    if (device.isFailure) {
      return this.fail(device.error);
    }

    // 9. Optional: Perform ping test
    if (data.performPingTest) {
      const pingResult = await this.performInitialPing(device.value);
      // Log but don't fail on ping failure
    }

    // 10. Persist aggregate
    const saveResult = await this.deviceRepository.save(device.value);
    if (saveResult.isFailure) {
      return this.fail(saveResult.error);
    }

    // 11. Convert to DTO
    const dto = NetworkDeviceMapper.toDTO(device.value);

    return this.ok(dto);
  }

  /**
   * Post-execution logging.
   */
  protected afterExecute(
    request: CreateNetworkDeviceRequest,
    result: Result<NetworkDeviceResponseDTO>
  ): void {
    if (result.isSuccess) {
      this.logger.info(
        `Network device created successfully: ${result.value.id}`,
        { name: request.name, ip: request.ipAddress }
      );
    } else {
      this.logger.error(
        `Failed to create network device: ${result.error}`,
        { request }
      );
    }
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  private validateCreateData(data: any): Result<void> {
    // Business validation
    if (data.name.trim().length > 255) {
      return Result.fail('Name must not exceed 255 characters');
    }

    if (data.managementPort < 1 || data.managementPort > 65535) {
      return Result.fail('Port must be between 1 and 65535');
    }

    return Result.ok();
  }

  private mapDeviceType(typeStr: string): NetworkDeviceType {
    const upperType = typeStr.toUpperCase();
    return Object.values(NetworkDeviceType).includes(
      upperType as NetworkDeviceType
    )
      ? (upperType as NetworkDeviceType)
      : NetworkDeviceType.UNKNOWN;
  }

  private async performInitialPing(
    device: NetworkDevice
  ): Promise<Result<void>> {
    // Optional ping test implementation
    return Result.ok();
  }
}
```

---

## 7. Orthogonality Principles

### One Use Case = One Responsibility

**Rule**: Each use case handles exactly one business intention.

```typescript
// ✅ GOOD - Single responsibility
class CreateNetworkDeviceUseCase {}
class UpdateNetworkDeviceUseCase {}
class DeleteNetworkDeviceUseCase {}

// ❌ BAD - Multiple responsibilities
class NetworkDeviceManagementUseCase {
  create() {}
  update() {}
  delete() {}
}
```

### No Shared State

**Rule**: Use cases maintain no state between executions.

```typescript
// ✅ GOOD - Stateless
class CreateDeviceUseCase {
  constructor(private repository: IDeviceRepository) {}

  async execute(request: CreateDeviceRequest) {
    // No instance variables modified
  }
}

// ❌ BAD - Stateful
class CreateDeviceUseCase {
  private lastCreatedDevice: Device; // State!

  async execute(request: CreateDeviceRequest) {
    this.lastCreatedDevice = device; // Modifying state!
  }
}
```

### No Coupling Between Use Cases

**Rule**: Use cases never call other use cases directly.

```typescript
// ✅ GOOD - Use shared domain services or repositories
class CreateDeviceUseCase {
  async execute(request: CreateDeviceRequest) {
    // Query repository
    const exists = await this.repository.existsByIp(ip);
  }
}

// ❌ BAD - Coupling to another use case
class CreateDeviceUseCase {
  constructor(
    private checkDeviceExistsUseCase: CheckDeviceExistsUseCase // NO!
  ) {}
}
```

### Dependency Injection Only

**Rule**: All dependencies must be injected, never created inside.

```typescript
// ✅ GOOD - Dependencies injected
class CreateDeviceUseCase {
  constructor(
    private readonly repository: IDeviceRepository,
    private readonly logger: ILogger,
    private readonly mapper: NetworkDeviceMapper
  ) {}
}

// ❌ BAD - Creating dependencies
class CreateDeviceUseCase {
  async execute(request: CreateDeviceRequest) {
    const repository = new DeviceRepository(); // NO!
    const logger = new ConsoleLogger(); // NO!
  }
}
```

### Interface-Based Dependencies

**Rule**: Depend on abstractions (interfaces), not concrete implementations.

```typescript
// ✅ GOOD - Interface dependency
interface INetworkDeviceRepository {
  save(device: NetworkDevice): Promise<Result<void>>;
  findById(
    id: NetworkDeviceId
  ): Promise<Result<NetworkDevice | null>>;
}

class CreateDeviceUseCase {
  constructor(
    private readonly repository: INetworkDeviceRepository // Interface!
  ) {}
}

// ❌ BAD - Concrete implementation dependency
import { PrismaDeviceRepository } from '../../infrastructure/...';

class CreateDeviceUseCase {
  constructor(
    private readonly repository: PrismaDeviceRepository // Concrete!
  ) {}
}
```

---

## 8. Naming Conventions

### Use Case Class Names

**Pattern**: `{Verb}{EntityName}UseCase`

```typescript
// ✅ GOOD - Clear verb + entity
CreateNetworkDeviceUseCase
UpdateNetworkDeviceUseCase
DeleteNetworkDeviceUseCase
GetNetworkDeviceUseCase
ListNetworkDevicesUseCase
ArchiveNetworkDeviceUseCase
EnablePollingUseCase
DisablePollingUseCase
ExecutePollingCycleUseCase

// ❌ BAD - Unclear or inconsistent
DeviceCreator
NetworkDeviceManager
HandleDevice
DeviceUseCase (too generic)
```

### Common Verbs

| Verb      | Use Case                   | Example                      |
| --------- | -------------------------- | ---------------------------- |
| Create    | Create new entity          | CreateNetworkDeviceUseCase   |
| Update    | Modify existing entity     | UpdateNetworkDeviceUseCase   |
| Delete    | Remove entity              | DeleteNetworkDeviceUseCase   |
| Get       | Retrieve single entity     | GetNetworkDeviceUseCase      |
| List      | Retrieve multiple entities | ListNetworkDevicesUseCase    |
| Find      | Search for entities        | FindDevicesByStatusUseCase   |
| Archive   | Soft delete                | ArchiveNetworkDeviceUseCase  |
| Restore   | Un-delete                  | RestoreNetworkDeviceUseCase  |
| Enable    | Activate feature           | EnablePollingUseCase         |
| Disable   | Deactivate feature         | DisablePollingUseCase        |
| Execute   | Run operation              | ExecutePollingCycleUseCase   |
| Calculate | Compute value              | CalculateDeviceUptimeUseCase |

### Request/Command DTOs

**Pattern**: `{UseCaseName}Request` or `{UseCaseName}Command`

```typescript
// Request suffix (preferred for queries)
interface GetNetworkDeviceRequest {
  deviceId: string;
}

// Command suffix (preferred for mutations)
interface CreateNetworkDeviceCommand {
  name: string;
  ipAddress: string;
  deviceType: string;
}
```

### Response DTOs

**Pattern**: Use mapper-generated DTOs or specific response types

```typescript
// ✅ GOOD - Use mapper DTO
async execute(
  request: CreateDeviceRequest
): Promise<Result<NetworkDeviceResponseDTO>> {
  const dto = NetworkDeviceMapper.toDTO(device);
  return Result.ok(dto);
}

// ✅ GOOD - Specific response type for complex use cases
interface ExecutePollingCycleResponse {
  devicesPolled: number;
  successfulPolls: number;
  failedPolls: number;
  averageResponseTime: number;
}
```

### File Names

**Pattern**: `{UseCaseName}.ts`

```
src/application/use-cases/
  ├── CreateNetworkDeviceUseCase.ts
  ├── UpdateNetworkDeviceUseCase.ts
  ├── DeleteNetworkDeviceUseCase.ts
  ├── GetNetworkDeviceUseCase.ts
  └── ListNetworkDevicesUseCase.ts
```

---

## 9. Error Handling Patterns

### Result Pattern (Preferred)

**Use Result<T> for expected business failures:**

```typescript
// Result pattern - Success and failure are both valid outcomes
const device = await this.repository.findById(deviceId);
if (device.isFailure) {
  return Result.fail(device.error);
}

// Use the value
const dto = NetworkDeviceMapper.toDTO(device.value);
return Result.ok(dto);
```

### Error Categories

#### Business Errors (Return Result.fail)

```typescript
// Validation errors
if (name.length > 255) {
  return Result.fail('Name exceeds maximum length');
}

// Business rule violations
if (await this.repository.existsByIp(ip)) {
  return Result.fail('Device with this IP already exists');
}

// Not found errors
if (!device) {
  return Result.fail('Device not found');
}

// Authorization errors
if (!user.canDelete(device)) {
  return Result.fail('Insufficient permissions');
}
```

#### Technical Errors (Let throw, catch at boundary)

```typescript
// Database connection failures
// Network timeouts
// Out of memory errors
// Infrastructure failures

// These should bubble up and be caught at the application boundary
// (e.g., error handling middleware in Express)
```

### Error Handling Best Practices

```typescript
protected async executeImpl(
  request: CreateDeviceRequest
): Promise<Result<DeviceResponseDTO>> {

  // 1. Check Result objects at each step
  const ipAddress = IPAddress.create(request.ipAddress);
  if (ipAddress.isFailure) {
    return Result.fail(`Invalid IP: ${ipAddress.error}`);
  }

  // 2. Unwrap value only after checking
  const ip = ipAddress.value; // Safe to unwrap

  // 3. Chain operations, checking each
  const macAddress = MACAddress.create(request.macAddress);
  if (macAddress.isFailure) {
    return Result.fail(`Invalid MAC: ${macAddress.error}`);
  }

  // 4. Don't nest error checking - return early
  const device = NetworkDevice.create({ /* ... */ });
  if (device.isFailure) {
    return Result.fail(device.error);
  }

  // 5. Return success at the end
  return Result.ok(dto);
}
```

### Error Messages

**Guidelines:**

- Be specific and actionable
- Include context when helpful
- Use consistent error message format
- Don't expose internal implementation details

```typescript
// ✅ GOOD - Specific and actionable
return Result.fail(
  'Device with IP address 192.168.1.1 already exists'
);
return Result.fail(
  'Name must not exceed 255 characters (current: 300)'
);
return Result.fail(
  'Management port must be between 1 and 65535 (current: 70000)'
);

// ❌ BAD - Vague or technical
return Result.fail('Invalid');
return Result.fail('Database constraint violation: UK_devices_ip');
return Result.fail('Error occurred');
```

---

## 10. Transaction Management

### ⚠️ CRITICAL: Transaction Implementation is Infrastructure Concern

**Use cases define transaction boundaries. Infrastructure implements the mechanism.**

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│                                                             │
│  Use Case defines WHAT needs to be transactional            │
│  (conceptual boundary)                                      │
│                                                             │
│  unitOfWork.runInTransaction(async () => {                  │
│    await repository.save(aggregate);                        │
│  });                                                        │
│                                                             │
└────────────────────────┬────────────────────────────────────┘
                         │ Interface
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                       │
│                                                             │
│  UnitOfWork implements HOW transaction works                │
│  (Prisma.$transaction, SQL BEGIN/COMMIT, etc.)              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Pattern 1: Single Aggregate = Implicit Transaction (Most Common)

**99% of use cases modify one aggregate and don't need explicit transactions.**

```typescript
// ✅ BEST PRACTICE - Single aggregate, implicit transaction
class UpdateNetworkDeviceNameUseCase {
  constructor(
    private readonly repository: INetworkDeviceRepository
  ) {}

  async execute(request: UpdateNameRequest) {
    // Load aggregate
    const device = await this.repository.findById(request.deviceId);

    // Modify aggregate
    device.updateName(request.newName);

    // Save aggregate - Repository handles transaction internally
    await this.repository.save(device);

    // Transaction committed automatically by repository implementation
  }
}
```

**Infrastructure implementation:**

```typescript
// Infrastructure layer (Prisma example)
class PrismaNetworkDeviceRepository
  implements INetworkDeviceRepository
{
  async save(device: NetworkDevice): Promise<Result<void>> {
    // Infrastructure handles transaction
    return await this.prisma.$transaction(async (tx) => {
      await tx.networkDevice.upsert({
        where: { id: device.id.toString() },
        update: {
          /* ... */
        },
        create: {
          /* ... */
        }
      });

      // Dispatch domain events within transaction
      await this.eventDispatcher.dispatch(device.domainEvents);
    });
  }
}
```

### Pattern 2: Multiple Operations = Explicit Transaction (Rare)

**Only when you MUST coordinate multiple repository operations atomically.**

**⚠️ WARNING**: This violates the "one aggregate per use case" rule. Use event-driven approach instead.

```typescript
// ❌ ANTI-PATTERN - Multiple aggregates in one transaction
// Use event-driven approach instead!
class ComplexOperationUseCase {
  async execute(request: ComplexRequest) {
    await this.unitOfWork.runInTransaction(async () => {
      await this.deviceRepository.save(device);
      await this.auditRepository.save(auditLog); // Should be event handler!
    });
  }
}

// ✅ CORRECT - Event-driven approach
class ComplexOperationUseCase {
  async execute(request: ComplexRequest) {
    // Modify only device - emits event
    device.performOperation();

    // Save device - repository handles transaction
    await this.repository.save(device);

    // Event handler reacts and creates audit log
  }
}
```

### Unit of Work Interface (Application Layer)

**Define the abstraction, let infrastructure implement:**

```typescript
// Application layer interface
export interface IUnitOfWork {
  /**
   * Execute operations within a transaction.
   * Infrastructure decides implementation (Prisma, SQL, etc.)
   *
   * @param work - Async function containing transactional operations
   * @returns Result of the transaction
   */
  runInTransaction<T>(work: () => Promise<T>): Promise<T>;
}
```

### Unit of Work Implementation (Infrastructure Layer)

```typescript
// Infrastructure layer - Prisma implementation
export class PrismaUnitOfWork implements IUnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    // Infrastructure decides HOW to implement transaction
    return await this.prisma.$transaction(async (tx) => {
      // Inject transaction context into repositories
      // Execute work within transaction
      return await work();
    });
  }
}

// Infrastructure layer - SQL implementation (alternative)
export class SqlUnitOfWork implements IUnitOfWork {
  constructor(private readonly connection: Connection) {}

  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    await this.connection.query('BEGIN');
    try {
      const result = await work();
      await this.connection.query('COMMIT');
      return result;
    } catch (error) {
      await this.connection.query('ROLLBACK');
      throw error;
    }
  }
}
```

### When to Use Explicit Transactions

| Scenario                          | Use Explicit Transaction?         |
| --------------------------------- | --------------------------------- |
| Single aggregate modification     | ❌ NO - Repository handles it     |
| Multiple aggregates (eventual ok) | ❌ NO - Use events                |
| Read operations only              | ❌ NO - No transaction needed     |
| Audit log + main operation        | ❌ NO - Use event handler         |
| Critical atomic operation (rare)  | ✅ YES - But question your design |

### Transaction Guidelines

1. **Default to implicit** - Let repository handle transactions
2. **Use events for multi-aggregate** - Avoid explicit transactions
3. **Keep transactions short** - Load, modify, save
4. **Don't hold transactions across I/O** - External API calls, user input
5. **Let infrastructure decide HOW** - Application defines WHAT
6. **Don't nest transactions** - Use single scope
7. **Don't catch and suppress** transaction errors

### Reconstitute Pattern in Transactions

**When loading from repository, use `reconstitute()` to avoid event emission:**

```typescript
class UpdateNetworkDeviceUseCase {
  async execute(request: UpdateRequest) {
    // Repository uses reconstitute() internally
    const device = await this.repository.findById(request.deviceId);
    // ↑ This calls NetworkDevice.reconstitute() - no events emitted

    // Business operation emits events
    device.updateName(request.newName);
    // ↑ This emits NetworkDeviceUpdatedEvent

    // Save dispatches events within transaction
    await this.repository.save(device);
  }
}
```

**Repository implementation:**

````typescript
class PrismaNetworkDeviceRepository {
  async findById(id: NetworkDeviceId): Promise<NetworkDevice | null> {
    const raw = await this.prisma.networkDevice.findUnique({
      where: { id: id.toString() }
    });

    if (!raw) return null;

    // Use reconstitute() to rebuild without events
    return NetworkDevice.reconstitute(
      {
        name: raw.name,
        ipAddress: IPAddress.create(raw.ipAddress).value,
        // ...
      },
      id
    ).value;
  }
}

---

## 11. Testing Strategy

### Unit Testing Use Cases

```typescript
describe('CreateNetworkDeviceUseCase', () => {
  let useCase: CreateNetworkDeviceUseCase;
  let mockRepository: jest.Mocked<INetworkDeviceRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    // Create mocks
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      existsByIpAddress: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    } as any;

    // Instantiate use case with mocks
    useCase = new CreateNetworkDeviceUseCase(
      mockRepository,
      mockLogger
    );
  });

  describe('executeImpl', () => {
    it('should create device successfully with valid input', async () => {
      // Arrange
      const request: CreateDeviceRequest = {
        name: 'Router-01',
        ipAddress: '192.168.1.1',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        deviceType: 'ROUTER'
      };

      mockRepository.existsByIpAddress.mockResolvedValue(false);
      mockRepository.save.mockResolvedValue(Result.ok());

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value.name).toBe('Router-01');
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should fail when IP address already exists', async () => {
      // Arrange
      const request: CreateDeviceRequest = {
        name: 'Router-01',
        ipAddress: '192.168.1.1',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        deviceType: 'ROUTER'
      };

      mockRepository.existsByIpAddress.mockResolvedValue(true);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already exists');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should fail with invalid IP address format', async () => {
      // Arrange
      const request: CreateDeviceRequest = {
        name: 'Router-01',
        ipAddress: 'invalid-ip',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        deviceType: 'ROUTER'
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid IP');
    });
  });
});
````

### Testing Guidelines

1. **Mock all dependencies** - repositories, loggers, services
2. **Test happy path** - successful execution
3. **Test business rule violations** - validation failures
4. **Test edge cases** - null values, empty strings, boundaries
5. **Test error propagation** - repository failures, domain errors
6. **Verify repository calls** - correct methods called with correct args
7. **Don't test domain logic** - that's domain layer's responsibility
8. **Test orchestration logic** - correct sequence of operations

---

## 12. Examples

### Example 1: Simple Create Use Case

```typescript
/**
 * CreateNetworkDeviceUseCase
 *
 * Simple creation use case with validation and uniqueness check.
 */
export class CreateNetworkDeviceUseCase extends UseCase<
  CreateNetworkDeviceRequest,
  NetworkDeviceResponseDTO
> {
  constructor(
    private readonly deviceRepository: INetworkDeviceRepository,
    private readonly logger: ILogger
  ) {
    super();
  }

  protected beforeExecute(
    request: CreateNetworkDeviceRequest
  ): Result<void> | null {
    if (!request.name || !request.ipAddress) {
      return Result.fail('Name and IP address are required');
    }
    return null;
  }

  protected async executeImpl(
    request: CreateNetworkDeviceRequest
  ): Promise<Result<NetworkDeviceResponseDTO>> {
    // 1. Extract data
    const data = NetworkDeviceMapper.extractCreateData(request);

    // 2. Validate
    if (data.name.length > 255) {
      return this.fail('Name too long');
    }

    // 3. Create VOs
    const ipAddress = IPAddress.create(data.ipAddress);
    if (ipAddress.isFailure) {
      return this.fail(ipAddress.error);
    }

    // 4. Check uniqueness
    if (
      await this.deviceRepository.existsByIpAddress(ipAddress.value)
    ) {
      return this.fail('IP already exists');
    }

    // 5. Create aggregate
    const device = NetworkDevice.create({
      /* ... */
    });
    if (device.isFailure) {
      return this.fail(device.error);
    }

    // 6. Persist
    await this.deviceRepository.save(device.value);

    // 7. Convert to DTO
    const dto = NetworkDeviceMapper.toDTO(device.value);

    return this.ok(dto);
  }
}
```

### Example 2: Complex Use Case with Domain Service

```typescript
/**
 * ExecutePollingCycleUseCase
 *
 * Complex use case that:
 * - Loads multiple aggregates
 * - Uses domain service
 * - Updates multiple aggregates
 * - Returns summary statistics
 */
export class ExecutePollingCycleUseCase extends UseCase<
  ExecutePollingCycleRequest,
  PollingCycleSummaryDTO
> {
  constructor(
    private readonly deviceRepository: INetworkDeviceRepository,
    private readonly pollingService: IPollingService,
    private readonly resultRepository: IPollingResultRepository,
    private readonly logger: ILogger
  ) {
    super();
  }

  protected async executeImpl(
    request: ExecutePollingCycleRequest
  ): Promise<Result<PollingCycleSummaryDTO>> {
    // 1. Load all devices with polling enabled
    const devicesResult =
      await this.deviceRepository.findByPollingEnabled(true);

    if (devicesResult.isFailure) {
      return this.fail(devicesResult.error);
    }

    const devices = devicesResult.value;
    this.logger.info(
      `Starting polling cycle for ${devices.length} devices`
    );

    // 2. Poll each device using domain service
    const pollResults: PollingResult[] = [];
    const statistics = {
      total: devices.length,
      successful: 0,
      failed: 0,
      totalResponseTime: 0
    };

    for (const device of devices) {
      // Domain service performs polling
      const pollResult = await this.pollingService.pollDevice(device);

      if (pollResult.isSuccess) {
        pollResults.push(pollResult.value);

        // Update device status based on poll result
        const updateResult = device.updatePollingState(
          pollResult.value
        );
        if (updateResult.isFailure) {
          this.logger.warn(
            `Failed to update device state: ${updateResult.error}`
          );
          continue;
        }

        // Track statistics
        if (pollResult.value.status === PollingStatus.SUCCESS) {
          statistics.successful++;
          statistics.totalResponseTime +=
            pollResult.value.metrics?.averageResponseTime || 0;
        } else {
          statistics.failed++;
        }

        // Persist updated device
        await this.deviceRepository.save(device);

        // Persist poll result
        await this.resultRepository.save(pollResult.value);
      }
    }

    // 3. Calculate summary
    const summary: PollingCycleSummaryDTO = {
      devicesPolled: statistics.total,
      successfulPolls: statistics.successful,
      failedPolls: statistics.failed,
      averageResponseTime:
        statistics.successful > 0
          ? statistics.totalResponseTime / statistics.successful
          : 0,
      timestamp: new Date()
    };

    return this.ok(summary);
  }

  protected afterExecute(
    request: ExecutePollingCycleRequest,
    result: Result<PollingCycleSummaryDTO>
  ): void {
    if (result.isSuccess) {
      this.logger.info(
        `Polling cycle completed: ${result.value.successfulPolls}/${result.value.devicesPolled} successful`
      );
    }
  }
}
```

### Example 3: Update Use Case with Partial Updates

```typescript
/**
 * UpdateNetworkDeviceUseCase
 *
 * Update use case demonstrating:
 * - Partial updates (only provided fields)
 * - Domain method calls
 * - Immutability enforcement
 */
export class UpdateNetworkDeviceUseCase extends UseCase<
  UpdateNetworkDeviceRequest,
  NetworkDeviceResponseDTO
> {
  constructor(
    private readonly deviceRepository: INetworkDeviceRepository,
    private readonly logger: ILogger
  ) {
    super();
  }

  protected beforeExecute(
    request: UpdateNetworkDeviceRequest
  ): Result<void> | null {
    const { id, ...updates } = request;

    // Check that at least one field is being updated
    if (Object.keys(updates).length === 0) {
      return Result.fail(
        'At least one field must be provided for update'
      );
    }

    return null;
  }

  protected async executeImpl(
    request: UpdateNetworkDeviceRequest
  ): Promise<Result<NetworkDeviceResponseDTO>> {
    // 1. Validate and load device
    const deviceId = NetworkDeviceId.create(request.id);
    if (deviceId.isFailure) {
      return this.fail(deviceId.error);
    }

    const deviceResult = await this.deviceRepository.findById(
      deviceId.value
    );
    if (deviceResult.isFailure || !deviceResult.value) {
      return this.fail('Device not found');
    }

    const device = deviceResult.value;

    // 2. Extract updates
    const updates = NetworkDeviceMapper.extractUpdateData(request);

    // 3. Validate updates
    const validation = this.validateUpdateData(updates);
    if (validation.isFailure) {
      return this.fail(validation.error);
    }

    // 4. Enforce immutability
    if (updates.deviceType !== undefined) {
      return this.fail(
        'Device type cannot be changed after creation'
      );
    }

    // 5. Apply updates using domain methods
    if (updates.name !== undefined) {
      const result = device.updateName(updates.name);
      if (result.isFailure) {
        return this.fail(result.error);
      }
    }

    if (updates.description !== undefined) {
      const result = device.updateDescription(updates.description);
      if (result.isFailure) {
        return this.fail(result.error);
      }
    }

    if (updates.managementPort !== undefined) {
      const protocol = updates.managementProtocol
        ? this.mapManagementProtocol(updates.managementProtocol)
        : undefined;

      const result = device.updateManagementConfig({
        protocol,
        port: updates.managementPort,
        enableRemoteAccess: updates.enabledRemoteAccess
      });

      if (result.isFailure) {
        return this.fail(result.error);
      }
    }

    // 6. Persist
    await this.deviceRepository.save(device);

    // 7. Convert to DTO
    const dto = NetworkDeviceMapper.toDTO(device);

    return this.ok(dto);
  }

  private validateUpdateData(updates: any): Result<void> {
    if (updates.name && updates.name.length > 255) {
      return Result.fail('Name too long');
    }

    if (updates.managementPort) {
      if (
        updates.managementPort < 1 ||
        updates.managementPort > 65535
      ) {
        return Result.fail('Invalid port range');
      }
    }

    return Result.ok();
  }

  private mapManagementProtocol(str: string): ManagementProtocol {
    // Business logic: map string to enum
    return (
      ManagementProtocol[str.toUpperCase()] ||
      ManagementProtocol.OTHER
    );
  }
}
```

---

## Final Instruction

**This document is the authoritative standard for all use case implementations in this project.**

### Critical Rules (Never Violate)

1. ⚠️ **ONE AGGREGATE PER USE CASE** - Modify only one aggregate root per transaction
2. ⚠️ **USE EVENTS FOR MULTI-AGGREGATE** - Cross-aggregate operations via domain events
3. ⚠️ **TRANSACTION = INFRASTRUCTURE** - Unit of Work implementation lives in infrastructure
4. ⚠️ **USE RECONSTITUTE() IN REPOSITORIES** - Load from DB without emitting events
5. ⚠️ **NO DOMAIN LOGIC IN USE CASES** - Orchestrate only, never implement

### Review Checklist

When creating, modifying, or reviewing any use case:

- [ ] Modifies **one aggregate only** (or read-only query)
- [ ] Uses **events** for cross-aggregate communication
- [ ] **Repository handles transactions** (or explicit `runInTransaction`)
- [ ] Follows **canonical flow** (Section 5)
- [ ] Uses **Result pattern** for error handling
- [ ] Depends on **interfaces**, not implementations
- [ ] **No shared state** between executions
- [ ] **Proper naming** (VerbEntityUseCase)
- [ ] **Unit tested** with mocked dependencies

### Common Anti-Patterns to Avoid

```typescript
// ❌ WRONG: Multiple aggregates in one use case
await this.deviceRepository.save(device);
await this.userRepository.save(user);

// ✅ CORRECT: Single aggregate + event
device.performAction(); // Emits event
await this.deviceRepository.save(device);
// Event handler updates user

// ❌ WRONG: Use case implements business logic
if (device.lastPingTime.isBefore(Date.now().minus(5, 'minutes'))) {
  device.status = 'OFFLINE';
}

// ✅ CORRECT: Domain implements business logic
device.updateStatusBasedOnPing(lastPingResult);

// ❌ WRONG: Manual transaction management
await this.unitOfWork.begin();
try {
  await this.repository.save(device);
  await this.unitOfWork.commit();
} catch (e) {
  await this.unitOfWork.rollback();
}

// ✅ CORRECT: Infrastructure handles transaction
await this.unitOfWork.runInTransaction(async () => {
  await this.repository.save(device);
});
```

### Document Compliance

**Use cases orchestrate domain logic. They do not implement it.**

Any deviation from this standard must be:

1. Explicitly documented in code comments
2. Justified with compelling architectural reason
3. Reviewed by team lead
4. Marked with `// DEVIATION:` comment

---

**Document Status:** This is a living document. Update as architectural patterns evolve, but maintain the core principles:

1. **One aggregate per use case**
2. **Event-driven cross-aggregate communication**
3. **Infrastructure implements transactions**
4. **Use cases orchestrate, Domain implements**
