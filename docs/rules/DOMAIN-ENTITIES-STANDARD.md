# DOMAIN ENTITIES STANDARD

## Table of Contents

1. [Purpose of Entities in DDD](#1-purpose-of-entities-in-ddd)
2. [Responsibilities of an Entity](#2-responsibilities-of-an-entity)
3. [Boundaries of an Entity](#3-boundaries-of-an-entity)
4. [Connections with Other Layers](#4-connections-with-other-layers)
5. [Entity Lifetime & Lifecycle](#5-entity-lifetime--lifecycle)
6. [Entity Structure Template](#6-entity-structure-template)
7. [Orthogonality Principles](#7-orthogonality-principles)
8. [Naming Conventions](#8-naming-conventions)
9. [Error Handling Patterns](#9-error-handling-patterns)
10. [Identity and Equality](#10-identity-and-equality)
11. [Testing Strategy](#11-testing-strategy)
12. [Examples](#12-examples)

---

## 1. Purpose of Entities in DDD

**Entities are domain objects that have a unique identity that runs through time and different representations.**

### Core Characteristics:

- **Identity**: Distinguished by an ID, not by attributes
- **Mutable**: Can change state over time while maintaining identity
- **Lifecycle**: Created, modified, persisted, retrieved, and deleted
- **Business Logic**: Contains domain behavior and enforces invariants
- **Equality by ID**: Two entities with same ID are the same entity, regardless of other attributes

### Entities vs Value Objects:

| Aspect         | Entity              | Value Object          |
| -------------- | ------------------- | --------------------- |
| **Identity**   | Has unique ID       | No identity           |
| **Equality**   | By ID               | By value              |
| **Mutability** | Mutable             | Immutable             |
| **Lifecycle**  | Persisted over time | Created/discarded     |
| **Example**    | User, Order, Device | Email, Money, Address |

### Entities vs Aggregate Roots:

**IMPORTANT**: Not all entities are aggregate roots. There are two types of entities:

1. **Aggregate Root Entities**: Entities that define consistency boundaries and own other entities
2. **Child Entities**: Entities that exist within an aggregate boundary and cannot exist independently

| Aspect                   | Aggregate Root Entity   | Child Entity                      |
| ------------------------ | ----------------------- | --------------------------------- |
| **Independence**         | Can exist independently | Belongs to an aggregate           |
| **Repository**           | Has its own repository  | No repository (accessed via root) |
| **External References**  | Can be referenced by ID | Only accessible through root      |
| **Consistency Boundary** | Defines the boundary    | Part of the boundary              |
| **Owns Children**        | Can own other entities  | Cannot own other entities         |
| **Example**              | NetworkDevice, Order    | PollingConfiguration, OrderItem   |

**When is an Entity an Aggregate Root?**

An entity becomes an aggregate root when it meets these criteria:

✅ **Has Independent Lifecycle**: Can be created, modified, and deleted independently
✅ **Owns Other Entities**: Contains child entities that cannot exist without it
✅ **Defines Consistency Boundary**: Enforces invariants across multiple entities
✅ **Entry Point for Operations**: All operations on children go through it
✅ **Referenced by Other Aggregates**: Other aggregates reference it by ID

See [DOMAIN-AGGREGATES-STANDARD.md](./DOMAIN-AGGREGATES-STANDARD.md) for detailed information about aggregate roots.

### Why Entities?

1. **Model Real-World Concepts**: Things that have identity (users, devices, orders)
2. **Track Changes Over Time**: History and state transitions matter
3. **Enforce Business Rules**: Domain logic lives within the Entity
4. **Maintain Invariants**: Entity ensures it's always in a valid state
5. **Provide Behavior**: Not just data holders - they DO things

---

## 2. Responsibilities of an Entity

### MUST DO:

1. **Maintain Unique Identity**

   - Every entity has a unique ID (EntityId extends from base ID class)
   - ID never changes during entity lifetime
   - ID used for equality comparison

2. **Enforce Business Invariants**

   - Validate all state changes
   - Prevent invalid state transitions
   - Ensure entity is always in a valid state

3. **Encapsulate Business Logic**

   - Methods that operate on entity state
   - Business rules specific to this entity
   - State transition logic

4. **Manage Internal Entities (if Aggregate Root)**

   - **NOTE**: Only applies to entities that are Aggregate Roots
   - Child entities that belong to this aggregate
   - Lifecycle management of children (create, modify, delete)
   - Cascade operations when appropriate
   - Enforce invariants across all children
   - Regular (child) entities do NOT own other entities

5. **Validate All Mutations**

   - Every state change must be validated
   - Return Result<T> for operations that can fail
   - Provide clear error messages

6. **Maintain Consistency**
   - All properties work together correctly
   - No invalid combinations of values
   - Transactions maintain invariants

---

## 3. Boundaries of an Entity

### MUST NOT DO:

1. **❌ Access Infrastructure Directly**

   - No database calls
   - No HTTP requests
   - No file system access
   - No framework dependencies

2. **❌ Coordinate Multiple Aggregates**

   - Cross-aggregate operations belong in Use Cases or Domain Services
   - Entities work within their own aggregate boundary

3. **❌ Perform Complex Queries**

   - Query logic belongs in Repositories
   - Entities should not contain query methods

4. **❌ Know About Presentation Layer**

   - No DTOs
   - No HTTP concepts
   - No UI logic

5. **❌ Handle Cross-Cutting Concerns**

   - Logging, caching, transactions belong in outer layers
   - Authentication/authorization handled by application layer

6. **❌ Create Other Aggregates**
   - Other aggregates are created by Use Cases, not by entities
   - Aggregate roots CAN create child entities within the same aggregate boundary
   - Child entities CANNOT create other entities (only aggregate roots can)
   - Reference other aggregates by ID only, never create them

---

## 4. Connections with Other Layers

```
┌─────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                        │
│  - Never directly references entities                       │
│  - Works with DTOs                                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  APPLICATION LAYER                          │
│  - Use Cases create and modify Entities                     │
│  - Use Cases coordinate multiple entities                   │
│  - Mappers convert Entities ↔ DTOs                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    DOMAIN LAYER                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │          ENTITIES (You are here)                   │     │
│  │  - Encapsulate business logic                      │     │
│  │  - Enforce invariants                              │     │
│  │  - Contain Value Objects                           │     │
│  │  - May contain child Entities                      │     │
│  │  - Validate all state changes                      │     │
│  └────────────────────────────────────────────────────┘     │
│         ▲                          ▲                        │
│         │                          │                        │
│  ┌──────┴───────┐          ┌───────┴──────┐                 │
│  │ Value Objects│          │  Aggregates  │                 │
│  │              │          │              │                 │
│  │ - Entities   │          │ - Aggregate  │                 │
│  │   contain    │          │   Root is    │                 │
│  │   VOs        │          │   an Entity  │                 │
│  └──────────────┘          └──────────────┘                 │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Repository Interfaces (contracts)                  │    │
│  │  - save(entity), findById(id), delete(id)           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                         ▲
                         │ Implements
┌─────────────────────────────────────────────────────────────┐
│                INFRASTRUCTURE LAYER                         │
│  - Repository implementations persist entities              │
│  - Infrastructure mappers convert Entity ↔ DB model         │
│  - Never modify entity business logic                       │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Rules:

✅ **Entities CAN depend on:**

- Value Objects (composition)
- Other Entities (within same aggregate)
- Domain Events
- Result<T> type
- Shared kernel types

❌ **Entities CANNOT depend on:**

- Use Cases
- Repositories (can use interfaces in some patterns)
- Application Services
- Infrastructure
- Presentation/DTOs

---

## 5. Entity Lifetime & Lifecycle

### Creation Flow:

```typescript
// 1. Use Case receives request (from controller/API)
const request = { name: "Router-01", ipAddress: "192.168.1.1", ... };

// 2. Use Case creates Value Objects
const ipResult = IPAddress.create(request.ipAddress);
if (ipResult.isFailure) {
  return Result.fail(ipResult.error);
}

// 3. Use Case calls Entity.create() factory method
const deviceResult = NetworkDevice.create({
  name: request.name,
  ipAddress: ipResult.value,
  // ... other properties
});

if (deviceResult.isFailure) {
  return Result.fail(deviceResult.error);
}

// 4. Entity is now in memory, validated, ready to use
const device = deviceResult.value;

// 5. Use Case persists entity via repository
await repository.save(device);

// 6. Entity lifecycle continues...
// - Retrieved from DB via repository
// - Modified through domain methods
// - Persisted again via repository
// - Eventually deleted
```

### Lifecycle States:

1. **Transient**: Created in memory, not yet persisted
2. **Persistent**: Saved to database, has ID
3. **Detached**: Was persistent, no longer tracked by repository
4. **Modified**: Persistent entity with unsaved changes
5. **Deleted**: Marked for removal

### State Transition Example:

```typescript
// TRANSIENT - Just created
const device = NetworkDevice.create({ ... }).value;

// PERSISTENT - After save
await repository.save(device);

// MODIFIED - After domain operation
device.updateStatus(NetworkDeviceStatus.MAINTENANCE);

// PERSISTENT AGAIN - After save
await repository.save(device);

// DELETED - After removal
await repository.delete(device.id);
```

---

## 6. Entity Structure Template

### Base Entity (Abstract):

```typescript
import { UniqueEntityID } from './UniqueEntityID';

/**
 * Base class for all domain entities.
 *
 * Entities are domain objects that have a unique identity (ID) and may have
 * mutable or immutable properties. Their identity is defined by their
 * {@link UniqueEntityID}, and equality between entities is determined by
 * comparing their IDs.
 *
 * @template T The shape of the entity's properties.
 * @template TID The type of the entity's unique identifier, extending {@link UniqueEntityID}.
 */
export abstract class Entity<T, TID extends UniqueEntityID> {
  /**
   * The unique identifier of the entity.
   * @protected
   */
  protected readonly _id: TID;

  /**
   * The internal properties of the entity.
   * @protected
   */
  protected props: T;

  /**
   * Creates a new entity instance.
   *
   * @param {T} props - The properties that define the entity's state.
   * @param {TID} id - The unique identifier for this entity.
   */
  protected constructor(props: T, id: TID) {
    this._id = id;
    this.props = props;
  }

  /**
   * Gets the unique identifier of the entity.
   *
   * @returns {TID} The entity's ID type.
   */
  get id(): TID {
    return this._id;
  }

  /**
   * Compares this entity with another to determine if they are equal.
   *
   * Two entities are equal if:
   * - They are the same reference, or
   * - They are both entities and their IDs match.
   *
   * @param {Entity<T, TID>} [object] - The entity to compare with.
   * @returns {boolean} True if both represent the same entity, otherwise false.
   */
  public equals(object?: Entity<T, TID>): boolean {
    if (object === null || object === undefined) {
      return false;
    }

    if (this === object) {
      return true;
    }

    if (!Entity.isEntity(object)) {
      return false;
    }

    return this._id.equals(object.id);
  }

  /**
   * Type guard that checks whether a given value is an Entity.
   *
   * @private
   * @param {unknown} v - The value to check.
   * @returns True if the value is an Entity instance.
   */
  public static isEntity(v: unknown) {
    return v instanceof Entity;
  }
}
```

### Concrete Entity Template:

````typescript
import { Result } from '@/shared/core/Result';
import { Entity } from '@/shared/domain/Entity';
import { UniqueEntityID } from '@/shared/domain/UniqueEntityID';

// Entity-specific ID type
export class EntityNameId extends UniqueEntityID {
  private constructor(id?: string) {
    super(id);
  }

  public static create(id?: string): Result<EntityNameId> {
    return Result.ok<EntityNameId>(new EntityNameId(id));
  }
}

// Entity properties interface
interface EntityNameProps {
  property1: ValueObject1;
  property2: ValueObject2;
  // ... more properties
  createdAt: Date;
  updatedAt: Date;
}

/**
 * [Entity Name] - Brief description of what this entity represents.
 *
 * Invariants:
 * - [Invariant 1]
 * - [Invariant 2]
 *
 * Business Rules:
 * - [Rule 1]
 * - [Rule 2]
 *
 * @example
 * ```typescript
 * const result = EntityName.create({
 *   property1: value1,
 *   property2: value2
 * });
 *
 * if (result.isSuccess) {
 *   const entity = result.value;
 *   entity.doSomething();
 * }
 * ```
 */
export class EntityName extends Entity<
  EntityNameProps,
  EntityNameId
> {
  /**
   * Private constructor enforces factory method usage.
   */
  private constructor(props: EntityNameProps, id: EntityNameId) {
    super(props, id);
  }

  /**
   * Factory method for creating EntityName.
   *
   * @param props - Entity properties (without createdAt/updatedAt)
   * @param id - Mandatory ID
   * @returns Result<EntityName> - Success with valid entity or failure with error
   */
  public static create(
    props: Omit<EntityNameProps, 'createdAt' | 'updatedAt'>,
    id: EntityNameId
  ): Result<EntityName> {
    // Validate required properties
    if (!props.property1) {
      return Result.fail<EntityName>('Property1 is required');
    }

    if (!props.property2) {
      return Result.fail<EntityName>('Property2 is required');
    }

    // Validate business rules
    const validationResult = this.validateInvariants(props);
    if (validationResult.isFailure) {
      return Result.fail<EntityName>(validationResult.error!);
    }

    // Create full props with timestamps
    const entityProps: EntityNameProps = {
      ...props,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return Result.ok<EntityName>(new EntityName(entityProps, id));
  }

  /**
   * Validates all business invariants.
   */
  private static validateInvariants(
    props: Omit<EntityNameProps, 'createdAt' | 'updatedAt'>
  ): Result<void> {
    // Implement business rule validation
    // Example: if (props.property1.value > props.property2.value) return fail

    return Result.ok<void>();
  }

  /**
   * Business method - modifies entity state.
   */
  public doSomething(param: SomeType): Result<void> {
    // Validate the operation
    if (!this.canDoSomething(param)) {
      return Result.fail<void>('Cannot do something: invalid state');
    }

    // Perform the operation - update props
    this.props.property1 = newValue;
    this.props.updatedAt = new Date();

    return Result.ok<void>();
  }

  /**
   * Guard method - checks if operation is allowed.
   */
  private canDoSomething(param: SomeType): boolean {
    // Implement business logic check
    return true;
  }

  // Getters (properties are encapsulated via props)
  get property1(): ValueObject1 {
    return this.props.property1;
  }

  get property2(): ValueObject2 {
    return this.props.property2;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
````

---

## 7. Orthogonality Principles

### 1. Single Responsibility

Each entity represents ONE business concept:

```typescript
// ✅ GOOD - Single responsibility
class Order {
  // Only order-related logic
  public addItem(item: OrderItem): Result<void>;
  public removeItem(itemId: OrderItemId): Result<void>;
  public calculateTotal(): Money;
}

class Customer {
  // Only customer-related logic
  public updateEmail(email: Email): Result<void>;
  public addAddress(address: Address): Result<void>;
}

// ❌ BAD - Mixed responsibilities
class OrderCustomer {
  // Order logic
  public addOrderItem(item: OrderItem): Result<void>;
  // Customer logic
  public updateCustomerEmail(email: Email): Result<void>;
  // Mixing concerns!
}
```

### 2. Encapsulation

Internal state is private, modified only through methods:

```typescript
// ✅ GOOD - Encapsulated in props
interface BankAccountProps {
  balance: Money;
}

class BankAccount extends Entity<BankAccountProps, BankAccountId> {
  private constructor(props: BankAccountProps, id: BankAccountId) {
    super(props, id);
  }

  get balance() {
    return this.props.balance;
  }

  public withdraw(amount: Money): Result<void> {
    if (this.balance.isLessThan(amount)) {
      return Result.fail('Insufficient funds');
    }
    this.balance = this.balance.subtract(amount).value;
    this.touch();
    return Result.ok();
  }
}

// ❌ BAD - Exposed state
class BankAccount {
  public balance: Money; // Public! Anyone can modify!

  public withdraw(amount: Money): Result<void> {
    // Cannot guarantee invariants
    this.balance = this.balance.subtract(amount).value;
    return Result.ok();
  }
}
```

### 3. Fail Fast

Invalid operations fail immediately:

```typescript
// ✅ GOOD - Fails immediately
public assignToProject(project: Project): Result<void> {
  if (!this.isAvailable()) {
    return Result.fail('Employee is not available');
  }

  if (this.hasConflictWith(project)) {
    return Result.fail('Project conflicts with existing assignments');
  }

  this._currentProject = project;
  this.touch();
  return Result.ok();
}

// ❌ BAD - Fails late or silently
public assignToProject(project: Project): void {
  // No validation!
  this._currentProject = project; // Might create invalid state
}
```

---

## 8. Naming Conventions

### Entity Class Names:

- Use **nouns** representing domain concepts
- Use **PascalCase**
- Use singular form (not plural)
- Be specific and meaningful

```typescript
// ✅ GOOD
class NetworkDevice {}
class PollingConfiguration {}
class User {}
class Order {}

// ❌ BAD
class NetworkDevices {} // Plural
class Device {} // Too generic
class ND {} // Abbreviated
class DeviceEntity {} // "Entity" suffix unnecessary
```

### ID Class Names:

- Entity name + "Id" suffix
- Extends UniqueEntityID

```typescript
// ✅ GOOD
class NetworkDeviceId extends UniqueEntityID {}
class OrderId extends UniqueEntityID {}

// ❌ BAD
class DeviceIdentifier {} // Non-standard
class NetworkDevice_ID {} // Bad casing
```

### Property Names:

- Use **camelCase**
- Be descriptive

```typescript
interface OrderProps {
  items: OrderItem[]; // ✅
  totalAmount: Money; // ✅
  shippingAddress: Address; // ✅

  shipping_address: Address; // ❌ not camelCase
  _i: OrderItem[]; // ❌ Not descriptive
}
```

### Method Names:

```typescript
class NetworkDevice {
  // Commands (modify state) - imperative verbs
  public updateStatus(status: NetworkDeviceStatus): Result<void>;
  public assignToGroup(group: string): Result<void>;
  public enablePolling(): Result<void>;

  // Queries (read state) - is/has/get
  public isOnline(): boolean;
  public hasActivePolling(): boolean;
  public getLastPollTime(): Date | null;

  // Calculations - calculate/compute
  public calculateUptime(): number;
  public computeAverageResponseTime(): number;

  // Guards (validation) - can/may (often private)
  private canBePolled(): boolean;
  private mayChangeStatus(newStatus: NetworkDeviceStatus): boolean;
}
```

---

## 9. Error Handling Patterns

### Pattern 1: Result<T> for All State Changes

All methods that modify state should return `Result<T>`:

```typescript
class Order {
  /**
   * Adds an item to the order.
   * Validates inventory, quantity limits, etc.
   */
  public addItem(item: OrderItem): Result<void> {
    // Validate operation
    if (this.status === OrderStatus.COMPLETED) {
      return Result.fail<void>('Cannot add items to completed order');
    }

    if (this.items.length >= 100) {
      return Result.fail<void>('Order cannot exceed 100 items');
    }

    // Perform operation
    this.props.items.push(item);
    this.touch();

    return Result.ok<void>();
  }
}
```

### Pattern 2: Guard Methods

Use private guard methods to check preconditions:

```typescript
class Employee {
  public promote(newRole: Role): Result<void> {
    // Guard checks
    if (!this.canBePromoted()) {
      return Result.fail('Employee is not eligible for promotion');
    }

    if (!this.hasRequiredExperienceFor(newRole)) {
      return Result.fail(`Insufficient experience for ${newRole}`);
    }

    // Operation is safe
    this.props.role = newRole;
    this.props.promotionDate = new Date();
    this.touch();

    return Result.ok();
  }

  private canBePromoted(): boolean {
    return (
      this.performanceRating >= 4.0 && this.yearsInCurrentRole >= 2
    );
  }

  private hasRequiredExperienceFor(role: Role): boolean {
    const requiredYears = role.requiredYearsOfExperience;
    return this.totalYearsOfExperience >= requiredYears;
  }
}
```

### Pattern 3: Specific Error Messages

Provide actionable, specific errors:

```typescript
// ✅ GOOD - Specific and actionable
public withdraw(amount: Money): Result<void> {
  if (!this.hasSameCurrency(amount)) {
    return Result.fail(
      `Cannot withdraw ${amount.currency}. Account currency is ${this._balance.currency}`
    );
  }

  if (this.balance.isLessThan(amount)) {
    return Result.fail(
      `Insufficient funds. Available: ${this._balance.format()}, Requested: ${amount.format()}`
    );
  }

  if (this.isDormant) {
    return Result.fail(
      'Account is dormant. Please reactivate before withdrawing'
    );
  }

  // ...
}

// ❌ BAD - Vague
public withdraw(amount: Money): Result<void> {
  if (this.balance.isLessThan(amount)) {
    return Result.fail('Cannot withdraw'); // Why? How much is available?
  }
  // ...
}
```

### Pattern 4: Invariant Validation

Validate invariants in factory method AND before state changes:

```typescript
class Subscription {
  public static create(
    props: SubscriptionProps
  ): Result<Subscription> {
    // Validate invariants at creation
    const validationResult = this.validateInvariants(props);
    if (validationResult.isFailure) {
      return Result.fail(validationResult.error);
    }

    return Result.ok(new Subscription(props));
  }

  public extend(additionalMonths: number): Result<void> {
    // Validate state change maintains invariants
    const newEndDate = this.calculateNewEndDate(additionalMonths);

    if (newEndDate > this.getMaxAllowedEndDate()) {
      return Result.fail(
        'Extension would exceed maximum subscription length'
      );
    }

    this.endDate = newEndDate;
    this.touch();

    return Result.ok();
  }

  private static validateInvariants(
    props: SubscriptionProps
  ): Result<void> {
    if (props.endDate <= props.startDate) {
      return Result.fail('End date must be after start date');
    }

    const duration = this.calculateDuration(
      props.startDate,
      props.endDate
    );
    if (duration > 60) {
      // 60 months max
      return Result.fail('Subscription cannot exceed 60 months');
    }

    return Result.ok();
  }
}
```

---

## 10. Identity and Equality

### Identity Implementation:

```typescript
import { Result } from '@/shared/core/Result';
import { UniqueEntityID } from '@/shared/domain/UniqueEntityID';

/**
 * Unique identifier for NetworkDevice entities.
 */
export class NetworkDeviceId extends UniqueEntityID {
  private constructor(id?: string) {
    super(id); // Generates UUID if not provided
  }

  public static create(id?: string): Result<NetworkDeviceId> {
    return Result.ok<NetworkDeviceId>(new NetworkDeviceId(id));
  }

  /**
   * Compares two NetworkDeviceId instances.
   */
  public equals(other: NetworkDeviceId | null | undefined): boolean {
    if (other == null || !(other instanceof NetworkDeviceId)) {
      return false;
    }
    return this.toString() === other.toString();
  }
}
```

### Entity Equality (ID-Based):

```typescript
class NetworkDevice extends Entity<NetworkDeviceId> {
  // equals() inherited from Entity base class
  // Compares by ID only
}

// Usage
const device1 = NetworkDevice.create({ name: "Router-01", ... }).value;
const device2 = NetworkDevice.create({ name: "Router-02", ... }).value;
const device1Copy = device1; // Same reference

console.log(device1.equals(device1Copy)); // true - same ID
console.log(device1.equals(device2));     // false - different IDs

// Even if all properties are the same, different IDs = different entities
```

### Key Principle: Identity vs Value

```typescript
// Entities: Equal by ID
const user1 = User.create(
  { email: 'test@example.com' },
  userId1
).value;
const user2 = User.create(
  { email: 'test@example.com' },
  userId2
).value;

console.log(user1.equals(user2)); // FALSE - different IDs (different people!)

// Value Objects: Equal by value
const email1 = Email.create('test@example.com').value;
const email2 = Email.create('test@example.com').value;

console.log(email1.equals(email2)); // TRUE - same value (same email!)
```

---

## 11. Testing Strategy

### Test Structure:

```typescript
import {
  NetworkDevice,
  NetworkDeviceId
} from '@/domain/entities/NetworkDevice';
import { IPAddress } from '@/domain/value-objects/IPAddress';
import { MACAddress } from '@/domain/value-objects/MACAddress';

describe('NetworkDevice Entity', () => {
  // Helper to create valid test data
  const createValidProps = () => ({
    name: 'Test-Device',
    ipAddress: IPAddress.create('192.168.1.1').value,
    macAddress: MACAddress.create('00:11:22:33:44:55').value
    // ... other valid properties
  });

  describe('create', () => {
    describe('when valid properties', () => {
      it('should create NetworkDevice successfully', () => {
        const props = createValidProps();
        const result = NetworkDevice.create(props);

        expect(result.isSuccess).toBe(true);
        expect(result.value.name).toBe('Test-Device');
        expect(result.value.ipAddress).toBe(props.ipAddress);
      });

      it('should generate ID if not provided', () => {
        const props = createValidProps();
        const result = NetworkDevice.create(props);

        expect(result.value.id).toBeDefined();
        expect(result.value.id.toString()).toBeTruthy();
      });

      it('should use provided ID if given', () => {
        const props = createValidProps();
        const id = NetworkDeviceId.create('custom-id').value;
        const result = NetworkDevice.create(props, id);

        expect(result.value.id.toString()).toBe('custom-id');
      });
    });

    describe('when invalid properties', () => {
      it('should fail if name is empty', () => {
        const props = { ...createValidProps(), name: '' };
        const result = NetworkDevice.create(props);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });

      it('should fail if IP address is missing', () => {
        const props = {
          ...createValidProps(),
          ipAddress: null as any
        };
        const result = NetworkDevice.create(props);

        expect(result.isFailure).toBe(true);
      });
    });

    describe('invariant validation', () => {
      it('should enforce business rules at creation', () => {
        // Example: Device name must not exceed 50 characters
        const props = {
          ...createValidProps(),
          name: 'A'.repeat(51)
        };
        const result = NetworkDevice.create(props);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('50 characters');
      });
    });
  });

  describe('updateStatus', () => {
    it('should update status successfully', () => {
      const device = NetworkDevice.create(createValidProps()).value;
      const result = device.updateStatus(
        NetworkDeviceStatus.MAINTENANCE
      );

      expect(result.isSuccess).toBe(true);
      expect(device.status).toBe(NetworkDeviceStatus.MAINTENANCE);
    });

    it('should fail if invalid state transition', () => {
      const device = NetworkDevice.create(createValidProps()).value;
      // Assume DELETED devices cannot change status
      device.delete();

      const result = device.updateStatus(NetworkDeviceStatus.ONLINE);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('deleted');
    });

    it('should update timestamp on successful change', () => {
      const device = NetworkDevice.create(createValidProps()).value;
      const originalUpdatedAt = device.updatedAt;

      // Wait a bit to ensure timestamp changes
      setTimeout(() => {
        device.updateStatus(NetworkDeviceStatus.MAINTENANCE);
        expect(device.updatedAt).not.toEqual(originalUpdatedAt);
      }, 10);
    });
  });

  describe('equals', () => {
    it('should return true for same ID', () => {
      const id = NetworkDeviceId.create().value;
      const device1 = NetworkDevice.create(
        createValidProps(),
        id
      ).value;
      const device2 = NetworkDevice.create(
        createValidProps(),
        id
      ).value;

      expect(device1.equals(device2)).toBe(true);
    });

    it('should return false for different IDs', () => {
      const device1 = NetworkDevice.create(createValidProps()).value;
      const device2 = NetworkDevice.create(createValidProps()).value;

      expect(device1.equals(device2)).toBe(false);
    });

    it('should return false for null or undefined', () => {
      const device = NetworkDevice.create(createValidProps()).value;

      expect(device.equals(null)).toBe(false);
      expect(device.equals(undefined)).toBe(false);
    });
  });

  describe('business logic', () => {
    describe('enablePolling', () => {
      it('should enable polling for online device', () => {
        const device = NetworkDevice.create({
          ...createValidProps(),
          status: NetworkDeviceStatus.ONLINE
        }).value;

        const result = device.enablePolling();

        expect(result.isSuccess).toBe(true);
        expect(device.pollingEnabled).toBe(true);
      });

      it('should fail for offline device', () => {
        const device = NetworkDevice.create({
          ...createValidProps(),
          status: NetworkDeviceStatus.OFFLINE
        }).value;

        const result = device.enablePolling();

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('offline');
      });
    });
  });

  describe('timestamp management', () => {
    it('should set createdAt on creation', () => {
      const device = NetworkDevice.create(createValidProps()).value;

      expect(device.createdAt).toBeInstanceOf(Date);
      expect(device.createdAt.getTime()).toBeLessThanOrEqual(
        Date.now()
      );
    });

    it('should update updatedAt on modification', () => {
      const device = NetworkDevice.create(createValidProps()).value;
      const originalUpdatedAt = device.updatedAt.getTime();

      // Modify entity
      setTimeout(() => {
        device.updateName('New-Name');
        expect(device.updatedAt.getTime()).toBeGreaterThan(
          originalUpdatedAt
        );
      }, 10);
    });
  });
});
```

### Test Coverage Requirements:

1. **Creation Tests**:

   - Valid creation (with and without ID)
   - All validation rules
   - Invariant enforcement
   - Edge cases

2. **Business Logic Tests**:

   - All public methods
   - Valid operations
   - Invalid operations (guards)
   - State transitions

3. **Equality Tests**:

   - Same ID = equal
   - Different ID = not equal
   - Null/undefined handling

4. **Timestamp Tests**:
   - createdAt set on creation
   - updatedAt changes on modification

---

## 12. Examples

### Example 1: Simple Entity - PollingConfiguration

```typescript
import { Result } from '@/shared/core/Result';
import { Entity } from '@/shared/domain/Entity';
import { UniqueEntityID } from '@/shared/domain/UniqueEntityID';
import { PollingInterval } from '@/domain/value-objects/PollingInterval';

export class PollingConfigurationId extends UniqueEntityID {
  private constructor(id?: string) {
    super(id);
  }

  public static create(id?: string): Result<PollingConfigurationId> {
    return Result.ok<PollingConfigurationId>(
      new PollingConfigurationId(id)
    );
  }
}

interface PollingConfigurationProps {
  interval: PollingInterval;
  enabled: boolean;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * PollingConfiguration entity - Configuration for device polling.
 *
 * Invariants:
 * - Interval must be valid
 * - Max retries between 0 and 10
 * - If disabled, interval doesn't matter
 *
 * Business Rules:
 * - Cannot enable polling with invalid interval
 * - Cannot set retries above 10 (system limit)
 */
export class PollingConfiguration extends Entity<
  PollingConfigurationProps,
  PollingConfigurationId
> {
  private constructor(
    props: PollingConfigurationProps,
    id: PollingConfigurationId
  ) {
    super(props, id);
  }

  public static create(
    props: Omit<PollingConfigurationProps, 'createdAt' | 'updatedAt'>,
    id?: PollingConfigurationId
  ): Result<PollingConfiguration> {
    // Validate interval
    if (!props.interval) {
      return Result.fail<PollingConfiguration>(
        'Interval is required'
      );
    }

    // Validate max retries
    if (props.maxRetries < 0 || props.maxRetries > 10) {
      return Result.fail<PollingConfiguration>(
        'Max retries must be between 0 and 10'
      );
    }

    const configId = id ?? PollingConfigurationId.create().value;

    const configProps: PollingConfigurationProps = {
      ...props,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return Result.ok<PollingConfiguration>(
      new PollingConfiguration(configProps, configId)
    );
  }

  /**
   * Enables polling.
   * Validates that interval is appropriate.
   */
  public enable(): Result<void> {
    if (this.props.interval.seconds < 10) {
      return Result.fail<void>(
        'Cannot enable polling with interval less than 10 seconds'
      );
    }

    this.props.enabled = true;
    this.props.updatedAt = new Date();

    return Result.ok<void>();
  }

  /**
   * Disables polling.
   */
  public disable(): void {
    this.props.enabled = false;
    this.props.updatedAt = new Date();
  }

  /**
   * Updates the polling interval.
   * If enabled, validates new interval is acceptable.
   */
  public updateInterval(newInterval: PollingInterval): Result<void> {
    if (this.props.enabled && newInterval.seconds < 10) {
      return Result.fail<void>(
        'Cannot set interval less than 10 seconds while polling is enabled'
      );
    }

    this.props.interval = newInterval;
    this.props.updatedAt = new Date();

    return Result.ok<void>();
  }

  /**
   * Updates max retry attempts.
   */
  public updateMaxRetries(retries: number): Result<void> {
    if (retries < 0 || retries > 10) {
      return Result.fail<void>(
        'Max retries must be between 0 and 10'
      );
    }

    this.props.maxRetries = retries;
    this.props.updatedAt = new Date();

    return Result.ok<void>();
  }

  // Getters
  get interval(): PollingInterval {
    return this.props.interval;
  }

  get enabled(): boolean {
    return this.props.enabled;
  }

  get maxRetries(): number {
    return this.props.maxRetries;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
```

### Example 2: Complex Entity with Child Entities - Order

```typescript
import { Result } from '@/shared/core/Result';
import { Entity } from '@/shared/domain/Entity';
import { UniqueEntityID } from '@/shared/domain/UniqueEntityID';
import { Money } from '@/domain/value-objects/Money';
import { OrderItem, OrderItemId } from '@/domain/entities/OrderItem';
import { Address } from '@/domain/value-objects/Address';

export class OrderId extends UniqueEntityID {
  private constructor(id?: string) {
    super(id);
  }

  public static create(id?: string): Result<OrderId> {
    return Result.ok<OrderId>(new OrderId(id));
  }
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

interface OrderProps {
  customerId: string;
  items: OrderItem[];
  shippingAddress: Address;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Order aggregate root.
 *
 * Invariants:
 * - Must have at least one item
 * - Cannot exceed 100 items
 * - All items must have same currency
 * - Status transitions follow business rules
 *
 * Business Rules:
 * - Can only add items when PENDING
 * - Can only confirm if total > $0
 * - Cannot cancel after SHIPPED
 */
export class Order extends Entity<OrderProps, OrderId> {
  private constructor(props: OrderProps, id: OrderId) {
    super(props, id);
  }

  public static create(
    props: Omit<OrderProps, 'createdAt' | 'updatedAt'>,
    id?: OrderId
  ): Result<Order> {
    // Validate customer
    if (!props.customerId || props.customerId.trim().length === 0) {
      return Result.fail<Order>('Customer ID is required');
    }

    // Validate items
    if (!props.items || props.items.length === 0) {
      return Result.fail<Order>('Order must have at least one item');
    }

    if (props.items.length > 100) {
      return Result.fail<Order>('Order cannot exceed 100 items');
    }

    // Validate all items have same currency
    const currencies = new Set(
      props.items.map((item) => item.price.currency)
    );
    if (currencies.size > 1) {
      return Result.fail<Order>(
        'All items must have the same currency'
      );
    }

    // Validate shipping address
    if (!props.shippingAddress) {
      return Result.fail<Order>('Shipping address is required');
    }

    const orderId = id ?? OrderId.create().value;

    const orderProps: OrderProps = {
      ...props,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return Result.ok<Order>(new Order(orderProps, orderId));
  }

  /**
   * Adds an item to the order.
   * Only allowed in PENDING status.
   */
  public addItem(item: OrderItem): Result<void> {
    if (this.props.status !== OrderStatus.PENDING) {
      return Result.fail<void>(
        'Can only add items to pending orders'
      );
    }

    if (this.props.items.length >= 100) {
      return Result.fail<void>('Order cannot exceed 100 items');
    }

    // Check currency matches
    if (this.props.items.length > 0) {
      const existingCurrency = this.props.items[0].price.currency;
      if (item.price.currency !== existingCurrency) {
        return Result.fail<void>(
          `Item currency ${item.price.currency} does not match order currency ${existingCurrency}`
        );
      }
    }

    this.props.items.push(item);
    this.props.updatedAt = new Date();

    return Result.ok<void>();
  }

  /**
   * Removes an item from the order.
   */
  public removeItem(itemId: OrderItemId): Result<void> {
    if (this.props.status !== OrderStatus.PENDING) {
      return Result.fail<void>(
        'Can only remove items from pending orders'
      );
    }

    const index = this.props.items.findIndex((item) =>
      item.id.equals(itemId)
    );
    if (index === -1) {
      return Result.fail<void>('Item not found in order');
    }

    this.props.items.splice(index, 1);

    if (this.props.items.length === 0) {
      return Result.fail<void>(
        'Cannot remove last item. Delete order instead.'
      );
    }

    this.props.updatedAt = new Date();

    return Result.ok<void>();
  }

  /**
   * Confirms the order.
   * Transitions from PENDING to CONFIRMED.
   */
  public confirm(): Result<void> {
    if (this.props.status !== OrderStatus.PENDING) {
      return Result.fail<void>(
        'Only pending orders can be confirmed'
      );
    }

    const total = this.calculateTotal();
    if (total.isZero()) {
      return Result.fail<void>(
        'Cannot confirm order with zero total'
      );
    }

    this.props.status = OrderStatus.CONFIRMED;
    this.props.updatedAt = new Date();

    return Result.ok<void>();
  }

  /**
   * Marks order as shipped.
   */
  public ship(): Result<void> {
    if (this.props.status !== OrderStatus.CONFIRMED) {
      return Result.fail<void>(
        'Only confirmed orders can be shipped'
      );
    }

    this.props.status = OrderStatus.SHIPPED;
    this.props.updatedAt = new Date();

    return Result.ok<void>();
  }

  /**
   * Marks order as delivered.
   */
  public deliver(): Result<void> {
    if (this.props.status !== OrderStatus.SHIPPED) {
      return Result.fail<void>(
        'Only shipped orders can be delivered'
      );
    }

    this.props.status = OrderStatus.DELIVERED;
    this.props.updatedAt = new Date();

    return Result.ok<void>();
  }

  /**
   * Cancels the order.
   * Cannot cancel after shipping.
   */
  public cancel(): Result<void> {
    if (
      this.props.status === OrderStatus.SHIPPED ||
      this.props.status === OrderStatus.DELIVERED
    ) {
      return Result.fail<void>(
        'Cannot cancel order that has been shipped'
      );
    }

    if (this.props.status === OrderStatus.CANCELLED) {
      return Result.fail<void>('Order is already cancelled');
    }

    this.props.status = OrderStatus.CANCELLED;
    this.props.updatedAt = new Date();

    return Result.ok<void>();
  }

  /**
   * Calculates total order amount.
   */
  public calculateTotal(): Money {
    if (this.props.items.length === 0) {
      // Return zero in first item's currency or default
      return Money.zero('USD').value;
    }

    let total = this.props.items[0].calculateSubtotal();

    for (let i = 1; i < this.props.items.length; i++) {
      const subtotal = this.props.items[i].calculateSubtotal();
      const addResult = total.add(subtotal);

      if (addResult.isFailure) {
        throw new Error('Failed to calculate total');
      }

      total = addResult.value;
    }

    return total;
  }

  /**
   * Gets item count.
   */
  public getItemCount(): number {
    return this.props.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
  }

  // Getters
  get customerId(): string {
    return this.props.customerId;
  }

  get items(): readonly OrderItem[] {
    return this.props.items; // Return readonly to prevent external modification
  }

  get shippingAddress(): Address {
    return this.props.shippingAddress;
  }

  get status(): OrderStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
```

---

## Summary Checklist

When creating an Entity, ensure:

- ✅ Has unique identity (extends Entity<TId>)
- ✅ Has dedicated ID class (extends UniqueEntityID)
- ✅ Uses private constructor + static factory method
- ✅ Returns Result<T> from factory and mutation methods
- ✅ Validates all invariants at creation
- ✅ Validates all state changes
- ✅ All properties are private with getters
- ✅ Implements business logic as methods
- ✅ Uses guard methods for preconditions
- ✅ Calls `this.touch()` on all mutations
- ✅ Equality based on ID (inherited from Entity base)
- ✅ Contains no infrastructure dependencies
- ✅ Does not access repositories or external services
- ✅ Has comprehensive unit tests
- ✅ Provides clear, actionable error messages

---

**Remember**: Entities are the heart of your domain model. They encapsulate business rules, enforce invariants, and provide behavior. Keep them focused, testable, and free of infrastructure concerns!
