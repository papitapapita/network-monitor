# DOMAIN AGGREGATES STANDARD

## Table of Contents

1. [Purpose of Aggregates in DDD](#1-purpose-of-aggregates-in-ddd)
2. [When is an Entity an Aggregate Root?](#2-when-is-an-entity-an-aggregate-root)
3. [Responsibilities of an Aggregate](#3-responsibilities-of-an-aggregate)
4. [Boundaries of an Aggregate](#4-boundaries-of-an-aggregate)
5. [Connections with Other Layers](#5-connections-with-other-layers)
6. [Aggregate Lifetime & Lifecycle](#6-aggregate-lifetime--lifecycle)
7. [Aggregate Structure Template](#7-aggregate-structure-template)
8. [Orthogonality Principles](#8-orthogonality-principles)
9. [Naming Conventions](#9-naming-conventions)
10. [Error Handling Patterns](#10-error-handling-patterns)
11. [Transaction and Consistency Boundaries](#11-transaction-and-consistency-boundaries)
12. [Testing Strategy](#12-testing-strategy)
13. [Examples](#13-examples)

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

| Aspect              | Aggregate                        | Entity                         |
| ------------------- | -------------------------------- | ------------------------------ |
| **Scope**           | Cluster of related objects       | Single domain object           |
| **Identity**        | Root has identity                | Has identity                   |
| **Invariants**      | Enforces across multiple objects | Enforces own invariants        |
| **Transaction**     | Transaction boundary             | Part of transaction            |
| **Repository**      | Has repository                   | May or may not have repository |
| **External Access** | Only root accessible             | Depends on aggregate design    |

### Why Aggregates?

1. **Consistency**: Ensure related objects stay consistent together
2. **Transaction Control**: Clear boundaries for atomic operations
3. **Complexity Management**: Reduce coupling between related concepts
4. **Performance**: Optimize loading and saving of related data
5. **Invariant Enforcement**: Business rules spanning multiple objects

---

## 2. When is an Entity an Aggregate Root?

**Not every entity is an aggregate root. An entity becomes an aggregate root when it needs to own and control other entities.**

### Decision Criteria:

Ask these questions to determine if an entity should be an aggregate root:

#### 1. **Does it have an independent lifecycle?**

```typescript
// ✅ Aggregate Root - Independent lifecycle
class NetworkDevice {
  // Can be created without any other aggregate
  // Can be deleted independently
  // Has its own use cases: CreateNetworkDevice, DeleteNetworkDevice, etc.
}

// ❌ Not Aggregate Root - Dependent lifecycle
class PollingConfiguration {
  // Cannot exist without a NetworkDevice
  // Created when NetworkDevice is created
  // Deleted when NetworkDevice is deleted
  // No independent use cases
}
```

#### 2. **Do other aggregates need to reference it?**

```typescript
// ✅ Aggregate Root - Referenced by others
class NetworkDevice {
  // PollingResult references NetworkDevice by ID
  // Alert references NetworkDevice by ID
  // Other aggregates need to know about this device
}

// ❌ Not Aggregate Root - Not referenced externally
class PollingConfiguration {
  // No other aggregate references PollingConfiguration directly
  // Only NetworkDevice knows about it
}
```

#### 3. **Does it own other entities?**

```typescript
// ✅ Aggregate Root - Owns children
class NetworkDevice {
  private _pollingConfiguration: PollingConfiguration; // Owns this entity
  private _alertSettings: AlertSettings; // Owns this entity

  // Controls their lifecycle
  // Enforces invariants across them
}

// ❌ Not Aggregate Root - Owns nothing
class PollingConfiguration {
  // Has no child entities
  // Only has value objects (PollingInterval, etc.)
}
```

#### 4. **Does it enforce invariants across multiple objects?**

```typescript
// ✅ Aggregate Root - Cross-entity invariants
class NetworkDevice {
  public updateStatus(status: NetworkDeviceStatus): Result<void> {
    // Invariant: If device goes to MAINTENANCE, polling must be disabled
    if (
      status === NetworkDeviceStatus.MAINTENANCE &&
      this._pollingConfiguration.enabled
    ) {
      this._pollingConfiguration.disable(); // Enforcing across entities
    }
    // ...
  }
}

// ❌ Not Aggregate Root - Only self invariants
class PollingConfiguration {
  public updateInterval(interval: PollingInterval): Result<void> {
    // Only validates its own state
    if (this._enabled && interval.seconds < 10) {
      return Result.fail('Cannot set interval < 10s while enabled');
    }
    // ...
  }
}
```

#### 5. **Does it need its own repository?**

```typescript
// ✅ Aggregate Root - Has repository
interface INetworkDeviceRepository {
  save(device: NetworkDevice): Promise<void>;
  findById(id: NetworkDeviceId): Promise<NetworkDevice>;
  // Repository loads entire aggregate including PollingConfiguration
}

// ❌ Not Aggregate Root - No repository
// PollingConfiguration has no repository
// Loaded and saved as part of NetworkDevice
```

### Decision Tree:

```
Does the entity have an independent lifecycle?
│
├─ NO → Child Entity (not aggregate root)
│
└─ YES → Continue...
    │
    Does it own other entities?
    │
    ├─ NO → Could be aggregate root if:
    │       - Referenced by other aggregates
    │       - Has complex business logic
    │       - Otherwise, might just be a simple entity
    │
    └─ YES → Aggregate Root
```

### Examples from Real Systems:

#### Example 1: E-commerce Domain

```typescript
// ✅ Aggregate Root
class Order {
  private _items: OrderItem[]; // Owns
  private _payment: Payment; // Owns
  // Independent lifecycle, owns children, has repository
}

// ❌ Child Entity
class OrderItem {
  // No independent lifecycle
  // Cannot exist without Order
  // No repository
}

// ✅ Aggregate Root (separate from Order)
class Customer {
  // Independent lifecycle
  // Referenced by Order (by ID)
  // Has own repository
}
```

#### Example 2: Network Management Domain

```typescript
// ✅ Aggregate Root
class NetworkDevice {
  private _pollingConfiguration: PollingConfiguration; // Owns
  // Independent lifecycle, owns children, has repository
}

// ❌ Child Entity
class PollingConfiguration {
  // No independent lifecycle
  // Part of NetworkDevice aggregate
}

// ✅ Aggregate Root (separate from NetworkDevice)
class PollingResult {
  private _networkDeviceId: NetworkDeviceId; // References by ID
  // Independent lifecycle
  // Has own repository
  // Not owned by NetworkDevice
}
```

### Common Mistakes:

#### ❌ Mistake 1: Making everything an aggregate root

```typescript
// WRONG - PollingConfiguration as aggregate root
class PollingConfiguration {
  // Has its own repository
  // Can be loaded independently
  // But NO business reason for independence!
}

// This creates unnecessary complexity:
// - Two repositories to manage
// - Complex transaction coordination
// - Weakened invariant enforcement
```

#### ❌ Mistake 2: Aggregates that are too large

```typescript
// WRONG - Customer owns too much
class Customer {
  private _orders: Order[]; // Should be separate aggregates!
  private _addresses: Address[]; // Too many
  private _paymentMethods: PaymentMethod[]; // Too many
  private _preferences: CustomerPreferences[]; // Too many

  // Performance nightmare
  // Lock contention issues
  // Difficult to maintain
}

// CORRECT - Customer as small aggregate
class Customer {
  private _customerId: CustomerId;
  private _primaryAddress: Address; // Value object or single entity
  // Orders are separate aggregates, referenced by ID
}
```

#### ✅ Good Practice: Small, focused aggregates

```typescript
// CORRECT - Small aggregate
class NetworkDevice {
  private _pollingConfiguration: PollingConfiguration; // Only what changes together

  // Other related data in separate aggregates:
  // - PollingResult (separate aggregate)
  // - DeviceLog (separate aggregate)
  // - Alert (separate aggregate)
}
```

### Summary Checklist:

When deciding if an entity should be an aggregate root, check:

- ✅ Has independent business lifecycle
- ✅ Needs to be referenced by other aggregates
- ✅ Owns child entities that cannot exist independently
- ✅ Enforces invariants across multiple entities/VOs
- ✅ Needs its own repository
- ✅ Acts as entry point for all operations on its children
- ✅ Defines a clear transactional boundary

If most of these are true → **Aggregate Root**
If most are false → **Child Entity** (part of another aggregate)

---

## 3. Responsibilities of an Aggregate

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
   - Reference Other Aggregates by ID only

### Aggregate Root Behavior Deep Dive:

#### 1. Entry Point Pattern

The aggregate root is the ONLY entry point for modifying the aggregate:

```typescript
interface OrderProps {
  customerId: string;
  items: OrderItem[];
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ✅ CORRECT - All operations through root
class Order extends AggregateRoot<OrderProps, OrderId> {
  /**
   * Update item quantity - Root validates and coordinates
   */
  public updateItemQuantity(
    itemId: OrderItemId,
    quantity: number
  ): Result<void> {
    // Find item
    const item = this.props.items.find((i) => i.id.equals(itemId));
    if (!item) {
      return Result.fail('Item not found');
    }

    // Validate aggregate invariant
    if (!this.canUpdateQuantity(itemId, quantity)) {
      return Result.fail(
        'Cannot update quantity: violates order limits'
      );
    }

    // Update through child entity method
    const updateResult = item.updateQuantity(quantity);
    if (updateResult.isFailure) {
      return updateResult;
    }

    // Root tracks the change
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      new OrderItemQuantityChangedEvent(this.id, itemId, quantity)
    );

    return Result.ok();
  }

  private canUpdateQuantity(
    itemId: OrderItemId,
    newQuantity: number
  ): boolean {
    // Aggregate-level business rule
    const newTotal = this.calculateTotalQuantityWith(
      itemId,
      newQuantity
    );
    return newTotal <= 1000; // Business rule: max 1000 items per order
  }
}

// ❌ WRONG - External code modifying child directly
const order = await orderRepository.findById(orderId);
const item = order.items[0];
item.updateQuantity(10); // WRONG! Bypasses aggregate root validation!
```

#### 2. Invariant Enforcement Pattern

The aggregate root enforces invariants that span multiple entities:

```typescript
interface NetworkDeviceProps {
  status: NetworkDeviceStatus;
  pollingConfiguration: PollingConfiguration;
  createdAt: Date;
  updatedAt: Date;
}

class NetworkDevice extends AggregateRoot<
  NetworkDeviceProps,
  NetworkDeviceId
> {
  /**
   * Invariant: Polling must be disabled when device is in MAINTENANCE
   */
  public setMaintenanceMode(): Result<void> {
    // Coordinate multiple entities to maintain invariant
    if (this.props.pollingConfiguration.enabled) {
      // Disable polling before changing status
      this.props.pollingConfiguration.disable();
    }

    this.props.status = NetworkDeviceStatus.MAINTENANCE;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new DeviceEnteredMaintenanceModeEvent(this.id)
    );

    return Result.ok();
  }

  /**
   * Invariant: Only ONLINE devices can have polling enabled
   */
  public enablePolling(): Result<void> {
    if (this.props.status !== NetworkDeviceStatus.ONLINE) {
      return Result.fail(
        'Cannot enable polling: device must be online'
      );
    }

    const enableResult = this.props.pollingConfiguration.enable();
    if (enableResult.isFailure) {
      return enableResult;
    }

    this.props.updatedAt = new Date();
    this.addDomainEvent(new PollingEnabledEvent(this.id));

    return Result.ok();
  }
}
```

#### 3. Domain Events Pattern

Aggregates publish domain events for significant state changes:

```typescript
interface OrderProps {
  customerId: string;
  items: OrderItem[];
  status: OrderStatus;
  confirmedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

class Order extends AggregateRoot<OrderProps, OrderId> {
  /**
   * Confirms the order and publishes event
   */
  public confirm(): Result<void> {
    // Validate business rules
    if (this.props.status !== OrderStatus.PENDING) {
      return Result.fail('Only pending orders can be confirmed');
    }

    if (this.props.items.length === 0) {
      return Result.fail('Cannot confirm empty order');
    }

    // Change state
    const previousStatus = this.props.status;
    this.props.status = OrderStatus.CONFIRMED;
    this.props.confirmedAt = new Date();
    this.props.updatedAt = new Date();

    // Update all items
    this.props.items.forEach((item) => item.markAsConfirmed());

    // Publish domain event for cross-aggregate coordination
    this.addDomainEvent(
      new OrderConfirmedEvent({
        aggregateId: this.id, // Aggregate root ID
        orderId: this.id,
        customerId: this.props.customerId,
        items: this.props.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity
        })),
        total: this.calculateTotal(),
        confirmedAt: this.props.confirmedAt,
        dateTimeOccurred: new Date()
      })
    );

    return Result.ok();
  }
}

// Event handler in another bounded context
class OrderConfirmedHandler {
  async handle(event: OrderConfirmedEvent): Promise<void> {
    // Update Inventory aggregate (different aggregate)
    const inventory = await this.inventoryRepo.findByProductIds(
      event.items.map((i) => i.productId)
    );

    for (const item of event.items) {
      inventory.reserveStock(item.productId, item.quantity);
    }

    await this.inventoryRepo.save(inventory);

    // Update Customer aggregate (different aggregate)
    const customer = await this.customerRepo.findById(
      event.customerId
    );
    customer.recordOrderConfirmed(event.orderId);
    await this.customerRepo.save(customer);
  }
}
```

#### 4. Child Lifecycle Management Pattern

The aggregate root controls the complete lifecycle of child entities:

```typescript
interface ShoppingCartProps {
  items: CartItem[];
  createdAt: Date;
  updatedAt: Date;
}

class ShoppingCart extends AggregateRoot<
  ShoppingCartProps,
  ShoppingCartId
> {
  /**
   * Add item - Root creates child entity
   */
  public addItem(
    productId: ProductId,
    quantity: number,
    price: Money
  ): Result<void> {
    // Check if item already exists
    const existingItem = this.props.items.find((i) =>
      i.productId.equals(productId)
    );

    if (existingItem) {
      // Update existing item
      return this.updateItemQuantity(
        existingItem.id,
        existingItem.quantity + quantity
      );
    }

    // Validate aggregate invariant
    if (this.props.items.length >= 50) {
      return Result.fail('Cart cannot exceed 50 different items');
    }

    // Root creates child entity
    const itemResult = CartItem.create({
      productId,
      quantity,
      price
    });

    if (itemResult.isFailure) {
      return Result.fail(itemResult.error);
    }

    // Add to collection
    this.props.items.push(itemResult.value);
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new ItemAddedToCartEvent(this.id, productId, quantity)
    );

    return Result.ok();
  }

  /**
   * Remove item - Root deletes child entity
   */
  public removeItem(itemId: CartItemId): Result<void> {
    const index = this.props.items.findIndex((i) =>
      i.id.equals(itemId)
    );

    if (index === -1) {
      return Result.fail('Item not found in cart');
    }

    const removedItem = this.props.items[index];
    this.props.items.splice(index, 1);

    this.props.updatedAt = new Date();
    this.addDomainEvent(
      new ItemRemovedFromCartEvent(this.id, removedItem.productId)
    );

    return Result.ok();
  }

  /**
   * Clear cart - Root removes all children
   */
  public clear(): Result<void> {
    if (this.props.items.length === 0) {
      return Result.ok(); // Already empty
    }

    this.props.items = [];
    this.props.updatedAt = new Date();

    this.addDomainEvent(new CartClearedEvent(this.id));

    return Result.ok();
  }
}
```

#### 5. Aggregate Reconstruction Pattern

When loading from persistence, the aggregate must reconstruct its complete state:

```typescript
interface OrderProps {
  customerId: string;
  items: OrderItem[];
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

class Order extends AggregateRoot<OrderProps, OrderId> {
  /**
   * Factory for creating new orders
   */
  public static create(
    props: Omit<OrderProps, 'createdAt' | 'updatedAt'>
  ): Result<Order> {
    // Validation for new orders
    // ...
    const orderProps: OrderProps = {
      ...props,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const order = new Order(orderProps, OrderId.create().value);

    // Publish creation event
    order.addDomainEvent(new OrderCreatedEvent(order.id));

    return Result.ok(order);
  }

  /**
   * Factory for reconstructing from persistence
   * NOTE: No domain events published - already happened
   */
  public static reconstitute(
    props: OrderProps,
    id: OrderId
  ): Result<Order> {
    // Minimal validation - data already validated
    // Don't publish events - this is reconstruction, not a new event

    return Result.ok(new Order(props, id));
  }
}

// Repository usage
class OrderRepository implements IOrderRepository {
  async findById(id: OrderId): Promise<Order> {
    const data = await this.db.orders.findOne({ id: id.toString() });

    if (!data) {
      throw new Error('Order not found');
    }

    // Reconstruct aggregate with all children
    const orderResult = Order.reconstitute(
      {
        customerId: data.customerId,
        items: data.items.map((itemData) =>
          OrderItem.reconstitute(
            itemData,
            new OrderItemId(itemData.id)
          )
        ),
        status: data.status,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
        // ... all properties
      },
      id
    );

    return orderResult.value;
  }
}
```

#### 6. Transaction Boundary Pattern

Each aggregate instance represents one transaction boundary:

```typescript
// ✅ CORRECT - One aggregate, one transaction
class PlaceOrderUseCase {
  async execute(
    request: PlaceOrderRequest
  ): Promise<Result<OrderDTO>> {
    // 1. Create aggregate
    const orderResult = Order.create({
      customerId: request.customerId,
      items: request.items,
      shippingAddress: request.shippingAddress
    });

    if (orderResult.isFailure) {
      return Result.fail(orderResult.error);
    }

    const order = orderResult.value;

    // 2. Modify aggregate
    const confirmResult = order.confirm();
    if (confirmResult.isFailure) {
      return Result.fail(confirmResult.error);
    }

    // 3. Save entire aggregate (one transaction)
    await this.orderRepository.save(order);

    // 4. Events are dispatched after successful save
    await this.eventDispatcher.dispatchEventsForAggregate(order);

    return Result.ok(OrderMapper.toDTO(order));
  }
}

// ❌ WRONG - Multiple aggregates in one transaction
class TransferMoneyUseCase {
  async execute(request: TransferRequest): Promise<Result<void>> {
    const fromAccount = await this.accountRepo.findById(
      request.fromAccountId
    );
    const toAccount = await this.accountRepo.findById(
      request.toAccountId
    );

    // Modifying two aggregates
    fromAccount.withdraw(request.amount);
    toAccount.deposit(request.amount);

    // WRONG! Two aggregates = two transactions
    // If second save fails, first is already committed!
    await this.accountRepo.save(fromAccount);
    await this.accountRepo.save(toAccount);

    // Should use eventual consistency + domain events instead
  }
}

// ✅ CORRECT - Eventual consistency across aggregates
class WithdrawMoneyUseCase {
  async execute(request: WithdrawRequest): Promise<Result<void>> {
    // Only modify one aggregate
    const account = await this.accountRepo.findById(
      request.accountId
    );

    const withdrawResult = account.withdraw(request.amount);
    if (withdrawResult.isFailure) {
      return Result.fail(withdrawResult.error);
    }

    // Save one aggregate
    await this.accountRepo.save(account);

    // Event published for other aggregates to react
    await this.eventDispatcher.dispatchEventsForAggregate(account);
    // MoneyWithdrawnEvent → processed by other bounded contexts

    return Result.ok();
  }
}
```

---

## 4. Boundaries of an Aggregate

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

## 5. Connections with Other Layers

```
┌─────────────────────────────────────────────────────────────┐
│                  PRESENTATION LAYER                         │
│  - Never knows about aggregates                             │
│  - Works with DTOs only                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 APPLICATION LAYER                           │
│  ┌───────────────────────────────────────────────────┐      │
│  │  Use Cases                                        │      │
│  │  - Load aggregate from repository                 │      │
│  │  - Call aggregate root methods                    │      │
│  │  - Save aggregate via repository                  │      │
│  │  - Convert aggregate to DTO via mapper            │      │
│  └───────────────────────────────────────────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    DOMAIN LAYER                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │         AGGREGATES (You are here)                  │     │
│  │                                                    │     │
│  │  ┌───────────────────────────────────────────┐     │     │
│  │  │  Aggregate Root (Entity)                  │     │     │
│  │  │  - Entry point for all operations         │     │     │
│  │  │  - Enforces aggregate invariants          │     │     │
│  │  │  - Controls child entities                │     │     │
│  │  │  - Publishes domain events                │     │     │
│  │  └────────────┬──────────────────────────────┘     │     │
│  │               │                                    │     │
│  │               │ contains                           │     │
│  │               ▼                                    │     │
│  │  ┌───────────────────────────────────────────┐     │     │
│  │  │  Child Entities                           │     │     │
│  │  │  - Accessible only through root           │     │     │
│  │  │  - Part of aggregate boundary             │     │     │
│  │  │  - No independent repository              │     │     │
│  │  └───────────────────────────────────────────┘     │     │
│  │               │                                    │     │
│  │               │ contains                           │     │
│  │               ▼                                    │     │
│  │  ┌───────────────────────────────────────────┐     │     │
│  │  │  Value Objects                            │     │     │
│  │  │  - Shared across entities in aggregate    │     │     │
│  │  │  - Immutable descriptive attributes       │     │     │
│  │  └───────────────────────────────────────────┘     │     │
│  └────────────────────────────────────────────────────┘     │
│                                                             │
│  Repository Interface (for Aggregate Root only)             │
└─────────────────────────────────────────────────────────────┘
                         ▲
                         │ implements
┌─────────────────────────────────────────────────────────────┐
│               INFRASTRUCTURE LAYER                          │
│  - Repository saves entire aggregate                        │
│  - Loads aggregate with all children                        │
│  - Transactions span single aggregate                       │
└─────────────────────────────────────────────────────────────┘
```

### Cross-Aggregate Communication:

```
┌─────────────────┐         Domain Event         ┌─────────────────┐
│  Aggregate A    │ ────────────────────────────>│  Aggregate B    │
│  (Root)         │                              │  (Root)         │
│                 │  Reference by ID only        │                 │
│  aggregateB_id  │ <─────────────────────────── │  id             │
└─────────────────┘                              └─────────────────┘
```

---

## 6. Aggregate Lifetime & Lifecycle

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

## 7. Aggregate Structure Template

### Aggregate Root Template:

```typescript
import { Result } from '@/shared/core/Result';
import { AggregateRoot } from '@/shared/domain/AggregateRoot';
import { UniqueEntityID } from '@/shared/domain/UniqueEntityID';
import { EventDispatcher } from '@/shared/domain/events/EventDispatcher';
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
  createdAt: Date;
  updatedAt: Date;
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
export class AggregateRootName extends AggregateRoot<
  AggregateRootProps,
  AggregateRootId
> {
  private constructor(
    props: AggregateRootProps,
    id: AggregateRootId
  ) {
    super(props, id);
  }

  /**
   * Factory method for creating the aggregate.
   * Publishes creation domain event.
   */
  public static create(
    props: Omit<AggregateRootProps, 'createdAt' | 'updatedAt'>,
    id: AggregateRootId
  ): Result<AggregateRootName> {
    // Validate properties
    if (!props.property1) {
      return Result.fail<AggregateRootName>('Property1 is required');
    }

    // Validate aggregate-level invariants
    const invariantsResult = this.validateInvariants(props);
    if (invariantsResult.isFailure) {
      return Result.fail<AggregateRootName>(invariantsResult.error);
    }

    const aggregateProps: AggregateRootProps = {
      ...props,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const aggregate = new AggregateRootName(aggregateProps, id);

    // Publish creation event
    aggregate.addDomainEvent(new AggregateCreatedEvent(aggregate));

    return Result.ok<AggregateRootName>(aggregate);
  }

  /**
   * Validates aggregate-level invariants.
   * These are rules that span multiple entities/VOs.
   */
  private static validateInvariants(
    props: Omit<AggregateRootProps, 'createdAt' | 'updatedAt'>
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
      return Result.fail<void>(
        'Cannot add child: violates aggregate invariants'
      );
    }

    // Add child
    this.props.childEntities.push(child);
    this.props.updatedAt = new Date();

    // Optionally publish event
    this.addDomainEvent(new ChildAddedEvent(this, child));

    return Result.ok<void>();
  }

  /**
   * Removes a child entity from the aggregate.
   */
  public removeChild(childId: ChildEntityId): Result<void> {
    const index = this.props.childEntities.findIndex((c) =>
      c.id.equals(childId)
    );

    if (index === -1) {
      return Result.fail<void>('Child not found');
    }

    // Validate removal maintains invariants
    if (!this.canRemoveChild(childId)) {
      return Result.fail<void>(
        'Cannot remove child: violates aggregate invariants'
      );
    }

    // Remove child
    this.props.childEntities.splice(index, 1);
    this.props.updatedAt = new Date();

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
    return (
      this.props.childEntities.find((c) => c.id.equals(childId)) ??
      null
    );
  }

  // Getters
  get property1(): ValueObject1 {
    return this.props.property1;
  }

  get property2(): ValueObject2 {
    return this.props.property2;
  }

  get children(): readonly ChildEntity[] {
    return this.props.childEntities; // Readonly to prevent external modification
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
```

### Base AggregateRoot Class:

```typescript
import { Entity } from './Entity';
import { UniqueEntityID } from './UniqueEntityID';
import { IDomainEvent } from '../shared/interfaces/IDomainEvent';

/**
 * Base class for all Aggregate Roots in Domain-Driven Design (DDD).
 *
 * An Aggregate Root:
 * - Is the main **entry point** for modifying an aggregate.
 * - Enforces business invariants for the entire aggregate.
 * - Can publish domain events when important business actions occur.
 *
 * The AggregateRoot class extends the `Entity` class and adds
 * the ability to track and manage domain events generated
 * by the aggregate.
 *
 * @typeParam T - The shape of the properties stored in the entity.
 * @typeParam TID - The type of the unique identifier for the entity, extending {@link UniqueEntityID}.
 */
export abstract class AggregateRoot<
  T,
  TID extends UniqueEntityID
> extends Entity<T, TID> {
  /**
   * Internal collection of domain events raised by this aggregate.
   *
   * Events are stored here until a dispatcher processes them.
   */
  private _domainEvents: IDomainEvent[] = [];

  /**
   * Returns a copy of all domain events that the aggregate has raised.
   *
   * These events are typically handled by an event dispatcher
   * after the aggregate operation completes.
   */
  get domainEvents(): IDomainEvent[] {
    return [...this._domainEvents];
  }

  /**
   * Registers a new domain event inside the aggregate.
   *
   * Use this method whenever something meaningful happens
   * in the business logic (e.g., "DeviceWentOffline").
   *
   * @param domainEvent - The domain event to add.
   */
  protected addDomainEvent(domainEvent: IDomainEvent): void {
    this._domainEvents.push(domainEvent);
  }

  /**
   * Clears all stored domain events.
   *
   * This is typically called by the event dispatcher AFTER
   * all events have been published.
   */
  public clearEvents(): void {
    this._domainEvents.splice(0, this._domainEvents.length);
  }
}
```

---

## 8. Orthogonality Principles

### 1. Small Aggregates

Keep aggregates as small as possible while maintaining consistency:

```typescript
// ✅ GOOD - Small aggregate
class Order {
  private _customerId: string; // Reference by ID
  private _items: OrderItem[]; // Children
  private _total: Money; // Derived value

  // Only what needs to change together atomically
}

// ❌ BAD - Too large
class Order {
  private _customer: Customer; // Full customer aggregate!
  private _items: OrderItem[];
  private _shipments: Shipment[]; // Separate aggregate
  private _invoices: Invoice[]; // Separate aggregate
  private _payments: Payment[]; // Separate aggregate

  // Too many things changing together = performance issues
}
```

### 2. Reference by ID

Other aggregates referenced by ID only:

```typescript
// ✅ GOOD - Reference by ID
class Order {
  private _customerId: CustomerId; // ID only

  public getCustomer(): Promise<Customer> {
    // Load if needed via repository
    return this.customerRepo.findById(this._customerId);
  }
}

// ❌ BAD - Direct reference
class Order {
  private _customer: Customer; // Full object!

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
    this.addDomainEvent(
      new OrderCompletedEvent(this.id, this._items)
    );

    return Result.ok();
  }
}

// Event handler in another context
class OrderCompletedHandler {
  async handle(event: OrderCompletedEvent): Promise<void> {
    // Update Inventory aggregate separately
    const inventory = await this.inventoryRepo.findByProductIds(
      event.items
    );
    inventory.reserve(event.items);
    await this.inventoryRepo.save(inventory);
  }
}
```

---

## 9. Naming Conventions

### Aggregate Root Names:

- Use **domain-meaningful nouns**
- Should represent the core concept
- Often the most important entity in the cluster

```typescript
// ✅ GOOD
class Order {} // Core concept
class NetworkDevice {} // Core concept
class ShoppingCart {} // Core concept

// ❌ BAD
class OrderAggregate {} // "Aggregate" suffix unnecessary
class OrderRoot {} // "Root" suffix unnecessary
class OrderData {} // Not descriptive of domain role
```

### Child Entity Names:

- Related to parent context
- Describe their role in the aggregate

```typescript
class Order {
  private _items: OrderItem[]; // ✅ Clear relationship
  private _shipment: OrderShipment; // ✅ Scoped to Order
}

class Order {
  private _items: Item[]; // ❌ Too generic
  private _products: Product[]; // ❌ Product is likely another aggregate
}
```

### Event Names:

- Past tense (something happened)
- Include aggregate name
- Describe what changed

```typescript
// ✅ GOOD
class OrderCreatedEvent {}
class OrderCompletedEvent {}
class OrderCancelledEvent {}
class ItemAddedToOrderEvent {}

// ❌ BAD
class CreateOrderEvent {} // Present tense
class OrderEvent {} // Not specific
class OrderChange {} // Not clear what happened
```

---

## 10. Error Handling Patterns

### Pattern 1: Validate at Boundary

Aggregate root validates all operations:

```typescript
interface OrderProps {
  status: OrderStatus;
  items: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

class Order extends AggregateRoot<OrderProps, OrderId> {
  public addItem(item: OrderItem): Result<void> {
    // Validate at aggregate boundary
    if (this.props.status !== OrderStatus.PENDING) {
      return Result.fail('Cannot add items to non-pending order');
    }

    if (this.props.items.length >= 100) {
      return Result.fail('Order cannot exceed 100 items');
    }

    // Check aggregate invariant
    if (!this.maintainsInventoryLimit(item)) {
      return Result.fail('Adding item would exceed inventory limit');
    }

    this.props.items.push(item);
    this.props.updatedAt = new Date();

    return Result.ok();
  }

  // Aggregate-level invariant check
  private maintainsInventoryLimit(newItem: OrderItem): boolean {
    const totalQuantity = this.props.items.reduce(
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
interface OrderProps {
  status: OrderStatus;
  items: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

// ✅ GOOD - Return Result
public ship(): Result<void> {
  if (this.props.status !== OrderStatus.CONFIRMED) {
    return Result.fail('Only confirmed orders can be shipped');
  }

  if (this.props.items.length === 0) {
    return Result.fail('Cannot ship empty order');
  }

  this.props.status = OrderStatus.SHIPPED;
  this.props.updatedAt = new Date();
  this.addDomainEvent(new OrderShippedEvent(this.id));

  return Result.ok();
}

// ❌ BAD - Throws exception
public ship(): void {
  if (this.props.status !== OrderStatus.CONFIRMED) {
    throw new Error('Only confirmed orders can be shipped');
  }
  // ...
}
```

### Pattern 3: Child Operations Through Root

All child modifications go through root for validation:

```typescript
interface OrderProps {
  items: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

class Order extends AggregateRoot<OrderProps, OrderId> {
  /**
   * Updates item quantity.
   * Root validates aggregate invariants.
   */
  public updateItemQuantity(
    itemId: OrderItemId,
    newQuantity: number
  ): Result<void> {
    // Find child
    const item = this.props.items.find((i) => i.id.equals(itemId));
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

    this.props.updatedAt = new Date();

    return Result.ok();
  }

  private calculateTotalWithQuantityChange(
    itemId: OrderItemId,
    newQuantity: number
  ): number {
    return this.props.items.reduce((sum, item) => {
      const quantity = item.id.equals(itemId)
        ? newQuantity
        : item.quantity;
      return sum + quantity;
    }, 0);
  }
}
```

---

## 11. Transaction and Consistency Boundaries

### Transactional Consistency (Within Aggregate):

```typescript
/**
 * All changes within an aggregate are ACID.
 * Either all succeed or all fail.
 */
interface OrderProps {
  items: OrderItem[];
  status: OrderStatus;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

class Order extends AggregateRoot<OrderProps, OrderId> {
  public complete(): Result<void> {
    // Validate entire aggregate state
    if (this.props.items.length === 0) {
      return Result.fail('Cannot complete empty order');
    }

    // Multiple changes happen atomically
    this.props.status = OrderStatus.COMPLETED;
    this.props.completedAt = new Date();
    this.props.updatedAt = new Date();
    this.props.items.forEach((item) => item.markAsOrdered());

    // All or nothing when saved to DB
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
interface OrderProps {
  customerId: string;
  total: Money;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

// 1. Order aggregate publishes event
class Order extends AggregateRoot<OrderProps, OrderId> {
  public complete(): Result<void> {
    this.props.status = OrderStatus.COMPLETED;
    this.props.updatedAt = new Date();

    // Event for other aggregates
    this.addDomainEvent(
      new OrderCompletedEvent(
        this.id,
        this.props.customerId,
        this.props.total
      )
    );

    return Result.ok();
  }
}

// 2. Event handler updates other aggregates
class UpdateCustomerStatisticsHandler {
  async handle(event: OrderCompletedEvent): Promise<void> {
    // Load different aggregate
    const customer = await this.customerRepo.findById(
      event.customerId
    );

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
interface ShoppingCartProps {
  items: CartItem[];
  total: Money;
  createdAt: Date;
  updatedAt: Date;
}

// ✅ GOOD - Immediate consistency within aggregate
class ShoppingCart extends AggregateRoot<
  ShoppingCartProps,
  ShoppingCartId
> {
  public addItem(item: CartItem): Result<void> {
    this.props.items.push(item);
    this.props.total = this.calculateTotal(); // Immediately consistent
    this.props.updatedAt = new Date();
    return Result.ok();
  }
}

// ✅ GOOD - Eventual consistency across aggregates
class OrderCompletedHandler {
  async handle(event: OrderCompletedEvent): Promise<void> {
    // Updates CustomerStatistics aggregate eventually
    const stats = await this.statsRepo.findByCustomerId(
      event.customerId
    );
    stats.incrementOrderCount();
    await this.statsRepo.save(stats);
  }
}
```

---

## 12. Testing Strategy

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

        const item1 = createOrderItem(
          Money.create({ amount: 10, currency: 'USD' }).value,
          2
        );
        const item2 = createOrderItem(
          Money.create({ amount: 15, currency: 'USD' }).value,
          3
        );

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
      expect(order.domainEvents[0]).toBeInstanceOf(
        OrderConfirmedEvent
      );
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

## 13. Examples

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
  createdAt: Date;
  updatedAt: Date;
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
export class NetworkDevice extends AggregateRoot<
  NetworkDeviceProps,
  NetworkDeviceId
> {
  private constructor(
    props: NetworkDeviceProps,
    id: NetworkDeviceId
  ) {
    super(props, id);
  }

  public static create(
    props: Omit<NetworkDeviceProps, 'createdAt' | 'updatedAt'>,
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
      return Result.fail<NetworkDevice>(
        'Polling configuration is required'
      );
    }

    // Validate aggregate invariants
    const invariantsResult = this.validateInvariants(props);
    if (invariantsResult.isFailure) {
      return Result.fail<NetworkDevice>(invariantsResult.error);
    }

    // Create device
    const deviceId = id ?? NetworkDeviceId.create().value;

    const deviceProps: NetworkDeviceProps = {
      ...props,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const device = new NetworkDevice(deviceProps, deviceId);

    // Publish creation event
    device.addDomainEvent(new NetworkDeviceCreatedEvent(device));

    return Result.ok<NetworkDevice>(device);
  }

  /**
   * Validates aggregate-level invariants.
   */
  private static validateInvariants(
    props: Omit<NetworkDeviceProps, 'createdAt' | 'updatedAt'>
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
    if (newStatus === this.props.status) {
      return Result.ok<void>(); // No change
    }

    // Validate invariant: If going to MAINTENANCE, disable polling
    if (
      newStatus === NetworkDeviceStatus.MAINTENANCE &&
      this.props.pollingConfiguration.enabled
    ) {
      // Automatically disable polling
      this.props.pollingConfiguration.disable();
    }

    // Validate invariant: If going to OFFLINE, disable polling
    if (
      newStatus === NetworkDeviceStatus.OFFLINE &&
      this.props.pollingConfiguration.enabled
    ) {
      this.props.pollingConfiguration.disable();
    }

    const oldStatus = this.props.status;
    this.props.status = newStatus;
    this.props.updatedAt = new Date();

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
    if (this.props.status !== NetworkDeviceStatus.ONLINE) {
      return Result.fail<void>(
        'Cannot enable polling for offline or maintenance devices'
      );
    }

    const enableResult = this.props.pollingConfiguration.enable();
    if (enableResult.isFailure) {
      return enableResult;
    }

    this.props.updatedAt = new Date();
    this.addDomainEvent(new PollingEnabledEvent(this));

    return Result.ok<void>();
  }

  /**
   * Disables polling for this device.
   */
  public disablePolling(): Result<void> {
    this.props.pollingConfiguration.disable();

    this.props.updatedAt = new Date();
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
    const updateResult =
      this.props.pollingConfiguration.updateInterval(newInterval);
    if (updateResult.isFailure) {
      return updateResult;
    }

    this.props.updatedAt = new Date();

    return Result.ok<void>();
  }

  // Getters
  get name(): string {
    return this.props.name;
  }

  get ipAddress(): IPAddress {
    return this.props.ipAddress;
  }

  get macAddress(): MACAddress {
    return this.props.macAddress;
  }

  get status(): NetworkDeviceStatus {
    return this.props.status;
  }

  get pollingConfiguration(): PollingConfiguration {
    return this.props.pollingConfiguration;
  }

  get isOnline(): boolean {
    return this.props.status === NetworkDeviceStatus.ONLINE;
  }

  get isPollingEnabled(): boolean {
    return this.props.pollingConfiguration.enabled;
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
