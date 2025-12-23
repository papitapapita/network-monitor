# INFRASTRUCTURE EVENT MAPPER STANDARD

## Table of Contents

1. [Purpose](#1-purpose)
2. [Clean Architecture Rationale](#2-clean-architecture-rationale)
3. [Responsibilities](#3-responsibilities)
4. [Design Patterns](#4-design-patterns)
5. [Value Object Handling](#5-value-object-handling)
6. [Event Mapper Structure](#6-event-mapper-structure)
7. [Usage Examples](#7-usage-examples)
8. [Testing Strategy](#8-testing-strategy)
9. [Best Practices](#9-best-practices)

---

## 1. Purpose

The **DomainEventMapper** (or **EventSerializer**) is an **Infrastructure layer** component responsible for converting Domain Events into plain objects or JSON representations suitable for:

- **Persistence**: Storing events in an event store (database, message queue)
- **Transmission**: Publishing events to a message bus (RabbitMQ, Kafka, etc.)
- **Logging**: Recording event details in application logs
- **API Responses**: Including event information in HTTP responses

### Core Principle:

**Domain Events remain pure data holders with ZERO knowledge of serialization.**

The Domain layer must not know:
- How events are stored in the database
- How events are formatted for message buses
- What JSON structure external systems expect
- Any persistence or infrastructure concerns

This separation ensures **Clean Architecture** and **DDD principles** are maintained.

---

## 2. Clean Architecture Rationale

### The Problem:

When Domain Events contain `toJSON()` or `serializeProps()` methods:

```typescript
// ❌ BAD - Domain coupled to Infrastructure
export class OrderCreatedEvent extends DomainEvent<OrderCreatedEventProps> {
  // Domain Event now knows about JSON format!
  protected serializeProps(): Record<string, any> {
    return {
      orderId: this.props.orderId.toString(),
      customerId: this.props.customerId.toString()
    };
  }
}
```

**Problems:**
- Domain layer depends on Infrastructure concerns (JSON format)
- Changing database schema requires modifying Domain events
- Cannot have different serialization formats for different consumers
- Violates Single Responsibility Principle
- Makes testing harder (Domain tests now need to verify JSON structure)

### The Solution:

Move serialization to Infrastructure layer:

```typescript
// ✅ GOOD - Domain remains pure
export class OrderCreatedEvent extends DomainEvent<OrderCreatedEventProps> {
  // No serialization logic - just data
  get orderId(): OrderId {
    return this.props.orderId;
  }
}

// ✅ GOOD - Infrastructure handles serialization
export class DomainEventMapper {
  static toJSON(event: DomainEvent<any>): Record<string, any> {
    // Infrastructure knows about JSON format
  }
}
```

**Benefits:**
- Domain layer remains clean and focused on business logic
- Infrastructure can change format without affecting Domain
- Different mappers for different consumers (DB, message bus, API)
- Easy to test separately
- Follows Dependency Inversion Principle

---

## 3. Responsibilities

### MUST DO:

1. **Accept Domain Events**
   - Mapper takes any `DomainEvent<T>` instance as input
   - Works with all event types polymorphically
   - No coupling to specific event classes

2. **Extract Properties**
   - Uses reflection, property inspection, or mapping strategy
   - Accesses event properties via getters
   - Handles Value Objects correctly

3. **Convert Value Objects**
   - Calls `.toString()` on ID value objects (UniqueEntityID, OrderId, etc.)
   - Calls `.getValue()` or `.value` on primitive value objects
   - Calls `.toJSON()` or `.toPlainObject()` on complex value objects (Money, Address)
   - Handles both simple and complex value objects

4. **Return Plain Object**
   - Returns `Record<string, any>` or JSON-compatible object
   - All properties are primitive values or plain objects
   - Ready for `JSON.stringify()` or database insertion
   - Includes metadata (eventType, timestamp, aggregateId)

5. **Handle Edge Cases**
   - Null/undefined values
   - Nested value objects
   - Arrays of entities or value objects
   - Optional properties
   - Date objects (convert to ISO strings)

### MUST NOT DO:

1. **❌ Modify Domain Events**
   - Mapper is read-only
   - Does not mutate event instances
   - Does not add properties to events

2. **❌ Contain Business Logic**
   - No validation or business rules
   - Pure transformation only
   - No side effects

3. **❌ Be Imported by Domain Layer**
   - Domain layer never imports Infrastructure mappers
   - Dependency flows: Domain ← Application ← Infrastructure
   - Infrastructure knows about Domain, not vice versa

---

## 4. Design Patterns

### Pattern 1: Strategy Pattern (Recommended)

Use a mapping strategy for each event type or event category:

```typescript
/**
 * Strategy interface for mapping Domain Events to JSON.
 */
export interface IDomainEventMappingStrategy {
  /**
   * Determines if this strategy can handle the given event.
   */
  canHandle(event: DomainEvent<any>): boolean;

  /**
   * Maps the event to a plain object.
   */
  toJSON(event: DomainEvent<any>): Record<string, any>;
}

/**
 * Main mapper that delegates to strategies.
 */
export class DomainEventMapper {
  private strategies: IDomainEventMappingStrategy[] = [];

  constructor(strategies: IDomainEventMappingStrategy[]) {
    this.strategies = strategies;
  }

  /**
   * Converts a Domain Event to JSON.
   * Uses registered strategies to handle event-specific serialization.
   */
  public toJSON(event: DomainEvent<any>): Record<string, any> {
    // Find appropriate strategy
    const strategy = this.strategies.find((s) => s.canHandle(event));

    if (!strategy) {
      // Fallback to generic mapping
      return this.genericMapping(event);
    }

    // Delegate to strategy
    return strategy.toJSON(event);
  }

  /**
   * Generic mapping for events without specific strategy.
   * Uses reflection to extract properties.
   */
  private genericMapping(event: DomainEvent<any>): Record<string, any> {
    const result: Record<string, any> = {
      eventType: event.constructor.name,
      aggregateId: event.aggregateId.toString(),
      dateTimeOccurred: event.dateTimeOccurred.toISOString()
    };

    // Use reflection to get all getter properties
    const proto = Object.getPrototypeOf(event);
    const descriptors = Object.getOwnPropertyDescriptors(proto);

    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor.get && key !== 'aggregateId' && key !== 'dateTimeOccurred') {
        const value = (event as any)[key];
        result[key] = this.mapValue(value);
      }
    }

    return result;
  }

  /**
   * Maps a value to a JSON-compatible format.
   * Handles Value Objects, primitives, and complex objects.
   */
  private mapValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Check for common DDD value object patterns
    if (typeof value.toString === 'function' && value.constructor.name.includes('Id')) {
      // Entity IDs (UniqueEntityID, OrderId, etc.)
      return value.toString();
    }

    if (typeof value.getValue === 'function') {
      // Simple value objects with getValue()
      return value.getValue();
    }

    if (typeof value.value !== 'undefined' && Object.keys(value).length === 1) {
      // Value objects with single 'value' property
      return value.value;
    }

    if (typeof value.toJSON === 'function') {
      // Complex value objects with toJSON() method
      return value.toJSON();
    }

    if (typeof value.toPlainObject === 'function') {
      // Value objects with toPlainObject() method
      return value.toPlainObject();
    }

    if (Array.isArray(value)) {
      // Arrays - map each element
      return value.map((item) => this.mapValue(item));
    }

    if (value instanceof Date) {
      // Dates - convert to ISO string
      return value.toISOString();
    }

    if (typeof value === 'object') {
      // Plain objects - map recursively
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = this.mapValue(v);
      }
      return result;
    }

    // Primitives (string, number, boolean)
    return value;
  }
}
```

### Pattern 2: Specific Mappers per Event

For events requiring custom serialization logic:

```typescript
/**
 * Specific mapper for OrderConfirmedEvent.
 * Handles complex order item serialization.
 */
export class OrderConfirmedEventMapper
  implements IDomainEventMappingStrategy
{
  canHandle(event: DomainEvent<any>): boolean {
    return event.constructor.name === 'OrderConfirmedEvent';
  }

  toJSON(event: DomainEvent<any>): Record<string, any> {
    const orderEvent = event as OrderConfirmedEvent;

    return {
      eventType: 'OrderConfirmedEvent',
      aggregateId: orderEvent.aggregateId.toString(),
      dateTimeOccurred: orderEvent.dateTimeOccurred.toISOString(),
      orderId: orderEvent.orderId.toString(),
      customerId: orderEvent.customerId.toString(),
      totalAmount: {
        amount: orderEvent.totalAmount.amount,
        currency: orderEvent.totalAmount.currency
      },
      items: orderEvent.items.map((item) => ({
        productId: item.productId.toString(),
        quantity: item.quantity,
        price: item.price.amount
      }))
    };
  }
}
```

### Pattern 3: Generic Reflection-Based Mapper

For simple events without complex nested structures:

```typescript
/**
 * Generic mapper using reflection.
 * Works for most simple events.
 */
export class GenericDomainEventMapper {
  /**
   * Converts any Domain Event to JSON using reflection.
   */
  public static toJSON(event: DomainEvent<any>): Record<string, any> {
    const result: Record<string, any> = {
      eventType: event.constructor.name,
      aggregateId: event.aggregateId.toString(),
      dateTimeOccurred: event.dateTimeOccurred.toISOString()
    };

    // Extract all getters from event class
    const proto = Object.getPrototypeOf(event);
    const descriptors = Object.getOwnPropertyDescriptors(proto);

    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (
        descriptor.get &&
        key !== 'aggregateId' &&
        key !== 'dateTimeOccurred'
      ) {
        const value = (event as any)[key];
        result[key] = this.serializeValue(value);
      }
    }

    return result;
  }

  /**
   * Serializes a single value based on its type.
   */
  private static serializeValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // UniqueEntityID and ID value objects
    if (this.isEntityId(value)) {
      return value.toString();
    }

    // Simple value objects with getValue()
    if (typeof value.getValue === 'function') {
      return value.getValue();
    }

    // Complex value objects with toJSON()
    if (typeof value.toJSON === 'function') {
      return value.toJSON();
    }

    // Dates
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Arrays
    if (Array.isArray(value)) {
      return value.map((item) => this.serializeValue(item));
    }

    // Plain primitives
    return value;
  }

  /**
   * Checks if value is an Entity ID (UniqueEntityID subclass).
   */
  private static isEntityId(value: any): boolean {
    return (
      typeof value.toString === 'function' &&
      (value.constructor.name.endsWith('Id') ||
        value.constructor.name === 'UniqueEntityID')
    );
  }
}
```

---

## 5. Value Object Handling

### Common DDD Value Object Patterns:

```typescript
// 1. Entity IDs (extends UniqueEntityID)
class OrderId extends UniqueEntityID {}
// Serialization: orderId.toString() → "123e4567-e89b-12d3-a456-426614174000"

// 2. Simple Value Objects with getValue()
class Email {
  private value: string;
  getValue(): string {
    return this.value;
  }
}
// Serialization: email.getValue() → "user@example.com"

// 3. Simple Value Objects with value property
class Quantity {
  constructor(public readonly value: number) {}
}
// Serialization: quantity.value → 5

// 4. Complex Value Objects with toJSON()
class Money {
  toJSON(): { amount: number; currency: string } {
    return {
      amount: this.amount,
      currency: this.currency
    };
  }
}
// Serialization: money.toJSON() → { amount: 100, currency: "USD" }

// 5. Nested Value Objects
class Address {
  toPlainObject(): Record<string, any> {
    return {
      street: this.street,
      city: this.city,
      zipCode: this.zipCode.value,
      country: this.country.value
    };
  }
}
// Serialization: address.toPlainObject() → { street: "...", city: "...", ... }
```

### Value Object Detection Strategy:

```typescript
export class ValueObjectSerializer {
  /**
   * Intelligently serializes any value object.
   */
  public static serialize(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // 1. Try toString() for IDs
    if (this.looksLikeEntityId(value)) {
      return value.toString();
    }

    // 2. Try getValue() for simple value objects
    if (typeof value.getValue === 'function') {
      return value.getValue();
    }

    // 3. Try toJSON() for complex value objects
    if (typeof value.toJSON === 'function') {
      return value.toJSON();
    }

    // 4. Try toPlainObject() for custom serialization
    if (typeof value.toPlainObject === 'function') {
      return value.toPlainObject();
    }

    // 5. Check for single 'value' property
    if (this.hasSingleValueProperty(value)) {
      return value.value;
    }

    // 6. Handle dates
    if (value instanceof Date) {
      return value.toISOString();
    }

    // 7. Handle arrays
    if (Array.isArray(value)) {
      return value.map((item) => this.serialize(item));
    }

    // 8. Handle plain objects recursively
    if (this.isPlainObject(value)) {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = this.serialize(v);
      }
      return result;
    }

    // 9. Return primitives as-is
    return value;
  }

  private static looksLikeEntityId(value: any): boolean {
    return (
      typeof value.toString === 'function' &&
      (value.constructor.name.endsWith('Id') ||
        value.constructor.name === 'UniqueEntityID')
    );
  }

  private static hasSingleValueProperty(value: any): boolean {
    return (
      typeof value === 'object' &&
      'value' in value &&
      Object.keys(value).length === 1
    );
  }

  private static isPlainObject(value: any): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      value.constructor === Object
    );
  }
}
```

---

## 6. Event Mapper Structure

### File Organization:

```
src/infrastructure/
├── mappers/
│   ├── DomainEventMapper.ts              # Main mapper
│   ├── IDomainEventMappingStrategy.ts    # Strategy interface
│   ├── strategies/
│   │   ├── OrderEventMappingStrategy.ts       # Order events
│   │   ├── DeviceEventMappingStrategy.ts      # Device events
│   │   └── GenericEventMappingStrategy.ts     # Fallback
│   └── ValueObjectSerializer.ts          # Value object handling
└── persistence/
    └── EventStore.ts                     # Uses mapper for persistence
```

### Main Mapper Interface:

```typescript
/**
 * Infrastructure service for serializing Domain Events.
 *
 * This mapper converts Domain Events to plain objects suitable for:
 * - Database persistence (event store)
 * - Message bus publishing (RabbitMQ, Kafka)
 * - HTTP API responses
 * - Application logging
 *
 * Key Principles:
 * - Domain Events remain pure (no serialization logic)
 * - Mapper handles all Value Object conversion
 * - Uses reflection or strategies for flexibility
 * - Supports multiple output formats if needed
 */
export interface IDomainEventMapper {
  /**
   * Converts a Domain Event to a plain object.
   *
   * @param event - The domain event to serialize
   * @returns Plain object ready for JSON.stringify() or database insertion
   */
  toJSON(event: DomainEvent<any>): Record<string, any>;

  /**
   * Converts a Domain Event to a database record.
   *
   * @param event - The domain event to serialize
   * @returns Database-compatible object (may differ from JSON format)
   */
  toDatabaseRecord?(event: DomainEvent<any>): Record<string, any>;

  /**
   * Converts a Domain Event to a message bus payload.
   *
   * @param event - The domain event to serialize
   * @returns Message bus compatible object
   */
  toMessageBusPayload?(event: DomainEvent<any>): Record<string, any>;
}
```

---

## 7. Usage Examples

### Example 1: Event Store Persistence

```typescript
/**
 * Event Store using DomainEventMapper.
 */
export class PrismaEventStore {
  constructor(
    private prisma: PrismaClient,
    private eventMapper: IDomainEventMapper
  ) {}

  /**
   * Saves a domain event to the database.
   */
  async save(event: DomainEvent<any>): Promise<void> {
    // Use mapper to convert event to plain object
    const payload = this.eventMapper.toJSON(event);

    await this.prisma.domainEvent.create({
      data: {
        eventType: payload.eventType,
        aggregateId: payload.aggregateId,
        occurredAt: new Date(payload.dateTimeOccurred),
        payload: JSON.stringify(payload) // Store full payload as JSON
      }
    });
  }
}
```

### Example 2: Message Bus Publishing

```typescript
/**
 * Message Bus Publisher using DomainEventMapper.
 */
export class RabbitMQEventPublisher {
  constructor(
    private channel: Channel,
    private eventMapper: IDomainEventMapper
  ) {}

  /**
   * Publishes domain event to message bus.
   */
  async publish(event: DomainEvent<any>): Promise<void> {
    // Use mapper to convert event
    const payload = this.eventMapper.toJSON(event);

    // Publish to exchange
    this.channel.publish(
      'domain-events',
      event.constructor.name,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true }
    );
  }
}
```

### Example 3: API Response

```typescript
/**
 * Use Case that returns event in response.
 */
export class CreateOrderUseCase {
  constructor(
    private orderRepo: IOrderRepository,
    private eventMapper: IDomainEventMapper
  ) {}

  async execute(dto: CreateOrderDTO): Promise<CreateOrderResponse> {
    const orderResult = Order.create({ ...dto });

    if (orderResult.isFailure) {
      return { success: false, error: orderResult.error };
    }

    const order = orderResult.value;
    await this.orderRepo.save(order);

    // Include serialized events in response
    const events = order.domainEvents.map((event) =>
      this.eventMapper.toJSON(event)
    );

    return {
      success: true,
      orderId: order.id.toString(),
      events // Serialized events for client
    };
  }
}
```

---

## 8. Testing Strategy

### Test 1: Generic Mapping

```typescript
describe('DomainEventMapper', () => {
  let mapper: DomainEventMapper;

  beforeEach(() => {
    mapper = new DomainEventMapper([]);
  });

  it('should serialize simple event with primitives', () => {
    const event = new DeviceCreatedEvent({
      aggregateId: NetworkDeviceId.create().value,
      deviceName: 'Router-01',
      ipAddress: '192.168.1.1',
      dateTimeOccurred: new Date('2024-01-15T10:00:00Z')
    });

    const json = mapper.toJSON(event);

    expect(json).toEqual({
      eventType: 'DeviceCreatedEvent',
      aggregateId: expect.any(String),
      dateTimeOccurred: '2024-01-15T10:00:00.000Z',
      deviceName: 'Router-01',
      ipAddress: '192.168.1.1'
    });
  });

  it('should serialize Value Objects correctly', () => {
    const orderId = OrderId.create().value;
    const money = Money.create({ amount: 100, currency: 'USD' }).value;

    const event = new OrderCreatedEvent({
      aggregateId: orderId,
      totalAmount: money,
      dateTimeOccurred: new Date()
    });

    const json = mapper.toJSON(event);

    expect(json.aggregateId).toBe(orderId.toString());
    expect(json.totalAmount).toEqual({
      amount: 100,
      currency: 'USD'
    });
  });

  it('should handle arrays of Value Objects', () => {
    const items = [
      createOrderItem('item-1', 5),
      createOrderItem('item-2', 3)
    ];

    const event = new OrderConfirmedEvent({
      aggregateId: OrderId.create().value,
      items,
      dateTimeOccurred: new Date()
    });

    const json = mapper.toJSON(event);

    expect(json.items).toHaveLength(2);
    expect(json.items[0]).toHaveProperty('productId');
    expect(json.items[0]).toHaveProperty('quantity');
  });
});
```

### Test 2: Custom Strategy

```typescript
describe('OrderEventMappingStrategy', () => {
  let strategy: OrderEventMappingStrategy;

  beforeEach(() => {
    strategy = new OrderEventMappingStrategy();
  });

  it('should handle OrderConfirmedEvent', () => {
    const event = new OrderConfirmedEvent({
      aggregateId: OrderId.create().value,
      customerId: CustomerId.create().value,
      totalAmount: Money.create({ amount: 100, currency: 'USD' })
        .value,
      items: [],
      dateTimeOccurred: new Date()
    });

    expect(strategy.canHandle(event)).toBe(true);

    const json = strategy.toJSON(event);

    expect(json.eventType).toBe('OrderConfirmedEvent');
    expect(json).toHaveProperty('orderId');
    expect(json).toHaveProperty('customerId');
    expect(json).toHaveProperty('totalAmount');
  });
});
```

---

## 9. Best Practices

### DO:

✅ **Use Reflection for Generic Mapping**

- Automatically extract properties using `Object.getOwnPropertyDescriptors()`
- Reduces boilerplate for simple events
- Makes mapper resilient to event changes

✅ **Create Specific Strategies for Complex Events**

- Events with nested structures need custom logic
- Events with special formatting requirements
- Events requiring performance optimization

✅ **Handle All Common Value Object Patterns**

- Entity IDs (`.toString()`)
- Simple value objects (`.getValue()`, `.value`)
- Complex value objects (`.toJSON()`, `.toPlainObject()`)
- Dates (`.toISOString()`)
- Arrays (map recursively)

✅ **Include Metadata**

- Always include `eventType` (class name)
- Always include `aggregateId`
- Always include `dateTimeOccurred`
- Optionally include version, correlation ID, etc.

✅ **Test Thoroughly**

- Test generic mapping with various event types
- Test custom strategies independently
- Test Value Object serialization edge cases
- Test null/undefined handling
- Test nested structures

### DON'T:

❌ **Don't Import Mapper in Domain Layer**

- Domain layer must never know about Infrastructure
- Violates Clean Architecture dependency rules

❌ **Don't Add Business Logic**

- Mapper is pure transformation
- No validation, no calculations, no side effects

❌ **Don't Mutate Events**

- Mapper reads events only
- Never modify event properties
- Events remain immutable

❌ **Don't Hardcode JSON Structure**

- Use strategies for flexibility
- Different consumers may need different formats

❌ **Don't Forget Error Handling**

- Handle missing properties gracefully
- Log warnings for unserializable values
- Provide meaningful error messages

---

## Summary

The **DomainEventMapper** is a critical Infrastructure component that maintains **Clean Architecture** by:

1. **Keeping Domain Pure**: Domain Events contain no serialization logic
2. **Single Responsibility**: Mapper handles ONLY serialization concerns
3. **Flexibility**: Supports multiple strategies and output formats
4. **Value Object Handling**: Intelligently converts all DDD value object patterns
5. **Testability**: Can be tested independently from Domain layer

**Remember**: The Domain layer should never import or depend on Infrastructure mappers. Dependency flows one way: **Domain ← Application ← Infrastructure**.

By following this standard, you ensure your Domain layer remains focused on business logic while Infrastructure handles technical concerns like serialization, persistence, and messaging.
