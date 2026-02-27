# Domain Core Building Blocks

## Introduction

This document explains the foundational classes that underpin the entire domain layer of the Network Management System. These building blocks are not specific to network devices or polling; they are reusable infrastructure that enforces how data is created, validated, compared, and modified throughout the system.

**Why These Blocks Exist:**

The domain layer must ensure that business rules are enforced consistently, data integrity is maintained, and state changes are tracked reliably. Without these building blocks, business logic would be scattered, inconsistent, and fragile. These classes provide:

- **Immutability and Safety**: Once created, critical objects cannot be accidentally modified.
- **Strong Validation**: Rules are checked at creation time, not later.
- **Clear Success/Failure Handling**: Operations explicitly indicate whether they succeeded or failed.
- **Unique Identification**: Every significant entity is distinguishable and traceable.
- **Business Event Tracking**: Important actions in the domain are recorded and can trigger downstream consequences.

All classes in this document work together in a hierarchical relationship, from the simplest primitive wrappers to complex aggregates that orchestrate business operations.

---

## Result: Explicit Success and Failure

**Location:** `/src/domain/shared/core/Result.ts`

### The Business Problem

When operations succeed or fail, the system must communicate what happened clearly. A successful operation produces a value; a failed operation produces an explanation. Mixing success and failure signals is a source of bugs.

### What the System Enforces

A Result object represents the outcome of a single operation. It is immutable and frozen once created, so it cannot be accidentally modified. Every Result must be either a success with a value OR a failure with an error message—never both, and never neither. This strict rule is enforced at construction time.

When you read a Result's value, the system checks first that the operation succeeded. If it failed, attempting to read the value throws an error with a reminder to use the error message instead. This prevents silent failures.

Multiple Result objects can be combined into a single Result using the combine operation. If any Result in the group failed, the first failure is returned immediately; only if all succeed does the combination succeed.

### Real-World Meaning

Think of a Result as a sealed envelope containing either good news or bad news—never both. You can ask the envelope whether it contains good news or bad news. If it's good news, you can open it and read the value inside. If it's bad news, you read the message explaining what went wrong. The envelope cannot be tampered with after sealing.

### Example in Network Management

When creating a network device, the system validates the IP address. It returns either a successful Result containing the new device, or a failed Result with a message like "Invalid IP address format." The application code checks which type of Result it received and handles accordingly.

---

## Guard: Input and State Validation

**Location:** `/src/domain/shared/core/Guard.ts`

### The Business Problem

Domain objects must reject invalid inputs at creation time. Invalid data entering the system early is cheaper to catch than discovering problems deep in business logic.

### What the System Enforces

The Guard class provides a collection of validation checks. Each check examines a piece of data against a rule and returns a result describing whether the validation passed. No exceptions are thrown—validation is explicit and composable.

The Guard validates:

- **Presence**: Values cannot be null or undefined; entire groups of values can be checked together.
- **Numeric Ranges**: Numbers must fall within specific minimum and maximum boundaries; all numbers in a list can be checked simultaneously.
- **String Length**: Text must be at least a certain length or must not exceed a maximum length.
- **Type Correctness**: Values must be strings, numbers, booleans, or valid dates—no surprises.
- **Magnitude Comparisons**: Numbers must be greater than a threshold.

Multiple Guard checks can be combined so that all failures are visible at once, or the first failure can be returned immediately.

### Real-World Meaning

A Guard is like a checklist of conditions an input must satisfy before the system accepts it. The checklist includes rules like "this field cannot be empty," "this number must be between 1 and 100," and "this must be a valid date." The Guard reports whether the input passed or, if not, which rule it violated.

### Example in Network Management

Before creating a polling configuration, the system uses the Guard to validate that the polling interval is a positive number and that the retry count is within the range 1 to 10. Instead of throwing separate exceptions for each violation, all violations can be checked together and reported at once.

---

## UUID: Guaranteed Unique Identifiers

**Location:** `/src/domain/shared/core/UUID.ts`

### The Business Problem

Every significant object needs a globally unique, universally recognized identifier. The system must generate these identifiers automatically when needed and validate them when supplied by external systems.

### What the System Enforces

A UUID is an immutable wrapper around a universally unique identifier string. The UUID class enforces that all identifiers follow the standard UUID format (RFC 4122). When you create a UUID without providing a value, the system automatically generates a new random one using version 4 of the UUID standard. When you create a UUID by supplying a string, the system validates it against the UUID format; if invalid, it rejects the input with a specific error message.

UUIDs are compared for equality by their string values. Two UUIDs are the same if they contain the same identifier string.

The UUID object itself cannot be modified after creation. You can ask for its string representation for storage or logging, but you cannot change the identifier.

### Real-World Meaning

A UUID is like a unique serial number on a product that never changes. The system can print a new serial number (generate a UUID) or accept a serial number you provide (create a UUID from a string). The system checks that serial numbers follow the correct format. Once assigned, the serial number is final and cannot be modified.

### Example in Network Management

When a network device is created, the system generates a new UUID to identify that device forever. This UUID is never duplicated across any other device. If an external system provides a device ID claiming to be a UUID, the system validates it before accepting it.

---

## ValueObject: Immutable Domain Concepts

**Location:** `/src/domain/shared/core/ValueObject.ts`

### The Business Problem

Some domain concepts have no separate identity; they are defined entirely by their properties. Two instances with the same properties are interchangeable. These objects must be immutable to prevent accidental changes that would make them unsafe to share.

### What the System Enforces

A ValueObject is an abstract base class for domain concepts that are meaningless without their properties. Once created, all properties are frozen—the object and its contents cannot be modified. ValueObjects are compared for equality by comparing their properties, not by object identity. Two ValueObjects are equal if all their properties have the same values.

Equality is determined by serializing both objects' properties to JSON and comparing the strings. This ensures deep equality checking.

### Real-World Meaning

A ValueObject is like a simple data structure that is defined entirely by its contents. For example, a quantity of 5 units is the same as any other quantity of 5 units; there is no separate identity. Once created, you cannot change a quantity from 5 to 6 units—you must create a new quantity object. Two quantities are equal if they both say 5 units.

### Example in Network Management

An IP address is a ValueObject. Two IP addresses are equal if they have the same octets. Equality is based on the address value, not on separate IDs. The IP address 192.168.1.1 is always the same IP address 192.168.1.1. Once an IP address object is created, it cannot be modified; if the IP changes, a new IP address object must be created.

---

## Identifier: Type-Safe Wrappers for IDs

**Location:** `/src/domain/shared/core/Identifier.ts`

### The Business Problem

Different types of IDs (device IDs, polling IDs, user IDs) must be kept separate to prevent accidental mixing. A strongly typed identifier prevents you from passing a device ID where a polling ID is expected.

### What the System Enforces

An Identifier is a strongly typed wrapper around a primitive value (string, number, UUID, etc.). Identifiers are immutable ValueObjects, meaning two Identifiers are equal if their wrapped values are equal. When comparing two Identifiers, the system checks that they are the same type (same class) before comparing their values. An Identifier of one type will never equal an Identifier of a different type, even if their values are the same.

You can extract the underlying value from an Identifier for storage or serialization.

### Real-World Meaning

An Identifier is like a labeled container for an ID value. It says "this is a Device ID" or "this is a Polling ID," not just "this is some number." The label prevents mixing different types of IDs. Two Device IDs are equal if they have the same number inside the container; a Device ID and a Polling ID are never equal, even if they happen to contain the same number.

### Example in Network Management

A DeviceId is an Identifier wrapping a UUID. A PollingConfigurationId is also an Identifier wrapping a UUID. They are different types, so the system will not allow you to accidentally pass a DeviceId to a method expecting a PollingConfigurationId. The system will catch this error at compile time.

---

## UniqueEntityID: Entity Identification with Automatic UUID Generation

**Location:** `/src/domain/shared/core/UniqueEntityID.ts`

### The Business Problem

Every entity in the domain must have a unique, never-changing identifier. These identifiers are UUID strings that are validated on creation.

### What the System Enforces

UniqueEntityID is an abstract class that extends Identifier and always wraps a UUID. When you create an entity ID without providing a value, it automatically generates a new UUID. When you provide an ID string, it validates that the string is a valid UUID; if not, it throws an error immediately, preventing invalid IDs from entering the system.

Once created, a UniqueEntityID cannot be changed. Two entity IDs are equal if their UUID strings are the same.

### Real-World Meaning

UniqueEntityID is like an automatically assigned employee ID that is always a valid UUID format. If you create a new employee without specifying an ID, the system assigns one automatically. If you try to assign an ID manually, it must be in valid UUID format or the system rejects it.

### Example in Network Management

Every network device has a NetworkDeviceId that is a UniqueEntityID. When a device is created, a new UUID is generated automatically. If the system needs to look up a device by a UUID string from an external system, the ID is validated first to ensure it is a valid UUID.

---

## Entity: Identifiable Domain Objects

**Location:** `/src/domain/shared/core/Entity.ts`

### The Business Problem

Some domain objects have persistent identity. Even if their properties change, they remain "the same object." Two entities are the same if they have the same ID, regardless of their current properties.

### What the System Enforces

An Entity has a unique identifier (a UniqueEntityID) and properties. The properties may change over time, but the ID never changes. Entities are compared for equality by their IDs. Two entities with the same ID are considered the same entity, even if their properties differ.

An Entity cannot be constructed directly; it must be extended by concrete domain entities. The system provides a type guard to check whether a value is an Entity instance.

### Real-World Meaning

An Entity is a domain object with a permanent identity. Think of a network device as an Entity: it has an ID (generated when it is first created), and it may have properties like IP address, status, and last-seen time. If the device's IP address changes, it is still the same device (same ID). If the device's status changes from online to offline, it is still the same device. You identify the device by its ID, not by its properties.

### Example in Network Management

NetworkDevice is an Entity extending the Entity class. It has a NetworkDeviceId and properties like IP address, device type, and status. Two NetworkDevice instances are equal if they have the same NetworkDeviceId, regardless of whether their IP addresses or statuses are different.

---

## AggregateRoot: Coordinated Domain Operations

**Location:** `/src/domain/shared/core/AggregateRoot.ts`

### The Business Problem

In a complex domain, changes to one entity often require changes to related entities. All these changes must be coordinated as a single unit of work. Important business actions should be recorded so the system can react to them.

### What the System Enforces

An AggregateRoot is an Entity that can record and track domain events. When something important happens inside the aggregate (creation, deletion, status change), the aggregate adds a domain event to its internal list. These events are immutable records of what happened.

After an aggregate is saved to the database, the system can retrieve its recorded events and notify other parts of the system. Once events are dispatched, the aggregate clears its event list.

An AggregateRoot enforces invariants—business rules that must always be true. The aggregate is the only entity allowed to change properties; nothing outside the aggregate can directly modify it.

### Real-World Meaning

An AggregateRoot is a domain object that is responsible for a group of related entities and enforces the rules about how they relate. When something significant happens, the AggregateRoot creates a record (event) of what happened. Later, other parts of the system can read these records and react.

For example, a Device Inventory is an AggregateRoot that contains multiple devices. When a device is added, the inventory records the event "DeviceAdded". When a device is removed, the inventory records the event "DeviceRemoved". Other parts of the system can listen to these events to trigger actions like sending notifications or updating reports.

### Example in Network Management

NetworkDevice is an AggregateRoot. When a device is created, it adds a NetworkDeviceCreatedEvent to its list. When the device status changes, it adds a NetworkDeviceStatusChangedEvent. When the device is deleted (soft delete), it adds a NetworkDeviceDeletedEvent. After the device is persisted, all these events are dispatched so that alert handlers, notification handlers, and audit loggers can react.

---

## DomainEvent: Immutable Records of Business Actions

**Location:** `/src/domain/shared/core/DomainEvent.ts`

### The Business Problem

Important business actions (a device going offline, a polling cycle completing, a device being replaced) must be recorded so the system can react consistently. Events are immutable records that multiple parts of the system can rely on without fear of modification.

### What the System Enforces

A DomainEvent is an immutable record of something significant that happened in the domain. All properties of an event are frozen at creation time and cannot be modified. Every event must specify which aggregate produced it (by providing an aggregate ID) and when the event occurred (by providing a timestamp).

DomainEvents are named in past tense (e.g., DeviceCreated, DeviceStatusChanged, PollingCompleted) to reflect that they record things that have already happened.

You can convert an event to a human-readable string for logging and debugging. The string includes the event name, the aggregate ID that created it, and the timestamp.

### Real-World Meaning

A DomainEvent is like a log entry that says "something happened." Once written, the log entry is permanent and cannot be changed. The entry records what happened (the event type), which entity it happened to (the aggregate ID), and when (the timestamp). Other parts of the system can read the log and react accordingly.

### Example in Network Management

NetworkDeviceStatusChangedEvent records that a device's status changed. The event contains the device's ID, the new status, the old status, and the timestamp when the status changed. Once this event is created, it is permanent. Alert handlers and dashboard updaters can read this event and take action.

DevicePolledSuccessfullyEvent records that a device was successfully reached during a polling cycle. The event contains the device ID, the polling metrics (latency, packet loss), and the timestamp. Monitoring systems can read this event to update historical records.

---

## EventDispatcher: Publishing and Handling Domain Events

**Location:** `/src/domain/shared/core/EventDispatcher.ts`

### The Business Problem

When a domain event is created, multiple parts of the system may need to react to it (sending alerts, updating dashboards, logging to audit trails). These reactions must be decoupled from the aggregate that created the event, so aggregates do not need to know about or depend on every handler.

### What the System Enforces

The EventDispatcher is a central registry that tracks all event handlers (subscribers) and dispatches events to them when aggregates are saved. Handlers are registered at application startup by class name, and multiple handlers can be registered for the same event type.

When an aggregate is marked for dispatch after being saved, the EventDispatcher retrieves all its recorded events and executes each handler that is registered for those events. Handlers are executed in the order they were registered. If one handler fails, its error is logged, but other handlers continue executing, preventing one broken handler from stopping the entire system.

After all events are dispatched, the aggregate's event list is cleared so events are not dispatched twice.

If a handler's handle() method returns a Promise (for asynchronous work), the EventDispatcher does not wait for it to complete before continuing. Handlers are responsible for their own error handling.

### Real-World Meaning

An EventDispatcher is like a post office for domain events. When an event is created, it is dropped into the post office (added to the aggregate). After the aggregate is saved, the post office delivers the event to all handlers (subscribers) registered to receive it. Different handlers can react in different ways: one might send an alert, another might update a dashboard, a third might log to audit trails. The handlers do not need to coordinate with each other.

### Example in Network Management

When NetworkDeviceStatusChangedEvent is dispatched, the following handlers might be registered:

1. DeviceOfflineAlertHandler - checks if the device is now offline and creates an alert.
2. DeviceStatusDashboardHandler - updates the dashboard to reflect the new status.
3. DeviceStatusAuditHandler - logs the status change to an audit trail.

All three handlers receive the event and execute independently. If the alert handler fails, the dashboard and audit handlers still execute. The system is resilient to individual handler failures.

The EventDispatcher maintains an internal map of event types to handlers, a list of aggregates pending event dispatch, and internal methods to find aggregates by ID, dispatch events one at a time, and clean up after dispatch.

---

## Quick Reference: Classes and Dependencies

This table summarizes all 10 domain core classes, their primary responsibility, and which classes they depend on.

| Class | File | Responsibility | Depends On | Used By |
|-------|------|-----------------|-----------|---------|
| Result | Result.ts | Explicit success/failure representation; immutable outcome envelope | None | Guard, UUID, UniqueEntityID, all validation |
| Guard | Guard.ts | Input and state validation; no exceptions thrown | None | Domain entities, value objects, use cases |
| UUID | UUID.ts | Validate and generate RFC 4122 identifiers; immutable UUID wrapper | Result | UniqueEntityID |
| ValueObject | ValueObject.ts | Immutable domain concept with no separate identity; equality by properties | None | Identifier, and all domain value objects |
| Identifier | Identifier.ts | Type-safe wrapper for primitive ID values; immutable | ValueObject | UniqueEntityID, and all domain identifiers |
| UniqueEntityID | UniqueEntityID.ts | Entity identification with automatic UUID generation; never changes | Identifier, UUID | Entity, AggregateRoot |
| Entity | Entity.ts | Identifiable domain object; equality by ID not properties | UniqueEntityID | AggregateRoot, all concrete domain entities |
| AggregateRoot | AggregateRoot.ts | Coordinated entity with domain event tracking; enforces invariants | Entity | Concrete aggregates like NetworkDevice |
| DomainEvent | DomainEvent.ts | Immutable record of significant business action; past tense | UniqueEntityID | AggregateRoot, EventDispatcher |
| EventDispatcher | EventDispatcher.ts | Central registry for event handlers; publishes events after persistence | AggregateRoot, DomainEvent | Application services |

### Dependency Flow Summary

The classes form a clear hierarchy from foundational to composite:

1. **Foundation**: Result, Guard, UUID, ValueObject (standalone validation and data concepts)
2. **Identification**: Identifier, UniqueEntityID (typed ID wrappers)
3. **Domain Objects**: Entity, AggregateRoot (identifiable domain objects)
4. **Events**: DomainEvent, EventDispatcher (business action recording and publishing)

This ordering ensures that lower-level classes are reusable and do not depend on higher-level concepts, while higher-level concepts build on stable foundations.
