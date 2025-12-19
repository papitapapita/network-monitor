# DOMAIN AGGREGATES STANDARD

## Table of Contents
1. [Purpose of Aggregates in DDD](#1-purpose-of-aggregates-in-ddd)
2. [Responsibilities of an Aggregate](#2-responsibilities-of-an-aggregate)
3. [Boundaries of an Aggregate](#3-boundaries-of-an-aggregate)
4. [Connections with Other Layers](#4-connections-with-other-layers)
5. [Aggregate Lifetime & Lifecycle](#5-aggregate-lifetime--lifecycle)
6. [Aggregate Structure Template](#6-aggregate-structure-template)
7. [Orthogonality Principles](#7-orthogonality-principles)
8. [Naming Conventions](#8-naming-conventions)
9. [Error Handling Patterns](#9-error-handling-patterns)
10. [Transaction and Consistency Boundaries](#10-transaction-and-consistency-boundaries)
11. [Testing Strategy](#11-testing-strategy)
12. [Examples](#12-examples)

---

## 1. Purpose of Aggregates in DDD

**An Aggregate is a cluster of domain objects (entities and value objects) that can be treated as a single unit for data changes.**

### Core Characteristics:

- **Consistency Boundary**: All invariants within aggregate enforced together
- **Transaction Boundary**: One aggregate = one transaction
- **Aggregate Root**: Single entity that serves as entry point
- **External References**: Other aggregates can only reference the root by ID
- **Atomic Changes**: All changes to aggregate are atomic
- **Domain Events**: Aggregates publish events for cross-aggregate communication

### Key Concept: Aggregate Root

The **Aggregate Root** is the only entity within the aggregate that:
- External objects can hold references to
- Can be retrieved from repository
- Enforces invariants for the entire aggregate
- Controls access to internal entities

### Aggregates vs Entities:

| Aspect | Aggregate | Entity |
|--------|-----------|--------|
| **Scope** | Cluster of related objects | Single domain object |
| **Identity** | Root has identity | Has identity |
| **Invariants** | Enforces across multiple objects | Enforces own invariants |
| **Transaction** | Transaction boundary | Part of transaction |
| **Repository** | Has repository | May or may not have repository |
| **External Access** | Only root accessible | Depends on aggregate design |

### Why Aggregates?

1. **Consistency**: Ensure related objects stay consistent together
2. **Transaction Control**: Clear boundaries for atomic operations
3. **Complexity Management**: Reduce coupling between related concepts
4. **Performance**: Optimize loading and saving of related data
5. **Invariant Enforcement**: Business rules spanning multiple objects

---

## 2. Responsibilities of an Aggregate

### MUST DO:

1. **Define Consistency Boundary**
   - All invariants within aggregate enforced together
   - No partial updates that violate business rules
   - Root validates all state changes

2. **Control Access to Internal Entities**
   - External code can only access internal entities through root
   - Root provides methods for operations on children
   - Root decides when to create/modify/delete children

3. **Maintain Aggregate Invariants**
   - Cross-entity business rules enforced by root
   - Validate all changes before applying them
   - Ensure aggregate is always in valid state

4. **Publish Domain Events**
   - Events for significant state changes
   - Events for cross-aggregate coordination
   - Events for audit/notification purposes

5. **Manage Child Lifecycle**
   - Create child entities
   - Modify child entities
   - Remove child entities
   - Prevent orphaned children

6. **Define Transaction Boundary**
   - One aggregate instance = one transaction
   - All changes saved or rolled back together
   - No partial saves

---

## 3. Boundaries of an Aggregate

### How to Define Aggregate Boundaries:

1. **Transactional Consistency**: What must change together?
2. **Invariant Rules**: What rules span multiple objects?
3. **Use Case Analysis**: What operations happen together?
4. **Performance**: Can it be loaded/saved efficiently?

### MUST NOT DO:

1. **❌ Span Too Large**
   - Large aggregates = performance problems
   - Difficult to maintain consistency
   - Increased lock contention
   - Rule of thumb: Keep aggregates small

2. **❌ Enforce Invariants Across Aggregates**
   - Use eventual consistency for cross-aggregate rules
   - Use Domain Events for coordination
   - Use Domain Services for cross-aggregate logic

3. **❌ Hold Direct References to Other Aggregates**
   - Reference by ID only
   - Load other aggregates via repository if needed
   - Prevents tight coupling

4. **❌ Modify Multiple Aggregates in One Transaction**
   - One transaction = one aggregate instance
   - Use Domain Events for multi-aggregate changes
   - Use Sagas for complex multi-aggregate workflows

5. **❌ Allow External Direct Access to Children**
   - All access goes through root
   - Root controls child lifecycle
   - Root enforces aggregate invariants

---

## 4. Connections with Other Layers

```
┌─────────────────────────────────────────────────────────────┐
│                  PRESENTATION LAYER                          │
│  - Never knows about aggregates                              │
│  - Works with DTOs only                                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 APPLICATION LAYER                            │
│  ┌───────────────────────────────────────────────────┐      │
│  │  Use Cases                                         │      │
│  │  - Load aggregate from repository                  │      │
│  │  - Call aggregate root methods                     │      │
│  │  - Save aggregate via repository                   │      │
│  │  - Convert aggregate to DTO via mapper             │      │
│  └───────────────────────────────────────────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    DOMAIN LAYER                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │         AGGREGATES (You are here)                   │     │
│  │                                                     │     │
│  │  ┌──────────────────────────────────────────┐     │     │
│  │  │  Aggregate Root (Entity)                  │     │     │
│  │  │  - Entry point for all operations         │     │     │
│  │  │  - Enforces aggregate invariants          │     │     │
│  │  │  - Controls child entities                │     │     │
│  │  │  - Publishes domain events                │     │     │
│  │  └────────────┬─────────────────────────────┘     │     │
│  │               │                                    │     │
│  │               │ contains                           │     │
│  │               ▼                                    │     │
│  │  ┌──────────────────────────────────────────┐     │     │
│  │  │  Child Entities                           │     │     │
│  │  │  - Accessible only through root           │     │     │
│  │  │  - Part of aggregate boundary             │     │     │
│  │  │  - No independent repository              │     │     │
│  │  └──────────────────────────────────────────┘     │     │
│  │               │                                    │     │
│  │               │ contains                           │     │
│  │               ▼                                    │     │
│  │  ┌──────────────────────────────────────────┐     │     │
│  │  │  Value Objects                            │     │     │
│  │  │  - Shared across entities in aggregate    │     │     │
│  │  │  - Immutable descriptive attributes       │     │     │
│  │  └──────────────────────────────────────────┘     │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  Repository Interface (for Aggregate Root only)               │
└─────────────────────────────────────────────────────────────┘
                         ▲
                         │ implements
┌─────────────────────────────────────────────────────────────┐
│               INFRASTRUCTURE LAYER                           │
│  - Repository saves entire aggregate                         │
│  - Loads aggregate with all children                         │
│  - Transactions span single aggregate                        │
└─────────────────────────────────────────────────────────────┘
```

### Cross-Aggregate Communication:

```
┌─────────────────┐         Domain Event         ┌─────────────────┐
│  Aggregate A    │ ────────────────────────────> │  Aggregate B    │
│  (Root)         │                                │  (Root)         │
│                 │  Reference by ID only          │                 │
│  aggregateB_id  │ <───────────────────────────  │  id             │
└─────────────────┘                                └─────────────────┘
```

---

## 5. Aggregate Lifetime & Lifecycle

### Lifecycle Phases:

```typescript
// 1. CREATION (in Use Case)
const orderResult = Order.create({
  customerId: customerId,
  items: [],
  shippingAddress: address
});
const order = orderResult.value;

// 2. MODIFICATION (through root methods)
order.addItem(item1);
order.addItem(item2);
order.confirm();

// 3. PERSISTENCE (via repository)
await orderRepository.save(order);

// 4. RETRIEVAL (from repository)
const existingOrder = await orderRepository.findById(orderId);

// 5. MORE MODIFICATIONS
existingOrder.ship();
existingOrder.deliver();

// 6. PERSISTENCE AGAIN
await orderRepository.save(existingOrder);

// 7. DELETION
await orderRepository.delete(orderId);
```

### Transaction Scope:

```typescript
// ✅ CORRECT - Single aggregate transaction
async execute(request: CompleteOrderRequest): Promise<Result<OrderDTO>> {
  // 1. Load aggregate
  const orderResult = await this.orderRepository.findById(request.orderId);
  if (orderResult.isFailure) {
    return Result.fail(orderResult.error);
  }
  const order = orderResult.value;

  // 2. Modify aggregate
  const completeResult = order.complete();
  if (completeResult.isFailure) {
    return Result.fail(completeResult.error);
  }

  // 3. Save aggregate (single transaction)
  await this.orderRepository.save(order);

  return Result.ok(OrderMapper.toDTO(order));
}

// ❌ WRONG - Multiple aggregates in one transaction
async execute(request: TransferMoneyRequest): Promise<Result<void>> {
  // Loading two aggregates
  const fromAccount = await this.accountRepo.findById(request.fromAccountId);
  const toAccount = await this.accountRepo.findById(request.toAccountId);

  // Modifying both
  fromAccount.withdraw(amount);
  toAccount.deposit(amount);

  // WRONG! Two aggregates in one transaction
  await this.accountRepo.save(fromAccount);
  await this.accountRepo.save(toAccount);

  // Should use Domain Events or Saga instead
}
```

---

## 6. Aggregate Structure Template

### Aggregate Root Template:

```typescript
import { Result } from '@/shared/core/Result';
import { AggregateRoot } from '@/shared/domain/AggregateRoot';
import { UniqueEntityID } from '@/shared/domain/UniqueEntityID';
import { DomainEvents } from '@/shared/domain/events/DomainEvents';
import { AggregateCreatedEvent } from './events/AggregateCreatedEvent';

// Aggregate Root ID
export class AggregateRootId extends UniqueEntityID {
  private constructor(id?: string) {
    super(id);
  }

  public static create(id?: string): Result<AggregateRootId> {
    return Result.ok<AggregateRootId>(new AggregateRootId(id));
  }
}

// Aggregate Root Properties
interface AggregateRootProps {
  property1: ValueObject1;
  property2: ValueObject2;
  childEntities: ChildEntity[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * [AggregateRoot Name] - Brief description of the aggregate.
 *
 * Aggregate Boundary:
 * - Root: [This entity]
 * - Children: [List of child entities]
 * - Value Objects: [List of VOs]
 *
 * Invariants (enforced by this root):
 * - [Invariant 1 spanning multiple objects]
 * - [Invariant 2 spanning multiple objects]
 *
 * Business Rules:
 * - [Rule 1]
 * - [Rule 2]
 *
 * Domain Events:
 * - [Event 1]: When [trigger]
 * - [Event 2]: When [trigger]
 */
export class AggregateRoot extends AggregateRoot<AggregateRootId> {
  private _property1: ValueObject1;
  private _property2: ValueObject2;
  private _childEntities: ChildEntity[];

  private constructor(
    props: AggregateRootProps,
    id: AggregateRootId
  ) {
    super(id, props.createdAt, props.updatedAt);
    this._property1 = props.property1;
    this._property2 = props.property2;
    this._childEntities = props.childEntities;
  }

  /**
   * Factory method for creating the aggregate.
   * Publishes creation domain event.
   */
  public static create(
    props: AggregateRootProps,
    id?: AggregateRootId
  ): Result<AggregateRoot> {
    // Validate properties
    if (!props.property1) {
      return Result.fail<AggregateRoot>('Property1 is required');
    }

    // Validate aggregate-level invariants
    const invariantsResult = this.validateInvariants(props);
    if (invariantsResult.isFailure) {
      return Result.fail<AggregateRoot>(invariantsResult.error);
    }

    // Create aggregate
    const aggregateId = id ?? AggregateRootId.create().value;
    const aggregate = new AggregateRoot(props, aggregateId);

    // Publish creation event
    aggregate.addDomainEvent(new AggregateCreatedEvent(aggregate));

    return Result.ok<AggregateRoot>(aggregate);
  }

  /**
   * Validates aggregate-level invariants.
   * These are rules that span multiple entities/VOs.
   */
  private static validateInvariants(
    props: AggregateRootProps
  ): Result<void> {
    // Example: Total of child values cannot exceed root limit
    // if (childrenTotal > rootLimit) return fail

    return Result.ok<void>();
  }

  /**
   * Adds a child entity to the aggregate.
   * Validates aggregate invariants before adding.
   */
  public addChild(child: ChildEntity): Result<void> {
    // Validate the addition maintains aggregate invariants
    if (!this.canAddChild(child)) {
      return Result.fail<void>('Cannot add child: violates aggregate invariants');
    }

    // Add child
    this._childEntities.push(child);

    // Update timestamp
    this.touch();

    // Optionally publish event
    this.addDomainEvent(new ChildAddedEvent(this, child));

    return Result.ok<void>();
  }

  /**
   * Removes a child entity from the aggregate.
   */
  public removeChild(childId: ChildEntityId): Result<void> {
    const index = this._childEntities.findIndex(
      c => c.id.equals(childId)
    );

    if (index === -1) {
      return Result.fail<void>('Child not found');
    }

    // Validate removal maintains invariants
    if (!this.canRemoveChild(childId)) {
      return Result.fail<void>('Cannot remove child: violates aggregate invariants');
    }

    // Remove child
    this._childEntities.splice(index, 1);

    // Update timestamp
    this.touch();

    return Result.ok<void>();
  }

  /**
   * Guard: Checks if child can be added.
   */
  private canAddChild(child: ChildEntity): boolean {
    // Implement business logic
    return true;
  }

  /**
   * Guard: Checks if child can be removed.
   */
  private canRemoveChild(childId: ChildEntityId): boolean {
    // Implement business logic
    return true;
  }

  /**
   * Gets a child entity by ID.
   * Returns copy to prevent external modification.
   */
  public getChild(childId: ChildEntityId): ChildEntity | null {
    return this._childEntities.find(c => c.id.equals(childId)) ?? null;
  }

  // Getters
  public get property1(): ValueObject1 {
    return this._property1;
  }

  public get property2(): ValueObject2 {
    return this._property2;
  }

  public get children(): readonly ChildEntity[] {
    return this._childEntities; // Readonly to prevent external modification
  }
}
```

### Base AggregateRoot Class:

```typescript
import { Entity } from './Entity';
import { DomainEvent } from './events/DomainEvent';
import { DomainEvents } from './events/DomainEvents';
import { UniqueEntityID } from './UniqueEntityID';

/**
 * Base class for all aggregate roots.
 * Extends Entity with domain event capabilities.
 */
export abstract class AggregateRoot<T extends UniqueEntityID> extends Entity<T> {
  private _domainEvents: DomainEvent[] = [];

  /**
   * Gets all domain events for this aggregate.
   */
  public get domainEvents(): ReadonlyArray<DomainEvent> {
    return this._domainEvents;
  }

  /**
   * Adds a domain event to be dispatched.
   *
   * @param domainEvent - The event to add
   */
  protected addDomainEvent(domainEvent: DomainEvent): void {
    this._domainEvents.push(domainEvent);

    // Mark aggregate as having events
    DomainEvents.markAggregateForDispatch(this);
  }

  /**
   * Clears all domain events.
   * Called after events are dispatched.
   */
  public clearEvents(): void {
    this._domainEvents = [];
  }
}
```

---

## 7. Orthogonality Principles

### 1. Small Aggregates

Keep aggregates as small as possible while maintaining consistency:

```typescript
// ✅ GOOD - Small aggregate
class Order {
  private _customerId: string;        // Reference by ID
  private _items: OrderItem[];        // Children
  private _total: Money;              // Derived value

  // Only what needs to change together atomically
}

// ❌ BAD - Too large
class Order {
  private _customer: Customer;        // Full customer aggregate!
  private _items: OrderItem[];
  private _shipments: Shipment[];     // Separate aggregate
  private _invoices: Invoice[];       // Separate aggregate
  private _payments: Payment[];       // Separate aggregate

  // Too many things changing together = performance issues
}
```

### 2. Reference by ID

Other aggregates referenced by ID only:

```typescript
// ✅ GOOD - Reference by ID
class Order {
  private _customerId: CustomerId;    // ID only

  public getCustomer(): Promise<Customer> {
    // Load if needed via repository
    return this.customerRepo.findById(this._customerId);
  }
}

// ❌ BAD - Direct reference
class Order {
  private _customer: Customer;        // Full object!

  // Creates tight coupling, transaction issues
}
```

### 3. One Transaction = One Aggregate

Never modify multiple aggregates in one transaction:

```typescript
// ✅ GOOD - Single aggregate per transaction
class CompleteOrderUseCase {
  async execute(orderId: OrderId): Promise<Result<void>> {
    const order = await this.orderRepo.findById(orderId);

    order.complete(); // Modify only Order aggregate

    await this.orderRepo.save(order);

    // Other aggregates updated via domain events
    return Result.ok();
  }
}

// ❌ BAD - Multiple aggregates
class CompleteOrderUseCase {
  async execute(orderId: OrderId): Promise<Result<void>> {
    const order = await this.orderRepo.findById(orderId);
    const inventory = await this.inventoryRepo.findByProductIds(...);

    order.complete();
    inventory.reserve(order.items); // WRONG! Two aggregates!

    await this.orderRepo.save(order);
    await this.inventoryRepo.save(inventory);

    // Risk of partial failure, deadlocks, etc.
  }
}
```

### 4. Eventual Consistency Across Aggregates

Use domain events for cross-aggregate updates:

```typescript
// ✅ GOOD - Eventual consistency
class Order extends AggregateRoot<OrderId> {
  public complete(): Result<void> {
    this._status = OrderStatus.COMPLETED;

    // Publish event for other aggregates
    this.addDomainEvent(new OrderCompletedEvent(this.id, this._items));

    return Result.ok();
  }
}

// Event handler in another context
class OrderCompletedHandler {
  async handle(event: OrderCompletedEvent): Promise<void> {
    // Update Inventory aggregate separately
    const inventory = await this.inventoryRepo.findByProductIds(event.items);
    inventory.reserve(event.items);
    await this.inventoryRepo.save(inventory);
  }
}
```

---

## 8. Naming Conventions

### Aggregate Root Names:
- Use **domain-meaningful nouns**
- Should represent the core concept
- Often the most important entity in the cluster

```typescript
// ✅ GOOD
class Order { }              // Core concept
class NetworkDevice { }      // Core concept
class ShoppingCart { }       // Core concept

// ❌ BAD
class OrderAggregate { }     // "Aggregate" suffix unnecessary
class OrderRoot { }          // "Root" suffix unnecessary
class OrderData { }          // Not descriptive of domain role
```

### Child Entity Names:
- Related to parent context
- Describe their role in the aggregate

```typescript
class Order {
  private _items: OrderItem[];         // ✅ Clear relationship
  private _shipment: OrderShipment;    // ✅ Scoped to Order
}

class Order {
  private _items: Item[];              // ❌ Too generic
  private _products: Product[];        // ❌ Product is likely another aggregate
}
```

### Event Names:
- Past tense (something happened)
- Include aggregate name
- Describe what changed

```typescript
// ✅ GOOD
class OrderCreatedEvent { }
class OrderCompletedEvent { }
class OrderCancelledEvent { }
class ItemAddedToOrderEvent { }

// ❌ BAD
class CreateOrderEvent { }          // Present tense
class OrderEvent { }                // Not specific
class OrderChange { }               // Not clear what happened
```

---

## 9. Error Handling Patterns

### Pattern 1: Validate at Boundary

Aggregate root validates all operations:

```typescript
class Order extends AggregateRoot<OrderId> {
  public addItem(item: OrderItem): Result<void> {
    // Validate at aggregate boundary
    if (this._status !== OrderStatus.PENDING) {
      return Result.fail('Cannot add items to non-pending order');
    }

    if (this._items.length >= 100) {
      return Result.fail('Order cannot exceed 100 items');
    }

    // Check aggregate invariant
    if (!this.maintainsInventoryLimit(item)) {
      return Result.fail('Adding item would exceed inventory limit');
    }

    this._items.push(item);
    this.touch();

    return Result.ok();
  }

  // Aggregate-level invariant check
  private maintainsInventoryLimit(newItem: OrderItem): boolean {
    const totalQuantity = this._items.reduce(
      (sum, item) => sum + item.quantity,
      newItem.quantity
    );
    return totalQuantity <= 1000;
  }
}
```

### Pattern 2: Invariant Violations Return Failures

Never throw exceptions for business rule violations:

```typescript
// ✅ GOOD - Return Result
public ship(): Result<void> {
  if (this._status !== OrderStatus.CONFIRMED) {
    return Result.fail('Only confirmed orders can be shipped');
  }

  if (this._items.length === 0) {
    return Result.fail('Cannot ship empty order');
  }

  this._status = OrderStatus.SHIPPED;
  this.addDomainEvent(new OrderShippedEvent(this.id));

  return Result.ok();
}

// ❌ BAD - Throws exception
public ship(): void {
  if (this._status !== OrderStatus.CONFIRMED) {
    throw new Error('Only confirmed orders can be shipped');
  }
  // ...
}
```

### Pattern 3: Child Operations Through Root

All child modifications go through root for validation:

```typescript
class Order extends AggregateRoot<OrderId> {
  /**
   * Updates item quantity.
   * Root validates aggregate invariants.
   */
  public updateItemQuantity(
    itemId: OrderItemId,
    newQuantity: number
  ): Result<void> {
    // Find child
    const item = this._items.find(i => i.id.equals(itemId));
    if (!item) {
      return Result.fail('Item not found');
    }

    // Validate aggregate invariant before allowing change
    const newTotal = this.calculateTotalWithQuantityChange(
      itemId,
      newQuantity
    );

    if (newTotal > 1000) {
      return Result.fail('Total quantity cannot exceed 1000');
    }

    // Update child through root-controlled method
    const updateResult = item.updateQuantity(newQuantity);
    if (updateResult.isFailure) {
      return updateResult;
    }

    this.touch();

    return Result.ok();
  }

  private calculateTotalWithQuantityChange(
    itemId: OrderItemId,
    newQuantity: number
  ): number {
    return this._items.reduce((sum, item) => {
      const quantity = item.id.equals(itemId) ? newQuantity : item.quantity;
      return sum + quantity;
    }, 0);
  }
}
```

---

## 10. Transaction and Consistency Boundaries

### Transactional Consistency (Within Aggregate):

```typescript
/**
 * All changes within an aggregate are ACID.
 * Either all succeed or all fail.
 */
class Order extends AggregateRoot<OrderId> {
  public complete(): Result<void> {
    // Validate entire aggregate state
    if (this._items.length === 0) {
      return Result.fail('Cannot complete empty order');
    }

    // Multiple changes happen atomically
    this._status = OrderStatus.COMPLETED;
    this._completedAt = new Date();
    this._items.forEach(item => item.markAsOrdered());

    // All or nothing when saved to DB
    this.touch();
    this.addDomainEvent(new OrderCompletedEvent(this));

    return Result.ok();
  }
}

// Repository save is atomic for entire aggregate
await orderRepository.save(order);
```

### Eventual Consistency (Across Aggregates):

```typescript
/**
 * Changes across aggregates are eventually consistent.
 * Use domain events for coordination.
 */

// 1. Order aggregate publishes event
class Order extends AggregateRoot<OrderId> {
  public complete(): Result<void> {
    this._status = OrderStatus.COMPLETED;

    // Event for other aggregates
    this.addDomainEvent(
      new OrderCompletedEvent(this.id, this._customerId, this._total)
    );

    return Result.ok();
  }
}

// 2. Event handler updates other aggregates
class UpdateCustomerStatisticsHandler {
  async handle(event: OrderCompletedEvent): Promise<void> {
    // Load different aggregate
    const customer = await this.customerRepo.findById(event.customerId);

    // Update it
    customer.recordOrderCompleted(event.orderId, event.total);

    // Save separately (different transaction)
    await this.customerRepo.save(customer);
  }
}
```

### Consistency Rules:

1. **Strong Consistency (Immediate)**:
   - Within single aggregate
   - Enforced by aggregate root
   - Validated before saving
   - ACID guarantees

2. **Eventual Consistency (Delayed)**:
   - Across aggregates
   - Coordinated via domain events
   - May take time to propagate
   - Eventually converges to correct state

```typescript
// ✅ GOOD - Immediate consistency within aggregate
class ShoppingCart {
  public addItem(item: CartItem): Result<void> {
    this._items.push(item);
    this._total = this.calculateTotal(); // Immediately consistent
    return Result.ok();
  }
}

// ✅ GOOD - Eventual consistency across aggregates
class OrderCompletedHandler {
  async handle(event: OrderCompletedEvent): Promise<void> {
    // Updates CustomerStatistics aggregate eventually
    const stats = await this.statsRepo.findByCustomerId(event.customerId);
    stats.incrementOrderCount();
    await this.statsRepo.save(stats);
  }
}
```

---

## 11. Testing Strategy

### Test Structure for Aggregates:

```typescript
import { Order, OrderId } from '@/domain/aggregates/Order';
import { OrderItem, OrderItemId } from '@/domain/entities/OrderItem';
import { Money } from '@/domain/value-objects/Money';

describe('Order Aggregate', () => {
  const createValidOrderProps = () => ({
    customerId: 'customer-123',
    items: [],
    shippingAddress: createValidAddress(),
    status: OrderStatus.PENDING
  });

  describe('create', () => {
    it('should create order with valid properties', () => {
      const result = Order.create(createValidOrderProps());

      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe(OrderStatus.PENDING);
    });

    it('should publish OrderCreatedEvent', () => {
      const result = Order.create(createValidOrderProps());
      const order = result.value;

      expect(order.domainEvents).toHaveLength(1);
      expect(order.domainEvents[0]).toBeInstanceOf(OrderCreatedEvent);
    });
  });

  describe('aggregate invariants', () => {
    describe('when adding items', () => {
      it('should enforce maximum item limit', () => {
        const order = Order.create(createValidOrderProps()).value;

        // Add 100 items (limit)
        for (let i = 0; i < 100; i++) {
          const item = createMockOrderItem();
          order.addItem(item);
        }

        // 101st item should fail
        const item = createMockOrderItem();
        const result = order.addItem(item);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('100 items');
      });

      it('should enforce currency consistency', () => {
        const order = Order.create(createValidOrderProps()).value;

        // Add USD item
        const usdItem = createOrderItemWithCurrency('USD');
        order.addItem(usdItem);

        // Try to add EUR item
        const eurItem = createOrderItemWithCurrency('EUR');
        const result = order.addItem(eurItem);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('currency');
      });
    });

    describe('when calculating total', () => {
      it('should sum all item subtotals correctly', () => {
        const order = Order.create(createValidOrderProps()).value;

        const item1 = createOrderItem(Money.create({ amount: 10, currency: 'USD' }).value, 2);
        const item2 = createOrderItem(Money.create({ amount: 15, currency: 'USD' }).value, 3);

        order.addItem(item1);
        order.addItem(item2);

        const total = order.calculateTotal();

        // 10 * 2 + 15 * 3 = 20 + 45 = 65
        expect(total.amount).toBe(65);
        expect(total.currency).toBe('USD');
      });
    });
  });

  describe('state transitions', () => {
    it('should transition from PENDING to CONFIRMED', () => {
      const order = Order.create(createValidOrderProps()).value;
      order.addItem(createMockOrderItem());

      const result = order.confirm();

      expect(result.isSuccess).toBe(true);
      expect(order.status).toBe(OrderStatus.CONFIRMED);
    });

    it('should not confirm empty order', () => {
      const order = Order.create(createValidOrderProps()).value;

      const result = order.confirm();

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('empty');
    });

    it('should transition CONFIRMED -> SHIPPED -> DELIVERED', () => {
      const order = Order.create(createValidOrderProps()).value;
      order.addItem(createMockOrderItem());

      order.confirm();
      expect(order.status).toBe(OrderStatus.CONFIRMED);

      order.ship();
      expect(order.status).toBe(OrderStatus.SHIPPED);

      order.deliver();
      expect(order.status).toBe(OrderStatus.DELIVERED);
    });

    it('should not allow invalid state transitions', () => {
      const order = Order.create(createValidOrderProps()).value;

      // Cannot ship without confirming
      const result = order.ship();

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('confirmed');
    });
  });

  describe('domain events', () => {
    it('should publish OrderConfirmedEvent when confirmed', () => {
      const order = Order.create(createValidOrderProps()).value;
      order.addItem(createMockOrderItem());
      order.clearEvents(); // Clear creation event

      order.confirm();

      expect(order.domainEvents).toHaveLength(1);
      expect(order.domainEvents[0]).toBeInstanceOf(OrderConfirmedEvent);
    });

    it('should clear events after dispatch', () => {
      const order = Order.create(createValidOrderProps()).value;

      expect(order.domainEvents).toHaveLength(1);

      order.clearEvents();

      expect(order.domainEvents).toHaveLength(0);
    });
  });

  describe('child entity management', () => {
    it('should add item successfully', () => {
      const order = Order.create(createValidOrderProps()).value;
      const item = createMockOrderItem();

      const result = order.addItem(item);

      expect(result.isSuccess).toBe(true);
      expect(order.items).toHaveLength(1);
    });

    it('should remove item successfully', () => {
      const order = Order.create(createValidOrderProps()).value;
      const item = createMockOrderItem();
      order.addItem(item);

      const result = order.removeItem(item.id);

      expect(result.isSuccess).toBe(true);
      expect(order.items).toHaveLength(0);
    });

    it('should not remove last item', () => {
      const order = Order.create(createValidOrderProps()).value;
      const item = createMockOrderItem();
      order.addItem(item);

      const result = order.removeItem(item.id);

      // Depends on business rule
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('last item');
    });

    it('should update item quantity through root', () => {
      const order = Order.create(createValidOrderProps()).value;
      const item = createMockOrderItem();
      order.addItem(item);

      const result = order.updateItemQuantity(item.id, 5);

      expect(result.isSuccess).toBe(true);
      expect(order.items[0].quantity).toBe(5);
    });
  });
});
```

### Test Coverage for Aggregates:

1. **Creation Tests**: Valid/invalid creation, default values
2. **Invariant Tests**: All aggregate-level business rules
3. **State Transition Tests**: Valid/invalid transitions
4. **Child Management Tests**: Add/remove/update children
5. **Domain Event Tests**: Events published at right times
6. **Transaction Boundary Tests**: Multiple operations succeed/fail together

---

## 12. Examples

### Example: NetworkDevice Aggregate

```typescript
import { Result } from '@/shared/core/Result';
import { AggregateRoot } from '@/shared/domain/AggregateRoot';
import { UniqueEntityID } from '@/shared/domain/UniqueEntityID';
import { IPAddress } from '@/domain/value-objects/IPAddress';
import { MACAddress } from '@/domain/value-objects/MACAddress';
import { PollingConfiguration } from '@/domain/entities/PollingConfiguration';
import { NetworkDeviceCreatedEvent } from './events/NetworkDeviceCreatedEvent';
import { NetworkDeviceStatusChangedEvent } from './events/NetworkDeviceStatusChangedEvent';

export class NetworkDeviceId extends UniqueEntityID {
  private constructor(id?: string) {
    super(id);
  }

  public static create(id?: string): Result<NetworkDeviceId> {
    return Result.ok<NetworkDeviceId>(new NetworkDeviceId(id));
  }
}

export enum NetworkDeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  MAINTENANCE = 'MAINTENANCE'
}

interface NetworkDeviceProps {
  name: string;
  ipAddress: IPAddress;
  macAddress: MACAddress;
  status: NetworkDeviceStatus;
  pollingConfiguration: PollingConfiguration;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * NetworkDevice Aggregate Root.
 *
 * Aggregate Boundary:
 * - Root: NetworkDevice
 * - Children: PollingConfiguration
 * - Value Objects: IPAddress, MACAddress
 *
 * Invariants:
 * - IP and MAC addresses must be unique (enforced by repository)
 * - If status is MAINTENANCE, polling must be disabled
 * - If polling is enabled, device must be ONLINE
 *
 * Domain Events:
 * - NetworkDeviceCreatedEvent: When device is created
 * - NetworkDeviceStatusChangedEvent: When status changes
 * - PollingEnabledEvent: When polling is enabled
 * - PollingDisabledEvent: When polling is disabled
 */
export class NetworkDevice extends AggregateRoot<NetworkDeviceId> {
  private _name: string;
  private _ipAddress: IPAddress;
  private _macAddress: MACAddress;
  private _status: NetworkDeviceStatus;
  private _pollingConfiguration: PollingConfiguration;

  private constructor(
    props: NetworkDeviceProps,
    id: NetworkDeviceId
  ) {
    super(id, props.createdAt, props.updatedAt);
    this._name = props.name;
    this._ipAddress = props.ipAddress;
    this._macAddress = props.macAddress;
    this._status = props.status;
    this._pollingConfiguration = props.pollingConfiguration;
  }

  public static create(
    props: NetworkDeviceProps,
    id?: NetworkDeviceId
  ): Result<NetworkDevice> {
    // Validate required properties
    if (!props.name || props.name.trim().length === 0) {
      return Result.fail<NetworkDevice>('Device name is required');
    }

    if (!props.ipAddress) {
      return Result.fail<NetworkDevice>('IP address is required');
    }

    if (!props.macAddress) {
      return Result.fail<NetworkDevice>('MAC address is required');
    }

    if (!props.pollingConfiguration) {
      return Result.fail<NetworkDevice>('Polling configuration is required');
    }

    // Validate aggregate invariants
    const invariantsResult = this.validateInvariants(props);
    if (invariantsResult.isFailure) {
      return Result.fail<NetworkDevice>(invariantsResult.error);
    }

    // Create device
    const deviceId = id ?? NetworkDeviceId.create().value;
    const device = new NetworkDevice(props, deviceId);

    // Publish creation event
    device.addDomainEvent(new NetworkDeviceCreatedEvent(device));

    return Result.ok<NetworkDevice>(device);
  }

  /**
   * Validates aggregate-level invariants.
   */
  private static validateInvariants(
    props: NetworkDeviceProps
  ): Result<void> {
    // Invariant: If MAINTENANCE, polling must be disabled
    if (
      props.status === NetworkDeviceStatus.MAINTENANCE &&
      props.pollingConfiguration.enabled
    ) {
      return Result.fail<void>(
        'Polling must be disabled for devices in maintenance'
      );
    }

    // Invariant: If polling enabled, device must be ONLINE
    if (
      props.pollingConfiguration.enabled &&
      props.status !== NetworkDeviceStatus.ONLINE
    ) {
      return Result.fail<void>(
        'Only online devices can have polling enabled'
      );
    }

    return Result.ok<void>();
  }

  /**
   * Updates device status.
   * Validates and enforces aggregate invariants.
   */
  public updateStatus(newStatus: NetworkDeviceStatus): Result<void> {
    if (newStatus === this._status) {
      return Result.ok<void>(); // No change
    }

    // Validate invariant: If going to MAINTENANCE, disable polling
    if (
      newStatus === NetworkDeviceStatus.MAINTENANCE &&
      this._pollingConfiguration.enabled
    ) {
      // Automatically disable polling
      this._pollingConfiguration.disable();
    }

    // Validate invariant: If going to OFFLINE, disable polling
    if (
      newStatus === NetworkDeviceStatus.OFFLINE &&
      this._pollingConfiguration.enabled
    ) {
      this._pollingConfiguration.disable();
    }

    const oldStatus = this._status;
    this._status = newStatus;

    this.touch();
    this.addDomainEvent(
      new NetworkDeviceStatusChangedEvent(this, oldStatus, newStatus)
    );

    return Result.ok<void>();
  }

  /**
   * Enables polling for this device.
   * Validates aggregate invariants before enabling.
   */
  public enablePolling(): Result<void> {
    if (this._status !== NetworkDeviceStatus.ONLINE) {
      return Result.fail<void>(
        'Cannot enable polling for offline or maintenance devices'
      );
    }

    const enableResult = this._pollingConfiguration.enable();
    if (enableResult.isFailure) {
      return enableResult;
    }

    this.touch();
    this.addDomainEvent(new PollingEnabledEvent(this));

    return Result.ok<void>();
  }

  /**
   * Disables polling for this device.
   */
  public disablePolling(): Result<void> {
    this._pollingConfiguration.disable();

    this.touch();
    this.addDomainEvent(new PollingDisabledEvent(this));

    return Result.ok<void>();
  }

  /**
   * Updates polling interval.
   * Delegates to child entity but validates aggregate rules.
   */
  public updatePollingInterval(
    newInterval: PollingInterval
  ): Result<void> {
    const updateResult = this._pollingConfiguration.updateInterval(newInterval);
    if (updateResult.isFailure) {
      return updateResult;
    }

    this.touch();

    return Result.ok<void>();
  }

  // Getters
  public get name(): string {
    return this._name;
  }

  public get ipAddress(): IPAddress {
    return this._ipAddress;
  }

  public get macAddress(): MACAddress {
    return this._macAddress;
  }

  public get status(): NetworkDeviceStatus {
    return this._status;
  }

  public get pollingConfiguration(): PollingConfiguration {
    return this._pollingConfiguration;
  }

  public get isOnline(): boolean {
    return this._status === NetworkDeviceStatus.ONLINE;
  }

  public get isPollingEnabled(): boolean {
    return this._pollingConfiguration.enabled;
  }
}
```

---

## Summary Checklist

When creating an Aggregate, ensure:

- ✅ Identified aggregate root (entry point)
- ✅ Defined consistency boundary (what changes together)
- ✅ Kept aggregate small (only what needs transactional consistency)
- ✅ Root extends AggregateRoot base class
- ✅ All invariants spanning multiple objects enforced by root
- ✅ External access only through root
- ✅ Child entities modified only through root methods
- ✅ Other aggregates referenced by ID only
- ✅ Domain events published for significant changes
- ✅ One aggregate = one transaction
- ✅ Cross-aggregate coordination via events
- ✅ Comprehensive tests for invariants
- ✅ Tests for state transitions
- ✅ Tests for child management

---

**Remember**: Aggregates define consistency boundaries. Keep them small, enforce invariants at the root, and use domain events for cross-aggregate coordination!
