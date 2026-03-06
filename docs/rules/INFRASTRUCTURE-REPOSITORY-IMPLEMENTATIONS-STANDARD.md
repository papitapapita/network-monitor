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
- **Unified Error Model**: All errors — business and infrastructure — are returned as `Result.fail()` with descriptive messages
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
| **Dependencies**      | Database, ORM, mappers, events     | Domain types only                 |
| **Error Handling**    | Returns `Result.fail()` for ALL errors | Returns `Result<T>` signature  |
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
   - Return `Result<T>` for all scenarios (success and failure)

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

4. **Return `Result.fail()` for ALL Errors**

   - Business errors (duplicates, not found, constraint violations): `Result.fail()` with a descriptive business message
   - Infrastructure errors (connection lost, timeouts): `Result.fail()` with a message prefixed by `"Database error: ..."` so callers can identify the category
   - Never throw from a repository method — the `UseCase` base class catches all exceptions and converts them to `Result.fail()` anyway, making thrown exceptions unreliable
   - Provide meaningful, distinguishable error messages for both types

5. **Manage Transactions**

   - Ensure atomic operations (all-or-nothing)
   - Support transaction boundaries
   - Handle rollbacks on failures
   - Dispatch domain events AFTER the transaction block completes (never inside the transaction callback)

6. **Dispatch Domain Events**

   - Trigger domain events after successful save operations
   - Use `EventDispatcher.dispatchEventsForAggregate()`
   - Only dispatch after database commit succeeds (after `$transaction` resolves)
   - If event dispatch fails, log the error but do not fail the operation

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

   - Events only dispatched after `$transaction` resolves
   - Never dispatch inside a transaction callback
   - Never dispatch on failed saves

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

7. **❌ Throw Exceptions from Public Methods**

   - All public methods return `Result<T>` — never throw
   - The `UseCase` base class already catches all unhandled exceptions and converts them to `Result.fail()`, making thrown exceptions from repositories unreliable and inconsistent
   - Catch all errors internally and return `Result.fail()` with appropriate messages

8. **❌ Return `null` for Infrastructure Errors**
   - `null` (wrapped in `Result.ok(null)`) signals "entity not found" — a valid business scenario
   - Infrastructure failures must return `Result.fail()` with a descriptive message
   - Never hide infrastructure problems in a silent `null`

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
│  │  - Dispatch domain events (after commit)          │      │
│  │  - Manage transactions                            │      │
│  │  - Return Result.fail() for ALL errors            │      │
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
- `EventDispatcher` (for domain event dispatching)
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
// - Dispatches events (after commit)
// - Returns Result<T> (success or failure)
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
  NetworkDeviceId,
  EventDispatcher
} from '@/domain/aggregates/NetworkDevice';
import { NetworkDeviceMapper } from '@/infrastructure/mappers/NetworkDeviceMapper';

/**
 * Prisma implementation of INetworkDeviceRepository.
 *
 * Responsibilities:
 * - Persist and retrieve NetworkDevice aggregates
 * - Map between domain and Prisma models
 * - Handle database transactions
 * - Dispatch domain events after successful saves
 * - Return Result.fail() for ALL errors (business and infrastructure)
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
   *
   * Business errors (e.g. duplicate IP) return Result.fail() with a clear message.
   * Infrastructure errors (e.g. connection failure) return Result.fail() prefixed
   * with "Database error: ..." so callers can distinguish the category.
   *
   * @param device - Network device aggregate to save
   * @returns Result<NetworkDevice> - Saved device or error
   */
  public async save(device: NetworkDevice): Promise<Result<NetworkDevice>> {
    try {
      const persistenceData = NetworkDeviceMapper.toPersistence(device);

      await this.prisma.$transaction(async (tx) => {
        const exists = await tx.networkDevice.findUnique({
          where: { id: device.id.toString() }
        });

        if (exists) {
          await tx.networkDevice.update({
            where: { id: device.id.toString() },
            data: persistenceData
          });
        } else {
          await tx.networkDevice.create({
            data: persistenceData
          });
        }
      });

      // Dispatch domain events AFTER the transaction resolves (never inside it)
      EventDispatcher.dispatchEventsForAggregate(device.id);

      return Result.ok<NetworkDevice>(device);
    } catch (error: any) {
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

      // Infrastructure Error: connection, timeout, unknown — prefix message
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<NetworkDevice>(
        `Database error saving network device: ${errorMessage}`
      );
    }
  }

  /**
   * Finds a device by its unique identifier.
   * Returns Result.ok(null) if not found (valid business scenario).
   *
   * @param id - Device ID
   * @returns Result<NetworkDevice | null> - Device, null, or error
   */
  public async findById(
    id: NetworkDeviceId
  ): Promise<Result<NetworkDevice | null>> {
    try {
      const deviceData = await this.prisma.networkDevice.findUnique({
        where: { id: id.toString() },
        include: {
          pollingConfiguration: true
        }
      });

      if (!deviceData) {
        return Result.ok<NetworkDevice | null>(null);
      }

      const deviceOrError = NetworkDeviceMapper.toDomain(deviceData);

      if (deviceOrError.isFailure) {
        // Data integrity error: persisted data could not be reconstructed
        // This is NOT a business error — it signals corrupted or migrated data
        return Result.fail<NetworkDevice | null>(
          `Data integrity error mapping device ${id}: ${deviceOrError.error}`
        );
      }

      return Result.ok<NetworkDevice | null>(deviceOrError.value);
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<NetworkDevice | null>(
        `Database error finding network device: ${errorMessage}`
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

      if (devicesData.length === 0) {
        return Result.ok<NetworkDevice[]>([]);
      }

      const devices: NetworkDevice[] = [];
      for (const deviceData of devicesData) {
        const deviceOrError = NetworkDeviceMapper.toDomain(deviceData);

        if (deviceOrError.isFailure) {
          return Result.fail<NetworkDevice[]>(
            `Data integrity error mapping device ${deviceData.id}: ${deviceOrError.error}`
          );
        }

        devices.push(deviceOrError.value);
      }

      return Result.ok<NetworkDevice[]>(devices);
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<NetworkDevice[]>(
        `Database error listing network devices: ${errorMessage}`
      );
    }
  }

  /**
   * Deletes a device by ID.
   *
   * @param id - Device ID
   * @returns Result<void> - Success or error
   */
  public async delete(id: NetworkDeviceId): Promise<Result<void>> {
    try {
      await this.prisma.networkDevice.delete({
        where: { id: id.toString() }
      });

      return Result.ok<void>();
    } catch (error: any) {
      // P2025: Record not found — business error
      if (error.code === 'P2025') {
        return Result.fail<void>('Device not found');
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<void>(
        `Database error deleting network device: ${errorMessage}`
      );
    }
  }

  /**
   * Checks if a device exists with given ID.
   *
   * @param id - Device ID
   * @returns Result<boolean> - True if exists
   */
  public async exists(id: NetworkDeviceId): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.networkDevice.count({
        where: { id: id.toString() }
      });

      return Result.ok<boolean>(count > 0);
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking device existence: ${errorMessage}`
      );
    }
  }
}
```

### Repository with Transaction Support:

```typescript
export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async save(order: Order): Promise<Result<Order>> {
    try {
      const orderData = OrderMapper.toPersistence(order);

      // Explicit transaction for multiple related operations
      await this.prisma.$transaction(async (tx) => {
        await tx.order.upsert({
          where: { id: order.id.toString() },
          update: orderData,
          create: orderData
        });

        await tx.orderItem.deleteMany({
          where: { orderId: order.id.toString() }
        });

        for (const item of order.items) {
          await tx.orderItem.create({
            data: OrderItemMapper.toPersistence(item)
          });
        }
      });

      // Events dispatched AFTER $transaction resolves — never inside the callback
      EventDispatcher.dispatchEventsForAggregate(order.id);

      return Result.ok(order);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return Result.fail<Order>('Order number already exists');
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Order>(
        `Database error saving order: ${errorMessage}`
      );
    }
  }

  public async saveMultiple(orders: Order[]): Promise<Result<void>> {
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const order of orders) {
          const orderData = OrderMapper.toPersistence(order);
          await tx.order.upsert({
            where: { id: order.id.toString() },
            update: orderData,
            create: orderData
          });
        }
      });

      // Dispatch events for all orders AFTER the transaction resolves
      for (const order of orders) {
        EventDispatcher.dispatchEventsForAggregate(order.id);
      }

      return Result.ok<void>();
    } catch (error: any) {
      if (error.code === 'P2002') {
        return Result.fail<void>('One or more orders already exist');
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<void>(
        `Database error saving multiple orders: ${errorMessage}`
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

Follow the interface exactly — no deviation:

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

  private classifyPrismaError<T>(error: any): Result<T> {
    // Error message builder
  }
}
```

---

## 9. Error Handling Strategy

### Unified Result Model

Repository implementations use a **single error channel**: all errors — whether caused by business rule violations or infrastructure failures — are returned as `Result.fail()`.

**Why not throw for infrastructure errors?**

The `UseCase` base class wraps every `execute()` call in a try/catch and converts any thrown exception to `Result.fail()`. This means:

- A thrown exception from a repository **never reaches the controller** in a distinguishable way
- Throwing creates two error paths (return + throw) for the same outcome, increasing cognitive load
- Consistency is impossible if some errors throw and others return

**The rule is simple:** Repository public methods always return `Result<T>`. They never throw.

### How to Distinguish Error Categories

Since both business and infrastructure errors use `Result.fail()`, callers must be able to tell them apart. Use **message prefixes** for infrastructure errors:

```typescript
// Business error - no prefix, describes the domain violation
return Result.fail('Device with ipAddress already exists');
return Result.fail('Device not found');
return Result.fail('Referenced entity does not exist');

// Infrastructure error - prefixed with "Database error: ..."
return Result.fail(`Database error saving network device: ${errorMessage}`);
return Result.fail(`Database error finding network device: ${errorMessage}`);
```

The controller can then classify errors for HTTP status codes without relying on fragile string matching for business errors:

```typescript
// Business errors have short, specific messages → 400/404/409
// Infrastructure errors start with "Database error:" → 500
```

### Business Errors → `Result.fail()` with domain message

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

      // Fall through to infrastructure handling below
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<NetworkDevice>(
        `Database error saving network device: ${errorMessage}`
      );
    }
  }
}
```

**Common Prisma Error Codes (Business Errors):**

| Code   | Meaning                      | Message style            |
| ------ | ---------------------------- | ------------------------ |
| P2002  | Unique constraint violation  | `"X already exists"`     |
| P2003  | Foreign key constraint fail  | `"Referenced X does not exist"` |
| P2004  | Constraint failed on DB      | `"Data violates constraints"` |
| P2025  | Record not found (delete)    | `"X not found"`          |

### Infrastructure Errors → `Result.fail()` with "Database error: ..." prefix

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
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // All infrastructure failures: connection, timeout, auth — return Result.fail()
      return Result.fail<NetworkDevice | null>(
        `Database error finding network device: ${errorMessage}`
      );
    }
  }
}
```

**Common Prisma Error Codes (Infrastructure Errors):**

| Code   | Meaning                   | Message style                                 |
| ------ | ------------------------- | --------------------------------------------- |
| P1000  | Authentication failed     | `"Database error: ..."` |
| P1001  | Cannot reach DB server    | `"Database error: ..."` |
| P1002  | DB server unreachable     | `"Database error: ..."` |
| P1008  | Operations timed out      | `"Database error: ..."` |
| P1009  | Database doesn't exist    | `"Database error: ..."` |
| P1010  | Access denied             | `"Database error: ..."` |

### Data Mapping Errors — Data Integrity (Not Business Errors)

When a mapper fails to reconstruct a domain entity from persisted data, this is a **data integrity** error — it means the database contains data that does not conform to current domain rules. This is NOT a business error (user did not violate a rule); it signals corrupted, migrated, or stale data that needs operator attention.

```typescript
async findById(id: NetworkDeviceId): Promise<Result<NetworkDevice | null>> {
  try {
    const data = await this.prisma.networkDevice.findUnique({...});

    if (!data) return Result.ok(null);

    const deviceOrError = NetworkDeviceMapper.toDomain(data);

    if (deviceOrError.isFailure) {
      // ✅ Data integrity error — NOT a business error
      // Use a distinct prefix so monitoring can alert on these
      return Result.fail<NetworkDevice>(
        `Data integrity error mapping device ${id}: ${deviceOrError.error}`
      );
    }

    return Result.ok(deviceOrError.value);
  } catch (error: any) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return Result.fail<NetworkDevice | null>(
      `Database error finding device: ${errorMessage}`
    );
  }
}
```

### Error Classification Helper:

```typescript
export class PrismaNetworkDeviceRepository implements INetworkDeviceRepository {
  /**
   * Converts a Prisma error into a typed Result.fail() message.
   * Business errors use domain language; infrastructure errors use "Database error:" prefix.
   */
  private handlePrismaError<T>(
    error: any,
    context: string
  ): Result<T> {
    // Business errors — domain language
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

    // Infrastructure errors — "Database error:" prefix
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return Result.fail<T>(`Database error ${context}: ${errorMessage}`);
  }

  async save(device: NetworkDevice): Promise<Result<NetworkDevice>> {
    try {
      // ... database operations ...
      return Result.ok(device);
    } catch (error: any) {
      return this.handlePrismaError<NetworkDevice>(
        error,
        'saving network device'
      );
    }
  }
}
```

---

## 10. Transaction Management

### Pattern 1: Auto-Transaction (Simple Operations)

Most operations are naturally transactional with a single Prisma call:

```typescript
export class PrismaNetworkDeviceRepository implements INetworkDeviceRepository {
  async save(device: NetworkDevice): Promise<Result<NetworkDevice>> {
    try {
      await this.prisma.networkDevice.upsert({
        where: { id: device.id.toString() },
        update: { ...updateData },
        create: { ...createData }
      });

      // Dispatch AFTER the Prisma call succeeds
      EventDispatcher.dispatchEventsForAggregate(device.id);
      return Result.ok(device);
    } catch (error: any) {
      return this.handlePrismaError(error, 'saving device');
    }
  }
}
```

### Pattern 2: Explicit Transaction (Multiple Operations)

For operations requiring multiple database calls, use `$transaction`. Always dispatch events **after** the `$transaction` call resolves — never inside the callback:

```typescript
export class PrismaOrderRepository implements IOrderRepository {
  async save(order: Order): Promise<Result<Order>> {
    try {
      // Explicit transaction for multiple operations
      await this.prisma.$transaction(async (tx) => {
        await tx.order.upsert({
          where: { id: order.id.toString() },
          update: { ...orderData },
          create: { ...orderData }
        });

        await tx.orderItem.deleteMany({
          where: { orderId: order.id.toString() }
        });

        for (const item of order.items) {
          await tx.orderItem.create({
            data: OrderItemMapper.toPersistence(item)
          });
        }
      });

      // ✅ Events dispatched AFTER $transaction resolves
      // Dispatching inside the callback would fire before commit
      EventDispatcher.dispatchEventsForAggregate(order.id);

      return Result.ok(order);
    } catch (error: any) {
      return this.handlePrismaError(error, 'saving order');
    }
  }
}
```

### Pattern 3: Transaction Context (Use Case Controls Transaction)

When a use case needs to coordinate multiple repositories atomically:

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

      // Only dispatch events if NOT inside an external transaction.
      // When tx is provided, the use case controls the transaction boundary
      // and is responsible for dispatching events after commit.
      if (!tx) {
        EventDispatcher.dispatchEventsForAggregate(order.id);
      }

      return Result.ok(order);
    } catch (error: any) {
      return this.handlePrismaError(error, 'saving order');
    }
  }
}

// Use case manages the transaction
export class PlaceOrderUseCase {
  async execute(request: PlaceOrderRequest): Promise<Result<Order>> {
    try {
      let savedOrder: Order;
      let savedInventory: Inventory;

      await this.prisma.$transaction(async (tx) => {
        const orderResult = await this.orderRepo.save(order, tx);
        if (orderResult.isFailure) throw new Error(orderResult.error);
        savedOrder = order;

        const inventoryResult = await this.inventoryRepo.decreaseStock(items, tx);
        if (inventoryResult.isFailure) throw new Error(inventoryResult.error);
      });

      // Dispatch events for all aggregates AFTER the transaction commits
      EventDispatcher.dispatchEventsForAggregate(savedOrder!.id);

      return Result.ok(savedOrder!);
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

3. **Dispatch Events AFTER `$transaction` Resolves**
   - Never dispatch inside the transaction callback
   - The callback runs BEFORE the commit — events dispatched there may fire on rolled-back data
   - Dispatch immediately after the `await this.prisma.$transaction(...)` call

4. **Handle Rollbacks Gracefully**
   - Let Prisma handle rollback automatically
   - Don't dispatch events if the `$transaction` call threw

---

## 11. Domain Event Dispatching

### When to Dispatch Events

Domain events are dispatched **AFTER** the database transaction resolves:

```typescript
export class PrismaNetworkDeviceRepository implements INetworkDeviceRepository {
  async save(device: NetworkDevice): Promise<Result<NetworkDevice>> {
    try {
      // 1. Perform database operation (or transaction)
      await this.prisma.$transaction(async (tx) => {
        await tx.networkDevice.upsert({...});
      });

      // 2. Dispatch events ONLY after transaction resolves
      //    NOT inside the transaction callback
      EventDispatcher.dispatchEventsForAggregate(device.id);

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
import { EventDispatcher } from '@/domain/events/EventDispatcher';

export class PrismaNetworkDeviceRepository implements INetworkDeviceRepository {
  async save(device: NetworkDevice): Promise<Result<NetworkDevice>> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.networkDevice.upsert({...});
      });

      // Dispatch after successful commit
      EventDispatcher.dispatchEventsForAggregate(device.id);

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
   * If transaction provided, events are NOT dispatched here (caller's responsibility).
   * If no transaction, events dispatched immediately after the save.
   */
  async save(
    order: Order,
    tx?: PrismaTransaction
  ): Promise<Result<Order>> {
    const client = tx || this.prisma;

    try {
      await client.order.upsert({...});

      // Only dispatch if NOT in an externally managed transaction
      if (!tx) {
        EventDispatcher.dispatchEventsForAggregate(order.id);
      }

      return Result.ok(order);
    } catch (error: any) {
      return this.handlePrismaError(error, 'saving order');
    }
  }
}

// Caller dispatches after the transaction commits
await this.prisma.$transaction(async (tx) => {
  await this.orderRepo.save(order, tx);
  await this.paymentRepo.save(payment, tx);
  // Do NOT dispatch here — transaction has not committed yet
});

// Dispatch here, after $transaction resolves
EventDispatcher.dispatchEventsForAggregate(order.id);
EventDispatcher.dispatchEventsForAggregate(payment.id);
```

### Event Dispatching Best Practices:

1. **After Database Commit Only**
   - Never dispatch before persistence succeeds
   - Never dispatch inside a `$transaction` callback

2. **Transaction-Aware**
   - Skip dispatching if an external transaction is in progress
   - Let the transaction owner dispatch after commit

3. **Handle Failures Gracefully**
   - If dispatch fails, log the error
   - Do not fail the overall operation (persistence already succeeded)
   - Consider retry mechanisms for critical events

4. **One Aggregate ID at a Time**
   - Dispatch events for single aggregate
   - Don't mix events from multiple aggregates in one call

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
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL
        }
      }
    });

    repository = new PrismaNetworkDeviceRepository(prisma);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.networkDevice.deleteMany();
    await prisma.pollingConfiguration.deleteMany();
  });

  describe('save', () => {
    describe('when creating new device', () => {
      it('should persist device to database', async () => {
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

        const saveResult = await repository.save(device);

        expect(saveResult.isSuccess).toBe(true);

        const dbDevice = await prisma.networkDevice.findUnique({
          where: { id: device.id.toString() }
        });

        expect(dbDevice).toBeDefined();
        expect(dbDevice?.name).toBe('Test Device');
        expect(dbDevice?.ipAddress).toBe('192.168.1.100');
      });

      it('should return Result.fail() with duplicate IP address', async () => {
        const device1 = NetworkDevice.create({
          name: 'Device 1',
          ipAddress: IPAddress.create('192.168.1.100').value,
          macAddress: MACAddress.create('00:11:22:33:44:55').value,
          deviceType: 'ROUTER'
        }).value;

        await repository.save(device1);

        const device2 = NetworkDevice.create({
          name: 'Device 2',
          ipAddress: IPAddress.create('192.168.1.100').value, // Same IP!
          macAddress: MACAddress.create('00:11:22:33:44:66').value,
          deviceType: 'SWITCH'
        }).value;

        const saveResult = await repository.save(device2);

        // Business error returned as Result.fail() — not thrown
        expect(saveResult.isFailure).toBe(true);
        expect(saveResult.error).toContain('already exists');
      });
    });

    describe('when updating existing device', () => {
      it('should update device in database', async () => {
        const device = NetworkDevice.create({
          name: 'Original Name',
          ipAddress: IPAddress.create('192.168.1.100').value,
          macAddress: MACAddress.create('00:11:22:33:44:55').value,
          deviceType: 'ROUTER'
        }).value;

        await repository.save(device);

        const updateResult = device.updateName('Updated Name');
        expect(updateResult.isSuccess).toBe(true);

        const saveResult = await repository.save(device);

        expect(saveResult.isSuccess).toBe(true);

        const dbDevice = await prisma.networkDevice.findUnique({
          where: { id: device.id.toString() }
        });

        expect(dbDevice?.name).toBe('Updated Name');
      });
    });
  });

  describe('findById', () => {
    it('should return device if exists', async () => {
      const device = NetworkDevice.create({
        name: 'Test Device',
        ipAddress: IPAddress.create('192.168.1.100').value,
        macAddress: MACAddress.create('00:11:22:33:44:55').value,
        deviceType: 'ROUTER'
      }).value;

      await repository.save(device);

      const findResult = await repository.findById(device.id);

      expect(findResult.isSuccess).toBe(true);
      expect(findResult.value).not.toBeNull();
      expect(findResult.value?.id.equals(device.id)).toBe(true);
      expect(findResult.value?.name).toBe('Test Device');
    });

    it('should return null if device does not exist', async () => {
      const nonExistentId = NetworkDeviceId.create();

      const findResult = await repository.findById(nonExistentId);

      expect(findResult.isSuccess).toBe(true);
      expect(findResult.value).toBeNull();
    });

    it('should load complete aggregate with children', async () => {
      const device = NetworkDevice.create({
        name: 'Test Device',
        ipAddress: IPAddress.create('192.168.1.100').value,
        macAddress: MACAddress.create('00:11:22:33:44:55').value,
        deviceType: 'ROUTER'
      }).value;

      device.configurePolling({ enabled: true, interval: 60 });
      await repository.save(device);

      const findResult = await repository.findById(device.id);

      expect(findResult.isSuccess).toBe(true);
      expect(findResult.value?.pollingConfiguration).toBeDefined();
      expect(findResult.value?.pollingConfiguration.enabled).toBe(true);
    });
  });

  describe('findAll', () => {
    it('should return all devices', async () => {
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

      const findResult = await repository.findAll();

      expect(findResult.isSuccess).toBe(true);
      expect(findResult.value).toHaveLength(2);
    });

    it('should return empty array if no devices', async () => {
      const findResult = await repository.findAll();

      expect(findResult.isSuccess).toBe(true);
      expect(findResult.value).toEqual([]);
    });

    it('should support pagination', async () => {
      for (let i = 1; i <= 5; i++) {
        const device = NetworkDevice.create({
          name: `Device ${i}`,
          ipAddress: IPAddress.create(`192.168.1.${i}`).value,
          macAddress: MACAddress.create(`00:11:22:33:44:${i}${i}`).value,
          deviceType: 'ROUTER'
        }).value;

        await repository.save(device);
      }

      const findResult = await repository.findAll(2, 2);

      expect(findResult.isSuccess).toBe(true);
      expect(findResult.value).toHaveLength(2);
    });
  });

  describe('delete', () => {
    it('should delete device from database', async () => {
      const device = NetworkDevice.create({
        name: 'Test Device',
        ipAddress: IPAddress.create('192.168.1.100').value,
        macAddress: MACAddress.create('00:11:22:33:44:55').value,
        deviceType: 'ROUTER'
      }).value;

      await repository.save(device);

      const deleteResult = await repository.delete(device.id);

      expect(deleteResult.isSuccess).toBe(true);

      const dbDevice = await prisma.networkDevice.findUnique({
        where: { id: device.id.toString() }
      });

      expect(dbDevice).toBeNull();
    });

    it('should return Result.fail() if device does not exist', async () => {
      const nonExistentId = NetworkDeviceId.create();

      const deleteResult = await repository.delete(nonExistentId);

      // Returns Result.fail() — does not throw
      expect(deleteResult.isFailure).toBe(true);
      expect(deleteResult.error).toContain('not found');
    });

    it('should cascade delete child entities', async () => {
      const device = NetworkDevice.create({
        name: 'Test Device',
        ipAddress: IPAddress.create('192.168.1.100').value,
        macAddress: MACAddress.create('00:11:22:33:44:55').value,
        deviceType: 'ROUTER'
      }).value;

      device.configurePolling({ enabled: true, interval: 60 });
      await repository.save(device);

      await repository.delete(device.id);

      const dbConfig = await prisma.pollingConfiguration.findUnique({
        where: { deviceId: device.id.toString() }
      });

      expect(dbConfig).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true if device exists', async () => {
      const device = NetworkDevice.create({
        name: 'Test Device',
        ipAddress: IPAddress.create('192.168.1.100').value,
        macAddress: MACAddress.create('00:11:22:33:44:55').value,
        deviceType: 'ROUTER'
      }).value;

      await repository.save(device);

      const existsResult = await repository.exists(device.id);

      expect(existsResult.isSuccess).toBe(true);
      expect(existsResult.value).toBe(true);
    });

    it('should return false if device does not exist', async () => {
      const nonExistentId = NetworkDeviceId.create();

      const existsResult = await repository.exists(nonExistentId);

      expect(existsResult.isSuccess).toBe(true);
      expect(existsResult.value).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should return Result.fail() on database failure', async () => {
      // Simulate a disconnected client
      const badRepository = new PrismaNetworkDeviceRepository(
        new PrismaClient({ datasources: { db: { url: 'postgresql://invalid' } } })
      );

      const device = NetworkDevice.create({
        name: 'Test Device',
        ipAddress: IPAddress.create('192.168.1.100').value,
        macAddress: MACAddress.create('00:11:22:33:44:55').value,
        deviceType: 'ROUTER'
      }).value;

      // Repository returns Result.fail() — it does NOT throw
      const saveResult = await badRepository.save(device);

      expect(saveResult.isFailure).toBe(true);
      expect(saveResult.error).toMatch(/Database error/i);
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
   - Duplicate key violations → `Result.fail()` with domain message
   - Foreign key violations → `Result.fail()` with domain message
   - Not found scenarios → `Result.ok(null)` or `Result.fail("X not found")`
   - Constraint violations → `Result.fail()` with domain message

3. **Aggregate Loading**:
   - Complete aggregate with children
   - Nested relationships
   - Lazy vs eager loading

4. **Edge Cases**:
   - Empty results (valid scenario → `Result.ok([])`)
   - Null returns (`Result.ok(null)`)
   - Pagination boundaries

5. **Transaction Behavior**:
   - Multiple operations succeed together
   - Rollback on failure
   - Event dispatching after commit (not inside callback)

6. **Infrastructure Errors**:
   - Connection failures → `Result.fail("Database error: ...")`
   - Repository never throws — always returns `Result`

---

## 13. Examples

### Example 1: Simple Repository (Basic CRUD)

```typescript
import { PrismaClient } from '@prisma/client';
import { Result } from '@/shared/core/Result';
import { ICustomerRepository } from '@/domain/repositories/ICustomerRepository';
import { Customer, CustomerId } from '@/domain/aggregates/Customer';
import { CustomerMapper } from '@/infrastructure/mappers/CustomerMapper';
import { EventDispatcher } from '@/domain/events/EventDispatcher';

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

      EventDispatcher.dispatchEventsForAggregate(customer.id);

      return Result.ok(customer);
    } catch (error: any) {
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'field';
        return Result.fail<Customer>(`Customer ${field} already exists`);
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Customer>(
        `Database error saving customer: ${errorMessage}`
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
          `Data integrity error mapping customer ${id}: ${customerOrError.error}`
        );
      }

      return Result.ok(customerOrError.value);
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Customer | null>(
        `Database error finding customer: ${errorMessage}`
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

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<void>(
        `Database error deleting customer: ${errorMessage}`
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Customer | null>(
        `Database error finding customer by email: ${errorMessage}`
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
import { EventDispatcher } from '@/domain/events/EventDispatcher';

/**
 * Prisma implementation of IOrderRepository.
 * Handles complex aggregate with multiple children.
 */
export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(order: Order): Promise<Result<Order>> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const orderData = OrderMapper.toPersistence(order);

        await tx.order.upsert({
          where: { id: order.id.toString() },
          update: {
            status: orderData.status,
            totalAmount: orderData.totalAmount,
            updatedAt: new Date()
          },
          create: orderData
        });

        await tx.orderItem.deleteMany({
          where: { orderId: order.id.toString() }
        });

        for (const item of orderData.items) {
          await tx.orderItem.create({
            data: {
              ...item,
              orderId: order.id.toString()
            }
          });
        }
      });

      // Dispatch AFTER $transaction resolves
      EventDispatcher.dispatchEventsForAggregate(order.id);

      return Result.ok(order);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return Result.fail<Order>('Order number already exists');
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Order>(
        `Database error saving order: ${errorMessage}`
      );
    }
  }

  async findById(id: OrderId): Promise<Result<Order | null>> {
    try {
      const orderData = await this.prisma.order.findUnique({
        where: { id: id.toString() },
        include: {
          items: {
            include: {
              product: true
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Order | null>(
        `Database error finding order: ${errorMessage}`
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
          items: { include: { product: true } },
          shippingAddress: true,
          payment: true
        },
        orderBy: { createdAt: 'desc' }
      });

      if (ordersData.length === 0) {
        return Result.ok<Order[]>([]);
      }

      const orders: Order[] = [];
      for (const orderData of ordersData) {
        const orderOrError = OrderMapper.toDomain(orderData);

        if (orderOrError.isFailure) {
          return Result.fail<Order[]>(
            `Data integrity error mapping order ${orderData.id}: ${orderOrError.error}`
          );
        }

        orders.push(orderOrError.value);
      }

      return Result.ok(orders);
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Order[]>(
        `Database error finding orders by customer: ${errorMessage}`
      );
    }
  }

  async delete(id: OrderId): Promise<Result<void>> {
    try {
      await this.prisma.order.delete({
        where: { id: id.toString() }
      });

      return Result.ok<void>();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return Result.fail<void>('Order not found');
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<void>(
        `Database error deleting order: ${errorMessage}`
      );
    }
  }
}
```

### Example 3: Repository with Transaction Context Support

```typescript
import { PrismaClient, Prisma } from '@prisma/client';
import { Result } from '@/shared/core/Result';
import { IInventoryRepository } from '@/domain/repositories/IInventoryRepository';
import { Inventory, InventoryId } from '@/domain/aggregates/Inventory';
import { ProductId } from '@/domain/aggregates/Product';
import { InventoryMapper } from '@/infrastructure/mappers/InventoryMapper';
import { EventDispatcher } from '@/domain/events/EventDispatcher';

// Type for Prisma transaction client
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
   * If transaction provided, events are NOT dispatched here (caller dispatches after commit).
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

      // Only dispatch events if NOT inside an externally managed transaction
      if (!tx) {
        EventDispatcher.dispatchEventsForAggregate(inventory.id);
      }

      return Result.ok(inventory);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return Result.fail<Inventory>('Product already has inventory');
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Inventory>(
        `Database error saving inventory: ${errorMessage}`
      );
    }
  }

  async decreaseStockBatch(
    items: Array<{ productId: ProductId; quantity: number }>,
    tx?: PrismaTransaction
  ): Promise<Result<void>> {
    const client = tx || this.prisma;

    try {
      for (const item of items) {
        const inventoryData = await client.inventory.findUnique({
          where: { productId: item.productId.toString() }
        });

        if (!inventoryData) {
          return Result.fail<void>(
            `Inventory not found for product ${item.productId}`
          );
        }

        if (inventoryData.quantity < item.quantity) {
          return Result.fail<void>(
            `Insufficient stock for product ${item.productId}`
          );
        }

        await client.inventory.update({
          where: { productId: item.productId.toString() },
          data: { quantity: { decrement: item.quantity } }
        });
      }

      return Result.ok<void>();
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<void>(
        `Database error decreasing stock: ${errorMessage}`
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Inventory | null>(
        `Database error finding inventory: ${errorMessage}`
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
- [ ] Dispatches domain events after successful saves (after `$transaction` resolves)
- [ ] Handles transactions appropriately
- [ ] Manages database connections properly

**Error Handling:**

- [ ] All public methods return `Result<T>` — never throw
- [ ] Business errors (P2002, P2003, P2004, P2025) return `Result.fail()` with domain language
- [ ] Infrastructure errors (connection, timeout, unknown) return `Result.fail("Database error: ...")`
- [ ] Data mapping failures return `Result.fail("Data integrity error: ...")` — NOT classified as business errors
- [ ] Error messages are consistent and distinguishable by category prefix

**Domain Events:**

- [ ] Dispatches events using `EventDispatcher.dispatchEventsForAggregate()`
- [ ] Events dispatched AFTER `$transaction` resolves — never inside the transaction callback
- [ ] Skips dispatching when in an external transaction (caller dispatches)
- [ ] Handles event dispatch failures gracefully (log, don't fail the operation)

**Transactions:**

- [ ] Uses auto-transactions for single operations
- [ ] Uses `$transaction` for multiple related operations
- [ ] Supports optional transaction context parameter (if needed)
- [ ] Ensures all-or-nothing atomicity
- [ ] Events dispatched after `$transaction` resolves (not inside callback)

**Boundaries:**

- [ ] No business logic in repository
- [ ] No domain layer imports infrastructure
- [ ] Only domain types exposed to callers
- [ ] No ORM entities returned or accepted as parameters
- [ ] One repository per aggregate

**Testing:**

- [ ] Has integration tests with real database
- [ ] Tests all CRUD operations
- [ ] Tests business error scenarios (expect `Result.fail()`, not thrown exceptions)
- [ ] Tests aggregate loading (complete with children)
- [ ] Tests pagination and edge cases
- [ ] Tests transaction behavior (events dispatched after commit, not inside callback)
- [ ] Tests infrastructure error scenarios (expect `Result.fail("Database error: ...")`)

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

**Remember**: Repository implementations are the bridge between domain and persistence. They return `Result<T>` for every outcome — both expected business failures and unexpected infrastructure failures. The distinction is in the error message: domain language for business errors, `"Database error: ..."` prefix for infrastructure errors. This keeps the error channel simple and consistent with the `UseCase` base class, which already catches all unhandled exceptions and converts them to `Result.fail()`.
