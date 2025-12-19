# DOMAIN EVENTS STANDARD

## Table of Contents

1. [Purpose of Domain Events in DDD](#1-purpose-of-domain-events-in-ddd)
2. [Responsibilities of a Domain Event](#2-responsibilities-of-a-domain-event)
3. [Boundaries of a Domain Event](#3-boundaries-of-a-domain-event)
4. [Connections with Other Layers](#4-connections-with-other-layers)
5. [Domain Event Lifetime & Execution Flow](#5-domain-event-lifetime--execution-flow)
6. [Domain Event Structure Template](#6-domain-event-structure-template)
7. [Orthogonality Principles](#7-orthogonality-principles)
8. [Naming Conventions](#8-naming-conventions)
9. [Event Handling Patterns](#9-event-handling-patterns)
10. [Testing Strategy](#10-testing-strategy)
11. [Examples](#11-examples)

---

## 1. Purpose of Domain Events in DDD

**Domain Events represent something significant that happened in the domain.**

### Core Characteristics:

- **Immutable**: Once created, cannot be changed (enforced via readonly + Object.freeze)
- **Past Tense**: Named after what happened (OrderCreated, not CreateOrder)
- **Domain Concepts**: Represent domain occurrences, not technical events
- **Decoupling**: Allow aggregates to communicate without direct references
- **Eventual Consistency**: Enable cross-aggregate coordination
- **Audit Trail**: Can be stored for event sourcing or auditing
- **Props-Based**: Use frozen props object for guaranteed immutability

### Why Domain Events?

1. **Decouple Aggregates**: Aggregates communicate without direct references
2. **Eventual Consistency**: Coordinate changes across aggregate boundaries
3. **Side Effects**: Trigger actions in other parts of the system
4. **Integration**: Publish to external systems when domain changes
5. **Audit Trail**: Record what happened in the domain
6. **Domain Insight**: Make implicit domain concepts explicit

### Domain Events vs Integration Events:

| Aspect         | Domain Event             | Integration Event       |
| -------------- | ------------------------ | ----------------------- |
| **Scope**      | Within bounded context   | Across bounded contexts |
| **Purpose**    | Domain coordination      | System integration      |
| **Publisher**  | Aggregate Root           | Application layer       |
| **Handlers**   | Domain/Application layer | External systems        |
| **Guaranteed** | In-process, synchronous  | Out-of-process, async   |
| **Schema**     | Can change freely        | Versioned contract      |
| **Structure**  | Props-based, immutable   | DTO, versioned          |

---

## 2. Responsibilities of a Domain Event

### MUST DO:

1. **Represent Domain Occurrence**

   - Capture significant domain state change
   - Named after domain concept
   - Contains relevant domain data

2. **Be Immutable**

   - All properties readonly
   - Props object frozen with Object.freeze()
   - Set at construction time
   - No setters or mutations

3. **Contain Relevant Data**

   - Include data needed by handlers
   - Aggregate ID always included
   - Timestamp of occurrence
   - Relevant value objects or IDs (not full aggregates)

4. **Be Self-Descriptive**

   - Event name clearly states what happened
   - Props describe the change
   - Just enough information

5. **Be Serializable**
   - Can be converted to JSON
   - Can be persisted (for event store)
   - Can be transmitted (for message bus)
   - Value objects provide serialization methods

---

## 3. Boundaries of a Domain Event

### MUST NOT DO:

1. **❌ Contain Business Logic**

   - Events are data holders only
   - No validation logic
   - No calculations
   - No state mutations

2. **❌ Reference Entire Aggregates**

   - Store IDs, not full objects
   - Store value objects if needed
   - Avoid large object graphs

3. **❌ Be Mutable**

   - No setters
   - No methods that change state
   - Props are readonly and frozen

4. **❌ Know About Handlers**

   - Events don't know who handles them
   - Handlers subscribe to events
   - Loose coupling maintained

5. **❌ Contain Infrastructure Concerns**
   - No database entities
   - No HTTP requests
   - No framework dependencies

---

## 4. Connections with Other Layers

```
┌─────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                        │
│  - May subscribe to events for notifications                │
│  - Converts events to integration events                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  APPLICATION LAYER                          │
│  ┌───────────────────────────────────────────────────┐      │
│  │  Event Handlers (Application Logic)               │      │
│  │  - Listen for domain events                       │      │
│  │  - Coordinate cross-aggregate operations          │      │
│  │  - Trigger side effects (emails, notifications)   │      │
│  │  - Update read models                             │      │
│  └───────────────────────────────────────────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼ subscribes to
┌─────────────────────────────────────────────────────────────┐
│                    DOMAIN LAYER                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │         DOMAIN EVENTS (You are here)               │     │
│  │  - Immutable props-based objects                   │     │
│  │  - Represent domain occurrences                    │     │
│  │  - Published by Aggregates                         │     │
│  │  - Handled by Application/Domain handlers          │     │
│  └────────────────────────────────────────────────────┘     │
│         ▲                                                   │
│         │ publishes                                         │
│  ┌──────────────────┐                                       │
│  │  Aggregate Root  │ (props-based)                         │
│  │  - Adds events   │                                       │
│  │  - Events queued │                                       │
│  └──────────────────┘                                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  DomainEvents (Dispatcher)                          │    │
│  │  - Manages subscriptions                            │    │
│  │  - Dispatches events to handlers                    │    │
│  │  - Ensures events dispatched after persistence      │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                         ▲
                         │
┌─────────────────────────────────────────────────────────────┐
│               INFRASTRUCTURE LAYER                          │
│  - Event persistence (event store)                          │
│  - Message bus integration                                  │
│  - External system notifications                            │
└─────────────────────────────────────────────────────────────┘
```

### Event Flow:

```
1. Aggregate performs domain operation (updates props)
2. Aggregate adds domain event to internal queue
3. Aggregate marks itself for dispatch
4. Use Case saves aggregate to repository
5. Repository dispatches events AFTER successful save
6. DomainEvents dispatcher calls all handlers
7. Handlers perform side effects
8. Events cleared from aggregate
```

---

## 5. Domain Event Lifetime & Execution Flow

### Creation and Dispatch:

```typescript
// 1. Aggregate creates and adds event (props-based pattern)
interface OrderProps {
  customerId: CustomerId;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: Money;
}

class Order extends AggregateRoot<OrderId> {
  private constructor(
    private readonly props: OrderProps,
    id?: OrderId
  ) {
    super(id);
    Object.freeze(this.props);
  }

  get customerId(): CustomerId {
    return this.props.customerId;
  }

  get status(): OrderStatus {
    return this.props.status;
  }

  public confirm(): Result<void> {
    // Validate business rules
    if (this.props.status !== OrderStatus.PENDING) {
      return Result.fail<void>('Order must be pending to confirm');
    }

    // Update state (create new props object for immutability)
    const newProps = {
      ...this.props,
      status: OrderStatus.CONFIRMED
    };
    Object.assign(this.props as any, newProps);
    Object.freeze(this.props);

    // Add domain event
    this.addDomainEvent(
      new OrderConfirmedEvent({
        orderId: this.id,
        customerId: this.props.customerId,
        totalAmount: this.props.totalAmount,
        occurredOn: new Date()
      })
    );

    return Result.ok();
  }

  public static create(props: OrderProps, id?: OrderId): Result<Order> {
    // Validation guards
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.customerId, 'customerId'),
      Guard.againstNullOrUndefined(props.items, 'items')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<Order>(guardResult.message!);
    }

    const order = new Order(props, id);

    // Publish creation event
    order.addDomainEvent(
      new OrderCreatedEvent({
        orderId: order.id,
        customerId: props.customerId,
        occurredOn: new Date()
      })
    );

    return Result.ok<Order>(order);
  }
}

// 2. Use Case saves aggregate
class ConfirmOrderUseCase {
  async execute(orderId: OrderId): Promise<Result<void>> {
    const orderResult = await this.orderRepo.findById(orderId);

    if (orderResult.isFailure) {
      return Result.fail<void>(orderResult.error);
    }

    const order = orderResult.value;
    const confirmResult = order.confirm();

    if (confirmResult.isFailure) {
      return Result.fail<void>(confirmResult.error);
    }

    // Events dispatched AFTER successful save
    await this.orderRepo.save(order);

    return Result.ok();
  }
}

// 3. Repository triggers event dispatch
class OrderRepository {
  async save(order: Order): Promise<Result<Order>> {
    // Save to database
    await this.prisma.order.upsert({ ... });

    // Dispatch events AFTER successful save
    DomainEvents.dispatchEventsForAggregate(order.id);

    return Result.ok(order);
  }
}

// 4. Handlers receive event
class OrderConfirmedHandler implements IHandle<OrderConfirmedEvent> {
  async handle(event: OrderConfirmedEvent): Promise<void> {
    // Update inventory
    const inventoryResult = await this.inventoryRepo.findByOrderId(
      event.orderId
    );

    if (inventoryResult.isSuccess) {
      const inventory = inventoryResult.value;
      inventory.reserve(event.items);
      await this.inventoryRepo.save(inventory);
    }

    // Send notification
    await this.notificationService.send(
      event.customerId,
      'Order confirmed!'
    );
  }
}
```

### Lifecycle Phases:

1. **Creation**: Event created in aggregate method with props object
2. **Queuing**: Event added to aggregate's event queue
3. **Persistence**: Aggregate saved to database
4. **Dispatch**: Events dispatched after successful save
5. **Handling**: Handlers receive and process event
6. **Clearing**: Events cleared from aggregate

---

## 6. Domain Event Structure Template

### Base Domain Event Interface:

```typescript
import { UniqueEntityID } from '@/shared/domain/UniqueEntityID';

/**
 * Base interface for all domain events.
 * Events represent something that happened in the domain.
 */
export interface IDomainEvent {
  /**
   * When the event occurred.
   */
  readonly occurredOn: Date;

  /**
   * Aggregate ID that published this event.
   */
  getAggregateId(): UniqueEntityID;
}
```

### Props-Based Domain Event Template:

```typescript
import { IDomainEvent } from '@/shared/domain/events/IDomainEvent';
import { UniqueEntityID } from '@/shared/domain/UniqueEntityID';

/**
 * Props interface for EventName.
 * Defines all properties the event contains.
 */
export interface EventNameEventProps {
  readonly aggregateId: UniqueEntityID;
  readonly property1: ValueObject1;
  readonly property2: ValueObject2;
  readonly occurredOn: Date;
}

/**
 * [Event Name] - Brief description of what happened.
 *
 * Published By: [Aggregate Name]
 * Published When: [When this event is published]
 *
 * Handlers:
 * - [Handler 1]: [What it does]
 * - [Handler 2]: [What it does]
 *
 * Use Cases:
 * - [Use case that triggers this event]
 *
 * Business Rules:
 * - [Any domain rules about when this event is published]
 * - [Any invariants the event represents]
 *
 * @example
 * ```typescript
 * const event = new EventNameEvent({
 *   aggregateId,
 *   property1: valueObject1,
 *   property2: valueObject2,
 *   occurredOn: new Date()
 * });
 * ```
 */
export class EventNameEvent implements IDomainEvent {
  private readonly _props: EventNameEventProps;

  /**
   * Constructor for EventNameEvent.
   * All properties are readonly and frozen for immutability.
   *
   * @param props - Event properties
   */
  constructor(props: EventNameEventProps) {
    this._props = Object.freeze({ ...props });
  }

  /**
   * Gets the aggregate ID that published this event.
   */
  public getAggregateId(): UniqueEntityID {
    return this._props.aggregateId;
  }

  /**
   * When the event occurred.
   */
  get occurredOn(): Date {
    return this._props.occurredOn;
  }

  /**
   * Getter for property1.
   */
  get property1(): ValueObject1 {
    return this._props.property1;
  }

  /**
   * Getter for property2.
   */
  get property2(): ValueObject2 {
    return this._props.property2;
  }

  /**
   * String representation for logging.
   */
  public toString(): string {
    return `EventNameEvent(aggregateId: ${this._props.aggregateId.toString()}, occurredOn: ${this._props.occurredOn.toISOString()})`;
  }

  /**
   * Serializes event to plain object for persistence.
   */
  public toJSON(): Record<string, any> {
    return {
      aggregateId: this._props.aggregateId.toString(),
      property1: this._props.property1.toString(),
      property2: this._props.property2.toString(),
      occurredOn: this._props.occurredOn.toISOString()
    };
  }
}
```

### Simplified Domain Event Template (For Simple Events):

```typescript
/**
 * For simple events without complex value objects,
 * you can use constructor-based approach with readonly.
 */
export class SimpleEventNameEvent implements IDomainEvent {
  /**
   * Constructor with readonly parameters for immutability.
   */
  constructor(
    public readonly aggregateId: UniqueEntityID,
    public readonly simpleProperty: string,
    public readonly occurredOn: Date = new Date()
  ) {
    // Freeze for absolute immutability
    Object.freeze(this);
  }

  public getAggregateId(): UniqueEntityID {
    return this.aggregateId;
  }

  public toString(): string {
    return `SimpleEventNameEvent(aggregateId: ${this.aggregateId.toString()})`;
  }
}
```

### Event Handler Interface:

```typescript
import { IDomainEvent } from './IDomainEvent';

/**
 * Interface for domain event handlers.
 * Handlers subscribe to specific event types.
 *
 * @template T - Type of event to handle
 */
export interface IHandle<T extends IDomainEvent> {
  /**
   * Handles the domain event.
   *
   * @param event - The event to handle
   */
  handle(event: T): Promise<void> | void;
}
```

### Event Handler Template:

```typescript
import { IHandle } from '@/shared/domain/events/IHandle';
import { EventNameEvent } from '@/domain/events/EventNameEvent';

/**
 * Handler for EventNameEvent.
 *
 * Responsibilities:
 * - [What this handler does]
 * - [Side effects it triggers]
 *
 * Dependencies:
 * - [Repository/Service 1]: For [purpose]
 * - [Repository/Service 2]: For [purpose]
 *
 * Error Handling:
 * - Handlers should be resilient and not throw errors
 * - Log errors but continue processing
 * - Use eventual consistency for recovery
 */
export class EventNameEventHandler
  implements IHandle<EventNameEvent>
{
  constructor(
    private readonly repository1: IRepository1,
    private readonly service1: IService1
  ) {}

  /**
   * Handles the EventNameEvent.
   * Performs side effects and cross-aggregate coordination.
   */
  public async handle(event: EventNameEvent): Promise<void> {
    try {
      // 1. Load related aggregates/data
      const relatedAggregateResult =
        await this.repository1.findById(event.relatedId);

      if (relatedAggregateResult.isFailure) {
        // Log error but don't fail (eventual consistency)
        console.error(
          `Failed to load aggregate: ${relatedAggregateResult.error}`
        );
        return;
      }

      // 2. Perform domain operation
      const aggregate = relatedAggregateResult.value;
      const result = aggregate.performOperation(event.property1);

      if (result.isFailure) {
        console.error(`Operation failed: ${result.error}`);
        return;
      }

      // 3. Persist changes
      await this.repository1.save(aggregate);

      // 4. Trigger additional side effects if needed
      await this.service1.notify(event.getAggregateId());
    } catch (error) {
      // Log error but don't throw (handlers should be resilient)
      console.error(`Error handling EventNameEvent:`, error);
    }
  }
}
```

---

## 7. Orthogonality Principles

### 1. Immutability via Props Pattern

Events use props-based pattern for guaranteed immutability:

```typescript
// ✅ GOOD - Props-based immutable event
export interface OrderCreatedEventProps {
  readonly orderId: OrderId;
  readonly customerId: CustomerId;
  readonly totalAmount: Money;
  readonly occurredOn: Date;
}

export class OrderCreatedEvent implements IDomainEvent {
  private readonly _props: OrderCreatedEventProps;

  constructor(props: OrderCreatedEventProps) {
    this._props = Object.freeze({ ...props });
  }

  get orderId(): OrderId {
    return this._props.orderId;
  }

  get customerId(): CustomerId {
    return this._props.customerId;
  }

  get totalAmount(): Money {
    return this._props.totalAmount;
  }

  get occurredOn(): Date {
    return this._props.occurredOn;
  }

  public getAggregateId(): OrderId {
    return this._props.orderId;
  }
}

// ❌ BAD - Mutable event (no props, no freeze)
export class OrderCreatedEvent implements IDomainEvent {
  public orderId: OrderId; // Not readonly!
  public occurredOn: Date;

  setOrderId(id: OrderId): void {
    // Setter!
    this.orderId = id;
  }
}
```

### 2. Self-Contained

Events contain all relevant data:

```typescript
// ✅ GOOD - Self-contained with all data
export interface OrderShippedEventProps {
  readonly orderId: OrderId;
  readonly trackingNumber: string;
  readonly carrier: string;
  readonly estimatedDelivery: Date;
  readonly shippingAddress: Address; // Value Object
  readonly occurredOn: Date;
}

export class OrderShippedEvent implements IDomainEvent {
  private readonly _props: OrderShippedEventProps;

  constructor(props: OrderShippedEventProps) {
    this._props = Object.freeze({ ...props });
  }

  get trackingNumber(): string {
    return this._props.trackingNumber;
  }

  get carrier(): string {
    return this._props.carrier;
  }

  get estimatedDelivery(): Date {
    return this._props.estimatedDelivery;
  }

  get shippingAddress(): Address {
    return this._props.shippingAddress;
  }
  // ... other getters
}

// ❌ BAD - Incomplete (handlers must query for details)
export class OrderShippedEvent implements IDomainEvent {
  constructor(
    public readonly orderId: OrderId,
    public readonly occurredOn: Date = new Date()
  ) {}
  // Missing tracking number, carrier, etc.
}
```

### 3. Domain-Focused

Events represent domain concepts, not technical operations:

```typescript
// ✅ GOOD - Domain concepts
export class PaymentReceivedEvent {}
export class InventoryReservedEvent {}
export class CustomerUpgradedToGoldTierEvent {}
export class NetworkDeviceWentOfflineEvent {}
export class PollingResultRecordedEvent {}

// ❌ BAD - Technical operations
export class OrderRecordUpdatedEvent {} // Database operation, not domain
export class OrderTableModifiedEvent {} // Infrastructure detail
export class DataChangedEvent {} // Too generic
export class EntitySavedEvent {} // Technical, not domain
```

### 4. Past Tense

Events are named after what happened (past tense):

```typescript
// ✅ GOOD - Past tense
export class OrderCreatedEvent {}
export class PaymentProcessedEvent {}
export class ItemAddedToCartEvent {}
export class DeviceStatusChangedEvent {}
export class AlertTriggeredEvent {}

// ❌ BAD - Present/imperative
export class CreateOrderEvent {} // Command, not event
export class ProcessPaymentEvent {} // Command
export class AddItemToCart {} // Command
export class ChangeDeviceStatus {} // Command
```

### 5. Value Objects in Events

Use value objects, not primitives, for domain concepts:

```typescript
// ✅ GOOD - Value Objects
export interface PaymentReceivedEventProps {
  readonly orderId: OrderId; // Entity ID
  readonly amount: Money; // Value Object
  readonly paymentMethod: PaymentMethod; // Value Object
  readonly transactionId: TransactionId; // Value Object
  readonly occurredOn: Date;
}

// ❌ BAD - Primitives
export interface PaymentReceivedEventProps {
  readonly orderId: string; // Should be OrderId
  readonly amount: number; // Should be Money
  readonly currency: string; // Should be part of Money
  readonly paymentMethod: string; // Should be PaymentMethod
  readonly occurredOn: Date;
}
```

---

## 8. Naming Conventions

### Event Class Names:

- Use **past tense verbs**
- End with `Event` suffix
- Be specific about what happened
- Reflect domain language

```typescript
// ✅ GOOD - Clear, past tense, domain-focused
export class OrderConfirmedEvent {}
export class PaymentRefundedEvent {}
export class InventoryRestockedEvent {}
export class CustomerRegisteredEvent {}
export class PollingResultRecordedEvent {}
export class DeviceStatusChangedEvent {}
export class AlertAcknowledgedEvent {}

// ❌ BAD - Vague, wrong tense, or technical
export class OrderEvent {} // Too generic
export class ConfirmOrder {} // Command (imperative)
export class OrderStateChanged {} // Vague (what changed?)
export class DatabaseUpdatedEvent {} // Technical, not domain
export class UpdateOrder {} // Command
```

### Event Props Interface Names:

```typescript
// ✅ GOOD - Matches event class name + Props
export interface OrderCreatedEventProps {}
export interface PaymentProcessedEventProps {}
export interface DeviceStatusChangedEventProps {}

// ❌ BAD - Inconsistent naming
export interface OrderCreatedProps {} // Missing Event
export interface OrderCreated {} // Missing Event and Props
export interface IOrderCreatedEventProps {} // No I prefix
```

### Event Property Names:

- Use **camelCase**
- Be descriptive
- Include aggregate ID
- Use domain types (Value Objects, Entity IDs)

```typescript
export interface OrderCreatedEventProps {
  readonly orderId: OrderId; // ✅ Aggregate ID
  readonly customerId: CustomerId; // ✅ Related ID
  readonly totalAmount: Money; // ✅ Value Object
  readonly itemCount: number; // ✅ Primitive (when appropriate)
  readonly shippingAddress: Address; // ✅ Value Object
  readonly occurredOn: Date; // ✅ Timestamp
}
```

### Event File Names:

```
src/domain/events/
  OrderCreatedEvent.ts          // ✅ PascalCase with Event suffix
  OrderConfirmedEvent.ts        // ✅
  PaymentProcessedEvent.ts      // ✅
  DeviceStatusChangedEvent.ts   // ✅

  order-created.event.ts        // ❌ Kebab-case
  OrderCreated.ts               // ❌ Missing Event suffix
  Events.ts                     // ❌ Too generic
  orderCreatedEvent.ts          // ❌ camelCase
```

---

## 9. Event Handling Patterns

### Pattern 1: Eventual Consistency Across Aggregates

```typescript
// Aggregate publishes event (props-based)
interface OrderProps {
  customerId: CustomerId;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: Money;
}

export class Order extends AggregateRoot<OrderId> {
  private constructor(
    private readonly props: OrderProps,
    id?: OrderId
  ) {
    super(id);
    Object.freeze(this.props);
  }

  public confirm(): Result<void> {
    // Update state
    const newProps = { ...this.props, status: OrderStatus.CONFIRMED };
    Object.assign(this.props as any, newProps);
    Object.freeze(this.props);

    // Publish event
    this.addDomainEvent(
      new OrderConfirmedEvent({
        orderId: this.id,
        customerId: this.props.customerId,
        totalAmount: this.props.totalAmount,
        items: [...this.props.items],
        occurredOn: new Date()
      })
    );

    return Result.ok();
  }
}

// Handler updates different aggregate
export class OrderConfirmedHandler
  implements IHandle<OrderConfirmedEvent>
{
  async handle(event: OrderConfirmedEvent): Promise<void> {
    // Update Inventory aggregate (different transaction)
    const inventoryResult = await this.inventoryRepo.findByItems(
      event.items
    );

    if (inventoryResult.isSuccess) {
      const inventory = inventoryResult.value;
      inventory.reserveItems(event.items);
      await this.inventoryRepo.save(inventory);
    }
  }
}
```

### Pattern 2: Side Effects (Notifications, Emails)

```typescript
export class OrderShippedHandler
  implements IHandle<OrderShippedEvent>
{
  constructor(
    private readonly emailService: IEmailService,
    private readonly customerRepo: ICustomerRepository
  ) {}

  async handle(event: OrderShippedEvent): Promise<void> {
    // Load customer
    const customerResult = await this.customerRepo.findById(
      event.customerId
    );

    if (customerResult.isFailure) {
      console.error('Customer not found');
      return;
    }

    const customer = customerResult.value;

    // Send notification (side effect)
    await this.emailService.send({
      to: customer.email.value,
      subject: 'Your order has shipped!',
      body: `Tracking: ${event.trackingNumber}\nCarrier: ${event.carrier}`
    });
  }
}
```

### Pattern 3: Read Model Updates

```typescript
export class OrderConfirmedHandler
  implements IHandle<OrderConfirmedEvent>
{
  constructor(
    private readonly readModelRepo: IOrderReadModelRepository
  ) {}

  async handle(event: OrderConfirmedEvent): Promise<void> {
    // Update denormalized read model for queries
    await this.readModelRepo.updateOrderStatus(
      event.orderId.toString(),
      'CONFIRMED',
      event.occurredOn
    );
  }
}
```

### Pattern 4: Event Chaining

```typescript
// First event
export interface OrderConfirmedEventProps {
  readonly orderId: OrderId;
  readonly items: OrderItem[];
  readonly occurredOn: Date;
}

export class OrderConfirmedEvent implements IDomainEvent {
  private readonly _props: OrderConfirmedEventProps;

  constructor(props: OrderConfirmedEventProps) {
    this._props = Object.freeze({ ...props });
  }
  // ... getters
}

// Handler publishes new event
export class OrderConfirmedHandler
  implements IHandle<OrderConfirmedEvent>
{
  async handle(event: OrderConfirmedEvent): Promise<void> {
    const inventoryResult = await this.inventoryRepo.findByItems(
      event.items
    );

    if (inventoryResult.isSuccess) {
      const inventory = inventoryResult.value;
      const result = inventory.reserve(event.items);

      if (result.isSuccess) {
        // This save will trigger InventoryReservedEvent
        await this.inventoryRepo.save(inventory);
      }
    }
  }
}

// Second event (triggered by first)
export interface InventoryReservedEventProps {
  readonly inventoryId: InventoryId;
  readonly items: OrderItem[];
  readonly orderId: OrderId;
  readonly occurredOn: Date;
}

export class InventoryReservedEvent implements IDomainEvent {
  private readonly _props: InventoryReservedEventProps;

  constructor(props: InventoryReservedEventProps) {
    this._props = Object.freeze({ ...props });
  }
  // ... getters
}
```

### Pattern 5: Compensating Actions

```typescript
export class PaymentFailedHandler
  implements IHandle<PaymentFailedEvent>
{
  async handle(event: PaymentFailedEvent): Promise<void> {
    // Compensate: Cancel order
    const orderResult = await this.orderRepo.findById(event.orderId);

    if (orderResult.isSuccess) {
      const order = orderResult.value;
      order.cancel('Payment failed');
      await this.orderRepo.save(order);
    }

    // Compensate: Release inventory
    const inventoryResult = await this.inventoryRepo.findByOrderId(
      event.orderId
    );

    if (inventoryResult.isSuccess) {
      const inventory = inventoryResult.value;
      inventory.release(event.items);
      await this.inventoryRepo.save(inventory);
    }
  }
}
```

---

## 10. Testing Strategy

### Testing Event Creation:

```typescript
describe('OrderConfirmedEvent', () => {
  it('should create event with all properties', () => {
    const orderId = OrderId.create().value;
    const customerId = CustomerId.create().value;
    const totalAmount = Money.create({
      amount: 100,
      currency: 'USD'
    }).value;
    const items = [createMockOrderItem()];
    const occurredOn = new Date();

    const event = new OrderConfirmedEvent({
      orderId,
      customerId,
      totalAmount,
      items,
      occurredOn
    });

    expect(event.orderId).toBe(orderId);
    expect(event.customerId).toBe(customerId);
    expect(event.totalAmount).toBe(totalAmount);
    expect(event.items).toEqual(items);
    expect(event.occurredOn).toBe(occurredOn);
  });

  it('should be immutable', () => {
    const event = new OrderConfirmedEvent({
      orderId: OrderId.create().value,
      customerId: CustomerId.create().value,
      totalAmount: Money.create({ amount: 100, currency: 'USD' })
        .value,
      items: [],
      occurredOn: new Date()
    });

    // Attempting to modify should fail
    expect(() => {
      // @ts-expect-error - Testing immutability
      event.orderId = OrderId.create().value;
    }).toThrow();
  });

  it('should freeze props object', () => {
    const event = new OrderConfirmedEvent({
      orderId: OrderId.create().value,
      customerId: CustomerId.create().value,
      totalAmount: Money.create({ amount: 100, currency: 'USD' })
        .value,
      items: [],
      occurredOn: new Date()
    });

    // Props should be frozen
    expect(Object.isFrozen((event as any)._props)).toBe(true);
  });

  it('should serialize to JSON', () => {
    const orderId = OrderId.create().value;
    const event = new OrderConfirmedEvent({
      orderId,
      customerId: CustomerId.create().value,
      totalAmount: Money.create({ amount: 100, currency: 'USD' })
        .value,
      items: [],
      occurredOn: new Date()
    });

    const json = event.toJSON();

    expect(json.orderId).toBe(orderId.toString());
    expect(json).toHaveProperty('totalAmount');
    expect(json).toHaveProperty('occurredOn');
  });
});
```

### Testing Event Publishing:

```typescript
describe('Order Aggregate - Event Publishing', () => {
  it('should publish OrderConfirmedEvent when confirmed', () => {
    const orderResult = Order.create({
      customerId: CustomerId.create().value,
      items: [createMockOrderItem()],
      shippingAddress: createMockAddress(),
      status: OrderStatus.PENDING,
      totalAmount: Money.create({ amount: 100, currency: 'USD' })
        .value
    });

    expect(orderResult.isSuccess).toBe(true);
    const order = orderResult.value;

    // Clear creation event
    order.clearEvents();

    // Confirm order
    const confirmResult = order.confirm();

    expect(confirmResult.isSuccess).toBe(true);

    // Check event was added
    expect(order.domainEvents).toHaveLength(1);
    expect(order.domainEvents[0]).toBeInstanceOf(OrderConfirmedEvent);
  });

  it('should include correct data in event', () => {
    const customerId = CustomerId.create().value;
    const totalAmount = Money.create({
      amount: 100,
      currency: 'USD'
    }).value;

    const orderResult = Order.create({
      customerId,
      items: [createMockOrderItem()],
      shippingAddress: createMockAddress(),
      status: OrderStatus.PENDING,
      totalAmount
    });

    const order = orderResult.value;
    order.clearEvents();
    order.confirm();

    const event = order.domainEvents[0] as OrderConfirmedEvent;

    expect(event.orderId.equals(order.id)).toBe(true);
    expect(event.customerId.equals(customerId)).toBe(true);
    expect(event.totalAmount.equals(totalAmount)).toBe(true);
  });
});
```

### Testing Event Handlers:

```typescript
describe('OrderConfirmedHandler', () => {
  let handler: OrderConfirmedHandler;
  let inventoryRepo: MockInventoryRepository;
  let emailService: MockEmailService;

  beforeEach(() => {
    inventoryRepo = new MockInventoryRepository();
    emailService = new MockEmailService();
    handler = new OrderConfirmedHandler(inventoryRepo, emailService);
  });

  it('should reserve inventory when order confirmed', async () => {
    const event = new OrderConfirmedEvent({
      orderId: OrderId.create().value,
      customerId: CustomerId.create().value,
      totalAmount: Money.create({ amount: 100, currency: 'USD' })
        .value,
      items: [createMockOrderItem()],
      occurredOn: new Date()
    });

    await handler.handle(event);

    expect(inventoryRepo.saveCalled).toBe(true);
    expect(inventoryRepo.lastSaved?.isReserved).toBe(true);
  });

  it('should send confirmation email', async () => {
    const event = new OrderConfirmedEvent({
      orderId: OrderId.create().value,
      customerId: CustomerId.create().value,
      totalAmount: Money.create({ amount: 100, currency: 'USD' })
        .value,
      items: [],
      occurredOn: new Date()
    });

    await handler.handle(event);

    expect(emailService.sendCalled).toBe(true);
    expect(emailService.lastEmail?.subject).toContain('confirmed');
  });

  it('should handle errors gracefully', async () => {
    inventoryRepo.throwError = true;

    const event = new OrderConfirmedEvent({
      orderId: OrderId.create().value,
      customerId: CustomerId.create().value,
      totalAmount: Money.create({ amount: 100, currency: 'USD' })
        .value,
      items: [],
      occurredOn: new Date()
    });

    // Should not throw
    await expect(handler.handle(event)).resolves.not.toThrow();
  });
});
```

---

## 11. Examples

### Example 1: OrderConfirmedEvent (Props-Based)

```typescript
import { IDomainEvent } from '@/shared/domain/events/IDomainEvent';
import { OrderId } from '@/domain/aggregates/Order';
import { CustomerId } from '@/domain/aggregates/Customer';
import { Money } from '@/domain/value-objects/Money';
import { OrderItem } from '@/domain/entities/OrderItem';

/**
 * Props for OrderConfirmedEvent.
 */
export interface OrderConfirmedEventProps {
  readonly orderId: OrderId;
  readonly customerId: CustomerId;
  readonly totalAmount: Money;
  readonly items: ReadonlyArray<OrderItem>;
  readonly occurredOn: Date;
}

/**
 * OrderConfirmedEvent - Order has been confirmed by customer.
 *
 * Published By: Order aggregate
 * Published When: Order.confirm() is called successfully
 *
 * Handlers:
 * - InventoryReservationHandler: Reserves inventory for order items
 * - OrderConfirmationEmailHandler: Sends confirmation email to customer
 * - AnalyticsHandler: Records order confirmation metric
 *
 * Use Cases:
 * - ConfirmOrderUseCase
 *
 * Business Rules:
 * - Order must be in PENDING status to be confirmed
 * - All items must be available in inventory
 * - Payment must be authorized
 */
export class OrderConfirmedEvent implements IDomainEvent {
  private readonly _props: OrderConfirmedEventProps;

  constructor(props: OrderConfirmedEventProps) {
    this._props = Object.freeze({ ...props });
  }

  get orderId(): OrderId {
    return this._props.orderId;
  }

  get customerId(): CustomerId {
    return this._props.customerId;
  }

  get totalAmount(): Money {
    return this._props.totalAmount;
  }

  get items(): ReadonlyArray<OrderItem> {
    return this._props.items;
  }

  get occurredOn(): Date {
    return this._props.occurredOn;
  }

  public getAggregateId(): OrderId {
    return this._props.orderId;
  }

  public toString(): string {
    return `OrderConfirmedEvent(orderId: ${this._props.orderId.toString()}, total: ${this._props.totalAmount.format()}, occurredOn: ${this._props.occurredOn.toISOString()})`;
  }

  public toJSON(): Record<string, any> {
    return {
      orderId: this._props.orderId.toString(),
      customerId: this._props.customerId.toString(),
      totalAmount: this._props.totalAmount.toJSON(),
      items: this._props.items.map((item) => item.toJSON()),
      occurredOn: this._props.occurredOn.toISOString()
    };
  }
}
```

### Example 2: NetworkDeviceStatusChangedEvent

```typescript
import { IDomainEvent } from '@/shared/domain/events/IDomainEvent';
import { NetworkDeviceId } from '@/domain/aggregates/NetworkDevice';
import { NetworkDeviceStatus } from '@/domain/value-objects/NetworkDeviceStatus';

/**
 * Props for NetworkDeviceStatusChangedEvent.
 */
export interface NetworkDeviceStatusChangedEventProps {
  readonly deviceId: NetworkDeviceId;
  readonly previousStatus: NetworkDeviceStatus;
  readonly newStatus: NetworkDeviceStatus;
  readonly reason?: string;
  readonly occurredOn: Date;
}

/**
 * NetworkDeviceStatusChangedEvent - Device status has changed.
 *
 * Published By: NetworkDevice aggregate
 * Published When: NetworkDevice.updateStatus() is called
 *
 * Handlers:
 * - AlertHandler: Sends alert if device went offline
 * - MetricsHandler: Records status change metric
 * - PollingSchedulerHandler: Adjusts polling based on new status
 *
 * Use Cases:
 * - UpdateDeviceStatusUseCase
 * - ProcessPollingResultUseCase
 *
 * Business Rules:
 * - Status changes must follow valid transition rules
 * - UNKNOWN can transition to any status
 * - ONLINE cannot transition directly to UNKNOWN
 */
export class NetworkDeviceStatusChangedEvent implements IDomainEvent {
  private readonly _props: NetworkDeviceStatusChangedEventProps;

  constructor(props: NetworkDeviceStatusChangedEventProps) {
    this._props = Object.freeze({ ...props });
  }

  get deviceId(): NetworkDeviceId {
    return this._props.deviceId;
  }

  get previousStatus(): NetworkDeviceStatus {
    return this._props.previousStatus;
  }

  get newStatus(): NetworkDeviceStatus {
    return this._props.newStatus;
  }

  get reason(): string | undefined {
    return this._props.reason;
  }

  get occurredOn(): Date {
    return this._props.occurredOn;
  }

  public getAggregateId(): NetworkDeviceId {
    return this._props.deviceId;
  }

  /**
   * Checks if status changed from online to offline.
   */
  public get wentOffline(): boolean {
    return (
      this._props.previousStatus.isOnline() &&
      this._props.newStatus.isOffline()
    );
  }

  /**
   * Checks if status changed from offline to online.
   */
  public get cameOnline(): boolean {
    return (
      this._props.previousStatus.isOffline() &&
      this._props.newStatus.isOnline()
    );
  }

  public toString(): string {
    return `NetworkDeviceStatusChangedEvent(deviceId: ${this._props.deviceId.toString()}, ${this._props.previousStatus.value} -> ${this._props.newStatus.value}, occurredOn: ${this._props.occurredOn.toISOString()})`;
  }

  public toJSON(): Record<string, any> {
    return {
      deviceId: this._props.deviceId.toString(),
      previousStatus: this._props.previousStatus.value,
      newStatus: this._props.newStatus.value,
      reason: this._props.reason,
      occurredOn: this._props.occurredOn.toISOString()
    };
  }
}
```

### Example 3: Event Handler with Multiple Side Effects

```typescript
import { IHandle } from '@/shared/domain/events/IHandle';
import { NetworkDeviceStatusChangedEvent } from '@/domain/events/NetworkDeviceStatusChangedEvent';
import { IAlertRepository } from '@/domain/repository/IAlertRepository';
import { INetworkDeviceRepository } from '@/domain/repository/INetworkDeviceRepository';
import { IEmailService } from '@/application/services/IEmailService';
import { Alert } from '@/domain/aggregates/Alert';
import { AlertSeverity } from '@/domain/value-objects/AlertSeverity';

/**
 * Handler for NetworkDeviceStatusChangedEvent.
 *
 * Responsibilities:
 * - Creates alert when device goes offline
 * - Sends notification email to administrators
 * - Records status change in audit log
 *
 * Dependencies:
 * - IAlertRepository: For persisting alerts
 * - INetworkDeviceRepository: For loading device details
 * - IEmailService: For sending notifications
 */
export class DeviceStatusChangeAlertHandler
  implements IHandle<NetworkDeviceStatusChangedEvent>
{
  constructor(
    private readonly alertRepo: IAlertRepository,
    private readonly deviceRepo: INetworkDeviceRepository,
    private readonly emailService: IEmailService
  ) {}

  public async handle(
    event: NetworkDeviceStatusChangedEvent
  ): Promise<void> {
    try {
      // Only alert on offline status
      if (!event.wentOffline) {
        return;
      }

      // Load device details
      const deviceResult = await this.deviceRepo.findById(
        event.deviceId
      );

      if (deviceResult.isFailure) {
        console.error(
          `Device not found: ${event.deviceId.toString()}`
        );
        return;
      }

      const device = deviceResult.value;

      // Create alert
      const alertResult = Alert.create({
        deviceId: event.deviceId,
        severity: this.determineSeverity(device),
        message: `Device ${device.name} went offline`,
        occurredAt: event.occurredOn
      });

      if (alertResult.isSuccess) {
        await this.alertRepo.save(alertResult.value);
      }

      // Send email notification
      await this.emailService.send({
        to: 'admin@example.com',
        subject: `ALERT: ${device.name} is offline`,
        body: `Device ${device.name} (${device.ipAddress.value}) went offline at ${event.occurredOn.toISOString()}.`,
        priority: 'high'
      });

      console.log(
        `Alert created for device ${device.name} going offline`
      );
    } catch (error) {
      // Log but don't throw - event handlers should be resilient
      console.error(
        'Error handling DeviceStatusChangedEvent:',
        error
      );
    }
  }

  /**
   * Determines alert severity based on device criticality.
   */
  private determineSeverity(device: NetworkDevice): AlertSeverity {
    // Use device priority to determine alert severity
    if (device.priority.isCritical()) {
      return AlertSeverity.createCritical().value;
    } else if (device.priority.isHigh()) {
      return AlertSeverity.createHigh().value;
    } else {
      return AlertSeverity.createMedium().value;
    }
  }
}
```

---

## Summary Checklist

When creating a Domain Event, ensure:

- ✅ Named with past tense verb + Event suffix
- ✅ Implements IDomainEvent interface
- ✅ Uses props-based pattern with interface
- ✅ All props are readonly
- ✅ Props object is frozen with Object.freeze()
- ✅ Contains aggregate ID
- ✅ Contains occurredOn timestamp
- ✅ Includes all relevant data for handlers
- ✅ Uses value objects instead of primitives
- ✅ No business logic (data only)
- ✅ Represents domain occurrence (not technical operation)
- ✅ Published by aggregate root
- ✅ Provides toJSON() for serialization
- ✅ Handlers are registered at startup
- ✅ Handlers are resilient (catch errors)
- ✅ Events dispatched AFTER successful persistence
- ✅ Comprehensive tests for event creation and handling
- ✅ Tests verify immutability with Object.isFrozen()

---

**Remember**: Domain Events enable loose coupling between aggregates and provide a clean way to trigger side effects. Use the props-based pattern for guaranteed immutability, keep events self-contained with value objects, and ensure handlers are resilient!
