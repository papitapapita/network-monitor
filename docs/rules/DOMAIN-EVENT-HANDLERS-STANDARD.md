# DOMAIN EVENT HANDLERS STANDARD

## Table of Contents

1. [Purpose of Domain Event Handlers in DDD](#1-purpose-of-domain-event-handlers-in-ddd)
2. [Responsibilities of an Event Handler](#2-responsibilities-of-an-event-handler)
3. [Boundaries of an Event Handler](#3-boundaries-of-an-event-handler)
4. [Connections with Other Layers](#4-connections-with-other-layers)
5. [Event Handler Lifetime & Execution Flow](#5-event-handler-lifetime--execution-flow)
6. [Event Handler Structure Template](#6-event-handler-structure-template)
7. [Orthogonality Principles](#7-orthogonality-principles)
8. [Naming Conventions](#8-naming-conventions)
9. [Handler Registration Patterns](#9-handler-registration-patterns)
10. [Error Handling Strategy](#10-error-handling-strategy)
11. [Testing Strategy](#11-testing-strategy)
12. [Examples](#12-examples)

---

## 1. Purpose of Domain Event Handlers in DDD

**Event Handlers process domain events to perform side effects and coordinate cross-aggregate operations.**

### Core Characteristics:

- **Class-Based**: Handlers are classes that implement `IHandle<T>` interface
- **Single Responsibility**: Each handler focuses on one specific reaction to an event
- **Asynchronous**: Handlers can perform async operations (I/O, external services)
- **Resilient**: Handlers catch and log errors without throwing
- **Registered at Startup**: All handlers are registered before the application processes requests
- **Dependency Injection**: Handlers receive dependencies through constructor
- **Idempotent**: Safe to execute multiple times with the same event

### Why Event Handlers?

1. **Decouple Side Effects**: Keep aggregates focused on business rules
2. **Cross-Aggregate Coordination**: Update multiple aggregates in response to events
3. **External Integrations**: Send emails, push notifications, call external APIs
4. **Read Model Updates**: Update denormalized views and query models
5. **Audit & Logging**: Record important domain occurrences
6. **Eventual Consistency**: Coordinate changes across bounded contexts

### Event Handlers vs Aggregates:

| Aspect            | Aggregate                 | Event Handler              |
| ----------------- | ------------------------- | -------------------------- |
| **Purpose**       | Enforce business rules    | React to domain events     |
| **When Executed** | During command processing | After persistence          |
| **Side Effects**  | None (pure domain logic)  | I/O, external calls        |
| **Transactions**  | Single aggregate boundary | May span multiple contexts |
| **Dependencies**  | Minimal (value objects)   | Repositories, services     |
| **Error Impact**  | Fails the operation       | Logged, doesn't fail event |

---

## 2. Responsibilities of an Event Handler

### MUST DO:

1. **Implement IHandle<T> Interface**

   - Generic interface with specific event type
   - Implement `handle(event: T): Promise<void> | void` method
   - Type-safe access to event properties

2. **Declare Dependencies**

   - All dependencies in constructor
   - Use interfaces for repositories and services
   - Follow dependency injection pattern

3. **Be Resilient**

   - Wrap logic in try-catch blocks
   - Log errors for debugging
   - Never throw errors (prevent breaking other handlers)
   - Return gracefully on errors

4. **Handle Async Operations**

   - Mark handle() method as async if needed
   - Await all promises properly
   - Handle promise rejections

5. **Be Idempotent**
   - Safe to execute multiple times
   - Check for existing state before creating
   - Use unique identifiers to prevent duplicates

---

## 3. Boundaries of an Event Handler

### MUST NOT DO:

1. **❌ Modify the Event**

   - Events are immutable
   - Handlers read event data only
   - No setters or mutations

2. **❌ Throw Errors**

   - Catch and log all errors
   - Don't break other handlers
   - Use eventual consistency for recovery

3. **❌ Depend on Other Handlers**

   - Handlers execute independently
   - No assumptions about execution order
   - No direct handler-to-handler coupling

4. **❌ Contain Business Rules**

   - Business rules belong in aggregates
   - Handlers coordinate and orchestrate
   - Don't duplicate validation logic

5. **❌ Make Synchronous Assumptions**
   - Handlers may execute asynchronously
   - Don't assume immediate completion
   - Use eventual consistency patterns

---

## 4. Connections with Other Layers

```
┌─────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                        │
│  - HTTP Controllers                                         │
│  - WebSocket Handlers                                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  APPLICATION LAYER                          │
│  ┌───────────────────────────────────────────────────┐      │
│  │  Use Cases (Command Handlers)                     │      │
│  │  - Execute domain operations                      │      │
│  │  - Save aggregates via repository                 │      │
│  │  - Repository dispatches events                   │      │
│  └───────────────────────────────────────────────────┘      │
│                         │ triggers                          │
│  ┌───────────────────────────────────────────────────┐      │
│  │  EVENT HANDLERS (You are here)                    │      │
│  │  - Registered at startup                          │      │
│  │  - Receive events from dispatcher                 │      │
│  │  - Perform side effects                           │      │
│  │  - Coordinate cross-aggregate operations          │      │
│  └───────────────────────────────────────────────────┘      │
│                         │ uses                              │
│  ┌───────────────────────────────────────────────────┐      │
│  │  Repositories & Services                          │      │
│  │  - Load/save aggregates                           │      │
│  │  - Send emails, notifications                     │      │
│  │  - Call external services                         │      │
│  └───────────────────────────────────────────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    DOMAIN LAYER                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │         DOMAIN EVENTS                              │     │
│  │  - Published by Aggregates                         │     │
│  │  - Dispatched by EventDispatcher                      │     │
│  │  - Consumed by Handlers                            │     │
│  └────────────────────────────────────────────────────┘     │
│         ▲                                                   │
│         │ publishes                                         │
│  ┌──────────────────┐                                       │
│  │  Aggregate Root  │                                       │
│  │  - Adds events   │                                       │
│  │  - Events queued │                                       │
│  └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
                         ▲
                         │
┌─────────────────────────────────────────────────────────────┐
│               INFRASTRUCTURE LAYER                          │
│  - Database repositories                                    │
│  - Email service implementations                            │
│  - External API clients                                     │
│  - Message bus connections                                  │
└─────────────────────────────────────────────────────────────┘
```

### Event Flow with Handlers:

```
1. Use Case executes aggregate method
2. Aggregate adds domain event to queue
3. Use Case saves aggregate via repository
4. Repository calls EventDispatcher.dispatchEventsForAggregate()
5. EventDispatcher finds all handlers for event type
6. Each handler.handle(event) is called
7. Handlers perform side effects (emails, updates, etc.)
8. Errors are caught and logged per handler
9. Events cleared from aggregate
```

---

## 5. Event Handler Lifetime & Execution Flow

### Handler Lifecycle:

```typescript
// 1. Handler Definition (implements IHandle<T>)
export class DeviceOfflineAlertHandler
  implements IHandle<NetworkDeviceStatusChangedEvent>
{
  constructor(
    private readonly alertRepo: IAlertRepository,
    private readonly emailService: IEmailService
  ) {}

  async handle(
    event: NetworkDeviceStatusChangedEvent
  ): Promise<void> {
    try {
      if (event.isGoingOffline()) {
        // Perform side effect
      }
    } catch (error) {
      console.error('Handler error:', error);
    }
  }
}

// 2. Handler Registration (at application startup)
export function registerEventHandlers(
  container: DependencyContainer
): void {
  const alertRepo =
    container.resolve<IAlertRepository>('AlertRepository');
  const emailService =
    container.resolve<IEmailService>('EmailService');

  const handler = new DeviceOfflineAlertHandler(
    alertRepo,
    emailService
  );

  EventDispatcher.register(
    NetworkDeviceStatusChangedEvent.name,
    handler
  );
}

// 3. Event Dispatch (after aggregate save)
export class UpdateDeviceStatusUseCase {
  async execute(
    deviceId: string,
    newStatus: string
  ): Promise<Result<void>> {
    const device = await this.deviceRepo.findById(deviceId);
    device.updateStatus(newStatus); // Adds event to queue

    // Save triggers event dispatch
    await this.deviceRepo.save(device);
    // Handler.handle() is called here

    return Result.ok();
  }
}
```

### Execution Phases:

1. **Registration Phase** (Application Startup)

   - Handler instances created with dependencies
   - Handlers registered with EventDispatcher
   - Stored in handlersMap by event class name

2. **Dispatch Phase** (After Persistence)

   - Repository saves aggregate
   - EventDispatcher.dispatchEventsForAggregate() called
   - All handlers for event type executed

3. **Execution Phase** (Handler Processing)

   - Handler.handle(event) method invoked
   - Side effects performed
   - Errors caught and logged
   - Handler completes (sync or async)

4. **Cleanup Phase**
   - Events cleared from aggregate
   - Aggregate removed from marked list
   - Ready for next operation

---

## 6. Event Handler Structure Template

### IHandle Interface:

```typescript
import { IDomainEvent } from '@/shared/domain/events/IDomainEvent';

/**
 * Interface for domain event handlers.
 *
 * @template T - The type of domain event this handler processes
 */
export interface IHandle<T extends IDomainEvent> {
  /**
   * Handles the domain event.
   *
   * @param event - The domain event to handle
   * @returns Promise that resolves when handling is complete
   */
  handle(event: T): Promise<void> | void;
}
```

### Event Handler Template:

````typescript
import { IHandle } from '@/shared/domain/events/IHandle';
import { EventNameEvent } from '@/domain/events/EventNameEvent';
import { IRepository1 } from '@/domain/repository/IRepository1';
import { IService1 } from '@/application/services/IService1';

/**
 * Handler for EventNameEvent.
 *
 * Purpose:
 * - [What this handler does]
 * - [Side effects it triggers]
 *
 * Triggered By:
 * - [Aggregate].[method]() when [condition]
 *
 * Dependencies:
 * - IRepository1: For [purpose]
 * - IService1: For [purpose]
 *
 * Side Effects:
 * - [What it creates/updates/sends]
 * - [External calls it makes]
 *
 * Error Handling:
 * - Logs errors but doesn't throw
 * - Uses eventual consistency for recovery
 * - Idempotent (safe to retry)
 *
 * @example
 * ```typescript
 * const handler = new EventNameEventHandler(repo, service);
 * EventDispatcher.register(EventNameEvent.name, handler);
 * ```
 */
export class EventNameEventHandler
  implements IHandle<EventNameEvent>
{
  /**
   * Creates a new EventNameEventHandler.
   *
   * @param repository1 - Repository for accessing [entity]
   * @param service1 - Service for [purpose]
   */
  constructor(
    private readonly repository1: IRepository1,
    private readonly service1: IService1
  ) {}

  /**
   * Handles the EventNameEvent.
   *
   * Steps:
   * 1. [First step]
   * 2. [Second step]
   * 3. [Third step]
   *
   * @param event - The event containing [relevant data]
   */
  public async handle(event: EventNameEvent): Promise<void> {
    try {
      // 1. Validate event conditions
      if (!this.shouldHandle(event)) {
        return;
      }

      // 2. Load necessary data
      const dataResult = await this.repository1.findById(
        event.relatedId
      );

      if (dataResult.isFailure) {
        console.error(
          `Failed to load data for ${event.constructor.name}:`,
          dataResult.error
        );
        return;
      }

      // 3. Perform domain operation
      const data = dataResult.value;
      const operationResult = data.performOperation(event.property);

      if (operationResult.isFailure) {
        console.error(
          `Operation failed for ${event.constructor.name}:`,
          operationResult.error
        );
        return;
      }

      // 4. Persist changes
      await this.repository1.save(data);

      // 5. Trigger additional side effects
      await this.service1.notify(event.getAggregateId());
    } catch (error) {
      // Log error but don't throw (handlers should be resilient)
      console.error(
        `Error handling ${event.constructor.name}:`,
        error
      );
    }
  }

  /**
   * Determines if this event should be handled.
   *
   * @param event - The event to check
   * @returns true if the event should be handled
   */
  private shouldHandle(event: EventNameEvent): boolean {
    // Add conditional logic here
    return true;
  }
}
````

### Handler Registration Module Template:

```typescript
import { EventDispatcher } from '@/domain/core/EventDispatcher';
import { EventNameEventHandler } from '@/application/handlers/EventNameEventHandler';
import { IRepository1 } from '@/domain/repository/IRepository1';
import { IService1 } from '@/application/services/IService1';
import { EventNameEvent } from '@/domain/events/EventNameEvent';

/**
 * Registers all domain event handlers at application startup.
 *
 * This function should be called once when the application initializes,
 * before any requests are processed.
 *
 * @param container - Dependency injection container
 */
export function registerEventHandlers(
  container: DependencyContainer
): void {
  // Resolve dependencies from container
  const repository1 = container.resolve<IRepository1>('Repository1');
  const service1 = container.resolve<IService1>('Service1');

  // Create handler instances
  const eventNameHandler = new EventNameEventHandler(
    repository1,
    service1
  );

  // Register handlers with EventDispatcher
  EventDispatcher.register(EventNameEvent.name, eventNameHandler);

  console.log('Domain event handlers registered successfully');
}
```

---

## 7. Orthogonality Principles

### 1. Single Responsibility per Handler

Each handler should have one clear responsibility:

```typescript
// ✅ GOOD - Single responsibility: Create alert
export class DeviceOfflineAlertHandler
  implements IHandle<NetworkDeviceStatusChangedEvent>
{
  async handle(
    event: NetworkDeviceStatusChangedEvent
  ): Promise<void> {
    if (event.isGoingOffline()) {
      const alert = Alert.create({
        deviceId: event.deviceId,
        severity: AlertSeverity.HIGH,
        message: `Device ${event.deviceName} went offline`
      });
      await this.alertRepo.save(alert.value);
    }
  }
}

// ✅ GOOD - Single responsibility: Send email
export class DeviceOfflineEmailHandler
  implements IHandle<NetworkDeviceStatusChangedEvent>
{
  async handle(
    event: NetworkDeviceStatusChangedEvent
  ): Promise<void> {
    if (event.isGoingOffline()) {
      await this.emailService.send({
        to: 'admin@example.com',
        subject: 'Device Offline Alert',
        body: `Device ${event.deviceName} is offline`
      });
    }
  }
}

// ❌ BAD - Multiple responsibilities in one handler
export class DeviceOfflineHandler
  implements IHandle<NetworkDeviceStatusChangedEvent>
{
  async handle(
    event: NetworkDeviceStatusChangedEvent
  ): Promise<void> {
    // Creates alert
    await this.alertRepo.save(alert);
    // Sends email
    await this.emailService.send(email);
    // Updates analytics
    await this.analyticsService.track(event);
    // Calls external API
    await this.externalApi.notify(event);
  }
}
```

### 2. Error Isolation

Each handler catches its own errors:

```typescript
// ✅ GOOD - Errors caught and logged
export class DeviceOfflineAlertHandler
  implements IHandle<NetworkDeviceStatusChangedEvent>
{
  async handle(
    event: NetworkDeviceStatusChangedEvent
  ): Promise<void> {
    try {
      if (event.isGoingOffline()) {
        const alert = Alert.create({
          deviceId: event.deviceId,
          severity: AlertSeverity.HIGH,
          message: `Device ${event.deviceName} went offline`
        });

        if (alert.isSuccess) {
          await this.alertRepo.save(alert.value);
        }
      }
    } catch (error) {
      console.error(
        'DeviceOfflineAlertHandler error:',
        error,
        'Event:',
        event
      );
      // Don't throw - let other handlers execute
    }
  }
}

// ❌ BAD - Errors thrown (breaks other handlers)
export class DeviceOfflineAlertHandler
  implements IHandle<NetworkDeviceStatusChangedEvent>
{
  async handle(
    event: NetworkDeviceStatusChangedEvent
  ): Promise<void> {
    const alert = Alert.create({
      deviceId: event.deviceId,
      severity: AlertSeverity.HIGH,
      message: `Device ${event.deviceName} went offline`
    });

    // If this throws, no other handlers execute!
    await this.alertRepo.save(alert.value);
  }
}
```

### 3. Idempotency

Handlers should be safe to execute multiple times:

```typescript
// ✅ GOOD - Idempotent (checks for existing alert)
export class DeviceOfflineAlertHandler
  implements IHandle<NetworkDeviceStatusChangedEvent>
{
  async handle(
    event: NetworkDeviceStatusChangedEvent
  ): Promise<void> {
    try {
      if (!event.isGoingOffline()) {
        return;
      }

      // Check if alert already exists for this device
      const existingAlert = await this.alertRepo.findActiveByDeviceId(
        event.deviceId
      );

      if (existingAlert.isSuccess) {
        // Alert already exists, skip creation
        return;
      }

      // Create new alert
      const alert = Alert.create({
        deviceId: event.deviceId,
        severity: AlertSeverity.HIGH,
        message: `Device ${event.deviceName} went offline`
      });

      await this.alertRepo.save(alert.value);
    } catch (error) {
      console.error('DeviceOfflineAlertHandler error:', error);
    }
  }
}

// ❌ BAD - Not idempotent (creates duplicate alerts)
export class DeviceOfflineAlertHandler
  implements IHandle<NetworkDeviceStatusChangedEvent>
{
  async handle(
    event: NetworkDeviceStatusChangedEvent
  ): Promise<void> {
    // Always creates a new alert, even if one exists
    const alert = Alert.create({
      deviceId: event.deviceId,
      severity: AlertSeverity.HIGH,
      message: `Device ${event.deviceName} went offline`
    });
    await this.alertRepo.save(alert.value);
  }
}
```

### 4. No Handler Dependencies

Handlers should not depend on each other:

```typescript
// ✅ GOOD - Independent handlers
export class DeviceOfflineAlertHandler
  implements IHandle<NetworkDeviceStatusChangedEvent>
{
  async handle(
    event: NetworkDeviceStatusChangedEvent
  ): Promise<void> {
    // Creates alert independently
    await this.alertRepo.save(alert);
  }
}

export class DeviceOfflineEmailHandler
  implements IHandle<NetworkDeviceStatusChangedEvent>
{
  async handle(
    event: NetworkDeviceStatusChangedEvent
  ): Promise<void> {
    // Sends email independently
    await this.emailService.send(email);
  }
}

// ❌ BAD - Handler depends on another handler's side effect
export class DeviceOfflineEmailHandler
  implements IHandle<NetworkDeviceStatusChangedEvent>
{
  async handle(
    event: NetworkDeviceStatusChangedEvent
  ): Promise<void> {
    // Assumes alert was created by another handler
    const alert = await this.alertRepo.findByDeviceId(event.deviceId);
    // This will fail if alert handler hasn't run yet!
    await this.emailService.sendAlertEmail(alert);
  }
}
```

### 5. Dependency Injection

All dependencies through constructor:

```typescript
// ✅ GOOD - Dependencies injected
export class DeviceOfflineAlertHandler
  implements IHandle<NetworkDeviceStatusChangedEvent>
{
  constructor(
    private readonly alertRepo: IAlertRepository,
    private readonly deviceRepo: INetworkDeviceRepository,
    private readonly logger: ILogger
  ) {}

  async handle(
    event: NetworkDeviceStatusChangedEvent
  ): Promise<void> {
    this.logger.info(`Processing ${event.constructor.name}`);
    // Use injected dependencies
  }
}

// ❌ BAD - Direct instantiation (tight coupling)
export class DeviceOfflineAlertHandler
  implements IHandle<NetworkDeviceStatusChangedEvent>
{
  async handle(
    event: NetworkDeviceStatusChangedEvent
  ): Promise<void> {
    // Creates dependencies directly
    const repo = new AlertRepository();
    const logger = new ConsoleLogger();
    // Hard to test, tightly coupled
  }
}
```

---

## 8. Naming Conventions

### Handler Class Names:

- Use **event name + "Handler"** suffix
- Be specific about what the handler does
- Use **PascalCase**

```typescript
// ✅ GOOD - Clear, specific names
export class DeviceOfflineAlertHandler {}
export class DeviceOfflineEmailHandler {}
export class OrderConfirmedInventoryReservationHandler {}
export class UserRegisteredWelcomeEmailHandler {}
export class PaymentReceivedReceiptEmailHandler {}

// ❌ BAD - Vague, generic names
export class DeviceHandler {} // Too generic
export class StatusHandler {} // Too vague
export class Handler1 {} // Meaningless
export class ProcessDeviceOffline {} // Not clear it's a handler
```

### Handler File Names:

```
src/application/handlers/
  DeviceOfflineAlertHandler.ts           // ✅ Event + purpose
  DeviceOfflineEmailHandler.ts           // ✅ Event + purpose
  OrderConfirmedInventoryHandler.ts      // ✅ Event + purpose
  UserRegisteredWelcomeEmailHandler.ts   // ✅ Event + purpose

  DeviceHandler.ts                       // ❌ Too generic
  StatusChangedHandler.ts                // ❌ Too vague
  handler1.ts                            // ❌ camelCase
```

### Handler Method Names:

- Use **`handle()`** as the interface method (required by IHandle<T>)
- Use **private helper methods** for internal logic

```typescript
export class DeviceOfflineAlertHandler
  implements IHandle<NetworkDeviceStatusChangedEvent>
{
  // ✅ Public interface method
  public async handle(
    event: NetworkDeviceStatusChangedEvent
  ): Promise<void> {
    if (this.shouldCreateAlert(event)) {
      await this.createAlert(event);
    }
  }

  // ✅ Private helper methods
  private shouldCreateAlert(
    event: NetworkDeviceStatusChangedEvent
  ): boolean {
    return event.isGoingOffline();
  }

  private async createAlert(
    event: NetworkDeviceStatusChangedEvent
  ): Promise<void> {
    // Alert creation logic
  }
}
```

---

## 9. Handler Registration Patterns

### Pattern 1: Centralized Registration Module

```typescript
// src/application/handlers/registerEventHandlers.ts
import { EventDispatcher } from '@/domain/core/EventDispatcher';
import { DependencyContainer } from '@/shared/infrastructure/DependencyContainer';

// Event imports
import { NetworkDeviceStatusChangedEvent } from '@/domain/events';
import { NetworkDeviceCreatedEvent } from '@/domain/events';

// Handler imports
import { DeviceOfflineAlertHandler } from './DeviceOfflineAlertHandler';
import { DeviceOfflineEmailHandler } from './DeviceOfflineEmailHandler';
import { DeviceCreatedPollingSchedulerHandler } from './DeviceCreatedPollingSchedulerHandler';

/**
 * Registers all domain event handlers.
 *
 * Call this function once at application startup,
 * after the dependency container is initialized.
 *
 * @param container - The dependency injection container
 */
export function registerEventHandlers(
  container: DependencyContainer
): void {
  // Resolve shared dependencies
  const alertRepo = container.resolve('AlertRepository');
  const deviceRepo = container.resolve('NetworkDeviceRepository');
  const emailService = container.resolve('EmailService');
  const pollingScheduler = container.resolve('PollingScheduler');

  // NetworkDeviceStatusChangedEvent handlers
  EventDispatcher.register(
    NetworkDeviceStatusChangedEvent.name,
    new DeviceOfflineAlertHandler(alertRepo, deviceRepo)
  );

  EventDispatcher.register(
    NetworkDeviceStatusChangedEvent.name,
    new DeviceOfflineEmailHandler(emailService, deviceRepo)
  );

  // NetworkDeviceCreatedEvent handlers
  EventDispatcher.register(
    NetworkDeviceCreatedEvent.name,
    new DeviceCreatedPollingSchedulerHandler(pollingScheduler)
  );

  console.log('Domain event handlers registered');
}
```

### Pattern 2: Application Startup

```typescript
// src/index.ts or src/app.ts
import { registerEventHandlers } from '@/application/handlers/registerEventHandlers';
import { container } from '@/shared/infrastructure/DependencyContainer';

async function bootstrap(): Promise<void> {
  // 1. Initialize infrastructure
  await initializeDatabase();
  await initializeCache();

  // 2. Setup dependency container
  setupDependencyContainer(container);

  // 3. Register event handlers (BEFORE processing requests)
  registerEventHandlers(container);

  // 4. Start server
  const app = express();
  app.listen(3000, () => {
    console.log('Server started on port 3000');
  });
}

bootstrap();
```

### Pattern 3: Multiple Handlers per Event

```typescript
// Multiple handlers for the same event type
export function registerEventHandlers(
  container: DependencyContainer
): void {
  const alertRepo = container.resolve('AlertRepository');
  const emailService = container.resolve('EmailService');
  const analyticsService = container.resolve('AnalyticsService');
  const externalApi = container.resolve('ExternalMonitoringApi');

  // All handlers for NetworkDeviceStatusChangedEvent
  // They will execute in registration order
  EventDispatcher.register(
    NetworkDeviceStatusChangedEvent.name,
    new DeviceOfflineAlertHandler(alertRepo)
  );

  EventDispatcher.register(
    NetworkDeviceStatusChangedEvent.name,
    new DeviceOfflineEmailHandler(emailService)
  );

  EventDispatcher.register(
    NetworkDeviceStatusChangedEvent.name,
    new DeviceStatusAnalyticsHandler(analyticsService)
  );

  EventDispatcher.register(
    NetworkDeviceStatusChangedEvent.name,
    new DeviceStatusExternalNotificationHandler(externalApi)
  );
}
```

---

## 10. Error Handling Strategy

### Principle: Handlers Should Never Break Each Other

```typescript
export class DeviceOfflineAlertHandler
  implements IHandle<NetworkDeviceStatusChangedEvent>
{
  async handle(
    event: NetworkDeviceStatusChangedEvent
  ): Promise<void> {
    try {
      // 1. Early validation (fail fast)
      if (!event.isGoingOffline()) {
        return;
      }

      // 2. Load data with error handling
      const deviceResult = await this.deviceRepo.findById(
        event.deviceId
      );

      if (deviceResult.isFailure) {
        console.error(
          `[DeviceOfflineAlertHandler] Failed to load device ${event.deviceId.toString()}:`,
          deviceResult.error
        );
        return; // Don't throw - log and return
      }

      const device = deviceResult.value;

      // 3. Create domain object with validation
      const alertResult = Alert.create({
        deviceId: event.deviceId,
        severity: this.determineSeverity(device),
        message: `Device ${event.deviceName} went offline`,
        occurredAt: event.dateTimeOccurred
      });

      if (alertResult.isFailure) {
        console.error(
          `[DeviceOfflineAlertHandler] Failed to create alert:`,
          alertResult.error
        );
        return;
      }

      // 4. Persist with error handling
      const saveResult = await this.alertRepo.save(alertResult.value);

      if (saveResult.isFailure) {
        console.error(
          `[DeviceOfflineAlertHandler] Failed to save alert:`,
          saveResult.error
        );
        return;
      }

      console.log(
        `[DeviceOfflineAlertHandler] Alert created for device ${event.deviceName}`
      );
    } catch (error) {
      // 5. Catch all unexpected errors
      console.error(
        `[DeviceOfflineAlertHandler] Unexpected error:`,
        error,
        'Event:',
        {
          deviceId: event.deviceId.toString(),
          deviceName: event.deviceName,
          previousStatus: event.previousStatus.value,
          newStatus: event.newStatus.value
        }
      );
      // NEVER throw - let other handlers execute
    }
  }

  private determineSeverity(device: NetworkDevice): AlertSeverity {
    // Helper method logic
  }
}
```

### Error Logging Best Practices:

```typescript
// ✅ GOOD - Structured logging with context
console.error(`[${this.constructor.name}] Operation failed:`, {
  error: error.message,
  event: event.constructor.name,
  aggregateId: event.getAggregateId().toString(),
  timestamp: event.dateTimeOccurred.toISOString()
});

// ❌ BAD - Generic error message
console.error('Error:', error);
```

---

## 11. Testing Strategy

### Testing Handler Creation and Registration:

```typescript
describe('DeviceOfflineAlertHandler', () => {
  let handler: DeviceOfflineAlertHandler;
  let mockAlertRepo: MockAlertRepository;
  let mockDeviceRepo: MockNetworkDeviceRepository;

  beforeEach(() => {
    mockAlertRepo = new MockAlertRepository();
    mockDeviceRepo = new MockNetworkDeviceRepository();
    handler = new DeviceOfflineAlertHandler(
      mockAlertRepo,
      mockDeviceRepo
    );
  });

  it('should implement IHandle interface', () => {
    expect(handler.handle).toBeDefined();
    expect(typeof handler.handle).toBe('function');
  });

  it('should have required dependencies', () => {
    expect((handler as any).alertRepo).toBeDefined();
    expect((handler as any).deviceRepo).toBeDefined();
  });
});
```

### Testing Handler Logic:

```typescript
describe('DeviceOfflineAlertHandler - handle()', () => {
  let handler: DeviceOfflineAlertHandler;
  let mockAlertRepo: MockAlertRepository;
  let mockDeviceRepo: MockNetworkDeviceRepository;

  beforeEach(() => {
    mockAlertRepo = new MockAlertRepository();
    mockDeviceRepo = new MockNetworkDeviceRepository();
    handler = new DeviceOfflineAlertHandler(
      mockAlertRepo,
      mockDeviceRepo
    );
  });

  it('should create alert when device goes offline', async () => {
    // Arrange
    const deviceId = NetworkDeviceId.create().value;
    const device = createMockDevice(deviceId);
    mockDeviceRepo.setMockData(deviceId, device);

    const event = new NetworkDeviceStatusChangedEvent(
      deviceId,
      'Router-01',
      NetworkDeviceStatus.createOnline().value,
      NetworkDeviceStatus.createOffline().value,
      '192.168.1.1'
    );

    // Act
    await handler.handle(event);

    // Assert
    expect(mockAlertRepo.saveCalled).toBe(true);
    expect(mockAlertRepo.savedAlerts).toHaveLength(1);
    expect(
      mockAlertRepo.savedAlerts[0].deviceId.equals(deviceId)
    ).toBe(true);
  });

  it('should not create alert when device goes online', async () => {
    // Arrange
    const event = new NetworkDeviceStatusChangedEvent(
      NetworkDeviceId.create().value,
      'Router-01',
      NetworkDeviceStatus.createOffline().value,
      NetworkDeviceStatus.createOnline().value,
      '192.168.1.1'
    );

    // Act
    await handler.handle(event);

    // Assert
    expect(mockAlertRepo.saveCalled).toBe(false);
  });

  it('should handle repository errors gracefully', async () => {
    // Arrange
    const event = new NetworkDeviceStatusChangedEvent(
      NetworkDeviceId.create().value,
      'Router-01',
      NetworkDeviceStatus.createOnline().value,
      NetworkDeviceStatus.createOffline().value,
      '192.168.1.1'
    );

    mockDeviceRepo.setThrowError(true);

    // Act - should not throw
    await expect(handler.handle(event)).resolves.not.toThrow();

    // Assert - alert should not be created
    expect(mockAlertRepo.saveCalled).toBe(false);
  });

  it('should log errors when save fails', async () => {
    // Arrange
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation();
    const deviceId = NetworkDeviceId.create().value;
    const device = createMockDevice(deviceId);
    mockDeviceRepo.setMockData(deviceId, device);
    mockAlertRepo.setThrowError(true);

    const event = new NetworkDeviceStatusChangedEvent(
      deviceId,
      'Router-01',
      NetworkDeviceStatus.createOnline().value,
      NetworkDeviceStatus.createOffline().value,
      '192.168.1.1'
    );

    // Act
    await handler.handle(event);

    // Assert
    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleSpy.mock.calls[0][0]).toContain(
      'DeviceOfflineAlertHandler'
    );

    consoleSpy.mockRestore();
  });
});
```

### Testing Handler Registration:

```typescript
describe('registerEventHandlers', () => {
  let container: MockDependencyContainer;

  beforeEach(() => {
    container = new MockDependencyContainer();
    EventDispatcher.clearHandlers();
  });

  it('should register all handlers', () => {
    // Act
    registerEventHandlers(container);

    // Assert - handlers should be registered
    // (You can test this by dispatching events and checking execution)
    const event = new NetworkDeviceStatusChangedEvent(
      NetworkDeviceId.create().value,
      'Router-01',
      NetworkDeviceStatus.createOnline().value,
      NetworkDeviceStatus.createOffline().value,
      '192.168.1.1'
    );

    // This would trigger registered handlers
    EventDispatcher.dispatch(event);
  });
});
```

### Mock Repository Pattern:

```typescript
export class MockAlertRepository implements IAlertRepository {
  public saveCalled = false;
  public savedAlerts: Alert[] = [];
  private throwError = false;

  setThrowError(value: boolean): void {
    this.throwError = value;
  }

  async save(alert: Alert): Promise<Result<Alert>> {
    if (this.throwError) {
      return Result.fail<Alert>('Mock repository error');
    }

    this.saveCalled = true;
    this.savedAlerts.push(alert);
    return Result.ok(alert);
  }

  async findById(id: AlertId): Promise<Result<Alert>> {
    // Mock implementation
    return Result.fail<Alert>('Not found');
  }

  reset(): void {
    this.saveCalled = false;
    this.savedAlerts = [];
    this.throwError = false;
  }
}
```

---

## 12. Examples

### Example 1: Device Offline Alert Handler

```typescript
import { IHandle } from '@/shared/domain/events/IHandle';
import { NetworkDeviceStatusChangedEvent } from '@/domain/events/NetworkDeviceStatusChangedEvent';
import { IAlertRepository } from '@/domain/repository/IAlertRepository';
import { INetworkDeviceRepository } from '@/domain/repository/INetworkDeviceRepository';
import { Alert } from '@/domain/aggregates/Alert';
import { AlertSeverity } from '@/domain/value-objects/AlertSeverity';

/**
 * DeviceOfflineAlertHandler
 *
 * Purpose:
 * - Creates critical alerts when network devices go offline
 * - Determines alert severity based on device criticality
 *
 * Triggered By:
 * - NetworkDevice.updateStatus() when status changes to OFFLINE
 *
 * Dependencies:
 * - IAlertRepository: For persisting alerts
 * - INetworkDeviceRepository: For loading device details
 *
 * Side Effects:
 * - Creates Alert aggregate
 * - Persists alert to database
 *
 * Error Handling:
 * - Logs errors but doesn't throw
 * - Returns gracefully on repository failures
 * - Idempotent (checks for existing alerts)
 */
export class DeviceOfflineAlertHandler
  implements IHandle<NetworkDeviceStatusChangedEvent>
{
  constructor(
    private readonly alertRepo: IAlertRepository,
    private readonly deviceRepo: INetworkDeviceRepository
  ) {}

  /**
   * Handles NetworkDeviceStatusChangedEvent.
   *
   * Only processes events where device goes offline.
   * Loads full device details to determine alert severity.
   *
   * @param event - The status changed event
   */
  public async handle(
    event: NetworkDeviceStatusChangedEvent
  ): Promise<void> {
    try {
      // 1. Filter: only process offline events
      if (!event.isGoingOffline()) {
        return;
      }

      // 2. Check for existing alert (idempotency)
      const existingAlertResult =
        await this.alertRepo.findActiveByDeviceId(event.deviceId);

      if (existingAlertResult.isSuccess) {
        console.log(
          `[DeviceOfflineAlertHandler] Alert already exists for device ${event.deviceName}`
        );
        return;
      }

      // 3. Load device details for severity calculation
      const deviceResult = await this.deviceRepo.findById(
        event.deviceId
      );

      if (deviceResult.isFailure) {
        console.error(
          `[DeviceOfflineAlertHandler] Failed to load device:`,
          deviceResult.error
        );
        return;
      }

      const device = deviceResult.value;

      // 4. Create alert with appropriate severity
      const alertResult = Alert.create({
        deviceId: event.deviceId,
        severity: this.determineSeverity(device),
        message: `Device ${event.deviceName} (${event.ipAddress}) went offline`,
        occurredAt: event.dateTimeOccurred
      });

      if (alertResult.isFailure) {
        console.error(
          `[DeviceOfflineAlertHandler] Failed to create alert:`,
          alertResult.error
        );
        return;
      }

      // 5. Persist alert
      const saveResult = await this.alertRepo.save(alertResult.value);

      if (saveResult.isFailure) {
        console.error(
          `[DeviceOfflineAlertHandler] Failed to save alert:`,
          saveResult.error
        );
        return;
      }

      console.log(
        `[DeviceOfflineAlertHandler] Alert created for device ${event.deviceName}`
      );
    } catch (error) {
      console.error(
        `[DeviceOfflineAlertHandler] Unexpected error:`,
        error,
        'Event:',
        {
          deviceId: event.deviceId.toString(),
          deviceName: event.deviceName,
          ipAddress: event.ipAddress
        }
      );
    }
  }

  /**
   * Determines alert severity based on device priority.
   *
   * Critical devices get CRITICAL alerts.
   * High priority devices get HIGH alerts.
   * Others get MEDIUM alerts.
   *
   * @param device - The network device
   * @returns Alert severity for the device
   */
  private determineSeverity(device: NetworkDevice): AlertSeverity {
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

### Example 2: Device Offline Email Handler

```typescript
import { IHandle } from '@/shared/domain/events/IHandle';
import { NetworkDeviceStatusChangedEvent } from '@/domain/events/NetworkDeviceStatusChangedEvent';
import { IEmailService } from '@/application/services/IEmailService';
import { INetworkDeviceRepository } from '@/domain/repository/INetworkDeviceRepository';

/**
 * DeviceOfflineEmailHandler
 *
 * Purpose:
 * - Sends email notifications when network devices go offline
 * - Notifies administrators of critical infrastructure issues
 *
 * Triggered By:
 * - NetworkDevice.updateStatus() when status changes to OFFLINE
 *
 * Dependencies:
 * - IEmailService: For sending email notifications
 * - INetworkDeviceRepository: For loading device details
 *
 * Side Effects:
 * - Sends email to administrators
 * - Includes device details and timestamp
 *
 * Error Handling:
 * - Logs errors but doesn't throw
 * - Returns gracefully on email service failures
 */
export class DeviceOfflineEmailHandler
  implements IHandle<NetworkDeviceStatusChangedEvent>
{
  private readonly ADMIN_EMAIL = 'admin@example.com';

  constructor(
    private readonly emailService: IEmailService,
    private readonly deviceRepo: INetworkDeviceRepository
  ) {}

  public async handle(
    event: NetworkDeviceStatusChangedEvent
  ): Promise<void> {
    try {
      // 1. Filter: only process offline events
      if (!event.isGoingOffline()) {
        return;
      }

      // 2. Load device for additional details
      const deviceResult = await this.deviceRepo.findById(
        event.deviceId
      );

      if (deviceResult.isFailure) {
        console.error(
          `[DeviceOfflineEmailHandler] Failed to load device:`,
          deviceResult.error
        );
        // Send email anyway with available data
        await this.sendBasicNotification(event);
        return;
      }

      const device = deviceResult.value;

      // 3. Send detailed email notification
      await this.sendDetailedNotification(event, device);

      console.log(
        `[DeviceOfflineEmailHandler] Email sent for device ${event.deviceName}`
      );
    } catch (error) {
      console.error(
        `[DeviceOfflineEmailHandler] Unexpected error:`,
        error,
        'Event:',
        {
          deviceId: event.deviceId.toString(),
          deviceName: event.deviceName
        }
      );
    }
  }

  /**
   * Sends detailed email with full device information.
   */
  private async sendDetailedNotification(
    event: NetworkDeviceStatusChangedEvent,
    device: NetworkDevice
  ): Promise<void> {
    const emailResult = await this.emailService.send({
      to: this.ADMIN_EMAIL,
      subject: `ALERT: ${event.deviceName} is offline`,
      body: `
        Network Device Alert
        ====================

        Device Name: ${event.deviceName}
        IP Address: ${event.ipAddress}
        Location: ${device.location.value}
        Priority: ${device.priority.value}

        Status Change:
        - Previous: ${event.previousStatus.value}
        - Current: ${event.newStatus.value}

        Timestamp: ${event.dateTimeOccurred.toISOString()}

        Please investigate immediately.
      `,
      priority: 'high'
    });

    if (emailResult.isFailure) {
      console.error(
        `[DeviceOfflineEmailHandler] Failed to send email:`,
        emailResult.error
      );
    }
  }

  /**
   * Sends basic email with event data only.
   */
  private async sendBasicNotification(
    event: NetworkDeviceStatusChangedEvent
  ): Promise<void> {
    const emailResult = await this.emailService.send({
      to: this.ADMIN_EMAIL,
      subject: `ALERT: ${event.deviceName} is offline`,
      body: `
        Network Device Alert
        ====================

        Device Name: ${event.deviceName}
        IP Address: ${event.ipAddress}

        Status: ${event.newStatus.value}
        Timestamp: ${event.dateTimeOccurred.toISOString()}
      `,
      priority: 'high'
    });

    if (emailResult.isFailure) {
      console.error(
        `[DeviceOfflineEmailHandler] Failed to send email:`,
        emailResult.error
      );
    }
  }
}
```

### Example 3: Handler Registration Module

```typescript
// src/application/handlers/registerEventHandlers.ts
import { EventDispatcher } from '@/domain/core/EventDispatcher';
import { DependencyContainer } from '@/shared/infrastructure/DependencyContainer';

// Events
import {
  NetworkDeviceStatusChangedEvent,
  NetworkDeviceCreatedEvent,
  DevicePolledSuccessfullyEvent
} from '@/domain/events';

// Handlers
import { DeviceOfflineAlertHandler } from './DeviceOfflineAlertHandler';
import { DeviceOfflineEmailHandler } from './DeviceOfflineEmailHandler';
import { DeviceCreatedPollingSchedulerHandler } from './DeviceCreatedPollingSchedulerHandler';
import { PollingResultMetricsHandler } from './PollingResultMetricsHandler';

/**
 * Registers all domain event handlers at application startup.
 *
 * This function must be called once when the application initializes,
 * after the dependency container is set up but before processing
 * any requests.
 *
 * Handler Order:
 * - Handlers are executed in registration order
 * - Each event type can have multiple handlers
 * - Handlers execute independently (errors don't cascade)
 *
 * @param container - Dependency injection container
 */
export function registerEventHandlers(
  container: DependencyContainer
): void {
  console.log('Registering domain event handlers...');

  // Resolve repositories
  const alertRepo = container.resolve('AlertRepository');
  const deviceRepo = container.resolve('NetworkDeviceRepository');
  const metricsRepo = container.resolve('MetricsRepository');

  // Resolve services
  const emailService = container.resolve('EmailService');
  const pollingScheduler = container.resolve('PollingScheduler');

  // === NetworkDeviceStatusChangedEvent Handlers ===

  EventDispatcher.register(
    NetworkDeviceStatusChangedEvent.name,
    new DeviceOfflineAlertHandler(alertRepo, deviceRepo)
  );

  EventDispatcher.register(
    NetworkDeviceStatusChangedEvent.name,
    new DeviceOfflineEmailHandler(emailService, deviceRepo)
  );

  // === NetworkDeviceCreatedEvent Handlers ===

  EventDispatcher.register(
    NetworkDeviceCreatedEvent.name,
    new DeviceCreatedPollingSchedulerHandler(pollingScheduler)
  );

  // === DevicePolledSuccessfullyEvent Handlers ===

  EventDispatcher.register(
    DevicePolledSuccessfullyEvent.name,
    new PollingResultMetricsHandler(metricsRepo)
  );

  console.log('Domain event handlers registered successfully');
  console.log(`- ${getHandlerCount()} handlers registered`);
}

/**
 * Gets total number of registered handlers (for debugging).
 */
function getHandlerCount(): number {
  // Implementation would access EventDispatcher internal state
  // This is just for logging purposes
  return 4; // Placeholder
}
```

---

## Summary Checklist

When creating a Domain Event Handler, ensure:

- ✅ Implements `IHandle<T>` interface with specific event type
- ✅ Named with event name + "Handler" suffix
- ✅ All dependencies injected through constructor
- ✅ Uses interfaces for all dependencies
- ✅ Has single, clear responsibility
- ✅ Wrapped in try-catch block
- ✅ Logs errors with context (handler name, event details)
- ✅ Never throws errors
- ✅ Returns gracefully on failures
- ✅ Checks conditions before processing (event filtering)
- ✅ Idempotent (safe to execute multiple times)
- ✅ No dependencies on other handlers
- ✅ No assumptions about execution order
- ✅ Registered at application startup
- ✅ Uses Result<T> pattern for operations
- ✅ Comprehensive unit tests with mocks
- ✅ Tests cover success cases, error cases, and edge cases
- ✅ Integration tests verify handler registration

---

**Remember**: Event handlers enable loose coupling and side effects without polluting your domain logic. Keep them resilient, focused, and independent!
