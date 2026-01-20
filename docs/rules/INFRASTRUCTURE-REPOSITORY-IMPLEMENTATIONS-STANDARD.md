# INFRASTRUCTURE REPOSITORY IMPLEMENTATIONS STANDARD

## Table of Contents

1. [Purpose of Repository Implementations in DDD](#1-purpose-of-repository-implementations-in-ddd)
2. [Responsibilities of a Repository Implementation](#2-responsibilities-of-a-repository-implementation)
3. [Boundaries of a Repository Implementation](#3-boundaries-of-a-repository-implementation)
4. [Connections with Other Layers](#4-connections-with-other-layers)
5. [Repository Implementation Lifecycle](#5-repository-implementation-lifecycle)
6. [Repository Implementation Structure Template](#6-repository-implementation-structure-template)
7. [Orthogonality Principles](#7-orthogonality-principles)
8. [Naming Conventions](#8-naming-conventions)
9. [Error Handling Strategy](#9-error-handling-strategy)
10. [Transaction Management](#10-transaction-management)
11. [Domain Event Dispatching](#11-domain-event-dispatching)
12. [Testing Strategy](#12-testing-strategy)
13. [Examples](#13-examples)

---

## 1. Purpose of Repository Implementations in DDD

**Repository Implementations are infrastructure components that provide concrete implementations of domain repository interfaces, handling all persistence and data access concerns.**

### Core Characteristics:

- **Implements Domain Interface**: Fulfills contract defined in domain layer repository interface
- **Infrastructure Concerns**: Handles database access, ORM operations, caching, connection management
- **Mapper Integration**: Uses infrastructure mappers to convert between domain and persistence models
- **Error Classification**: Distinguishes between business errors (return `Result.fail()`) and infrastructure errors (throw exceptions)
- **Event Dispatching**: Triggers domain events after successful persistence operations
- **Transaction Management**: Handles database transactions, rollbacks, and consistency

### Why Repository Implementations?

1. **Separation of Concerns**: Domain layer remains pure, infrastructure handles technical details
2. **Dependency Inversion**: Domain defines the contract, infrastructure implements it
3. **Technology Independence**: Can swap database/ORM without changing domain code
4. **Testability**: Domain can be tested with mock repositories, infrastructure tested separately
5. **Clear Boundaries**: Explicit separation between business logic and persistence logic
6. **Flexibility**: Different implementations for different environments (production, testing, in-memory)

### Repository Implementation vs Repository Interface:

| Aspect                | Repository Implementation          | Repository Interface              |
| --------------------- | ---------------------------------- | --------------------------------- |
| **Layer**             | Infrastructure                     | Domain                            |
| **Purpose**           | How to persist (technical)         | What to persist (business)        |
| **Dependencies**      | Database, ORM, mappers, events    | Domain types only                 |
| **Error Handling**    | Throws for infrastructure failures | Returns Result<T> signature       |
| **Concrete/Abstract** | Concrete implementation            | Abstract interface                |
| **Knowledge**         | Knows about DB, tables, schemas    | Knows only domain concepts        |
| **Testing**           | Integration tests (real DB)        | Mocked in unit tests              |

---

## 2. Responsibilities of a Repository Implementation

### MUST DO:

1. **Implement Domain Repository Interface**

   - Fulfill all methods defined in the interface
   - Match exact method signatures
   - Honor the contract (input/output types, promises)
   - Return `Result<T>` for business scenarios

2. **Handle Persistence Operations**

   - Execute database queries (SELECT, INSERT, UPDATE, DELETE)
   - Use ORM effectively (Prisma, TypeORM, etc.)
   - Manage database connections
   - Handle connection pooling

3. **Map Between Layers**

   - Use infrastructure mappers to convert domain entities to persistence models
   - Use infrastructure mappers to convert persistence models to domain entities
   - Handle nested relationships and aggregates
   - Preserve domain integrity during mapping

4. **Classify and Handle Errors**

   - Return `Result.fail()` for expected business errors (duplicates, constraint violations)
   - Throw exceptions for unexpected infrastructure errors (connection lost, timeouts)
   - Provide meaningful error messages for both types
   - Log infrastructure errors appropriately

5. **Manage Transactions**

   - Ensure atomic operations (all-or-nothing)
   - Support transaction boundaries
   - Handle rollbacks on failures
   - Support nested transactions if needed

6. **Dispatch Domain Events**

   - Trigger domain events after successful save operations
   - Use domain event dispatcher
   - Only dispatch after database commit succeeds
   - Handle event dispatching failures appropriately

7. **Load Complete Aggregates**

   - Load entire aggregate including all child entities
   - Use eager loading or multiple queries as needed
   - Ensure aggregate consistency
   - Reconstruct domain objects correctly

8. **Optimize Performance**
   - Use appropriate indexes
   - Implement pagination efficiently
   - Use query optimization techniques
   - Cache when appropriate (with caution)

---

## 3. Boundaries of a Repository Implementation

### MUST NOT DO:

1. **❌ Contain Business Logic**

   - No validation of business rules
   - No calculations or transformations based on business logic
   - No business decisions
   - Business logic belongs in domain entities/aggregates

2. **❌ Be Imported by Domain Layer**

   - Domain layer never imports infrastructure implementations
   - Only domain interfaces are known to domain
   - Dependency flows: Infrastructure → Domain (not reverse)

3. **❌ Expose Infrastructure Types to Domain**

   - Never return ORM entities (Prisma models, TypeORM entities)
   - Never accept ORM entities as parameters
   - Only domain types cross the boundary
   - Infrastructure types stay in infrastructure layer

4. **❌ Dispatch Domain Events Before Persistence Succeeds**

   - Events only dispatched after database commit
   - Never dispatch on failed saves
   - Ensure transactional consistency

5. **❌ Perform Cross-Aggregate Operations**

   - One repository = one aggregate
   - No joining across aggregates in queries
   - Use domain services or use cases for cross-aggregate logic
   - Keep aggregate boundaries clear

6. **❌ Cache Without Clear Strategy**

   - Caching can cause stale data issues
   - Invalidation is complex and error-prone
   - Only cache when absolutely necessary
   - Document caching strategy clearly

7. **❌ Log Domain Events**

   - Domain events are business concerns
   - Infrastructure logs technical operations only
   - Event handlers log business events if needed

8. **❌ Return Null for Infrastructure Errors**
   - Null is only for "not found" (valid business scenario)
   - Connection failures must throw exceptions
   - Don't hide infrastructure problems in Result.fail()

---

## 4. Connections with Other Layers

```
┌─────────────────────────────────────────────────────────────┐
│                  PRESENTATION LAYER                         │
│  - Never interacts with repository implementations          │
│  - Works through controllers/handlers                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 APPLICATION LAYER                           │
│  - Use cases inject repository interfaces (not impls)       │
│  - Calls methods defined in domain interfaces               │
│  - Receives domain entities from repositories               │
└────────────────────────┬────────────────────────────────────┘
                         │ uses interface
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     DOMAIN LAYER                            │
│  ┌────────────────────────────────────────────────────┐     │
│  │   Repository Interfaces (Contract)                 │     │
│  │   - Define what to persist                         │     │
│  │   - Use domain types                               │     │
│  │   - Return Result<T>                               │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────▲──────────────────────────────────-┘
                          │ implements
                          │
┌─────────────────────────────────────────────────────────────┐
│               INFRASTRUCTURE LAYER                          │
│  ┌───────────────────────────────────────────────────┐      │
│  │  REPOSITORY IMPLEMENTATIONS (You are here)        │      │
│  │  - Implement domain interfaces                    │      │
│  │  - Handle database access (Prisma, TypeORM, etc.) │      │
│  │  - Use infrastructure mappers                     │      │
│  │  - Dispatch domain events                         │      │
│  │  - Manage transactions                            │      │
│  │  - Handle errors (business vs infrastructure)    │      │
│  └───────────────────────┬───────────────────────────┘      │
│                          │ uses                             │
│  ┌──────────────────────▼────────────────────────────┐      │
│  │  Infrastructure Mappers                           │      │
│  │  - Domain ↔ Persistence conversion                │      │
│  └───────────────────────────────────────────────────┘      │
│                                                             │
│  Database (PostgreSQL, MySQL, MongoDB, etc.)                │
│  ORM/Query Builder (Prisma, TypeORM, Knex, etc.)            │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Rules:

✅ **Repository Implementations CAN depend on:**

- Domain repository interfaces (implements them)
- Domain entities and aggregates (to return them)
- Domain value objects (to work with them)
- Infrastructure mappers (for conversion)
- ORM/Database libraries (Prisma, TypeORM, etc.)
- Domain event dispatcher (infrastructure)
- Shared kernel types (Result<T>, Guard, etc.)

❌ **Repository Implementations CANNOT depend on:**

- Use cases or application services
- Presentation layer (controllers, DTOs)
- Other repository implementations (direct coupling)
- Application mappers (wrong layer)

---

## 5. Repository Implementation Lifecycle

### Instantiation Flow:

```typescript
// 1. Infrastructure layer creates concrete implementation
const prismaClient = new PrismaClient();
const networkDeviceRepository = new PrismaNetworkDeviceRepository(prismaClient);

// 2. Dependency injection container registers implementation against interface
container.register<INetworkDeviceRepository>(
  'NetworkDeviceRepository',
  { useValue: networkDeviceRepository }
);

// 3. Use case receives interface (not implementation)
class CreateNetworkDeviceUseCase {
  constructor(
    private deviceRepo: INetworkDeviceRepository // Interface!
  ) {}
}

// 4. Use case calls interface methods
const saveResult = await this.deviceRepo.save(device);

// 5. Infrastructure implementation executes
// - Maps domain to persistence
// - Executes database operation
// - Maps persistence back to domain
// - Dispatches events
// - Returns Result<T> or throws
```

### Lifecycle Characteristics:

1. **Long-lived**: Typically singleton per application instance
2. **Stateless**: No state between method calls (uses database as state)
3. **Thread-safe**: Must handle concurrent access safely
4. **Connection Management**: Manages database connection lifecycle
5. **Transaction Scope**: Each method call can be a transaction
6. **Event Dispatching**: Triggers events after successful persistence

---

## 6. Repository Implementation Structure Template

### Basic Repository Implementation Template:

```typescript
import { PrismaClient } from '@prisma/client';
import { Result } from '@/shared/core/Result';
import { INetworkDeviceRepository } from '@/domain/repositories/INetworkDeviceRepository';
import {
  NetworkDevice,
  NetworkDeviceId
} from '@/domain/aggregates/NetworkDevice';
import { NetworkDeviceMapper } from '@/infrastructure/mappers/NetworkDeviceMapper';
import { DomainEvents } from '@/domain/events/DomainEvents';
import { InfrastructureException } from '@/infrastructure/exceptions/InfrastructureException';

/**
 * Prisma implementation of INetworkDeviceRepository.
 *
 * Responsibilities:
 * - Persist and retrieve NetworkDevice aggregates
 * - Map between domain and Prisma models
 * - Handle database transactions
 * - Dispatch domain events after successful saves
 * - Classify errors: business errors return Result.fail(), infrastructure errors throw
 *
 * Infrastructure Concerns:
 * - Uses Prisma ORM for database access
 * - Manages database connections and transactions
 * - Handles Prisma-specific error codes
 */
export class PrismaNetworkDeviceRepository implements INetworkDeviceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Saves a network device (create or update).
   * Returns Result.fail() for business constraint violations.
   * Throws InfrastructureException for database failures.
   *
   * @param device - Network device aggregate to save
   * @returns Result<NetworkDevice> - Saved device or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  public async save(device: NetworkDevice): Promise<Result<NetworkDevice>> {
    try {
      // Check if device already exists
      const exists = await this.prisma.networkDevice.findUnique({
        where: { id: device.id.toString() }
      });

      // Map domain aggregate to persistence model
      const persistenceData = NetworkDeviceMapper.toPersistence(device);

      if (exists) {
        // Update existing device
        await this.prisma.networkDevice.update({
          where: { id: device.id.toString() },
          data: persistenceData
        });
      } else {
        // Create new device
        await this.prisma.networkDevice.create({
          data: persistenceData
        });
      }

      // Dispatch domain events AFTER successful database operation
      await DomainEvents.dispatchEventsForAggregate(device.id);

      return Result.ok<NetworkDevice>(device);
    } catch (error: any) {
      // Classify error type

      // Business Error: Unique constraint violation (duplicate IP/MAC)
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'field';
        return Result.fail<NetworkDevice>(
          `Device with ${field} already exists`
        );
      }

      // Business Error: Foreign key violation
      if (error.code === 'P2003') {
        return Result.fail<NetworkDevice>(
          'Referenced entity does not exist'
        );
      }

      // Infrastructure Error: All other errors
      throw new InfrastructureException(
        'Database error while saving network device',
        error
      );
    }
  }

  /**
   * Finds a device by its unique identifier.
   * Returns null if not found (valid business scenario).
   * Throws InfrastructureException for database failures.
   *
   * @param id - Device ID
   * @returns Result<NetworkDevice | null> - Device, null, or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  public async findById(
    id: NetworkDeviceId
  ): Promise<Result<NetworkDevice | null>> {
    try {
      // Query database with full aggregate (includes children)
      const deviceData = await this.prisma.networkDevice.findUnique({
        where: { id: id.toString() },
        include: {
          pollingConfiguration: true // Load child entity
        }
      });

      // Not found is a valid scenario - return ok(null)
      if (!deviceData) {
        return Result.ok<NetworkDevice | null>(null);
      }

      // Map persistence model to domain aggregate
      const deviceOrError = NetworkDeviceMapper.toDomain(deviceData);

      if (deviceOrError.isFailure) {
        // Business Error: Data mapping failed (corrupted data)
        return Result.fail<NetworkDevice>(
          `Failed to map device: ${deviceOrError.error}`
        );
      }

      return Result.ok<NetworkDevice>(deviceOrError.value);
    } catch (error: any) {
      // Infrastructure Error: Database connection, timeout, etc.
      throw new InfrastructureException(
        'Database error while finding network device',
        error
      );
    }
  }

  /**
   * Finds all devices with optional pagination.
   * Returns empty array if none found (valid scenario).
   *
   * @param limit - Maximum results
   * @param offset - Results to skip
   * @returns Result<NetworkDevice[]> - Devices or error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  public async findAll(
    limit: number = 20,
    offset: number = 0
  ): Promise<Result<NetworkDevice[]>> {
    try {
      const devicesData = await this.prisma.networkDevice.findMany({
        skip: offset,
        take: limit,
        include: {
          pollingConfiguration: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Empty array is valid - not an error
      if (devicesData.length === 0) {
        return Result.ok<NetworkDevice[]>([]);
      }

      // Map all devices to domain
      const devices: NetworkDevice[] = [];
      for (const deviceData of devicesData) {
        const deviceOrError = NetworkDeviceMapper.toDomain(deviceData);

        if (deviceOrError.isFailure) {
          // Business Error: Data corruption
          return Result.fail<NetworkDevice[]>(
            `Failed to map device ${deviceData.id}: ${deviceOrError.error}`
          );
        }

        devices.push(deviceOrError.value);
      }

      return Result.ok<NetworkDevice[]>(devices);
    } catch (error: any) {
      // Infrastructure Error
      throw new InfrastructureException(
        'Database error while finding all network devices',
        error
      );
    }
  }

  /**
   * Deletes a device by ID.
   * Cascade deletes related entities (polling configuration).
   *
   * @param id - Device ID
   * @returns Result<void> - Success or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  public async delete(id: NetworkDeviceId): Promise<Result<void>> {
    try {
      // Check if device exists
      const exists = await this.prisma.networkDevice.findUnique({
        where: { id: id.toString() }
      });

      if (!exists) {
        // Business decision: Return failure if device doesn't exist
        return Result.fail<void>('Device not found');
      }

      // Delete device (cascade deletes children due to DB constraints)
      await this.prisma.networkDevice.delete({
        where: { id: id.toString() }
      });

      return Result.ok<void>();
    } catch (error: any) {
      // Infrastructure Error
      throw new InfrastructureException(
        'Database error while deleting network device',
        error
      );
    }
  }

  /**
   * Checks if a device exists with given ID.
   *
   * @param id - Device ID
   * @returns Result<boolean> - True if exists
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  public async exists(id: NetworkDeviceId): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.networkDevice.count({
        where: { id: id.toString() }
      });

      return Result.ok<boolean>(count > 0);
    } catch (error: any) {
      // Infrastructure Error
      throw new InfrastructureException(
        'Database error while checking device existence',
        error
      );
    }
  }

  /**
   * Checks if an IP address is already in use.
   *
   * @param ipAddress - IP address value object
   * @returns Result<boolean> - True if in use
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  public async existsByIpAddress(
    ipAddress: IPAddress
  ): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.networkDevice.count({
        where: { ipAddress: ipAddress.toString() }
      });

      return Result.ok<boolean>(count > 0);
    } catch (error: any) {
      // Infrastructure Error
      throw new InfrastructureException(
        'Database error while checking IP address',
        error
      );
    }
  }

  /**
   * Counts total devices.
   *
   * @returns Result<number> - Device count
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  public async count(): Promise<Result<number>> {
    try {
      const count = await this.prisma.networkDevice.count();

      return Result.ok<number>(count);
    } catch (error: any) {
      // Infrastructure Error
      throw new InfrastructureException(
        'Database error while counting devices',
        error
      );
    }
  }
}
```

### Repository with Transaction Support:

```typescript
export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Saves an order within a transaction.
   * If transaction is provided, uses it; otherwise creates new transaction.
   */
  public async save(
    order: Order,
    transaction?: PrismaTransaction
  ): Promise<Result<Order>> {
    const prismaClient = transaction || this.prisma;

    try {
      const orderData = OrderMapper.toPersistence(order);

      // Use transaction-aware client
      const savedOrder = await prismaClient.order.upsert({
        where: { id: order.id.toString() },
        update: orderData,
        create: orderData,
        include: {
          items: true,
          payment: true
        }
      });

      // Only dispatch events if not in transaction
      // (Transaction owner will dispatch after commit)
      if (!transaction) {
        await DomainEvents.dispatchEventsForAggregate(order.id);
      }

      return Result.ok<Order>(order);
    } catch (error: any) {
      // Classify errors...
      if (error.code === 'P2002') {
        return Result.fail<Order>('Order number already exists');
      }

      throw new InfrastructureException(
        'Database error while saving order',
        error
      );
    }
  }

  /**
   * Executes multiple operations in a single transaction.
   */
  public async saveMultiple(orders: Order[]): Promise<Result<void>> {
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const order of orders) {
          const saveResult = await this.save(order, tx);
          if (saveResult.isFailure) {
            throw new Error(saveResult.error); // Rollback transaction
          }
        }

        // Dispatch events for all orders after transaction commits
        for (const order of orders) {
          await DomainEvents.dispatchEventsForAggregate(order.id);
        }
      });

      return Result.ok<void>();
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        return Result.fail<void>(error.message);
      }

      throw new InfrastructureException(
        'Database error while saving multiple orders',
        error
      );
    }
  }
}
```

---

## 7. Orthogonality Principles

### 1. Single Aggregate Focus

Each repository handles exactly one aggregate type:

```typescript
// ✅ GOOD - Repository handles one aggregate
export class PrismaNetworkDeviceRepository implements INetworkDeviceRepository {
  // Only NetworkDevice operations
  async save(device: NetworkDevice): Promise<Result<NetworkDevice>> {}
  async findById(id: NetworkDeviceId): Promise<Result<NetworkDevice | null>> {}
}

// ❌ BAD - Repository handles multiple aggregates
export class PrismaDeviceAndResultRepository {
  async saveDevice(device: NetworkDevice): Promise<Result<NetworkDevice>> {}
  async saveResult(result: PollingResult): Promise<Result<PollingResult>> {}
  // Mixing different aggregates!
}
```

### 2. Domain Model Independence

Implementation changes don't affect domain model:

```typescript
// ✅ GOOD - Domain doesn't know about Prisma
export class PrismaNetworkDeviceRepository implements INetworkDeviceRepository {
  private prisma: PrismaClient; // Infrastructure detail

  async save(device: NetworkDevice): Promise<Result<NetworkDevice>> {
    // Convert to Prisma model internally
    const prismaData = NetworkDeviceMapper.toPersistence(device);
    // Domain knows nothing about this
  }
}

// ❌ BAD - Exposing infrastructure to domain
export class PrismaNetworkDeviceRepository implements INetworkDeviceRepository {
  async save(device: NetworkDevice): Promise<Result<PrismaNetworkDevice>> {
    // Returns Prisma type - leaks infrastructure!
  }
}
```

### 3. Mapper Responsibility Separation

Repository uses mappers, doesn't contain mapping logic:

```typescript
// ✅ GOOD - Repository delegates to mapper
export class PrismaNetworkDeviceRepository implements INetworkDeviceRepository {
  async findById(id: NetworkDeviceId): Promise<Result<NetworkDevice | null>> {
    const data = await this.prisma.networkDevice.findUnique({...});

    if (!data) return Result.ok(null);

    // Mapper handles conversion
    return NetworkDeviceMapper.toDomain(data);
  }
}

// ❌ BAD - Repository contains mapping logic
export class PrismaNetworkDeviceRepository implements INetworkDeviceRepository {
  async findById(id: NetworkDeviceId): Promise<Result<NetworkDevice | null>> {
    const data = await this.prisma.networkDevice.findUnique({...});

    if (!data) return Result.ok(null);

    // Inline mapping - should be in mapper!
    const ipAddress = IPAddress.create(data.ipAddress).value;
    const macAddress = MACAddress.create(data.macAddress).value;
    const device = NetworkDevice.create({...});
    // Repository shouldn't know domain object construction
  }
}
```

### Stability Under Change

Good repository implementations remain stable when:

- Database schema changes (only mapper updates needed)
- ORM library is replaced (only implementation changes)
- Domain model evolves (interface may change, but pattern stays same)
- Caching strategy changes (add caching layer without changing core logic)
- New query requirements (add new methods following same patterns)

---

## 8. Naming Conventions

### Class Names:

**Pattern:** `[ORM/DB Name][AggregateName]Repository`

```typescript
// ✅ GOOD
export class PrismaNetworkDeviceRepository implements INetworkDeviceRepository {}
export class PrismaOrderRepository implements IOrderRepository {}
export class TypeORMCustomerRepository implements ICustomerRepository {}
export class MongoDBProductRepository implements IProductRepository {}

// ❌ BAD
export class NetworkDeviceRepositoryImpl {} // Generic "Impl" suffix
export class DeviceRepo {} // Abbreviated
export class PrismaRepository {} // Missing aggregate name
export class NetworkDeviceRepository {} // Missing technology prefix
```

### File Names:

**Pattern:** `[ORM][AggregateName]Repository.ts`

```
✅ GOOD
src/infrastructure/persistence/repositories/PrismaNetworkDeviceRepository.ts
src/infrastructure/persistence/repositories/PrismaOrderRepository.ts
src/infrastructure/repositories/TypeORMCustomerRepository.ts

❌ BAD
src/infrastructure/NetworkDeviceRepository.ts // Missing "Prisma" prefix
src/infrastructure/repositories/device-repository.ts // kebab-case
src/repositories/PrismaNetworkDeviceRepository.ts // Wrong directory
```

### Method Names:

Follow the interface exactly - no deviation:

```typescript
// ✅ GOOD - Exact interface implementation
export class PrismaNetworkDeviceRepository implements INetworkDeviceRepository {
  // Interface defines: save
  async save(device: NetworkDevice): Promise<Result<NetworkDevice>> {}

  // Interface defines: findById
  async findById(id: NetworkDeviceId): Promise<Result<NetworkDevice | null>> {}

  // Interface defines: delete
  async delete(id: NetworkDeviceId): Promise<Result<void>> {}
}

// ❌ BAD - Different method names
export class PrismaNetworkDeviceRepository implements INetworkDeviceRepository {
  // Interface says "save", implementation says "persist"
  async persist(device: NetworkDevice): Promise<Result<NetworkDevice>> {}

  // Interface says "findById", implementation says "getById"
  async getById(id: NetworkDeviceId): Promise<Result<NetworkDevice | null>> {}
}
```

### Private Helper Methods:

```typescript
export class PrismaOrderRepository implements IOrderRepository {
  // ✅ Public methods - follow interface
  async save(order: Order): Promise<Result<Order>> {
    return this.executeInTransaction(async (tx) => {
      // ...
    });
  }

  // ✅ Private helpers - use descriptive names
  private async executeInTransaction<T>(
    operation: (tx: PrismaTransaction) => Promise<T>
  ): Promise<T> {
    // Transaction wrapper
  }

  private async loadOrderItems(orderId: string): Promise<OrderItemData[]> {
    // Helper query
  }

  private classifyError(error: any): 'business' | 'infrastructure' {
    // Error classification logic
  }
}
```

---

## 9. Error Handling Strategy

### Dual Error-Handling Model

Repository implementations MUST distinguish between two types of failures:

#### Business/Domain Errors → Return `Result.fail()`

These are **expected** errors that are part of normal business operations:

```typescript
export class PrismaNetworkDeviceRepository implements INetworkDeviceRepository {
  async save(device: NetworkDevice): Promise<Result<NetworkDevice>> {
    try {
      // ... save logic ...
    } catch (error: any) {
      // ✅ Business Error: Unique constraint violation
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'field';
        return Result.fail<NetworkDevice>(
          `Device with ${field} already exists`
        );
      }

      // ✅ Business Error: Foreign key violation
      if (error.code === 'P2003') {
        const field = error.meta?.field_name || 'reference';
        return Result.fail<NetworkDevice>(
          `Referenced ${field} does not exist`
        );
      }

      // ✅ Business Error: Check constraint violation
      if (error.code === 'P2004') {
        return Result.fail<NetworkDevice>(
          'Data violates database constraints'
        );
      }

      // Infrastructure error - throw (see below)
      throw new InfrastructureException('Database error', error);
    }
  }
}
```

**Common Prisma Error Codes (Business Errors):**

| Code   | Meaning                      | Action                   |
| ------ | ---------------------------- | ------------------------ |
| P2002  | Unique constraint violation  | Return `Result.fail()`   |
| P2003  | Foreign key constraint fail  | Return `Result.fail()`   |
| P2004  | Constraint failed on DB      | Return `Result.fail()`   |
| P2025  | Record not found (delete)    | Return `Result.fail()`   |

#### Infrastructure Errors → Throw Exceptions

These are **unexpected** system-level failures:

```typescript
export class PrismaNetworkDeviceRepository implements INetworkDeviceRepository {
  async findById(
    id: NetworkDeviceId
  ): Promise<Result<NetworkDevice | null>> {
    try {
      const data = await this.prisma.networkDevice.findUnique({...});
      // ... mapping logic ...
    } catch (error: any) {
      // ❌ Infrastructure Error: Connection errors
      if (error.code === 'P1001') {
        throw new InfrastructureException(
          'Cannot connect to database server',
          error
        );
      }

      // ❌ Infrastructure Error: Timeout
      if (error.code === 'P1008') {
        throw new InfrastructureException(
          'Database operation timed out',
          error
        );
      }

      // ❌ Infrastructure Error: Authentication failed
      if (error.code === 'P1000') {
        throw new InfrastructureException(
          'Database authentication failed',
          error
        );
      }

      // ❌ Infrastructure Error: Unknown/unexpected errors
      throw new InfrastructureException(
        'Unexpected database error while finding device',
        error
      );
    }
  }
}
```

**Common Prisma Error Codes (Infrastructure Errors):**

| Code   | Meaning                   | Action                      |
| ------ | ------------------------- | --------------------------- |
| P1000  | Authentication failed     | Throw exception             |
| P1001  | Cannot reach DB server    | Throw exception             |
| P1002  | DB server unreachable     | Throw exception             |
| P1008  | Operations timed out      | Throw exception             |
| P1009  | Database doesn't exist    | Throw exception             |
| P1010  | Access denied             | Throw exception             |

### Error Classification Helper:

```typescript
export class PrismaNetworkDeviceRepository implements INetworkDeviceRepository {
  /**
   * Classifies Prisma errors into business vs infrastructure.
   * Returns appropriate Result or throws exception.
   */
  private handlePrismaError<T>(
    error: any,
    context: string
  ): Result<T> | never {
    // Business errors - return Result.fail()
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'field';
      return Result.fail<T>(`${field} already exists`);
    }

    if (error.code === 'P2003') {
      return Result.fail<T>('Referenced entity does not exist');
    }

    if (error.code === 'P2004') {
      return Result.fail<T>('Data violates constraints');
    }

    if (error.code === 'P2025') {
      return Result.fail<T>('Record not found');
    }

    // Infrastructure errors - throw exception
    throw new InfrastructureException(
      `${context}: ${error.message}`,
      error
    );
  }

  // Usage
  async save(device: NetworkDevice): Promise<Result<NetworkDevice>> {
    try {
      // ... database operations ...
      return Result.ok(device);
    } catch (error: any) {
      return this.handlePrismaError<NetworkDevice>(
        error,
        'Error saving network device'
      );
    }
  }
}
```

### Data Mapping Errors:

```typescript
async findById(id: NetworkDeviceId): Promise<Result<NetworkDevice | null>> {
  try {
    const data = await this.prisma.networkDevice.findUnique({...});

    if (!data) return Result.ok(null);

    // Map to domain
    const deviceOrError = NetworkDeviceMapper.toDomain(data);

    if (deviceOrError.isFailure) {
      // ✅ Business Error: Corrupted data in database
      return Result.fail<NetworkDevice>(
        `Failed to map device data: ${deviceOrError.error}`
      );
    }

    return Result.ok(deviceOrError.value);
  } catch (error: any) {
    // ❌ Infrastructure Error
    throw new InfrastructureException(
      'Database error while finding device',
      error
    );
  }
}
```

---

## 10. Transaction Management

### Pattern 1: Auto-Transaction (Simple Operations)

Most operations are naturally transactional:

```typescript
export class PrismaNetworkDeviceRepository implements INetworkDeviceRepository {
  async save(device: NetworkDevice): Promise<Result<NetworkDevice>> {
    try {
      // Single operation - Prisma handles transaction automatically
      await this.prisma.networkDevice.upsert({
        where: { id: device.id.toString() },
        update: { ...updateData },
        create: { ...createData }
      });

      await DomainEvents.dispatchEventsForAggregate(device.id);
      return Result.ok(device);
    } catch (error: any) {
      return this.handlePrismaError(error, 'saving device');
    }
  }
}
```

### Pattern 2: Explicit Transaction (Multiple Operations)

For operations requiring multiple database calls:

```typescript
export class PrismaOrderRepository implements IOrderRepository {
  async save(order: Order): Promise<Result<Order>> {
    try {
      // Explicit transaction for multiple operations
      await this.prisma.$transaction(async (tx) => {
        // Save order
        await tx.order.upsert({
          where: { id: order.id.toString() },
          update: { ...orderData },
          create: { ...orderData }
        });

        // Delete existing items
        await tx.orderItem.deleteMany({
          where: { orderId: order.id.toString() }
        });

        // Create new items
        for (const item of order.items) {
          await tx.orderItem.create({
            data: OrderItemMapper.toPersistence(item)
          });
        }

        // Update payment
        await tx.payment.upsert({
          where: { orderId: order.id.toString() },
          update: { ...paymentData },
          create: { ...paymentData }
        });
      });

      // Events dispatched AFTER transaction commits
      await DomainEvents.dispatchEventsForAggregate(order.id);

      return Result.ok(order);
    } catch (error: any) {
      return this.handlePrismaError(error, 'saving order');
    }
  }
}
```

### Pattern 3: Transaction Context (Use Case Controls Transaction)

When use case needs to control transaction across multiple repositories:

```typescript
// Repository accepts optional transaction
export class PrismaOrderRepository implements IOrderRepository {
  async save(
    order: Order,
    tx?: PrismaTransaction
  ): Promise<Result<Order>> {
    const client = tx || this.prisma;

    try {
      await client.order.upsert({...});

      // Only dispatch events if NOT in a transaction
      // (caller will dispatch after transaction commits)
      if (!tx) {
        await DomainEvents.dispatchEventsForAggregate(order.id);
      }

      return Result.ok(order);
    } catch (error: any) {
      return this.handlePrismaError(error, 'saving order');
    }
  }
}

// Use case manages transaction
export class PlaceOrderUseCase {
  async execute(request: PlaceOrderRequest): Promise<Result<Order>> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Create order
        const orderResult = await this.orderRepo.save(order, tx);
        if (orderResult.isFailure) throw new Error(orderResult.error);

        // Update inventory
        const inventoryResult = await this.inventoryRepo.decreaseStock(
          items,
          tx
        );
        if (inventoryResult.isFailure) throw new Error(inventoryResult.error);

        // Dispatch events after transaction commits
        await DomainEvents.dispatchEventsForAggregate(order.id);

        return Result.ok(order);
      });
    } catch (error: any) {
      return Result.fail(`Failed to place order: ${error.message}`);
    }
  }
}
```

### Transaction Best Practices:

1. **Keep Transactions Short**
   - Only include necessary operations
   - Avoid long-running queries in transactions
   - Release locks quickly

2. **One Aggregate Per Transaction (Typically)**
   - Most operations = single aggregate = single transaction
   - Cross-aggregate operations need careful consideration

3. **Dispatch Events After Commit**
   - Never dispatch before transaction completes
   - Ensures consistency between DB and events

4. **Handle Rollbacks Gracefully**
   - Let Prisma handle rollback automatically
   - Don't dispatch events if transaction fails

---

## 11. Domain Event Dispatching

### When to Dispatch Events

Domain events are dispatched **AFTER** successful database operations:

```typescript
export class PrismaNetworkDeviceRepository implements INetworkDeviceRepository {
  async save(device: NetworkDevice): Promise<Result<NetworkDevice>> {
    try {
      // 1. Perform database operation
      await this.prisma.networkDevice.upsert({...});

      // 2. Dispatch events ONLY after successful database commit
      await DomainEvents.dispatchEventsForAggregate(device.id);

      return Result.ok(device);
    } catch (error: any) {
      // If database fails, events are NOT dispatched
      return this.handlePrismaError(error, 'saving device');
    }
  }
}
```

### Event Dispatching Pattern:

```typescript
import { DomainEvents } from '@/domain/events/DomainEvents';

export class PrismaNetworkDeviceRepository implements INetworkDeviceRepository {
  /**
   * Dispatches domain events for an aggregate.
   * Called after successful persistence.
   */
  private async dispatchEventsForAggregate(
    aggregateId: NetworkDeviceId
  ): Promise<void> {
    try {
      await DomainEvents.dispatchEventsForAggregate(aggregateId);
    } catch (error) {
      // Log event dispatching failures but don't fail the operation
      // Database operation succeeded, event handlers might retry
      console.error(
        `Failed to dispatch events for aggregate ${aggregateId}:`,
        error
      );
    }
  }

  async save(device: NetworkDevice): Promise<Result<NetworkDevice>> {
    try {
      await this.prisma.networkDevice.upsert({...});

      // Dispatch events
      await this.dispatchEventsForAggregate(device.id);

      return Result.ok(device);
    } catch (error: any) {
      return this.handlePrismaError(error, 'saving device');
    }
  }
}
```

### Event Dispatching in Transactions:

```typescript
export class PrismaOrderRepository implements IOrderRepository {
  /**
   * Save with optional transaction context.
   * If transaction provided, events are NOT dispatched (caller's responsibility).
   * If no transaction, events dispatched immediately.
   */
  async save(
    order: Order,
    tx?: PrismaTransaction
  ): Promise<Result<Order>> {
    const client = tx || this.prisma;

    try {
      await client.order.upsert({...});

      // Only dispatch if NOT in transaction
      if (!tx) {
        await DomainEvents.dispatchEventsForAggregate(order.id);
      }

      return Result.ok(order);
    } catch (error: any) {
      return this.handlePrismaError(error, 'saving order');
    }
  }
}

// Caller (use case) dispatches after transaction commits
await this.prisma.$transaction(async (tx) => {
  await this.orderRepo.save(order, tx);
  await this.paymentRepo.save(payment, tx);

  // After transaction commits, dispatch events
  await DomainEvents.dispatchEventsForAggregate(order.id);
  await DomainEvents.dispatchEventsForAggregate(payment.id);
});
```

### Event Dispatching Best Practices:

1. **After Database Commit Only**
   - Never dispatch before persistence succeeds
   - Ensures database and events stay consistent

2. **Transaction-Aware**
   - Skip dispatching if in transaction
   - Let transaction owner dispatch after commit

3. **Handle Failures Gracefully**
   - Log event dispatch failures
   - Don't fail the database operation
   - Consider retry mechanisms

4. **One Aggregate ID at a Time**
   - Dispatch events for single aggregate
   - Don't mix events from multiple aggregates

---

## 12. Testing Strategy

### Test Structure:

Repository implementations require **integration tests** (with real database):

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaNetworkDeviceRepository } from '@/infrastructure/repositories/PrismaNetworkDeviceRepository';
import { NetworkDevice, NetworkDeviceId } from '@/domain/aggregates/NetworkDevice';
import { IPAddress } from '@/domain/value-objects/IPAddress';
import { MACAddress } from '@/domain/value-objects/MACAddress';

describe('PrismaNetworkDeviceRepository (Integration)', () => {
  let prisma: PrismaClient;
  let repository: PrismaNetworkDeviceRepository;

  beforeAll(async () => {
    // Setup test database connection
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL
        }
      }
    });

    repository = new PrismaNetworkDeviceRepository(prisma);

    // Connect and run migrations
    await prisma.$connect();
  });

  afterAll(async () => {
    // Cleanup and disconnect
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean database before each test
    await prisma.networkDevice.deleteMany();
    await prisma.pollingConfiguration.deleteMany();
  });

  describe('save', () => {
    describe('when creating new device', () => {
      it('should persist device to database', async () => {
        // Arrange
        const ipAddress = IPAddress.create('192.168.1.100').value;
        const macAddress = MACAddress.create('00:11:22:33:44:55').value;

        const deviceResult = NetworkDevice.create({
          name: 'Test Device',
          ipAddress,
          macAddress,
          deviceType: 'ROUTER'
        });

        expect(deviceResult.isSuccess).toBe(true);
        const device = deviceResult.value;

        // Act
        const saveResult = await repository.save(device);

        // Assert
        expect(saveResult.isSuccess).toBe(true);

        // Verify in database
        const dbDevice = await prisma.networkDevice.findUnique({
          where: { id: device.id.toString() }
        });

        expect(dbDevice).toBeDefined();
        expect(dbDevice?.name).toBe('Test Device');
        expect(dbDevice?.ipAddress).toBe('192.168.1.100');
        expect(dbDevice?.macAddress).toBe('00:11:22:33:44:55');
      });

      it('should fail with duplicate IP address', async () => {
        // Arrange - Create first device
        const device1 = NetworkDevice.create({
          name: 'Device 1',
          ipAddress: IPAddress.create('192.168.1.100').value,
          macAddress: MACAddress.create('00:11:22:33:44:55').value,
          deviceType: 'ROUTER'
        }).value;

        await repository.save(device1);

        // Create second device with same IP
        const device2 = NetworkDevice.create({
          name: 'Device 2',
          ipAddress: IPAddress.create('192.168.1.100').value, // Same IP!
          macAddress: MACAddress.create('00:11:22:33:44:66').value,
          deviceType: 'SWITCH'
        }).value;

        // Act
        const saveResult = await repository.save(device2);

        // Assert - Business error, not exception
        expect(saveResult.isFailure).toBe(true);
        expect(saveResult.error).toContain('already exists');
      });
    });

    describe('when updating existing device', () => {
      it('should update device in database', async () => {
        // Arrange - Create device
        const device = NetworkDevice.create({
          name: 'Original Name',
          ipAddress: IPAddress.create('192.168.1.100').value,
          macAddress: MACAddress.create('00:11:22:33:44:55').value,
          deviceType: 'ROUTER'
        }).value;

        await repository.save(device);

        // Update device
        const updateResult = device.updateName('Updated Name');
        expect(updateResult.isSuccess).toBe(true);

        // Act - Save updated device
        const saveResult = await repository.save(device);

        // Assert
        expect(saveResult.isSuccess).toBe(true);

        // Verify in database
        const dbDevice = await prisma.networkDevice.findUnique({
          where: { id: device.id.toString() }
        });

        expect(dbDevice?.name).toBe('Updated Name');
      });
    });
  });

  describe('findById', () => {
    it('should return device if exists', async () => {
      // Arrange - Create device
      const device = NetworkDevice.create({
        name: 'Test Device',
        ipAddress: IPAddress.create('192.168.1.100').value,
        macAddress: MACAddress.create('00:11:22:33:44:55').value,
        deviceType: 'ROUTER'
      }).value;

      await repository.save(device);

      // Act
      const findResult = await repository.findById(device.id);

      // Assert
      expect(findResult.isSuccess).toBe(true);
      expect(findResult.value).not.toBeNull();
      expect(findResult.value?.id.equals(device.id)).toBe(true);
      expect(findResult.value?.name).toBe('Test Device');
    });

    it('should return null if device does not exist', async () => {
      // Arrange
      const nonExistentId = NetworkDeviceId.create();

      // Act
      const findResult = await repository.findById(nonExistentId);

      // Assert
      expect(findResult.isSuccess).toBe(true);
      expect(findResult.value).toBeNull();
    });

    it('should load complete aggregate with children', async () => {
      // Arrange - Create device with polling configuration
      const device = NetworkDevice.create({
        name: 'Test Device',
        ipAddress: IPAddress.create('192.168.1.100').value,
        macAddress: MACAddress.create('00:11:22:33:44:55').value,
        deviceType: 'ROUTER'
      }).value;

      device.configurePolling({
        enabled: true,
        interval: 60
      });

      await repository.save(device);

      // Act
      const findResult = await repository.findById(device.id);

      // Assert
      expect(findResult.isSuccess).toBe(true);
      expect(findResult.value?.pollingConfiguration).toBeDefined();
      expect(findResult.value?.pollingConfiguration.enabled).toBe(true);
    });
  });

  describe('findAll', () => {
    it('should return all devices', async () => {
      // Arrange - Create multiple devices
      const device1 = NetworkDevice.create({
        name: 'Device 1',
        ipAddress: IPAddress.create('192.168.1.1').value,
        macAddress: MACAddress.create('00:11:22:33:44:55').value,
        deviceType: 'ROUTER'
      }).value;

      const device2 = NetworkDevice.create({
        name: 'Device 2',
        ipAddress: IPAddress.create('192.168.1.2').value,
        macAddress: MACAddress.create('00:11:22:33:44:66').value,
        deviceType: 'SWITCH'
      }).value;

      await repository.save(device1);
      await repository.save(device2);

      // Act
      const findResult = await repository.findAll();

      // Assert
      expect(findResult.isSuccess).toBe(true);
      expect(findResult.value).toHaveLength(2);
    });

    it('should return empty array if no devices', async () => {
      // Act
      const findResult = await repository.findAll();

      // Assert
      expect(findResult.isSuccess).toBe(true);
      expect(findResult.value).toEqual([]);
    });

    it('should support pagination', async () => {
      // Arrange - Create 5 devices
      for (let i = 1; i <= 5; i++) {
        const device = NetworkDevice.create({
          name: `Device ${i}`,
          ipAddress: IPAddress.create(`192.168.1.${i}`).value,
          macAddress: MACAddress.create(`00:11:22:33:44:${i}${i}`).value,
          deviceType: 'ROUTER'
        }).value;

        await repository.save(device);
      }

      // Act - Get second page (limit=2, offset=2)
      const findResult = await repository.findAll(2, 2);

      // Assert
      expect(findResult.isSuccess).toBe(true);
      expect(findResult.value).toHaveLength(2);
    });
  });

  describe('delete', () => {
    it('should delete device from database', async () => {
      // Arrange
      const device = NetworkDevice.create({
        name: 'Test Device',
        ipAddress: IPAddress.create('192.168.1.100').value,
        macAddress: MACAddress.create('00:11:22:33:44:55').value,
        deviceType: 'ROUTER'
      }).value;

      await repository.save(device);

      // Act
      const deleteResult = await repository.delete(device.id);

      // Assert
      expect(deleteResult.isSuccess).toBe(true);

      // Verify deletion
      const dbDevice = await prisma.networkDevice.findUnique({
        where: { id: device.id.toString() }
      });

      expect(dbDevice).toBeNull();
    });

    it('should fail if device does not exist', async () => {
      // Arrange
      const nonExistentId = NetworkDeviceId.create();

      // Act
      const deleteResult = await repository.delete(nonExistentId);

      // Assert
      expect(deleteResult.isFailure).toBe(true);
      expect(deleteResult.error).toContain('not found');
    });

    it('should cascade delete child entities', async () => {
      // Arrange - Create device with polling configuration
      const device = NetworkDevice.create({
        name: 'Test Device',
        ipAddress: IPAddress.create('192.168.1.100').value,
        macAddress: MACAddress.create('00:11:22:33:44:55').value,
        deviceType: 'ROUTER'
      }).value;

      device.configurePolling({ enabled: true, interval: 60 });
      await repository.save(device);

      // Act - Delete device
      await repository.delete(device.id);

      // Assert - Polling configuration also deleted
      const dbConfig = await prisma.pollingConfiguration.findUnique({
        where: { deviceId: device.id.toString() }
      });

      expect(dbConfig).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true if device exists', async () => {
      // Arrange
      const device = NetworkDevice.create({
        name: 'Test Device',
        ipAddress: IPAddress.create('192.168.1.100').value,
        macAddress: MACAddress.create('00:11:22:33:44:55').value,
        deviceType: 'ROUTER'
      }).value;

      await repository.save(device);

      // Act
      const existsResult = await repository.exists(device.id);

      // Assert
      expect(existsResult.isSuccess).toBe(true);
      expect(existsResult.value).toBe(true);
    });

    it('should return false if device does not exist', async () => {
      // Arrange
      const nonExistentId = NetworkDeviceId.create();

      // Act
      const existsResult = await repository.exists(nonExistentId);

      // Assert
      expect(existsResult.isSuccess).toBe(true);
      expect(existsResult.value).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw InfrastructureException on connection failure', async () => {
      // Arrange - Disconnect database
      await prisma.$disconnect();

      const device = NetworkDevice.create({
        name: 'Test Device',
        ipAddress: IPAddress.create('192.168.1.100').value,
        macAddress: MACAddress.create('00:11:22:33:44:55').value,
        deviceType: 'ROUTER'
      }).value;

      // Act & Assert
      await expect(repository.save(device)).rejects.toThrow(
        InfrastructureException
      );

      // Cleanup - Reconnect
      await prisma.$connect();
    });
  });
});
```

### Test Coverage Requirements:

1. **CRUD Operations**:
   - Create (new entity)
   - Update (existing entity)
   - Read by ID
   - Read all (with pagination)
   - Delete
   - Exists

2. **Business Error Scenarios**:
   - Duplicate key violations
   - Foreign key violations
   - Not found scenarios
   - Constraint violations

3. **Aggregate Loading**:
   - Complete aggregate with children
   - Nested relationships
   - Lazy vs eager loading

4. **Edge Cases**:
   - Empty results (valid scenario)
   - Null returns
   - Pagination boundaries

5. **Transaction Behavior**:
   - Multiple operations succeed together
   - Rollback on failure
   - Event dispatching after commit

6. **Infrastructure Errors** (if testable):
   - Connection failures
   - Timeout scenarios

---

## 13. Examples

### Example 1: Simple Repository (Basic CRUD)

```typescript
import { PrismaClient } from '@prisma/client';
import { Result } from '@/shared/core/Result';
import { ICustomerRepository } from '@/domain/repositories/ICustomerRepository';
import { Customer, CustomerId } from '@/domain/aggregates/Customer';
import { CustomerMapper } from '@/infrastructure/mappers/CustomerMapper';
import { DomainEvents } from '@/domain/events/DomainEvents';
import { InfrastructureException } from '@/infrastructure/exceptions/InfrastructureException';

/**
 * Prisma implementation of ICustomerRepository.
 * Simple repository with basic CRUD operations.
 */
export class PrismaCustomerRepository implements ICustomerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(customer: Customer): Promise<Result<Customer>> {
    try {
      const customerData = CustomerMapper.toPersistence(customer);

      await this.prisma.customer.upsert({
        where: { id: customer.id.toString() },
        update: customerData,
        create: customerData
      });

      await DomainEvents.dispatchEventsForAggregate(customer.id);

      return Result.ok(customer);
    } catch (error: any) {
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'field';
        return Result.fail<Customer>(`Customer ${field} already exists`);
      }

      throw new InfrastructureException(
        'Database error while saving customer',
        error
      );
    }
  }

  async findById(id: CustomerId): Promise<Result<Customer | null>> {
    try {
      const customerData = await this.prisma.customer.findUnique({
        where: { id: id.toString() }
      });

      if (!customerData) {
        return Result.ok<Customer | null>(null);
      }

      const customerOrError = CustomerMapper.toDomain(customerData);

      if (customerOrError.isFailure) {
        return Result.fail<Customer>(
          `Failed to map customer: ${customerOrError.error}`
        );
      }

      return Result.ok(customerOrError.value);
    } catch (error: any) {
      throw new InfrastructureException(
        'Database error while finding customer',
        error
      );
    }
  }

  async delete(id: CustomerId): Promise<Result<void>> {
    try {
      await this.prisma.customer.delete({
        where: { id: id.toString() }
      });

      return Result.ok<void>();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return Result.fail<void>('Customer not found');
      }

      throw new InfrastructureException(
        'Database error while deleting customer',
        error
      );
    }
  }

  async findByEmail(email: Email): Promise<Result<Customer | null>> {
    try {
      const customerData = await this.prisma.customer.findUnique({
        where: { email: email.value }
      });

      if (!customerData) {
        return Result.ok<Customer | null>(null);
      }

      return CustomerMapper.toDomain(customerData);
    } catch (error: any) {
      throw new InfrastructureException(
        'Database error while finding customer by email',
        error
      );
    }
  }
}
```

### Example 2: Repository with Complex Queries

```typescript
import { PrismaClient } from '@prisma/client';
import { Result } from '@/shared/core/Result';
import { IOrderRepository } from '@/domain/repositories/IOrderRepository';
import { Order, OrderId } from '@/domain/aggregates/Order';
import { CustomerId } from '@/domain/aggregates/Customer';
import { OrderStatus } from '@/domain/value-objects/OrderStatus';
import { OrderMapper } from '@/infrastructure/mappers/OrderMapper';
import { DomainEvents } from '@/domain/events/DomainEvents';
import { InfrastructureException } from '@/infrastructure/exceptions/InfrastructureException';

/**
 * Prisma implementation of IOrderRepository.
 * Handles complex aggregate with multiple children.
 */
export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(order: Order): Promise<Result<Order>> {
    try {
      // Use transaction for multiple operations
      await this.prisma.$transaction(async (tx) => {
        const orderData = OrderMapper.toPersistence(order);

        // Upsert order
        await tx.order.upsert({
          where: { id: order.id.toString() },
          update: {
            status: orderData.status,
            totalAmount: orderData.totalAmount,
            updatedAt: new Date()
          },
          create: orderData
        });

        // Delete existing items
        await tx.orderItem.deleteMany({
          where: { orderId: order.id.toString() }
        });

        // Create new items
        for (const item of orderData.items) {
          await tx.orderItem.create({
            data: {
              ...item,
              orderId: order.id.toString()
            }
          });
        }
      });

      await DomainEvents.dispatchEventsForAggregate(order.id);

      return Result.ok(order);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return Result.fail<Order>('Order number already exists');
      }

      throw new InfrastructureException(
        'Database error while saving order',
        error
      );
    }
  }

  async findById(id: OrderId): Promise<Result<Order | null>> {
    try {
      // Load complete aggregate with all children
      const orderData = await this.prisma.order.findUnique({
        where: { id: id.toString() },
        include: {
          items: {
            include: {
              product: true // Include nested data
            }
          },
          shippingAddress: true,
          payment: true
        }
      });

      if (!orderData) {
        return Result.ok<Order | null>(null);
      }

      return OrderMapper.toDomain(orderData);
    } catch (error: any) {
      throw new InfrastructureException(
        'Database error while finding order',
        error
      );
    }
  }

  async findByCustomerId(
    customerId: CustomerId
  ): Promise<Result<Order[]>> {
    try {
      const ordersData = await this.prisma.order.findMany({
        where: { customerId: customerId.toString() },
        include: {
          items: {
            include: { product: true }
          },
          shippingAddress: true,
          payment: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (ordersData.length === 0) {
        return Result.ok<Order[]>([]);
      }

      const orders: Order[] = [];
      for (const orderData of ordersData) {
        const orderOrError = OrderMapper.toDomain(orderData);

        if (orderOrError.isFailure) {
          return Result.fail<Order[]>(
            `Failed to map order ${orderData.id}: ${orderOrError.error}`
          );
        }

        orders.push(orderOrError.value);
      }

      return Result.ok(orders);
    } catch (error: any) {
      throw new InfrastructureException(
        'Database error while finding orders by customer',
        error
      );
    }
  }

  async findByStatus(status: OrderStatus): Promise<Result<Order[]>> {
    try {
      const ordersData = await this.prisma.order.findMany({
        where: { status: status.value },
        include: {
          items: { include: { product: true } },
          shippingAddress: true,
          payment: true
        }
      });

      const orders: Order[] = [];
      for (const orderData of ordersData) {
        const orderOrError = OrderMapper.toDomain(orderData);

        if (orderOrError.isFailure) {
          return Result.fail<Order[]>(orderOrError.error);
        }

        orders.push(orderOrError.value);
      }

      return Result.ok(orders);
    } catch (error: any) {
      throw new InfrastructureException(
        'Database error while finding orders by status',
        error
      );
    }
  }

  async delete(id: OrderId): Promise<Result<void>> {
    try {
      // Cascade delete handled by database constraints
      await this.prisma.order.delete({
        where: { id: id.toString() }
      });

      return Result.ok<void>();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return Result.fail<void>('Order not found');
      }

      throw new InfrastructureException(
        'Database error while deleting order',
        error
      );
    }
  }
}
```

### Example 3: Repository with Transaction Support

```typescript
import { PrismaClient, Prisma } from '@prisma/client';
import { Result } from '@/shared/core/Result';
import { IInventoryRepository } from '@/domain/repositories/IInventoryRepository';
import { Inventory, InventoryId } from '@/domain/aggregates/Inventory';
import { ProductId } from '@/domain/aggregates/Product';
import { InventoryMapper } from '@/infrastructure/mappers/InventoryMapper';
import { DomainEvents } from '@/domain/events/DomainEvents';
import { InfrastructureException } from '@/infrastructure/exceptions/InfrastructureException';

// Type for Prisma transaction
type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'
>;

/**
 * Prisma implementation of IInventoryRepository.
 * Supports explicit transaction context for use case-controlled transactions.
 */
export class PrismaInventoryRepository implements IInventoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Saves inventory with optional transaction context.
   * If transaction provided, uses it; otherwise creates new transaction.
   * Events are NOT dispatched if in transaction (caller's responsibility).
   */
  async save(
    inventory: Inventory,
    tx?: PrismaTransaction
  ): Promise<Result<Inventory>> {
    const client = tx || this.prisma;

    try {
      const inventoryData = InventoryMapper.toPersistence(inventory);

      await client.inventory.upsert({
        where: { id: inventory.id.toString() },
        update: inventoryData,
        create: inventoryData
      });

      // Only dispatch events if NOT in transaction
      if (!tx) {
        await DomainEvents.dispatchEventsForAggregate(inventory.id);
      }

      return Result.ok(inventory);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return Result.fail<Inventory>('Product already has inventory');
      }

      throw new InfrastructureException(
        'Database error while saving inventory',
        error
      );
    }
  }

  /**
   * Decreases stock for multiple products in a transaction.
   * Use case controls transaction to ensure atomicity with other operations.
   */
  async decreaseStockBatch(
    items: Array<{ productId: ProductId; quantity: number }>,
    tx?: PrismaTransaction
  ): Promise<Result<void>> {
    const client = tx || this.prisma;

    try {
      for (const item of items) {
        // Find inventory
        const inventoryData = await client.inventory.findUnique({
          where: { productId: item.productId.toString() }
        });

        if (!inventoryData) {
          return Result.fail<void>(
            `Inventory not found for product ${item.productId}`
          );
        }

        // Check sufficient stock
        if (inventoryData.quantity < item.quantity) {
          return Result.fail<void>(
            `Insufficient stock for product ${item.productId}`
          );
        }

        // Decrease stock
        await client.inventory.update({
          where: { productId: item.productId.toString() },
          data: {
            quantity: {
              decrement: item.quantity
            }
          }
        });
      }

      return Result.ok<void>();
    } catch (error: any) {
      throw new InfrastructureException(
        'Database error while decreasing stock',
        error
      );
    }
  }

  async findById(
    id: InventoryId,
    tx?: PrismaTransaction
  ): Promise<Result<Inventory | null>> {
    const client = tx || this.prisma;

    try {
      const inventoryData = await client.inventory.findUnique({
        where: { id: id.toString() }
      });

      if (!inventoryData) {
        return Result.ok<Inventory | null>(null);
      }

      return InventoryMapper.toDomain(inventoryData);
    } catch (error: any) {
      throw new InfrastructureException(
        'Database error while finding inventory',
        error
      );
    }
  }

  async findByProductId(
    productId: ProductId
  ): Promise<Result<Inventory | null>> {
    try {
      const inventoryData = await this.prisma.inventory.findUnique({
        where: { productId: productId.toString() }
      });

      if (!inventoryData) {
        return Result.ok<Inventory | null>(null);
      }

      return InventoryMapper.toDomain(inventoryData);
    } catch (error: any) {
      throw new InfrastructureException(
        'Database error while finding inventory by product',
        error
      );
    }
  }
}
```

---

## Summary Checklist

When creating a Repository Implementation, ensure:

**Structure:**

- [ ] Class name follows `[ORM][Aggregate]Repository` pattern
- [ ] Implements domain repository interface exactly
- [ ] Constructor accepts ORM client (Prisma, TypeORM, etc.)
- [ ] File located in `src/infrastructure/persistence/repositories/` or `src/infrastructure/repositories/`
- [ ] Has comprehensive JSDoc comments

**Responsibilities:**

- [ ] Implements all interface methods with exact signatures
- [ ] Uses infrastructure mappers for domain ↔ persistence conversion
- [ ] Loads complete aggregates (including children)
- [ ] Dispatches domain events after successful saves
- [ ] Handles transactions appropriately
- [ ] Manages database connections properly

**Error Handling:**

- [ ] Returns `Result.fail()` for business errors (P2002, P2003, P2004, P2025)
- [ ] Throws `InfrastructureException` for infrastructure errors (P1xxx codes)
- [ ] Provides meaningful error messages for both types
- [ ] Classifies errors correctly (business vs infrastructure)
- [ ] Handles data mapping errors as business errors

**Domain Events:**

- [ ] Dispatches events ONLY after successful database commit
- [ ] Skips event dispatching when in transaction (caller dispatches)
- [ ] Handles event dispatch failures gracefully
- [ ] Uses `DomainEvents.dispatchEventsForAggregate()`

**Transactions:**

- [ ] Uses auto-transactions for single operations
- [ ] Uses explicit transactions for multiple operations
- [ ] Supports optional transaction context parameter (if needed)
- [ ] Ensures all-or-nothing atomicity
- [ ] Events dispatched after transaction commits

**Boundaries:**

- [ ] No business logic in repository
- [ ] No domain layer imports infrastructure
- [ ] Only domain types exposed to callers
- [ ] No ORM entities returned or accepted as parameters
- [ ] One repository per aggregate

**Testing:**

- [ ] Has integration tests with real database
- [ ] Tests all CRUD operations
- [ ] Tests business error scenarios
- [ ] Tests aggregate loading (complete with children)
- [ ] Tests pagination and edge cases
- [ ] Tests transaction behavior (if applicable)

**Code Quality:**

- [ ] No code duplication
- [ ] Clear, descriptive method names
- [ ] Proper TypeScript types everywhere
- [ ] No `any` types without explicit reason
- [ ] Consistent error handling pattern

**Orthogonality:**

- [ ] Single aggregate focus
- [ ] Domain model independence (can swap ORM)
- [ ] Mapper responsibility separation
- [ ] Stable under infrastructure changes

---

**Remember**: Repository implementations are the bridge between domain and persistence. They translate domain concepts to database operations while maintaining clear boundaries and proper error classification. Keep them focused, consistent, and infrastructure-aware while protecting domain purity!
