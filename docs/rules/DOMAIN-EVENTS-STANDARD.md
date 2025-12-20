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

- **Immutable**: Once created, cannot be changed (enforced via DomainEvent<TProps> base class)
- **Past Tense**: Named after what happened (OrderCreated, not CreateOrder)
- **Domain Concepts**: Represent domain occurrences, not technical events
- **Decoupling**: Allow aggregates to communicate without direct references
- **Eventual Consistency**: Enable cross-aggregate coordination
- **Audit Trail**: Can be stored for event sourcing or auditing
- **Props-Based**: Extend DomainEvent<TProps> for guaranteed immutability

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
| **Structure**  | Extends DomainEvent<T>   | DTO, versioned          |

---

## 2. Responsibilities of a Domain Event

### MUST DO:

1. **Extend DomainEvent<TProps> Base Class**

   - All events extend `DomainEvent<TProps>`
   - Base class handles immutability automatically
   - Props are frozen and type-safe
   - Common methods (toString, toJSON) provided

2. **Represent Domain Occurrence**

   - Capture significant domain state change
   - Named after domain concept in past tense
   - Contains relevant domain data

3. **Be Immutable**

   - Base class ensures immutability (Object.freeze)
   - All properties readonly in props interface
   - No setters or mutations in event class
   - Set at construction time only

4. **Contain Relevant Data**

   - Include data needed by handlers
   - Aggregate ID always included
   - Timestamp of occurrence (dateTimeOccurred)
   - Relevant value objects or IDs (not full aggregates)

5. **Be Self-Descriptive**

   - Event name clearly states what happened
   - Props interface describes the data
   - Just enough information for handlers

6. **Be Serializable**
   - Override serializeProps() for custom JSON output
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

   - Base class prevents mutations
   - No setters allowed
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
│  │  - Extend DomainEvent<TProps>                      │     │
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
│  │  EventDispatcher (Dispatcher)                       │    │
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
6. EventDispatcher dispatcher calls all handlers
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

class Order extends AggregateRoot<OrderProps, OrderId> {
  private constructor(props: OrderProps, id: OrderId) {
    super(props, id);
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
        dateTimeOccurred: new Date()
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
        dateTimeOccurred: new Date()
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
    EventDispatcher.dispatchEventsForAggregate(order.id);

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

1. **Creation**: Event created in aggregate method (extends DomainEvent<TProps>)
2. **Queuing**: Event added to aggregate's event queue
3. **Persistence**: Aggregate saved to database
4. **Dispatch**: Events dispatched after successful save
5. **Handling**: Handlers receive and process event
6. **Clearing**: Events cleared from aggregate

---

## 6. Domain Event Structure Template

### DomainEvent<TProps> Base Class:

```typescript
import { IDomainEvent } from '../shared/interfaces/IDomainEvent';
import { UniqueEntityID } from './UniqueEntityID';

/**
 * Base class for Domain Events.
 *
 * All domain events should extend this class and provide:
 * - Props interface defining event data
 * - Implementation of getAggregateId()
 * - Implementation of dateTimeOccurred getter
 */
export abstract class DomainEvent<TProps> implements IDomainEvent {
  protected readonly props: Readonly<TProps>;

  constructor(props: TProps) {
    this.props = Object.freeze({ ...props }) as Readonly<TProps>;
  }

  abstract getAggregateId(): UniqueEntityID;
  abstract get dateTimeOccurred(): Date;

  public toString(): string {
    return `${this.constructor.name}(aggregateId: ${this.getAggregateId().toString()}, occurred: ${this.dateTimeOccurred.toISOString()})`;
  }

  public toJSON(): Record<string, any> {
    return {
      eventType: this.constructor.name,
      aggregateId: this.getAggregateId().toString(),
      dateTimeOccurred: this.dateTimeOccurred.toISOString(),
      ...this.serializeProps()
    };
  }

  protected serializeProps(): Record<string, any> {
    return {};
  }
}
```

### Event Props Interface Template:

```typescript
import { UniqueEntityID } from '@/shared/domain/UniqueEntityID';

/**
 * Props interface for EventName.
 * Defines all properties the event contains.
 */
export interface EventNameEventProps {
  readonly aggregateId: UniqueEntityID;
  readonly property1: ValueObject1;
  readonly property2: ValueObject2;
  readonly dateTimeOccurred: Date;
}
```

### Domain Event Class Template:

````typescript
import { DomainEvent } from '@/domain/core/DomainEvent';
import { UniqueEntityID } from '@/shared/domain/UniqueEntityID';

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
 *   dateTimeOccurred: new Date()
 * });
 * ```
 */
export class EventNameEvent extends DomainEvent<EventNameEventProps> {
  /**
   * Constructor for EventNameEvent.
   * Props are automatically frozen by the base class.
   *
   * @param props - Event properties
   */
  constructor(props: EventNameEventProps) {
    super(props);
  }

  /**
   * Gets the aggregate ID that published this event.
   */
  public getAggregateId(): UniqueEntityID {
    return this.props.aggregateId;
  }

  /**
   * When the event occurred.
   */
  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  /**
   * Getter for property1.
   */
  get property1(): ValueObject1 {
    return this.props.property1;
  }

  /**
   * Getter for property2.
   */
  get property2(): ValueObject2 {
    return this.props.property2;
  }

  /**
   * Custom serialization for this event.
   * Override to include event-specific properties in JSON.
   */
  protected serializeProps(): Record<string, any> {
    return {
      aggregateId: this.props.aggregateId.toString(),
      property1: this.props.property1.toString(),
      property2: this.props.property2.toString()
    };
  }
}
````

### Simple Event Template (Minimal Boilerplate):

For simple events with few properties, you can use a minimal pattern:

```typescript
export interface DeviceCreatedEventProps {
  readonly deviceId: NetworkDeviceId;
  readonly deviceName: string;
  readonly ipAddress: string;
  readonly dateTimeOccurred: Date;
}

export class DeviceCreatedEvent extends DomainEvent<DeviceCreatedEventProps> {
  constructor(props: DeviceCreatedEventProps) {
    super(props);
  }

  getAggregateId(): NetworkDeviceId {
    return this.props.deviceId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  // Expose properties via getters
  get deviceId(): NetworkDeviceId {
    return this.props.deviceId;
  }

  get deviceName(): string {
    return this.props.deviceName;
  }

  get ipAddress(): string {
    return this.props.ipAddress;
  }
}
```

---

## 7. Orthogonality Principles

### 1. Immutability via DomainEvent<TProps>

Events extend DomainEvent<TProps> for guaranteed immutability:

```typescript
// ✅ GOOD - Extends DomainEvent<TProps>
export interface OrderCreatedEventProps {
  readonly orderId: OrderId;
  readonly customerId: CustomerId;
  readonly totalAmount: Money;
  readonly dateTimeOccurred: Date;
}

export class OrderCreatedEvent extends DomainEvent<OrderCreatedEventProps> {
  constructor(props: OrderCreatedEventProps) {
    super(props); // Base class freezes props
  }

  getAggregateId(): OrderId {
    return this.props.orderId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get orderId(): OrderId {
    return this.props.orderId;
  }

  get customerId(): CustomerId {
    return this.props.customerId;
  }

  get totalAmount(): Money {
    return this.props.totalAmount;
  }
}

// ❌ BAD - Implements interface directly (no immutability guarantee)
export class OrderCreatedEvent implements IDomainEvent {
  public orderId: OrderId; // Not readonly!
  public dateTimeOccurred: Date;

  constructor(orderId: OrderId) {
    this.orderId = orderId;
    this.dateTimeOccurred = new Date();
    // Forgot to freeze!
  }

  setOrderId(id: OrderId): void {
    // Setter! Event is mutable!
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
  readonly dateTimeOccurred: Date;
}

export class OrderShippedEvent extends DomainEvent<OrderShippedEventProps> {
  constructor(props: OrderShippedEventProps) {
    super(props);
  }

  getAggregateId(): OrderId {
    return this.props.orderId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get trackingNumber(): string {
    return this.props.trackingNumber;
  }

  get carrier(): string {
    return this.props.carrier;
  }

  get estimatedDelivery(): Date {
    return this.props.estimatedDelivery;
  }

  get shippingAddress(): Address {
    return this.props.shippingAddress;
  }
}

// ❌ BAD - Incomplete (handlers must query for details)
export interface OrderShippedEventProps {
  readonly orderId: OrderId;
  readonly dateTimeOccurred: Date;
}

export class OrderShippedEvent extends DomainEvent<OrderShippedEventProps> {
  constructor(props: OrderShippedEventProps) {
    super(props);
  }
  // Missing tracking number, carrier, etc.
}
```

### 3. Domain-Focused

Events represent domain concepts, not technical operations:

```typescript
// ✅ GOOD - Domain concepts
export class PaymentReceivedEvent extends DomainEvent<PaymentReceivedEventProps> {}
export class InventoryReservedEvent extends DomainEvent<InventoryReservedEventProps> {}
export class CustomerUpgradedToGoldTierEvent extends DomainEvent<CustomerUpgradedEventProps> {}
export class NetworkDeviceWentOfflineEvent extends DomainEvent<DeviceOfflineEventProps> {}
export class PollingResultRecordedEvent extends DomainEvent<PollingResultEventProps> {}

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
export class OrderCreatedEvent extends DomainEvent<OrderCreatedEventProps> {}
export class PaymentProcessedEvent extends DomainEvent<PaymentProcessedEventProps> {}
export class ItemAddedToCartEvent extends DomainEvent<ItemAddedEventProps> {}
export class DeviceStatusChangedEvent extends DomainEvent<DeviceStatusChangedEventProps> {}
export class AlertTriggeredEvent extends DomainEvent<AlertTriggeredEventProps> {}

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
  readonly dateTimeOccurred: Date;
}

export class PaymentReceivedEvent extends DomainEvent<PaymentReceivedEventProps> {
  constructor(props: PaymentReceivedEventProps) {
    super(props);
  }

  getAggregateId(): OrderId {
    return this.props.orderId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get amount(): Money {
    return this.props.amount;
  }

  get paymentMethod(): PaymentMethod {
    return this.props.paymentMethod;
  }

  protected serializeProps(): Record<string, any> {
    return {
      orderId: this.props.orderId.toString(),
      amount: this.props.amount.toJSON(),
      paymentMethod: this.props.paymentMethod.value,
      transactionId: this.props.transactionId.toString()
    };
  }
}

// ❌ BAD - Primitives
export interface PaymentReceivedEventProps {
  readonly orderId: string; // Should be OrderId
  readonly amount: number; // Should be Money
  readonly currency: string; // Should be part of Money
  readonly paymentMethod: string; // Should be PaymentMethod
  readonly dateTimeOccurred: Date;
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
export class OrderConfirmedEvent extends DomainEvent<OrderConfirmedEventProps> {}
export class PaymentRefundedEvent extends DomainEvent<PaymentRefundedEventProps> {}
export class InventoryRestockedEvent extends DomainEvent<InventoryRestockedEventProps> {}
export class CustomerRegisteredEvent extends DomainEvent<CustomerRegisteredEventProps> {}
export class PollingResultRecordedEvent extends DomainEvent<PollingResultEventProps> {}
export class DeviceStatusChangedEvent extends DomainEvent<DeviceStatusChangedEventProps> {}
export class AlertAcknowledgedEvent extends DomainEvent<AlertAcknowledgedEventProps> {}

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
  readonly dateTimeOccurred: Date; // ✅ Timestamp
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

export class Order extends AggregateRoot<OrderProps, OrderId> {
  private constructor(props: OrderProps, id: OrderId) {
    super(props, id);
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
        dateTimeOccurred: new Date()
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
      event.dateTimeOccurred
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
  readonly dateTimeOccurred: Date;
}

export class OrderConfirmedEvent extends DomainEvent<OrderConfirmedEventProps> {
  constructor(props: OrderConfirmedEventProps) {
    super(props);
  }

  getAggregateId(): OrderId {
    return this.props.orderId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get orderId(): OrderId {
    return this.props.orderId;
  }

  get items(): OrderItem[] {
    return this.props.items;
  }
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
  readonly dateTimeOccurred: Date;
}

export class InventoryReservedEvent extends DomainEvent<InventoryReservedEventProps> {
  constructor(props: InventoryReservedEventProps) {
    super(props);
  }

  getAggregateId(): InventoryId {
    return this.props.inventoryId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }
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
    const dateTimeOccurred = new Date();

    const event = new OrderConfirmedEvent({
      orderId,
      customerId,
      totalAmount,
      items,
      dateTimeOccurred
    });

    expect(event.orderId).toBe(orderId);
    expect(event.customerId).toBe(customerId);
    expect(event.totalAmount).toBe(totalAmount);
    expect(event.items).toEqual(items);
    expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
  });

  it('should be immutable (props frozen)', () => {
    const event = new OrderConfirmedEvent({
      orderId: OrderId.create().value,
      customerId: CustomerId.create().value,
      totalAmount: Money.create({ amount: 100, currency: 'USD' })
        .value,
      items: [],
      dateTimeOccurred: new Date()
    });

    // Props should be frozen by base class
    expect(Object.isFrozen((event as any).props)).toBe(true);
  });

  it('should not allow property mutation', () => {
    const event = new OrderConfirmedEvent({
      orderId: OrderId.create().value,
      customerId: CustomerId.create().value,
      totalAmount: Money.create({ amount: 100, currency: 'USD' })
        .value,
      items: [],
      dateTimeOccurred: new Date()
    });

    // Attempting to modify should fail
    expect(() => {
      // @ts-expect-error - Testing immutability
      (event as any).props.orderId = OrderId.create().value;
    }).toThrow();
  });

  it('should serialize to JSON', () => {
    const orderId = OrderId.create().value;
    const event = new OrderConfirmedEvent({
      orderId,
      customerId: CustomerId.create().value,
      totalAmount: Money.create({ amount: 100, currency: 'USD' })
        .value,
      items: [],
      dateTimeOccurred: new Date()
    });

    const json = event.toJSON();

    expect(json.eventType).toBe('OrderConfirmedEvent');
    expect(json.aggregateId).toBe(orderId.toString());
    expect(json).toHaveProperty('dateTimeOccurred');
  });

  it('should have toString method', () => {
    const event = new OrderConfirmedEvent({
      orderId: OrderId.create().value,
      customerId: CustomerId.create().value,
      totalAmount: Money.create({ amount: 100, currency: 'USD' })
        .value,
      items: [],
      dateTimeOccurred: new Date()
    });

    const str = event.toString();

    expect(str).toContain('OrderConfirmedEvent');
    expect(str).toContain('aggregateId');
    expect(str).toContain('occurred');
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
  let mockInventoryRepo: MockInventoryRepository;
  let mockEmailService: MockEmailService;

  beforeEach(() => {
    mockInventoryRepo = new MockInventoryRepository();
    mockEmailService = new MockEmailService();
    handler = new OrderConfirmedHandler(
      mockInventoryRepo,
      mockEmailService
    );
  });

  it('should reserve inventory when order confirmed', async () => {
    const event = new OrderConfirmedEvent({
      orderId: OrderId.create().value,
      customerId: CustomerId.create().value,
      totalAmount: Money.create({ amount: 100, currency: 'USD' })
        .value,
      items: [createMockOrderItem()],
      dateTimeOccurred: new Date()
    });

    await handler.handle(event);

    expect(mockInventoryRepo.saveCalled).toBe(true);
    expect(mockInventoryRepo.lastSaved?.isReserved).toBe(true);
  });

  it('should send confirmation email', async () => {
    const event = new OrderConfirmedEvent({
      orderId: OrderId.create().value,
      customerId: CustomerId.create().value,
      totalAmount: Money.create({ amount: 100, currency: 'USD' })
        .value,
      items: [],
      dateTimeOccurred: new Date()
    });

    await handler.handle(event);

    expect(mockEmailService.sendCalled).toBe(true);
    expect(mockEmailService.lastEmail?.subject).toContain(
      'confirmed'
    );
  });

  it('should handle errors gracefully', async () => {
    const event = new OrderConfirmedEvent({
      orderId: OrderId.create().value,
      customerId: CustomerId.create().value,
      totalAmount: Money.create({ amount: 100, currency: 'USD' })
        .value,
      items: [],
      dateTimeOccurred: new Date()
    });

    mockInventoryRepo.setThrowError(true);

    // Should not throw
    await expect(handler.handle(event)).resolves.not.toThrow();
  });
});
```

---

## 11. Examples

### Example 1: OrderConfirmedEvent

```typescript
import { DomainEvent } from '@/domain/core/DomainEvent';
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
  readonly dateTimeOccurred: Date;
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
export class OrderConfirmedEvent extends DomainEvent<OrderConfirmedEventProps> {
  constructor(props: OrderConfirmedEventProps) {
    super(props);
  }

  public getAggregateId(): OrderId {
    return this.props.orderId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get orderId(): OrderId {
    return this.props.orderId;
  }

  get customerId(): CustomerId {
    return this.props.customerId;
  }

  get totalAmount(): Money {
    return this.props.totalAmount;
  }

  get items(): ReadonlyArray<OrderItem> {
    return this.props.items;
  }

  protected serializeProps(): Record<string, any> {
    return {
      orderId: this.props.orderId.toString(),
      customerId: this.props.customerId.toString(),
      totalAmount: this.props.totalAmount.toJSON(),
      items: this.props.items.map((item) => item.toJSON())
    };
  }
}
```

### Example 2: NetworkDeviceStatusChangedEvent

```typescript
import { DomainEvent } from '@/domain/core/DomainEvent';
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
  readonly dateTimeOccurred: Date;
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
export class NetworkDeviceStatusChangedEvent extends DomainEvent<NetworkDeviceStatusChangedEventProps> {
  constructor(props: NetworkDeviceStatusChangedEventProps) {
    super(props);
  }

  public getAggregateId(): NetworkDeviceId {
    return this.props.deviceId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get deviceId(): NetworkDeviceId {
    return this.props.deviceId;
  }

  get previousStatus(): NetworkDeviceStatus {
    return this.props.previousStatus;
  }

  get newStatus(): NetworkDeviceStatus {
    return this.props.newStatus;
  }

  get reason(): string | undefined {
    return this.props.reason;
  }

  /**
   * Checks if status changed from online to offline.
   */
  public get wentOffline(): boolean {
    return (
      this.props.previousStatus.isOnline() &&
      this.props.newStatus.isOffline()
    );
  }

  /**
   * Checks if status changed from offline to online.
   */
  public get cameOnline(): boolean {
    return (
      this.props.previousStatus.isOffline() &&
      this.props.newStatus.isOnline()
    );
  }

  protected serializeProps(): Record<string, any> {
    return {
      deviceId: this.props.deviceId.toString(),
      previousStatus: this.props.previousStatus.value,
      newStatus: this.props.newStatus.value,
      reason: this.props.reason
    };
  }
}
```

### Example 3: Simple Event with Minimal Boilerplate

```typescript
import { DomainEvent } from '@/domain/core/DomainEvent';
import { NetworkDeviceId } from '@/domain/aggregates/NetworkDevice';

/**
 * Props for DeviceCreatedEvent.
 */
export interface DeviceCreatedEventProps {
  readonly deviceId: NetworkDeviceId;
  readonly deviceName: string;
  readonly ipAddress: string;
  readonly dateTimeOccurred: Date;
}

/**
 * DeviceCreatedEvent - New network device created.
 *
 * Published By: NetworkDevice aggregate
 * Published When: NetworkDevice.create() is called
 */
export class DeviceCreatedEvent extends DomainEvent<DeviceCreatedEventProps> {
  constructor(props: DeviceCreatedEventProps) {
    super(props);
  }

  getAggregateId(): NetworkDeviceId {
    return this.props.deviceId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get deviceId(): NetworkDeviceId {
    return this.props.deviceId;
  }

  get deviceName(): string {
    return this.props.deviceName;
  }

  get ipAddress(): string {
    return this.props.ipAddress;
  }

  protected serializeProps(): Record<string, any> {
    return {
      deviceId: this.props.deviceId.toString(),
      deviceName: this.props.deviceName,
      ipAddress: this.props.ipAddress
    };
  }
}
```

---

## Summary Checklist

When creating a Domain Event, ensure:

- ✅ Extends `DomainEvent<TProps>` base class
- ✅ Named with past tense verb + Event suffix
- ✅ Props interface defines all event properties
- ✅ All props are readonly
- ✅ Implements `getAggregateId()` method
- ✅ Implements `dateTimeOccurred` getter
- ✅ Contains aggregate ID in props
- ✅ Contains dateTimeOccurred timestamp
- ✅ Includes all relevant data for handlers
- ✅ Uses value objects instead of primitives
- ✅ No business logic (data only)
- ✅ Represents domain occurrence (not technical operation)
- ✅ Published by aggregate root
- ✅ Overrides `serializeProps()` for custom JSON output
- ✅ Handlers are registered at startup
- ✅ Handlers are resilient (catch errors)
- ✅ Events dispatched AFTER successful persistence
- ✅ Comprehensive tests for event creation and handling
- ✅ Tests verify immutability with Object.isFrozen()
- ✅ Base class ensures props are frozen (no manual freeze needed)

---

**Remember**: Domain Events enable loose coupling between aggregates and provide a clean way to trigger side effects. Use the `DomainEvent<TProps>` base class for guaranteed immutability and consistent structure!
