# DOMAIN REPOSITORY INTERFACES STANDARD

## Table of Contents

1. [Purpose of Repository Interfaces in DDD](#1-purpose-of-repository-interfaces-in-ddd)
2. [Responsibilities of a Repository Interface](#2-responsibilities-of-a-repository-interface)
3. [Boundaries of a Repository Interface](#3-boundaries-of-a-repository-interface)
4. [Connections with Other Layers](#4-connections-with-other-layers)
5. [Repository Interface Design Principles](#5-repository-interface-design-principles)
6. [Repository Interface Structure Template](#6-repository-interface-structure-template)
7. [Orthogonality Principles](#7-orthogonality-principles)
8. [Naming Conventions](#8-naming-conventions)
9. [Method Patterns](#9-method-patterns)
10. [Error Handling Strategy in Implementations](#10-error-handling-strategy-in-implementations)
11. [Testing Strategy](#11-testing-strategy)
12. [Examples](#12-examples)

---

## 1. Purpose of Repository Interfaces in DDD

**Repository Interfaces define contracts for persisting and retrieving Aggregates, abstracting data access from domain logic.**

### Core Characteristics:

- **Abstraction**: Hides persistence details from domain
- **Collection-Like**: Treat aggregate persistence like an in-memory collection
- **Aggregate-Focused**: One repository per aggregate root (not per entity)
- **Domain Layer**: Interfaces live in domain, implementations in infrastructure
- **Dependency Inversion**: Domain defines contract, infrastructure implements

### Why Repository Interfaces?

1. **Dependency Inversion**: Domain doesn't depend on infrastructure
2. **Testability**: Easy to mock repositories for unit tests
3. **Flexibility**: Swap database implementations without changing domain
4. **Clean Architecture**: Clear separation of concerns
5. **Collection Metaphor**: Treat persistence like working with collections

### Repository vs DAO (Data Access Object):

| Aspect         | Repository          | DAO              |
| -------------- | ------------------- | ---------------- |
| **Level**      | Domain-focused      | Data-focused     |
| **Scope**      | Aggregate root      | Any entity/table |
| **Operations** | Collection-like     | CRUD             |
| **Language**   | Ubiquitous language | Database terms   |
| **Location**   | Domain (interface)  | Infrastructure   |

---

## 2. Responsibilities of a Repository Interface

### MUST DO:

1. **Define Persistence Contract**

   - Methods for saving aggregates
   - Methods for retrieving aggregates
   - Methods for deleting aggregates
   - Query methods using domain language

2. **Use Domain Types**

   - Accept/return Aggregates, Entities, Value Objects
   - Parameters are domain IDs (not strings/numbers)
   - No DTOs or infrastructure types

3. **Return Results**

   Repository methods use a dual error-handling strategy:

   **Business/Domain Failures → Return `Result.fail()`**
   - Entity not found (when it's expected to exist)
   - Validation failures (e.g., duplicate IP address)
   - Business rule violations
   - Expected error scenarios that are part of normal operation
   - These are recoverable and should be handled by use cases

   **Infrastructure Catastrophes → Throw Exceptions**
   - Database connection lost
   - Network timeouts
   - ORM crashes
   - Disk full
   - Query syntax errors
   - Authentication failures with database
   - These are unexpected, system-level failures that should bubble up to global error handlers

   **Key Principles:**
   - Method signatures always return `Promise<Result<T>>`
   - Not finding an entity by ID returns `Result.ok(null)` (not an error - valid scenario)
   - Finding zero results returns `Result.ok([])` (not an error)
   - Business constraint violations return `Result.fail()` with meaningful message
   - Infrastructure failures throw exceptions immediately
   - Never throw exceptions for business logic failures

4. **Express Domain Queries**

   - Query methods use domain language
   - Filter by domain concepts
   - No SQL or query language in interface

5. **Work with Aggregates**
   - One repository per aggregate root
   - Save/load entire aggregate atomically
   - No repositories for child entities

---

## 3. Boundaries of a Repository Interface

### MUST NOT DO:

1. **❌ Contain Implementation Details**

   - No SQL queries
   - No ORM entities
   - No database-specific code
   - Pure contract definition

2. **❌ Know About Infrastructure**

   - No database connection details
   - No framework dependencies
   - No caching logic
   - No transaction management (explicit)

3. **❌ Have Business Logic**

   - No validation
   - No calculations
   - No state transformations
   - Pure persistence contract

4. **❌ Expose Internal Entities**

   - Only aggregate root repositories
   - No repositories for child entities
   - Child entities persisted with aggregate

5. **❌ Return DTOs**

   - Return domain objects only
   - No presentation layer types
   - No database entities

6. **❌ Leaking SQL or Query Language**

   - Should not have methods like `findByRawSql(query: string)`
   - Use specification pattern or clearly named methods like `findActiveOrders()`

---

## 4. Connections with Other Layers

```
┌─────────────────────────────────────────────────────────────┐
│                  PRESENTATION LAYER                         │
│  - Never calls repositories directly                        │
│  - Works through use cases                                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 APPLICATION LAYER                           │
│  ┌───────────────────────────────────────────────────┐      │
│  │  Use Cases                                        │      │
│  │  - Inject repository interfaces                   │      │
│  │  - Call repository methods                        │      │
│  │  - Manage transaction scope                       │      │
│  │  - Handle repository results                      │      │
│  └───────────────────────────────────────────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │ depends on (interface)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    DOMAIN LAYER                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │   REPOSITORY INTERFACES (You are here)             │     │
│  │   - Define persistence contracts                   │     │
│  │   - Use domain types only                          │     │
│  │   - Collection-like metaphor                       │     │
│  │   - One per aggregate root                         │     │
│  └────────────────────────────────────────────────────┘     │
│         ▲                                                   │
│         │ used by                                           │
│  ┌──────────────────┐                                       │
│  │  Aggregate Root  │                                       │
│  └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
                         ▲
                         │ implements
┌─────────────────────────────────────────────────────────────┐
│               INFRASTRUCTURE LAYER                          │
│  ┌───────────────────────────────────────────────────┐      │
│  │  Repository Implementations                       │      │
│  │  - Implement interfaces from domain               │      │
│  │  - Use ORM/database to persist                    │      │
│  │  - Map between domain and persistence             │      │
│  │  - Handle transactions                            │      │
│  │  - Dispatch domain events after save              │      │
│  └───────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Flow:

```
Use Case ──depends on──> IRepository (interface in domain)
                              ▲
                              │ implements
                              │
                    RepositoryImpl (in infrastructure)
```

---

## 5. Repository Interface Design Principles

### 1. Collection Metaphor

Repositories should feel like working with in-memory collections:

```typescript
// ✅ GOOD - Collection-like
interface IOrderRepository {
  save(order: Order): Promise<Result<Order>>;
  findById(id: OrderId): Promise<Result<Order | null>>;
  findAll(): Promise<Result<Order[]>>;
  delete(id: OrderId): Promise<Result<void>>;
}

// ❌ BAD - Database-focused
interface IOrderRepository {
  insert(order: Order): Promise<void>; // Database term
  selectById(id: string): Promise<Order>; // SQL term
  update(order: Order): Promise<void>; // Split save into insert/update
  deleteFromDatabase(id: string): Promise<void>; // Database detail
}
```

### 2. Aggregate Boundary

One repository per aggregate root:

```typescript
// ✅ GOOD - Repository per aggregate root
interface IOrderRepository {
  save(order: Order): Promise<Result<Order>>;
  // Order aggregate includes OrderItems automatically
}

// ❌ BAD - Repository for child entities
interface IOrderItemRepository {
  save(item: OrderItem): Promise<Result<OrderItem>>;
  // OrderItem is child entity, should be saved with Order!
}
```

### 3. Domain Language

Use ubiquitous language in method names:

```typescript
// ✅ GOOD - Domain language
interface ICustomerRepository {
  findByEmail(email: Email): Promise<Result<Customer | null>>;
  findActiveCustomers(): Promise<Result<Customer[]>>;
  findByLoyaltyTier(tier: LoyaltyTier): Promise<Result<Customer[]>>;
}

// ❌ BAD - Technical language
interface ICustomerRepository {
  selectWhereEmailEquals(email: string): Promise<Customer>;
  getAllActiveRecords(): Promise<Customer[]>;
  queryByTierColumn(tier: number): Promise<Customer[]>;
}
```

### 4. No Leaky Abstractions

Don't expose infrastructure details:

```typescript
// ✅ GOOD - Clean abstraction
interface IOrderRepository {
  findByCustomerId(customerId: CustomerId): Promise<Result<Order[]>>;
}

// ❌ BAD - Leaky abstraction
interface IOrderRepository {
  findByCustomerId(
    customerId: CustomerId,
    includeDeleted: boolean, // Database detail
    eager: boolean, // ORM detail
    lockMode: LockMode // Database detail
  ): Promise<Order[]>;
}
```

---

## 6. Repository Interface Structure Template

### Basic Repository Interface:

```typescript
import { Result } from '@/shared/core/Result';

/**
 * Repository interface for [Aggregate Name] aggregate.
 *
 * Responsibilities:
 * - Persist and retrieve [Aggregate] aggregates
 * - Provide domain-focused query methods
 * - Abstract persistence implementation details
 *
 * Implementation Notes:
 * - Implementations must handle domain event dispatch after save
 * - Implementations must load entire aggregate (including children)
 * - Implementations must handle transactions appropriately
 * - Business errors (duplicates, constraint violations) return Result.fail()
 * - Infrastructure errors (connection lost, timeouts) throw exceptions
 */
export interface IAggregateRepository {
  /**
   * Saves an aggregate (create or update).
   * Dispatches domain events after successful save.
   * Returns Result.fail() for business constraint violations (duplicate keys, etc.).
   *
   * @param aggregate - The aggregate to save
   * @returns Result<Aggregate> - Saved aggregate or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  save(aggregate: Aggregate): Promise<Result<Aggregate>>;

  /**
   * Finds an aggregate by its unique identifier.
   * Returns null if not found (valid scenario, not an error).
   *
   * @param id - Aggregate ID
   * @returns Result<Aggregate | null> - Found aggregate, null, or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  findById(id: AggregateId): Promise<Result<Aggregate | null>>;

  /**
   * Finds all aggregates (with optional pagination).
   * Returns empty array if none found (valid scenario, not an error).
   *
   * @param limit - Maximum number of results
   * @param offset - Number of results to skip
   * @returns Result<Aggregate[]> - Array of aggregates (may be empty) or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  findAll(
    limit?: number,
    offset?: number
  ): Promise<Result<Aggregate[]>>;

  /**
   * Deletes an aggregate by ID.
   * Not finding the aggregate to delete may be treated as success or error based on business rules.
   *
   * @param id - Aggregate ID
   * @returns Result<void> - Success or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  delete(id: AggregateId): Promise<Result<void>>;

  /**
   * Checks if an aggregate exists with the given ID.
   *
   * @param id - Aggregate ID
   * @returns Result<boolean> - True if exists, false otherwise, or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  exists(id: AggregateId): Promise<Result<boolean>>;

  /**
   * Counts total number of aggregates.
   *
   * @returns Result<number> - Count or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  count(): Promise<Result<number>>;
}
```

### Repository with Domain Queries:

```typescript
import { Result } from '@/shared/core/Result';
import { Order, OrderId } from '@/domain/aggregates/Order';
import { CustomerId } from '@/domain/aggregates/Customer';
import { OrderStatus } from '@/domain/value-objects/OrderStatus';
import { DateRange } from '@/domain/value-objects/DateRange';

/**
 * Repository interface for Order aggregate.
 *
 * Provides persistence and domain-focused queries for orders.
 */
export interface IOrderRepository {
  // Basic operations
  save(order: Order): Promise<Result<Order>>;
  findById(id: OrderId): Promise<Result<Order | null>>;
  delete(id: OrderId): Promise<Result<void>>;

  // Domain queries
  /**
   * Finds all orders for a specific customer.
   *
   * @param customerId - Customer ID
   * @returns Result<Order[]> - Customer's orders or error
   */
  findByCustomerId(customerId: CustomerId): Promise<Result<Order[]>>;

  /**
   * Finds orders with a specific status.
   *
   * @param status - Order status
   * @returns Result<Order[]> - Orders with status or error
   */
  findByStatus(status: OrderStatus): Promise<Result<Order[]>>;

  /**
   * Finds orders placed within a date range.
   *
   * @param dateRange - Date range to search
   * @returns Result<Order[]> - Orders in range or error
   */
  findByDateRange(dateRange: DateRange): Promise<Result<Order[]>>;

  /**
   * Finds pending orders for a customer.
   *
   * @param customerId - Customer ID
   * @returns Result<Order[]> - Pending orders or error
   */
  findPendingOrdersForCustomer(
    customerId: CustomerId
  ): Promise<Result<Order[]>>;

  // Existence checks
  /**
   * Checks if customer has any pending orders.
   *
   * @param customerId - Customer ID
   * @returns Result<boolean> - True if has pending orders
   */
  hasPendingOrders(customerId: CustomerId): Promise<Result<boolean>>;

  // Counts
  /**
   * Counts orders by status.
   *
   * @param status - Order status
   * @returns Result<number> - Count or error
   */
  countByStatus(status: OrderStatus): Promise<Result<number>>;
}
```

### Repository with Specification Pattern (Advanced):

```typescript
import { Result } from '@/shared/core/Result';
import { Specification } from '@/shared/domain/Specification';

/**
 * Repository with specification pattern support.
 * Allows flexible querying using domain specifications.
 */
export interface IProductRepository {
  save(product: Product): Promise<Result<Product>>;
  findById(id: ProductId): Promise<Result<Product | null>>;
  delete(id: ProductId): Promise<Result<void>>;

  /**
   * Finds products matching a specification.
   * Specifications encapsulate query logic in domain layer.
   *
   * @param spec - Domain specification
   * @returns Result<Product[]> - Matching products or error
   */
  findBySpecification(
    spec: Specification<Product>
  ): Promise<Result<Product[]>>;
}

// Example specifications (in domain layer)
export class ProductsInCategorySpec
  implements Specification<Product>
{
  constructor(private category: Category) {}

  isSatisfiedBy(product: Product): boolean {
    return product.category.equals(this.category);
  }
}

export class AvailableProductsSpec implements Specification<Product> {
  isSatisfiedBy(product: Product): boolean {
    return product.inventory > 0 && product.isActive;
  }
}
```

---

## 7. Orthogonality Principles

### 1. Single Aggregate Focus

Each repository handles exactly one aggregate type:

```typescript
// ✅ GOOD - One aggregate type
interface IOrderRepository {
  save(order: Order): Promise<Result<Order>>;
  findById(id: OrderId): Promise<Result<Order | null>>;
}

// ❌ BAD - Multiple aggregate types
interface IOrderAndCustomerRepository {
  saveOrder(order: Order): Promise<Result<Order>>;
  saveCustomer(customer: Customer): Promise<Result<Customer>>;
  // Mixing concerns!
}
```

### 2. Complete Aggregates

Repositories always load/save complete aggregates:

```typescript
// ✅ GOOD - Complete aggregate
interface IOrderRepository {
  // Loads order WITH all order items and shipping details
  findById(id: OrderId): Promise<Result<Order | null>>;
}

// ❌ BAD - Partial aggregates
interface IOrderRepository {
  findByIdWithoutItems(id: OrderId): Promise<Result<Order>>;
  findByIdLazy(id: OrderId): Promise<Result<Order>>; // Items loaded later
  // Breaks aggregate boundary!
}
```

### 3. No Query Builder Leakage

Don't expose query building details:

```typescript
// ✅ GOOD - Clean domain query
interface IProductRepository {
  findByCategory(category: Category): Promise<Result<Product[]>>;
  findAvailableProducts(): Promise<Result<Product[]>>;
}

// ❌ BAD - Query builder exposure
interface IProductRepository {
  query(
    builder: QueryBuilder // Infrastructure detail!
  ): Promise<Result<Product[]>>;
}
```

---

## 8. Naming Conventions

### Interface Names:

- Prefix with `I`
- Use aggregate name + `Repository`
- Singular, not plural

```typescript
// ✅ GOOD
interface IOrderRepository {}
interface INetworkDeviceRepository {}
interface ICustomerRepository {}

// ❌ BAD
interface OrderRepository {} // Missing I prefix
interface OrdersRepository {} // Plural
interface OrderRepo {} // Abbreviated
interface IOrderDataAccess {} // Not using "Repository"
```

### Method Names:

```typescript
interface IOrderRepository {
  // ✅ Create/Update: save (not insert/update/persist)
  save(order: Order): Promise<Result<Order>>;

  // ✅ Read: find/get (prefer "find")
  findById(id: OrderId): Promise<Result<Order | null>>;
  findByCustomerId(customerId: CustomerId): Promise<Result<Order[]>>;

  // ✅ Delete: delete (not remove/destroy)
  delete(id: OrderId): Promise<Result<void>>;

  // ✅ Existence: exists/has
  exists(id: OrderId): Promise<Result<boolean>>;
  hasOrders(customerId: CustomerId): Promise<Result<boolean>>;

  // ✅ Count: count
  count(): Promise<Result<number>>;
  countByStatus(status: OrderStatus): Promise<Result<number>>;
}
```

### Query Method Patterns:

```typescript
// ✅ GOOD - Domain-focused
findByCustomerId(customerId: CustomerId)
findByStatus(status: OrderStatus)
findActiveOrders()
findPendingOrdersForCustomer(customerId: CustomerId)

// ❌ BAD - Database-focused
selectWhereCustomerIdEquals(id: string)
getOrdersByStatusColumn(status: number)
queryActiveRecords()
getAllPendingForCustomerTable(id: string)
```

---

## 9. Method Patterns

### Pattern 1: save() - Create or Update

```typescript
/**
 * Saves an aggregate (creates if new, updates if exists).
 * Implementations use ID to determine create vs update.
 * Returns Result.fail() for business constraint violations (duplicate key, etc.).
 * Throws exception on infrastructure failures (connection lost, etc.).
 *
 * @param aggregate - Aggregate to save
 * @returns Result<Aggregate> - Saved aggregate or business error
 * @throws InfrastructureException - On catastrophic infrastructure failures
 */
save(aggregate: Aggregate): Promise<Result<Aggregate>>;

// Usage in Use Case
const order = Order.create({ ... }).value;
const saveResult = await orderRepository.save(order);  // Create

if (saveResult.isFailure) {
  // Business error (e.g., duplicate order number)
  return Result.fail(saveResult.error);
}

order.confirm();
await orderRepository.save(order);  // Update (same method!)

// Implementation Example
class PrismaOrderRepository implements IOrderRepository {
  async save(order: Order): Promise<Result<Order>> {
    try {
      const exists = await this.prisma.order.findUnique({
        where: { id: order.id.toString() }
      });

      const orderData = OrderMapper.toPersistence(order);

      if (exists) {
        // Update existing
        await this.prisma.order.update({
          where: { id: order.id.toString() },
          data: orderData
        });
      } else {
        // Create new
        await this.prisma.order.create({
          data: orderData
        });
      }

      // Dispatch domain events after successful save
      await DomainEvents.dispatchEventsForAggregate(order.id);

      return Result.ok(order);

    } catch (error) {
      // Check if it's a business constraint violation
      if (error.code === 'P2002') { // Prisma unique constraint violation
        const field = error.meta?.target?.[0] || 'field';
        return Result.fail(`${field} already exists`);
      }

      // Otherwise it's an infrastructure catastrophe - throw
      throw new InfrastructureException(
        'Database error while saving order',
        error
      );
    }
  }
}
```

### Pattern 2: findById() - Retrieve by ID

```typescript
/**
 * Finds aggregate by ID.
 * Returns null if not found (NOT an error - valid business scenario).
 * Throws exception on infrastructure failures (connection lost, etc.).
 *
 * @param id - Aggregate ID
 * @returns Result<Aggregate | null> - Aggregate or null on success, Result.fail() for business errors
 * @throws InfrastructureException - On catastrophic infrastructure failures
 */
findById(id: AggregateId): Promise<Result<Aggregate | null>>;

// Usage in Use Case
const result = await orderRepository.findById(orderId);

if (result.isFailure) {
  // Business/domain error (e.g., data inconsistency detected)
  return Result.fail(result.error);
}

if (result.value === null) {
  // Not found (not an error - valid scenario)
  // Use case decides if this is a failure in this context
  return Result.fail('Order not found');
}

const order = result.value; // Found!

// Implementation Example
class PrismaOrderRepository implements IOrderRepository {
  async findById(id: OrderId): Promise<Result<Order | null>> {
    try {
      const orderData = await this.prisma.order.findUnique({
        where: { id: id.toString() },
        include: { items: true, shippingAddress: true }
      });

      // Not found is a valid scenario - return ok(null)
      if (!orderData) {
        return Result.ok(null);
      }

      // Map to domain
      const orderOrError = OrderMapper.toDomain(orderData);
      if (orderOrError.isFailure) {
        // Mapping failed due to invalid data (business error)
        return Result.fail(`Failed to map order: ${orderOrError.error}`);
      }

      return Result.ok(orderOrError.value);

    } catch (error) {
      // Infrastructure catastrophe - connection lost, timeout, etc.
      // Don't wrap in Result - let it throw to global handler
      throw new InfrastructureException(
        'Database error while finding order',
        error
      );
    }
  }
}
```

### Pattern 3: findBy...() - Query Methods

```typescript
/**
 * Queries using domain concepts.
 * Returns empty array if none found (NOT an error - valid scenario).
 * Throws exception on infrastructure failures.
 *
 * @param criteria - Domain criteria
 * @returns Result<Aggregate[]> - Matching aggregates (may be empty) or business error
 * @throws InfrastructureException - On catastrophic infrastructure failures
 */
findByStatus(status: OrderStatus): Promise<Result<Order[]>>;
findByCustomerId(customerId: CustomerId): Promise<Result<Order[]>>;

// Usage in Use Case
const result = await orderRepository.findByStatus(OrderStatus.PENDING);

if (result.isFailure) {
  // Business error (e.g., data mapping failed)
  return Result.fail(result.error);
}

const pendingOrders = result.value; // May be empty array (valid!)

// Implementation Example
class PrismaOrderRepository implements IOrderRepository {
  async findByStatus(status: OrderStatus): Promise<Result<Order[]>> {
    try {
      const ordersData = await this.prisma.order.findMany({
        where: { status: status.value },
        include: { items: true, shippingAddress: true }
      });

      // Empty array is valid - not an error
      if (ordersData.length === 0) {
        return Result.ok([]);
      }

      // Map all orders to domain
      const orders: Order[] = [];
      for (const orderData of ordersData) {
        const orderOrError = OrderMapper.toDomain(orderData);
        if (orderOrError.isFailure) {
          // Business error - corrupted data in database
          return Result.fail(`Failed to map order ${orderData.id}: ${orderOrError.error}`);
        }
        orders.push(orderOrError.value);
      }

      return Result.ok(orders);

    } catch (error) {
      // Infrastructure catastrophe - throw
      throw new InfrastructureException(
        'Database error while finding orders by status',
        error
      );
    }
  }
}
```

### Pattern 4: exists() - Check Existence

```typescript
/**
 * Checks if aggregate exists without loading it.
 * More efficient than findById when only checking existence.
 *
 * @param id - Aggregate ID
 * @returns Result<boolean> - True if exists, false if not, or error
 */
exists(id: AggregateId): Promise<Result<boolean>>;

// Usage
const existsResult = await orderRepository.exists(orderId);

if (existsResult.isFailure) {
  return Result.fail(existsResult.error);
}

if (!existsResult.value) {
  return Result.fail('Order does not exist');
}
```

### Pattern 5: delete() - Remove Aggregate

```typescript
/**
 * Deletes aggregate by ID.
 * Implementations handle cascade deletes for children.
 *
 * @param id - Aggregate ID
 * @returns Result<void> - Success or error
 */
delete(id: AggregateId): Promise<Result<void>>;

// Usage
const deleteResult = await orderRepository.delete(orderId);

if (deleteResult.isFailure) {
  return Result.fail(deleteResult.error);
}

// Deleted successfully
```

### Pattern 6: count() - Count Aggregates

```typescript
/**
 * Counts aggregates matching criteria.
 *
 * @returns Result<number> - Count or error
 */
count(): Promise<Result<number>>;
countByStatus(status: OrderStatus): Promise<Result<number>>;

// Usage
const countResult = await orderRepository.countByStatus(OrderStatus.PENDING);

if (countResult.isSuccess) {
  console.log(`Pending orders: ${countResult.value}`);
}
```

---

## 10. Error Handling Strategy in Implementations

### Dual Error-Handling Model

Repository implementations must distinguish between two types of failures:

#### Business/Domain Errors (Return `Result.fail()`)

These are **expected** errors that are part of normal business operations:

```typescript
// ✅ Business errors - return Result.fail()
class PrismaNetworkDeviceRepository implements INetworkDeviceRepository {
  async save(device: NetworkDevice): Promise<Result<NetworkDevice>> {
    try {
      // ... save logic ...

    } catch (error) {
      // Unique constraint violation - IP address already exists
      if (error.code === 'P2002' && error.meta?.target?.includes('ipAddress')) {
        return Result.fail(`Device with IP ${device.ipAddress} already exists`);
      }

      // Unique constraint violation - MAC address already exists
      if (error.code === 'P2002' && error.meta?.target?.includes('macAddress')) {
        return Result.fail(`Device with MAC ${device.macAddress} already exists`);
      }

      // Foreign key violation - referenced entity doesn't exist
      if (error.code === 'P2003') {
        return Result.fail('Referenced entity does not exist');
      }

      // Infrastructure error - throw (see below)
      throw new InfrastructureException('Database error', error);
    }
  }

  async findById(id: DeviceId): Promise<Result<NetworkDevice | null>> {
    try {
      const data = await this.prisma.device.findUnique({...});

      // Not found - valid scenario
      if (!data) return Result.ok(null);

      // Map to domain
      const deviceOrError = NetworkDeviceMapper.toDomain(data);
      if (deviceOrError.isFailure) {
        // Data corruption or invalid data - business error
        return Result.fail(`Invalid device data: ${deviceOrError.error}`);
      }

      return Result.ok(deviceOrError.value);

    } catch (error) {
      // Infrastructure catastrophe - throw
      throw new InfrastructureException('Database error', error);
    }
  }
}
```

#### Infrastructure Errors (Throw Exceptions)

These are **unexpected** system-level failures:

```typescript
// ❌ Infrastructure catastrophes - throw exceptions
class PrismaOrderRepository implements IOrderRepository {
  async findById(id: OrderId): Promise<Result<Order | null>> {
    try {
      const data = await this.prisma.order.findUnique({...});
      // ... business logic ...

    } catch (error) {
      // Connection errors
      if (error.code === 'P1001') {
        throw new InfrastructureException('Cannot connect to database', error);
      }

      // Timeout errors
      if (error.code === 'P1008') {
        throw new InfrastructureException('Database operation timed out', error);
      }

      // Authentication errors
      if (error.code === 'P1000') {
        throw new InfrastructureException('Database authentication failed', error);
      }

      // Unknown errors - likely infrastructure issues
      throw new InfrastructureException(
        'Unexpected database error while finding order',
        error
      );
    }
  }
}
```

### Error Classification Decision Tree

```
Is this error expected in normal business operations?
│
├─ YES → Return Result.fail()
│   ├─ Entity not found (when expected to exist)
│   ├─ Duplicate key violations
│   ├─ Foreign key violations
│   ├─ Data validation failures during mapping
│   └─ Business constraint violations
│
└─ NO → Throw Exception
    ├─ Database connection lost
    ├─ Network timeout
    ├─ Authentication failure
    ├─ Query syntax errors
    ├─ ORM crashes
    └─ Unknown/unexpected errors
```

### Benefits of This Approach

1. **Clear Separation**: Business logic errors vs system failures
2. **Appropriate Handling**: Use cases handle business errors, global handlers catch infrastructure errors
3. **Clean Code**: Use cases don't need try-catch for every repository call
4. **Fail Fast**: Infrastructure issues bubble up immediately
5. **Type Safety**: Method signatures clearly indicate expected error types

### Example: Use Case Error Handling

```typescript
class CreateNetworkDeviceUseCase {
  async execute(request: CreateDeviceRequest): Promise<Result<NetworkDevice>> {
    // No try-catch needed - infrastructure errors throw to global handler

    // Check for duplicate IP
    const ipExistsResult = await this.deviceRepo.existsByIpAddress(request.ipAddress);
    if (ipExistsResult.isFailure) {
      // Business error from repository
      return Result.fail(ipExistsResult.error);
    }

    if (ipExistsResult.value) {
      // Business rule violation
      return Result.fail('IP address already in use');
    }

    // Create device
    const deviceOrError = NetworkDevice.create(request);
    if (deviceOrError.isFailure) {
      return Result.fail(deviceOrError.error);
    }

    // Save device
    const saveResult = await this.deviceRepo.save(deviceOrError.value);
    if (saveResult.isFailure) {
      // Business error (e.g., race condition - IP taken between check and save)
      return Result.fail(saveResult.error);
    }

    return Result.ok(saveResult.value);

    // If database connection fails, exception throws to global error handler
    // Use case doesn't need to handle "database is down" scenarios
  }
}
```

### Example: Global Error Handler

```typescript
// In Express.js or similar framework
app.use((error, req, res, next) => {
  if (error instanceof InfrastructureException) {
    logger.error('Infrastructure failure:', error);

    return res.status(503).json({
      error: 'Service temporarily unavailable',
      message: 'Please try again later'
    });
  }

  // Other error types...
  next(error);
});
```

---

## 11. Testing Strategy

### Mocking Repositories in Unit Tests:

```typescript
// Mock repository for testing use cases
class MockOrderRepository implements IOrderRepository {
  public orders: Map<string, Order> = new Map();
  public saveCalled = false;
  public findByIdCalled = false;

  async save(order: Order): Promise<Result<Order>> {
    this.saveCalled = true;
    this.orders.set(order.id.toString(), order);
    return Result.ok(order);
  }

  async findById(id: OrderId): Promise<Result<Order | null>> {
    this.findByIdCalled = true;
    const order = this.orders.get(id.toString()) ?? null;
    return Result.ok(order);
  }

  async delete(id: OrderId): Promise<Result<void>> {
    this.orders.delete(id.toString());
    return Result.ok();
  }

  async findByCustomerId(customerId: CustomerId): Promise<Result<Order[]>> {
    const orders = Array.from(this.orders.values()).filter(
      order => order.customerId.equals(customerId)
    );
    return Result.ok(orders);
  }

  async exists(id: OrderId): Promise<Result<boolean>> {
    return Result.ok(this.orders.has(id.toString()));
  }

  async count(): Promise<Result<number>> {
    return Result.ok(this.orders.size);
  }
}

// Using mock in use case test
describe('ConfirmOrderUseCase', () => {
  let useCase: ConfirmOrderUseCase;
  let mockRepo: MockOrderRepository;

  beforeEach(() => {
    mockRepo = new MockOrderRepository();
    useCase = new ConfirmOrderUseCase(mockRepo);
  });

  it('should confirm order successfully', async () => {
    // Arrange
    const order = Order.create({ ... }).value;
    await mockRepo.save(order);

    // Act
    const result = await useCase.execute({ orderId: order.id });

    // Assert
    expect(result.isSuccess).toBe(true);
    expect(mockRepo.saveCalled).toBe(true);

    const savedOrder = mockRepo.orders.get(order.id.toString());
    expect(savedOrder?.status).toBe(OrderStatus.CONFIRMED);
  });
});
```

### Integration Tests for Repository Implementations:

```typescript
describe('PrismaOrderRepository (Integration)', () => {
  let repository: IOrderRepository;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    repository = new PrismaOrderRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean database
    await prisma.order.deleteMany();
  });

  describe('save', () => {
    it('should persist new order', async () => {
      const order = Order.create({
        customerId: 'customer-123',
        items: [createMockOrderItem()],
        shippingAddress: createMockAddress()
      }).value;

      const result = await repository.save(order);

      expect(result.isSuccess).toBe(true);

      // Verify in database
      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id.toString() }
      });

      expect(dbOrder).toBeDefined();
      expect(dbOrder?.customerId).toBe('customer-123');
    });

    it('should update existing order', async () => {
      const order = Order.create({ ... }).value;
      await repository.save(order);

      order.confirm();

      const result = await repository.save(order);

      expect(result.isSuccess).toBe(true);

      const dbOrder = await prisma.order.findUnique({
        where: { id: order.id.toString() }
      });

      expect(dbOrder?.status).toBe('CONFIRMED');
    });
  });

  describe('findById', () => {
    it('should return order if exists', async () => {
      const order = Order.create({ ... }).value;
      await repository.save(order);

      const result = await repository.findById(order.id);

      expect(result.isSuccess).toBe(true);
      expect(result.value).not.toBeNull();
      expect(result.value?.id.equals(order.id)).toBe(true);
    });

    it('should return null if not exists', async () => {
      const result = await repository.findById(OrderId.create().value);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });
  });

  describe('findByCustomerId', () => {
    it('should return all customer orders', async () => {
      const customerId = CustomerId.create('customer-123').value;

      const order1 = Order.create({ customerId: customerId.toString(), ... }).value;
      const order2 = Order.create({ customerId: customerId.toString(), ... }).value;
      const order3 = Order.create({ customerId: 'other-customer', ... }).value;

      await repository.save(order1);
      await repository.save(order2);
      await repository.save(order3);

      const result = await repository.findByCustomerId(customerId);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(2);
    });
  });
});
```

---

## 12. Examples

### Example 1: INetworkDeviceRepository

```typescript
import { Result } from '@/shared/core/Result';
import {
  NetworkDevice,
  NetworkDeviceId
} from '@/domain/aggregates/NetworkDevice';
import { IPAddress } from '@/domain/value-objects/IPAddress';
import { MACAddress } from '@/domain/value-objects/MACAddress';
import { NetworkDeviceStatus } from '@/domain/value-objects/NetworkDeviceStatus';

/**
 * Repository interface for NetworkDevice aggregate.
 *
 * Responsibilities:
 * - Persist and retrieve network devices
 * - Query devices by IP, MAC, status
 * - Check uniqueness of IP and MAC addresses
 *
 * Implementation Notes:
 * - Must load device WITH polling configuration
 * - Must dispatch domain events after save
 * - Must handle unique constraint violations (IP, MAC) as business errors
 * - Business errors return Result.fail(), infrastructure errors throw exceptions
 */
export interface INetworkDeviceRepository {
  /**
   * Saves a network device (create or update).
   * Loads entire aggregate including PollingConfiguration.
   * Returns Result.fail() if IP or MAC address already exists.
   *
   * @param device - Network device to save
   * @returns Result<NetworkDevice> - Saved device or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  save(device: NetworkDevice): Promise<Result<NetworkDevice>>;

  /**
   * Finds a device by its unique identifier.
   * Returns null if not found (valid scenario, not an error).
   *
   * @param id - Device ID
   * @returns Result<NetworkDevice | null> - Device, null, or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  findById(
    id: NetworkDeviceId
  ): Promise<Result<NetworkDevice | null>>;

  /**
   * Finds a device by IP address.
   * IP addresses are unique per device.
   * Returns null if not found (valid scenario, not an error).
   *
   * @param ipAddress - IP address
   * @returns Result<NetworkDevice | null> - Device, null, or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  findByIpAddress(
    ipAddress: IPAddress
  ): Promise<Result<NetworkDevice | null>>;

  /**
   * Finds a device by MAC address.
   * MAC addresses are unique per device.
   * Returns null if not found (valid scenario, not an error).
   *
   * @param macAddress - MAC address
   * @returns Result<NetworkDevice | null> - Device, null, or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  findByMacAddress(
    macAddress: MACAddress
  ): Promise<Result<NetworkDevice | null>>;

  /**
   * Finds all devices with a specific status.
   * Returns empty array if none found (valid scenario, not an error).
   *
   * @param status - Device status
   * @returns Result<NetworkDevice[]> - Devices with status (may be empty) or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  findByStatus(
    status: NetworkDeviceStatus
  ): Promise<Result<NetworkDevice[]>>;

  /**
   * Finds all devices (with optional pagination).
   * Returns empty array if none found (valid scenario, not an error).
   *
   * @param limit - Maximum results
   * @param offset - Results to skip
   * @returns Result<NetworkDevice[]> - Devices (may be empty) or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  findAll(
    limit?: number,
    offset?: number
  ): Promise<Result<NetworkDevice[]>>;

  /**
   * Deletes a device by ID.
   * Cascade deletes polling configuration and results.
   *
   * @param id - Device ID
   * @returns Result<void> - Success or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  delete(id: NetworkDeviceId): Promise<Result<void>>;

  /**
   * Checks if a device exists with the given ID.
   *
   * @param id - Device ID
   * @returns Result<boolean> - True if exists, false otherwise, or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  exists(id: NetworkDeviceId): Promise<Result<boolean>>;

  /**
   * Checks if an IP address is already in use.
   * Used for uniqueness validation.
   *
   * @param ipAddress - IP address to check
   * @returns Result<boolean> - True if in use, false otherwise, or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  existsByIpAddress(ipAddress: IPAddress): Promise<Result<boolean>>;

  /**
   * Checks if a MAC address is already in use.
   * Used for uniqueness validation.
   *
   * @param macAddress - MAC address to check
   * @returns Result<boolean> - True if in use, false otherwise, or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  existsByMacAddress(
    macAddress: MACAddress
  ): Promise<Result<boolean>>;

  /**
   * Counts total devices.
   *
   * @returns Result<number> - Device count or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  count(): Promise<Result<number>>;

  /**
   * Counts devices by status.
   *
   * @param status - Device status
   * @returns Result<number> - Count or business error
   * @throws InfrastructureException - On catastrophic infrastructure failures
   */
  countByStatus(status: NetworkDeviceStatus): Promise<Result<number>>;
}
```

### Example 2: IOrderRepository with Rich Queries

```typescript
import { Result } from '@/shared/core/Result';
import { Order, OrderId } from '@/domain/aggregates/Order';
import { CustomerId } from '@/domain/aggregates/Customer';
import { OrderStatus } from '@/domain/value-objects/OrderStatus';
import { Money } from '@/domain/value-objects/Money';

/**
 * Repository interface for Order aggregate.
 *
 * Provides rich querying capabilities using domain concepts.
 */
export interface IOrderRepository {
  // Basic CRUD
  save(order: Order): Promise<Result<Order>>;
  findById(id: OrderId): Promise<Result<Order | null>>;
  delete(id: OrderId): Promise<Result<void>>;

  // Customer queries
  findByCustomerId(customerId: CustomerId): Promise<Result<Order[]>>;
  findRecentOrdersForCustomer(
    customerId: CustomerId,
    days: number
  ): Promise<Result<Order[]>>;

  // Status queries
  findByStatus(status: OrderStatus): Promise<Result<Order[]>>;
  findPendingOrders(): Promise<Result<Order[]>>;
  findConfirmedOrders(): Promise<Result<Order[]>>;

  // Date queries
  findOrdersPlacedAfter(date: Date): Promise<Result<Order[]>>;
  findOrdersPlacedBetween(
    startDate: Date,
    endDate: Date
  ): Promise<Result<Order[]>>;

  // Value queries
  findOrdersAboveAmount(amount: Money): Promise<Result<Order[]>>;
  findLargeOrders(threshold: Money): Promise<Result<Order[]>>;

  // Complex queries
  findPendingOrdersForCustomer(
    customerId: CustomerId
  ): Promise<Result<Order[]>>;

  findOrdersRequiringShipping(): Promise<Result<Order[]>>;

  // Existence checks
  hasPendingOrders(customerId: CustomerId): Promise<Result<boolean>>;
  hasOrdersInLast30Days(
    customerId: CustomerId
  ): Promise<Result<boolean>>;

  // Counts
  countByCustomerId(customerId: CustomerId): Promise<Result<number>>;
  countByStatus(status: OrderStatus): Promise<Result<number>>;
}
```

---

## Summary Checklist

When creating a Repository Interface, ensure:

**Interface Design:**
- ✅ Interface name: I + AggregateName + Repository
- ✅ Located in domain layer (src/domain/repository/)
- ✅ One repository per aggregate root
- ✅ Uses domain types (entities, VOs, IDs) - no primitives
- ✅ No DTOs or presentation types
- ✅ No infrastructure details in interface
- ✅ Collection-like metaphor

**Method Signatures:**
- ✅ Returns `Promise<Result<T>>` for all operations
- ✅ save() method (not insert/update)
- ✅ findById() returns `Result<T | null>`
- ✅ Query methods return `Result<T[]>` (empty array is valid)
- ✅ Query methods use domain language
- ✅ Includes @throws JSDoc for infrastructure exceptions

**Error Handling Documentation:**
- ✅ JSDoc documents both Result and thrown exceptions
- ✅ Clear distinction between business and infrastructure errors
- ✅ Implementation notes explain error handling strategy

**Implementation Guidance:**
- ✅ No business logic in interface
- ✅ Comprehensive documentation
- ✅ Clear responsibilities noted
- ✅ Error handling strategy documented

**Error Handling in Implementations:**
- ✅ Business errors return `Result.fail()`
  - Entity not found (when expected)
  - Duplicate key violations
  - Foreign key violations
  - Data mapping failures
- ✅ Infrastructure errors throw exceptions
  - Database connection lost
  - Network timeouts
  - Authentication failures
  - Unknown/unexpected errors

---

**Remember**: Repository interfaces define the contract for persistence in domain terms. They live in the domain layer and are implemented in the infrastructure layer, ensuring clean separation of concerns! Use the dual error-handling model: `Result.fail()` for business errors, throw exceptions for infrastructure catastrophes.
