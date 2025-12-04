# Network Monitoring Platform - Architecture Documentation

## Executive Summary

This document describes the architecture of a **full-stack network monitoring platform** designed for small and medium Internet Service Providers (ISPs). The system provides real-time supervision of network infrastructure including access points, routers, radios, switches, and backbone links. It monitors critical metrics such as availability, latency, packet loss, bandwidth usage, and device health, triggering alerts when thresholds are exceeded.

The platform is built using **Domain-Driven Design (DDD)** and **Clean Architecture** principles to ensure scalability, modularity, and long-term maintainability. The ultimate goal is to offer this as a **SaaS solution** for rural ISPs.

### Key Characteristics

- **Domain-Driven Design**: Strategic and tactical patterns applied throughout
- **Clean Architecture**: Strict dependency rules with layers pointing inward
- **Event-Driven**: Asynchronous event processing for monitoring and notifications
- **Type-Safe**: Full TypeScript implementation with strict mode
- **Functional Error Handling**: Result pattern instead of exceptions
- **Multi-Protocol Support**: ICMP, SNMP, SSH, HTTP/HTTPS monitoring

---

## Table of Contents

1. [System Context](#system-context)
2. [Architectural Style](#architectural-style)
3. [Layered Architecture](#layered-architecture)
4. [Component Architecture](#component-architecture)
5. [Domain Model Overview](#domain-model-overview)
6. [Data Flow](#data-flow)
7. [Technology Stack](#technology-stack)
8. [Architectural Decisions](#architectural-decisions)
9. [Infrastructure & Deployment](#infrastructure--deployment)
10. [Security Architecture](#security-architecture)
11. [Scalability & Performance](#scalability--performance)
12. [Future Evolution](#future-evolution)

---

## System Context

### System Purpose

The Network Monitoring Platform serves as a comprehensive network operations center (NOC) tool for ISPs, providing:

1. **Real-time Monitoring**: Continuous health checks of network devices
2. **Alert Management**: Multi-channel notifications (email, dashboard, SMS, Telegram)
3. **Inventory Tracking**: Device lifecycle management from purchase to decommission
4. **Maintenance Coordination**: Technician workload management
5. **Performance Analytics**: Historical data and trend analysis
6. **Business Integration**: Billing and payment platform connectivity
7. **Coverage Mapping**: Geographic visualization of network infrastructure

### External System Integration

```mermaid
graph TB
    subgraph "External Systems"
        EMAIL[SMTP Email Service]
        DB[(PostgreSQL Database)]
        DEVICES[Network Devices<br/>Routers, APs, Switches]
        BILLING[Billing Platforms]
        MAPS[Map Services]
        SMS[SMS/Telegram APIs]
    end

    subgraph "Network Monitoring Platform"
        API[REST API / WebSocket]
        MONITOR[Monitoring Engine]
        NOTIFIER[Notification Service]
        SCHEDULER[Job Scheduler]
    end

    DEVICES -->|ICMP/SNMP/SSH| MONITOR
    MONITOR -->|Store Metrics| DB
    MONITOR -->|Device Events| NOTIFIER
    NOTIFIER -->|Send Alerts| EMAIL
    NOTIFIER -.->|Future| SMS
    API -->|Query/Command| DB
    SCHEDULER -->|Trigger| MONITOR
    API -.->|Integration| BILLING
    API -.->|Coverage Data| MAPS

    style API fill:#e1f5ff
    style MONITOR fill:#fff4e1
    style NOTIFIER fill:#ffe1f5
    style SCHEDULER fill:#e1ffe1
```

### User Actors

| Actor                    | Responsibilities                                             | Primary Interactions  |
| ------------------------ | ------------------------------------------------------------ | --------------------- |
| **System Administrator** | Configure monitoring, manage users, set thresholds           | Web Dashboard, API    |
| **Network Technician**   | Respond to alerts, perform maintenance, update device status | Mobile App, Dashboard |
| **NOC Operator**         | Monitor real-time status, acknowledge alerts                 | Dashboard, WebSocket  |
| **Business Manager**     | View reports, analyze trends, billing integration            | Dashboard, Reports    |
| **System (Automated)**   | Execute polling, trigger alerts, log events                  | Background Services   |

---

## Architectural Style

### Clean Architecture + Domain-Driven Design

The system follows a **layered hexagonal architecture** with strict dependency rules:

```mermaid
graph TB
    subgraph "Presentation Layer"
        HTTP[HTTP Controllers]
        WS[WebSocket Gateway]
        VALIDATORS[Zod Validators]
        ROUTES[Route Definitions]
    end

    subgraph "Application Layer"
        USECASES[Use Cases]
        APPSERVICES[Application Services]
        POLLER[Polling Services]
        SCHEDULER[Schedulers]
    end

    subgraph "Domain Layer"
        ENTITIES[Entities]
        VOS[Value Objects]
        AGGREGATES[Aggregate Roots]
        DOMAINSERVICES[Domain Services]
        EVENTS[Domain Events]
    end

    subgraph "Infrastructure Layer"
        REPOS[Repository Implementations]
        PRISMA[Prisma ORM]
        EXTERNAL[External Services<br/>Email, SNMP, SSH]
        CACHE[Caching]
    end

    HTTP --> USECASES
    WS --> USECASES
    VALIDATORS --> HTTP
    ROUTES --> HTTP

    USECASES --> ENTITIES
    APPSERVICES --> ENTITIES
    POLLER --> ENTITIES
    SCHEDULER --> ENTITIES

    USECASES --> REPOS
    REPOS --> PRISMA
    REPOS --> EXTERNAL

    ENTITIES --> VOS
    AGGREGATES --> ENTITIES
    AGGREGATES --> EVENTS

    style ENTITIES fill:#90EE90
    style VOS fill:#90EE90
    style AGGREGATES fill:#90EE90
    style USECASES fill:#87CEEB
    style REPOS fill:#FFB6C1
```

### Dependency Rule

**Inner layers NEVER depend on outer layers**:

- Domain Layer: No external dependencies (pure business logic)
- Application Layer: Depends only on Domain
- Infrastructure Layer: Implements interfaces defined by Application/Domain
- Presentation Layer: Orchestrates Use Cases, depends on Application

---

## Layered Architecture

### 1. Domain Layer (`/src/domain/`)

The **heart of the system** containing pure business logic with zero external dependencies.

#### Structure

```
domain/
├── entities/               # Business entities with identity
│   ├── Supplier.ts        # Supplier aggregate root
│   ├── DeviceModel.ts     # Device model catalog
│   └── NetworkDevice.ts   # Network device (stub)
├── value-objects/         # Immutable domain concepts
│   ├── Email.ts          # RFC-compliant email validation
│   ├── PhoneNumber.ts    # E.164 phone number
│   └── Address.ts        # Full address representation
├── repository/           # Repository interfaces (contracts)
├── services/            # Domain services (complex business logic)
└── shared/              # DDD building blocks
    ├── kernel/          # Base classes (Entity, VO, AggregateRoot)
    ├── interfaces/      # Core interfaces
    ├── events/         # Domain event definitions
    └── types/          # Domain type definitions
```

#### Domain Kernel

The kernel provides foundational DDD building blocks:

**Entity Base Class** ([src/domain/shared/kernel/Entity.ts](src/domain/shared/kernel/Entity.ts))

```typescript
export abstract class Entity<T> {
  protected readonly _id: UniqueEntityID;
  public readonly props: T;

  equals(object?: Entity<T>): boolean {
    // Identity-based equality
  }
}
```

**Value Object Base Class** ([src/domain/shared/kernel/ValueObject.ts](src/domain/shared/kernel/ValueObject.ts))

```typescript
export abstract class ValueObject<T> {
  public readonly props: T;

  equals(vo?: ValueObject<T>): boolean {
    // Structural equality based on props
  }
}
```

**Aggregate Root** ([src/domain/shared/kernel/AggregateRoot.ts](src/domain/shared/kernel/AggregateRoot.ts))

```typescript
export abstract class AggregateRoot<T> extends Entity<T> {
  private _domainEvents: DomainEvent[] = [];

  addDomainEvent(domainEvent: DomainEvent): void;
  clearEvents(): void;
  getDomainEvents(): DomainEvent[];
}
```

**Result Type** ([src/domain/shared/kernel/Result.ts](src/domain/shared/kernel/Result.ts))

```typescript
export class Result<T> {
  public isSuccess: boolean;
  public error: string;
  public value: T;

  static ok<U>(value?: U): Result<U>;
  static fail<U>(error: string): Result<U>;
  static combine(results: Result<any>[]): Result<any>;
}
```

**Guard Validations** ([src/domain/shared/kernel/Guard.ts](src/domain/shared/kernel/Guard.ts))

Comprehensive validation utilities:

- `againstNullOrUndefined()` - Null/undefined checks
- `againstNullOrUndefinedBulk()` - Bulk validation
- `inRange()` - Numeric range validation
- `againstAtLeast()` / `againstAtMost()` - String length
- `isString()` / `isNumber()` / `isBoolean()` / `isDate()` - Type guards
- `isValidEmail()` - Email format validation
- `greaterThan()` - Comparison validation
- `combine()` - Combine multiple guard results

#### Domain Entities

**Supplier Aggregate** ([src/domain/entities/Supplier.ts](src/domain/entities/Supplier.ts))

```typescript
interface SupplierProps {
  name: string;
  contactEmail: Email;
  contactPhone: PhoneNumber;
  address: Address;
  website?: string;
  isActive: boolean;
}

class Supplier extends AggregateRoot<SupplierProps> {
  static create(props: SupplierProps): Result<Supplier>;

  activate(): void;
  deactivate(): void;
  updateContactInfo(email: Email, phone: PhoneNumber): Result<void>;
}
```

**Business Rules**:

- Supplier must have valid contact email and phone
- Website URL must be valid if provided
- Name cannot be empty
- Only active suppliers can receive purchase orders

#### Domain Value Objects

**Email** ([src/domain/value-objects/Email.ts](src/domain/value-objects/Email.ts))

```typescript
class Email extends ValueObject<EmailProps> {
  private static readonly MAX_LENGTH = 320;
  private static readonly LOCAL_PART_MAX = 64;
  private static readonly DOMAIN_MAX = 255;

  static create(email: string): Result<Email>;

  toString(): string;
}
```

**Invariants**:

- Must follow RFC email format
- Total length ≤ 320 characters
- Local part ≤ 64 characters
- Domain part ≤ 255 characters
- Normalized (trimmed, lowercase)

**PhoneNumber** ([src/domain/value-objects/PhoneNumber.ts](src/domain/value-objects/PhoneNumber.ts))

```typescript
class PhoneNumber extends ValueObject<PhoneNumberProps> {
  static create(
    phoneNumber: string,
    defaultCountry?: string
  ): Result<PhoneNumber>;

  isMobile(): boolean;
  isFixedLine(): boolean;
  canReceiveSMS(): boolean;
  formatFor(country: string): string;
  toE164(): string;
  toURI(): string;
}
```

**Features**:

- Uses `libphonenumber-js` for validation
- Supports international formats
- Stores in E.164 format
- Type detection (mobile, fixed-line)
- Country-specific formatting

**Address** ([src/domain/value-objects/Address.ts](src/domain/value-objects/Address.ts))

```typescript
interface AddressProps {
  street: string;
  houseNumber?: string;
  city: string;
  province: string;
  postalCode?: string;
  country: string;
  complement?: string;
  neighborhood?: string;
}

class Address extends ValueObject<AddressProps> {
  static create(props: AddressProps): Result<Address>;

  getFullAddress(): string;
  getShortAddress(): string;
}
```

---

### 2. Application Layer (`/src/application/`)

Orchestrates domain objects to implement use cases. Contains no business logic—only coordination.

#### Structure

```
application/
├── network-device/
│   └── use-cases/           # CRUD operations for network devices
│       ├── CreateNetworkDeviceUseCase.ts
│       ├── GetNetworkDeviceUseCase.ts
│       ├── UpdateNetworkDeviceUseCase.ts
│       └── NetworkDevice.service.ts

```

---

### 3. Infrastructure Layer (`/src/infrastructure/`)

Implements technical capabilities—database, external APIs, protocols.

#### Structure

```
infrastructure/
├── repositories/           # Prisma implementations
│   ├── PrismaNetworkDeviceRepository.ts
│   ├── PrismaSupplierRepository.ts
│   ├── PrismaDeviceModelRepository.ts
│   ├── PrismaDeviceRepository.ts
│   ├── PrismaLocationRepository.ts
│   ├── PrismaAccessPointRepository.ts
│   ├── PrismaRadioAntennaRepository.ts
│   ├── PrismaLinkRepository.ts
│   ├── PrismaDeviceSoftwareRepository.ts
│   ├── PrismaTechnicianRepository.ts
│   ├── PrismaDeviceMaintenanceLogRepository.ts
│   ├── PrismaDeviceSecurityRepository.ts
│   ├── PrismaDeviceLogsRepository.ts
│   ├── PrismaDeviceEnergyRepository.ts
│   └── PrismaDeviceMonitoringRepository.ts
├── external/              # Third-party integrations
│   ├── email/            # SMTP email service
│   ├── snmp/             # SNMP protocol handlers
│   └── ssh/              # SSH communication
├── mappers/              # DTO ↔ Domain mapping
├── cache/                # Caching layer
└── persistance/          # Database configuration
```

#### Repository Pattern

All repositories implement interfaces defined in the domain layer:

```typescript
interface INetworkDeviceRepository {
  findById(id: string): Promise<NetworkDevice | null>;
  save(device: NetworkDevice): Promise<void>;
  delete(id: string): Promise<void>;
  findAll(): Promise<NetworkDevice[]>;
  findByStatus(status: NetworkDeviceStatus): Promise<NetworkDevice[]>;
}
```

**Benefits**:

- Domain layer independent of database
- Easy to swap ORM or database
- Testable with in-memory implementations
- Repository can aggregate data from multiple sources

#### External Services

**Email Service** ([src/infrastructure/external/email/](src/infrastructure/external/email/))

- SMTP integration via Nodemailer
- Template-based emails
- HTML and plain text support
- Attachment support

**SNMP Service** (Planned - [src/infrastructure/external/snmp/](src/infrastructure/external/snmp/))

- SNMP v2c and v3 support
- MIB parsing
- Bulk data collection
- Trap handling

**SSH Service** (Planned - [src/infrastructure/external/ssh/](src/infrastructure/external/ssh/))

- Device configuration retrieval
- Command execution
- SCP file transfer
- Key-based authentication

---

### 4. Presentation Layer (`/src/presentation/`)

Exposes the system to external consumers via REST API and WebSockets.

#### Structure

```
presentation/
├── http/
│   ├── controllers/       # HTTP request handlers
│   │   └── network-device/
│   │       ├── CreateNetworkDeviceController.ts
│   │       ├── GetNetworkDeviceController.ts
│   │       └── UpdateNetworkDeviceController.ts
│   ├── routes/           # Route definitions
│   │   ├── networkDeviceRoutes.ts
│   │   └── index.ts
│   ├── validators/       # Zod schemas
│   │   ├── networkDevice.validator.ts
│   │   └── link.validator.ts
│   ├── middleware/       # Express middleware
│   └── error-handlers/   # Error handling
└── websocket/           # WebSocket gateway
    ├── gateway.ts
    ├── events/          # Event definitions
    └── handlers/        # Event handlers
```

#### Validation Strategy

All input validation uses **Zod** for type-safe runtime validation:

**Network Device Validator** ([src/presentation/http/validators/networkDevice.validator.ts](src/presentation/http/validators/networkDevice.validator.ts))

```typescript
const CreateNetworkDeviceSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.nativeEnum(NetworkDeviceRole),
  ipAddress: z.string().ip(),
  macAddress: z
    .string()
    .regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/),
  connectivityType: z.nativeEnum(ConnectivityType),
  managementProtocol: z.nativeEnum(ManagementProtocol),
  managementPort: z.number().int().min(1).max(65535),
  deviceId: z.string().uuid()
});

const UpdateNetworkDeviceSchema = CreateNetworkDeviceSchema.partial();

const ListNetworkDevicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(NetworkDeviceStatus).optional(),
  type: z.nativeEnum(NetworkDeviceRole).optional()
});
```

**Benefits**:

- Automatic TypeScript type inference
- Runtime validation at API boundary
- Clear error messages
- Composable schemas
- Prevents invalid data from reaching domain

#### Controller Pattern

Controllers are thin adapters that:

1. Validate input (Zod)
2. Execute use case
3. Map result to HTTP response
4. Handle errors

```typescript
class CreateNetworkDeviceController {
  constructor(
    private createNetworkDeviceUseCase: CreateNetworkDeviceUseCase
  ) {}

  async handle(req: Request, res: Response): Promise<Response> {
    const validation = CreateNetworkDeviceSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ errors: validation.error });
    }

    const result = await this.createNetworkDeviceUseCase.execute(
      validation.data
    );

    if (result.isSuccess) {
      return res.status(201).json(result.value);
    }

    return res.status(400).json({ error: result.error });
  }
}
```

---

## Component Architecture

### Monitoring Engine

The core monitoring system is event-driven and horizontally scalable.

```mermaid
graph LR
    subgraph "Monitoring Engine"
        SCHEDULER[Polling Scheduler]
        QUEUE[Polling Queue]
        WORKERS[Worker Pool]
        COLLECTOR[Metrics Collector]
    end

    subgraph "Protocols"
        ICMP[ICMP Handler]
        SNMP[SNMP Handler]
        SSH[SSH Handler]
        HTTP[HTTP Handler]
    end

    subgraph "Storage"
        TIMESERIES[(Time-Series Metrics)]
        EVENTS[(Event Log)]
        STATE[(Device State)]
    end

    SCHEDULER -->|Enqueue| QUEUE
    QUEUE -->|Dispatch| WORKERS
    WORKERS -->|Protocol Selection| ICMP
    WORKERS -->|Protocol Selection| SNMP
    WORKERS -->|Protocol Selection| SSH
    WORKERS -->|Protocol Selection| HTTP

    ICMP -->|Metrics| COLLECTOR
    SNMP -->|Metrics| COLLECTOR
    SSH -->|Metrics| COLLECTOR
    HTTP -->|Metrics| COLLECTOR

    COLLECTOR -->|Store| TIMESERIES
    COLLECTOR -->|Log| EVENTS
    COLLECTOR -->|Update| STATE

    style WORKERS fill:#90EE90
    style COLLECTOR fill:#FFB6C1
```

### Protocol Abstraction

```typescript
interface IDevicePoller {
  poll(device: NetworkDevice): Promise<PollingResult>;
  supportsProtocol(protocol: ManagementProtocol): boolean;
}

class ICMPPoller implements IDevicePoller {
  async poll(device: NetworkDevice): Promise<PollingResult> {
    // Ping implementation
  }

  supportsProtocol(protocol: ManagementProtocol): boolean {
    return protocol === ManagementProtocol.ICMP;
  }
}

class SNMPPoller implements IDevicePoller {
  async poll(device: NetworkDevice): Promise<PollingResult> {
    // SNMP implementation
  }

  supportsProtocol(protocol: ManagementProtocol): boolean {
    return [ManagementProtocol.SNMP].includes(protocol);
  }
}
```

### Notification Engine

```mermaid
graph TB
    subgraph "Event Sources"
        MONITOR[Monitoring Engine]
        MANUAL[Manual Alerts]
        SCHEDULED[Scheduled Reports]
    end

    subgraph "Notification Engine"
        ROUTER[Alert Router]
        FILTER[Filter Rules]
        FORMATTER[Message Formatter]
        QUEUE[Delivery Queue]
    end

    subgraph "Channels"
        EMAIL[Email Service]
        SMS[SMS Service]
        TELEGRAM[Telegram Bot]
        WEBHOOK[Webhooks]
        DASHBOARD[Dashboard Updates]
    end

    MONITOR -->|Device Events| ROUTER
    MANUAL -->|User Alerts| ROUTER
    SCHEDULED -->|Reports| ROUTER

    ROUTER --> FILTER
    FILTER -->|Apply Rules| FORMATTER
    FORMATTER -->|Template| QUEUE

    QUEUE --> EMAIL
    QUEUE --> SMS
    QUEUE --> TELEGRAM
    QUEUE --> WEBHOOK
    QUEUE --> DASHBOARD

    style ROUTER fill:#FFE4B5
    style FILTER fill:#FFB6C1
    style FORMATTER fill:#DDA0DD
```

---

## Domain Model Overview

### Database Schema

The system uses **PostgreSQL** with **Prisma ORM**. The schema is normalized to 3NF with clear aggregate boundaries.

```mermaid
erDiagram
    Supplier ||--o{ DeviceModel : supplies
    Supplier ||--o{ PurchaseOrder : places
    DeviceModel ||--o{ Device : "is instance of"
    PurchaseOrder ||--o{ Device : contains
    Device ||--|| Location : "located at"
    Device ||--|| NetworkDevice : "logical representation"
    NetworkDevice ||--|| RadioAntenna : "may have"
    NetworkDevice ||--|| DeviceSoftware : "runs"
    NetworkDevice ||--o{ DeviceMaintenanceLog : "has logs"
    NetworkDevice ||--|| DeviceSecurity : credentials
    NetworkDevice ||--o{ DeviceLogs : "system logs"
    NetworkDevice ||--|| DeviceEnergy : "power metrics"
    NetworkDevice ||--|| DeviceMonitoring : "health data"
    RadioAntenna ||--|| AccessPoint : "configured as"
    AccessPoint ||--|| Link : "source of"
    RadioAntenna ||--|| Link : "destination of"
    DeviceMaintenanceLog }o--|| Technician : "performed by"
```

### Aggregate Boundaries

#### 1. **Supplier Aggregate**

**Root**: Supplier
**Entities**: None
**Value Objects**: Email, PhoneNumber, Address

**Responsibilities**:

- Manage supplier information
- Track active/inactive status
- Provide contact details

**Invariants**:

- Must have valid contact information
- Name cannot be empty
- Only active suppliers can be assigned to purchase orders

---

#### 2. **Device Catalog Aggregate**

**Root**: DeviceModel
**Entities**: None
**Value Objects**: None

**Responsibilities**:

- Maintain device specifications
- Associate with suppliers
- Define supported features

**Invariants**:

- Model name must be unique per manufacturer
- Must have at least one supplier

---

#### 3. **Physical Device Aggregate**

**Root**: Device
**Entities**: Location
**Value Objects**: None

**Responsibilities**:

- Track physical hardware
- Manage warranty and ownership
- Associate with purchase orders

**Invariants**:

- Serial number must be unique
- Must be associated with a device model
- Must have a location if active

---

#### 4. **Network Device Aggregate** (Primary Monitoring Aggregate)

**Root**: NetworkDevice
**Entities**:

- RadioAntenna
- AccessPoint
- Link (association)

**Value Objects**: None (IP addresses validated at boundary)

**Children (1:1)**:

- DeviceSoftware
- DeviceSecurity
- DeviceEnergy
- DeviceMonitoring

**Children (1:N)**:

- DeviceMaintenanceLog
- DeviceLogs

**Responsibilities**:

- Represent logical network node
- Manage configuration
- Track operational status
- Store monitoring data
- Maintain security credentials

**Invariants**:

- IP address must be unique
- MAC address must be unique
- Must be associated with a physical device
- Management port must be valid (1-65535)
- Credentials required for remote management

---

#### 5. **Maintenance Aggregate**

**Root**: DeviceMaintenanceLog
**Entities**: Technician
**Value Objects**: None

**Responsibilities**:

- Record maintenance activities
- Track technician assignments
- Categorize maintenance types

**Invariants**:

- Must be associated with a network device
- Must have a technician assigned
- Date cannot be in the future

---

### Enumerations

The system uses extensive enumerations for type safety:

| Enum                    | Values                                                                             | Purpose                        |
| ----------------------- | ---------------------------------------------------------------------------------- | ------------------------------ |
| **DeviceType**          | ROUTER, SWITCH, RADIO, FIREWALL, SERVER, MODEM, ONT, OLT, WIRELESS, SECURITY, EDGE | Physical device classification |
| **NetworkDeviceRole**   | ROUTING, SWITCHING, WIRELESS_ACCESS, FIREWALL, VPN, MONITORING, etc.               | Logical network function       |
| **Vendors**             | MIKROTIK, UBIQUITI, MIMOSA, CISCO, ARUBA, etc.                                     | Device manufacturers           |
| **OperatingSystems**    | ROUTEROS, IOS, JUNOS, AIROS, UNIFI_OS, etc.                                        | Device firmware/OS             |
| **ConnectivityType**    | ETHERNET, FIBER_OPTIC, WIRELESS, DSL, SATELLITE                                    | Connection medium              |
| **ManagementProtocol**  | SNMP, SSH, TELNET, HTTP, HTTPS                                                     | Device management method       |
| **NetworkDeviceStatus** | ONLINE, OFFLINE, MAINTENANCE                                                       | Current operational state      |
| **DeviceStatus**        | ACTIVE, INACTIVE, DEGRADED, MAINTENANCE, OUT_OF_SERVICE, DAMAGED                   | Physical device state          |
| **MaintenanceType**     | PREVENTIVE, CORRECTIVE, PREDICTIVE, EMERGENCY                                      | Maintenance classification     |
| **LogLevel**            | INFO, WARNING, ERROR, CRITICAL                                                     | System log severity            |
| **EnergySourceType**    | SOLAR, BATTERY, MAINS, GENERATOR, POE                                              | Power source                   |

---

## Data Flow

### Request Flow (REST API)

```mermaid
sequenceDiagram
    participant Client
    participant Route
    participant Validator
    participant Controller
    participant UseCase
    participant Domain
    participant Repository
    participant Database

    Client->>Route: POST /api/network-devices
    Route->>Validator: Validate request body (Zod)

    alt Validation fails
        Validator-->>Client: 400 Bad Request
    end

    Validator->>Controller: Valid DTO
    Controller->>UseCase: Execute command
    UseCase->>Domain: Create entity

    alt Business rule violation
        Domain-->>UseCase: Result.fail(error)
        UseCase-->>Controller: Failed result
        Controller-->>Client: 400 Bad Request
    end

    Domain->>Domain: Validate invariants
    Domain-->>UseCase: Result.ok(entity)
    UseCase->>Repository: Save entity
    Repository->>Database: INSERT
    Database-->>Repository: Success
    Repository-->>UseCase: void
    UseCase-->>Controller: Result.ok(dto)
    Controller-->>Client: 201 Created
```

### Monitoring Data Flow

```mermaid
sequenceDiagram
    participant Scheduler
    participant PollerService
    participant Protocol
    participant Device
    participant Repository
    participant EventBus
    participant Notifier

    loop Every polling interval
        Scheduler->>PollerService: Trigger poll
        PollerService->>Protocol: poll(device)
        Protocol->>Device: Execute health check

        alt Device responds
            Device-->>Protocol: Metrics data
            Protocol-->>PollerService: PollingResult (success)
            PollerService->>Repository: Save metrics
            PollerService->>EventBus: Emit 'device-online'
        else Device timeout
            Device-->>Protocol: Timeout
            Protocol-->>PollerService: PollingResult (failure)
            PollerService->>Repository: Save failure
            PollerService->>EventBus: Emit 'device-offline'
            EventBus->>Notifier: DeviceOfflineEvent
            Notifier->>Notifier: Check alert rules
            Notifier->>Notifier: Send email/SMS
        end
    end
```

### Event Processing Flow

```mermaid
graph LR
    subgraph "Event Producers"
        DOMAIN[Domain Events]
        APP[Application Events]
    end

    subgraph "Event Bus"
        DISPATCHER[Event Dispatcher]
        QUEUE[Event Queue]
    end

    subgraph "Event Handlers"
        NOTIFICATION[Notification Handler]
        LOGGING[Logging Handler]
        ANALYTICS[Analytics Handler]
        SYNC[Data Sync Handler]
    end

    DOMAIN --> DISPATCHER
    APP --> DISPATCHER

    DISPATCHER --> QUEUE
    QUEUE --> NOTIFICATION
    QUEUE --> LOGGING
    QUEUE --> ANALYTICS
    QUEUE --> SYNC

    style DISPATCHER fill:#FFB6C1
    style QUEUE fill:#DDA0DD
```

---

## Technology Stack

### Runtime & Language

| Technology     | Version       | Purpose                   |
| -------------- | ------------- | ------------------------- |
| **Node.js**    | 24.x (Alpine) | Runtime environment       |
| **TypeScript** | 5.8.2         | Type-safe development     |
| **ES Modules** | -             | Modern JavaScript modules |

### Core Dependencies

| Dependency            | Version | Purpose                   |
| --------------------- | ------- | ------------------------- |
| **@prisma/client**    | 7.0.0   | Type-safe database client |
| **Zod**               | 4.1.13  | Schema validation         |
| **dotenv**            | 16.4.7  | Environment configuration |
| **Nodemailer**        | 7.0.10  | Email delivery            |
| **ping**              | 0.4.4   | ICMP network monitoring   |
| **libphonenumber-js** | 1.12.29 | Phone number validation   |
| **Winston**           | 3.17.0  | Structured logging        |

### Development Tools

| Tool           | Version | Purpose                    |
| -------------- | ------- | -------------------------- |
| **Jest**       | 29.5.14 | Testing framework          |
| **ts-jest**    | 29.4.5  | TypeScript testing         |
| **ESLint**     | 9.21.0  | Code linting               |
| **Prettier**   | 3.5.3   | Code formatting            |
| **tsx**        | 4.19.3  | Dev server with hot reload |
| **Prisma CLI** | 6.19.0  | Database migrations        |

### Infrastructure

| Component         | Technology     | Purpose                    |
| ----------------- | -------------- | -------------------------- |
| **Database**      | PostgreSQL     | Primary data store         |
| **ORM**           | Prisma         | Type-safe database access  |
| **Container**     | Docker         | Containerization           |
| **Orchestration** | Docker Compose | Multi-container management |

### Build & Deployment

```bash
# Development
npm run dev          # Hot-reload development server
npm run test         # Run test suite
npm run lint         # Check code quality

# Production Build
npm run build        # Compile TypeScript
npm start            # Start production server

# Database
npx prisma migrate dev     # Apply migrations
npx prisma generate        # Generate Prisma client
npx prisma studio          # Visual database browser
```

### Docker Configuration

**Multi-stage build** for optimized production images:

```dockerfile
# Stage 1: Build
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: Production
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
RUN npm install --omit=dev
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**Benefits**:

- Smaller production image
- No dev dependencies in production
- Cached layer optimization
- Security through minimal attack surface

---

## Architectural Decisions

### ADR-001: Domain-Driven Design

**Status**: Accepted

**Context**:
Network monitoring involves complex business rules, multiple device types, and evolving requirements. Traditional CRUD approaches lead to anemic domain models and business logic scattered across services.

**Decision**:
Adopt Domain-Driven Design with tactical patterns (entities, value objects, aggregates, domain events) and strategic patterns (bounded contexts, ubiquitous language).

**Consequences**:
✅ **Pros**:

- Business logic centralized in domain layer
- Clear aggregate boundaries prevent data inconsistencies
- Ubiquitous language shared between developers and domain experts
- Highly testable domain logic

❌ **Cons**:

- Steeper learning curve for developers
- More boilerplate code
- Requires domain expertise

**Alternatives Considered**:

- Transaction Script (rejected: doesn't scale with complexity)
- Anemic Domain Model (rejected: scatters business logic)

---

### ADR-002: Clean Architecture

**Status**: Accepted

**Context**:
Need to isolate business logic from infrastructure concerns to enable independent evolution, testing, and technology changes.

**Decision**:
Implement strict layered architecture with dependency inversion. Inner layers (domain) have zero dependencies on outer layers (infrastructure, presentation).

**Consequences**:
✅ **Pros**:

- Domain logic independent of frameworks
- Easy to swap databases, protocols, or APIs
- Highly testable (in-memory implementations)
- Clear separation of concerns

❌ **Cons**:

- More interfaces and abstractions
- Mapping between layers
- Initial development overhead

---

### ADR-003: Result Pattern for Error Handling

**Status**: Accepted

**Context**:
Exceptions are expensive and make control flow implicit. Expected business rule violations (e.g., "device already exists") shouldn't use exceptions.

**Decision**:
Use `Result<T>` type for operations that can fail predictably. Reserve exceptions for truly exceptional conditions (network failures, disk full, etc.).

**Consequences**:
✅ **Pros**:

- Explicit error handling
- Type-safe error propagation
- Composable results
- No hidden control flow

❌ **Cons**:

- More verbose than exceptions
- Requires discipline to use consistently

**Example**:

```typescript
// Instead of:
try {
  const device = await createDevice(data);
} catch (error) {
  // Handle error
}

// Use:
const result = await createDeviceUseCase.execute(data);
if (result.isSuccess) {
  const device = result.value;
} else {
  const error = result.error;
}
```

---

### ADR-004: Event-Driven Monitoring

**Status**: Accepted

**Context**:
Monitoring requires real-time processing of thousands of device status changes. Synchronous request-response doesn't scale.

**Decision**:
Use event-driven architecture with EventEmitter for in-process events. Future: migrate to message queue (RabbitMQ/Kafka) for distributed processing.

**Consequences**:
✅ **Pros**:

- Decoupled components
- Asynchronous processing
- Easy to add new event handlers
- Horizontal scalability (with message queue)

❌ **Cons**:

- Eventually consistent
- Harder to debug
- Requires event versioning strategy

---

### ADR-005: Prisma ORM

**Status**: Accepted

**Context**:
Need type-safe database access with good TypeScript integration, migrations, and schema management.

**Decision**:
Use Prisma as ORM instead of TypeORM, Sequelize, or raw SQL.

**Consequences**:
✅ **Pros**:

- Excellent TypeScript support (auto-generated types)
- Type-safe query builder
- Migration system
- Prisma Studio for visual database browsing
- Good performance

❌ **Cons**:

- Less flexibility than raw SQL
- Generated client adds dependency
- Learning curve for Prisma-specific syntax

**Alternatives Considered**:

- TypeORM (rejected: weaker TypeScript support)
- Sequelize (rejected: older, less type-safe)
- Raw SQL with query builders (rejected: more boilerplate)

---

### ADR-006: Zod for Validation

**Status**: Accepted

**Context**:
Need runtime validation at API boundaries with TypeScript type inference.

**Decision**:
Use Zod for all input validation in the presentation layer.

**Consequences**:
✅ **Pros**:

- Runtime type safety
- Automatic TypeScript type inference
- Composable schemas
- Clear error messages
- Single source of truth for types

❌ **Cons**:

- Additional dependency
- Validation logic coupled to Zod

**Example**:

```typescript
const schema = z.object({
  name: z.string().min(1).max(255),
  ipAddress: z.string().ip()
});

type Input = z.infer<typeof schema>; // Automatic type inference
```

---

### ADR-007: Value Objects for Primitives

**Status**: Accepted

**Context**:
Email addresses, phone numbers, and addresses have complex validation rules that shouldn't be duplicated.

**Decision**:
Create dedicated value objects for domain concepts instead of primitive strings.

**Consequences**:
✅ **Pros**:

- Validation centralized
- Type safety (can't assign string to Email)
- Domain concepts as first-class objects
- Immutability guaranteed

❌ **Cons**:

- More classes to maintain
- Mapping overhead at boundaries

**Example**:

```typescript
// Instead of:
interface Supplier {
  email: string; // Any string, no validation
}

// Use:
interface Supplier {
  email: Email; // Guaranteed valid email
}
```

---

### ADR-008: Multi-Protocol Poller

**Status**: Accepted

**Context**:
Different devices support different management protocols (ICMP, SNMP, SSH, HTTP).

**Decision**:
Implement protocol abstraction with strategy pattern. Each device specifies preferred protocol.

**Consequences**:
✅ **Pros**:

- Protocol-agnostic polling service
- Easy to add new protocols
- Device-specific optimization

❌ **Cons**:

- More complexity than single protocol
- Each protocol requires separate implementation

---

### ADR-009: Polling Frequency Management

**Status**: Accepted

**Context**:
Different devices require different polling intervals (critical devices every 10s, others every 60s).

**Decision**:
Support both global and per-device polling intervals with runtime updates.

**Consequences**:
✅ **Pros**:

- Flexible monitoring strategy
- Reduced network load
- No restart required for changes

❌ **Cons**:

- More complex scheduler
- Potential race conditions

---

## Infrastructure & Deployment

### Environment Configuration

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/network_monitoring"

# Email (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
EMAIL_USER="alerts@example.com"
EMAIL_PASS="app-password"
EMAIL_TARGET="admin@example.com"

# Monitoring
HOSTS="192.168.1.1,192.168.1.2,10.0.0.1"

# Application
NODE_ENV="production"
PORT=3000
LOG_LEVEL="info"
```

### Database Migrations

Prisma migrations are version-controlled:

```
prisma/migrations/
├── 20250101000000_init/
├── 20250102000000_enum_improvements/
└── 20250103000000_uuid_identifiers/
```

**Migration Workflow**:

```bash
# Development
npx prisma migrate dev --name feature_name

# Production
npx prisma migrate deploy
```

### Deployment Architecture

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[Nginx / Traefik]
    end

    subgraph "Application Tier"
        API1[API Server 1]
        API2[API Server 2]
        POLLER1[Poller Service 1]
        POLLER2[Poller Service 2]
    end

    subgraph "Data Tier"
        DB[(PostgreSQL Primary)]
        DBREPLICA[(PostgreSQL Replica)]
        REDIS[(Redis Cache)]
    end

    subgraph "External Services"
        EMAIL[Email Service]
        SNMP[Network Devices]
    end

    LB --> API1
    LB --> API2

    API1 --> DB
    API2 --> DB
    API1 --> REDIS
    API2 --> REDIS

    POLLER1 --> DB
    POLLER2 --> DB
    POLLER1 --> SNMP
    POLLER2 --> SNMP

    DB --> DBREPLICA

    API1 --> EMAIL
    POLLER1 --> EMAIL

    style LB fill:#FFE4B5
    style DB fill:#90EE90
    style REDIS fill:#FFB6C1
```

### Scalability Strategy

**Horizontal Scaling**:

- Stateless API servers (scale behind load balancer)
- Multiple poller instances (distribute devices)
- Read replicas for reporting queries

**Vertical Scaling**:

- Database resources (CPU, RAM, SSD)
- Connection pooling
- Query optimization

**Caching Strategy**:

- Device configuration (Redis, TTL 5 minutes)
- Aggregated metrics (Redis, TTL 1 minute)
- User sessions (Redis)

---

## Security Architecture

### Authentication & Authorization

**Planned Implementation**:

- JWT-based authentication
- Role-based access control (RBAC)
- API key authentication for integrations

**Roles**:
| Role | Permissions |
|------|-------------|
| **System Administrator** | Full access |
| **Network Manager** | Read/write devices, settings |
| **Technician** | Read devices, update maintenance logs |
| **Viewer** | Read-only access to dashboards |

### Data Security

**At Rest**:

- Encrypted database (PostgreSQL TDE)
- Encrypted SNMP community strings
- Hashed passwords (bcrypt)

**In Transit**:

- HTTPS/TLS for API
- WSS for WebSocket
- SNMP v3 with encryption

**Secrets Management**:

- Environment variables for credentials
- Future: HashiCorp Vault integration

### Network Security

**Device Credentials**:

- Stored encrypted in `DeviceSecurity` table
- Per-device SSH keys
- SNMP v3 authentication

**API Security**:

- Rate limiting (planned)
- Input validation (Zod)
- SQL injection prevention (Prisma parameterized queries)
- XSS prevention (sanitized output)

---

## Scalability & Performance

### Current Performance Characteristics

| Metric                   | Value         | Notes                          |
| ------------------------ | ------------- | ------------------------------ |
| **Polling Capacity**     | ~1000 devices | Single poller instance         |
| **Polling Frequency**    | 5-300 seconds | Configurable per device        |
| **API Response Time**    | < 100ms       | CRUD operations                |
| **Concurrent Polls**     | 50            | Configurable concurrency limit |
| **Database Connections** | 20            | Prisma connection pool         |

### Optimization Strategies

**Database**:

- Index on `ipAddress`, `macAddress`, `status`
- Partitioning for `DeviceMonitoring` (time-based)
- Materialized views for aggregations
- Query result caching

**Application**:

- Connection pooling
- Batch processing for polling results
- Lazy loading of relationships
- Compression for API responses

**Monitoring**:

- Distribute devices across poller instances
- Priority queues (critical devices first)
- Adaptive polling (faster when unstable)
- Circuit breaker for failing devices

### Bottleneck Analysis

**Potential Bottlenecks**:

1. **Database Write Throughput**: Monitoring data writes

   - **Solution**: Batch inserts, time-series database (TimescaleDB)

2. **Network I/O**: Polling thousands of devices

   - **Solution**: Multiple poller instances, distributed workers

3. **Event Processing**: High-frequency event handlers

   - **Solution**: Message queue (RabbitMQ), async processing

4. **API Query Performance**: Complex joins
   - **Solution**: Denormalization, caching, GraphQL DataLoader

---

## Future Evolution

### Short-term Enhancements (3-6 months)

1. **Complete REST API Implementation**

   - Implement all stubbed controllers
   - Add authentication/authorization middleware
   - API documentation (Swagger/OpenAPI)

2. **WebSocket Real-time Updates**

   - Device status changes
   - Alert notifications
   - Dashboard live metrics

3. **SNMP Integration**

   - MIB parsing
   - SNMP trap handling
   - Bandwidth monitoring

4. **Advanced Alerting**

   - Alert escalation
   - On-call schedules
   - Alert grouping/correlation
   - Slack/Discord integration

5. **Logging & Observability**
   - Winston integration
   - Structured logging
   - Metrics export (Prometheus)
   - Distributed tracing (OpenTelemetry)

### Mid-term Features (6-12 months)

1. **Multi-Tenancy**

   - Tenant isolation
   - Per-tenant databases (schema-per-tenant)
   - White-labeling

2. **Advanced Analytics**

   - Trend analysis
   - Capacity planning
   - SLA reporting
   - Predictive maintenance

3. **Workflow Engine**

   - Automated remediation
   - Approval workflows
   - Maintenance scheduling

4. **Mobile Application**

   - React Native app
   - Push notifications
   - Field technician tools

5. **Coverage Mapping**
   - Interactive maps (Leaflet/Mapbox)
   - Signal strength visualization
   - Coverage prediction

### Long-term Vision (12+ months)

1. **SaaS Platform**

   - Multi-tenant architecture
   - Subscription billing
   - Self-service onboarding
   - Marketplace integrations

2. **AI/ML Integration**

   - Anomaly detection
   - Predictive failures
   - Automated root cause analysis
   - Intelligent alerting

3. **Advanced Networking**

   - Network topology discovery
   - Path analysis
   - Traffic engineering
   - SD-WAN integration

4. **Business Modules**

   - CRM integration
   - Billing system
   - Payment processing
   - Customer portal

5. **Compliance & Auditing**
   - Audit logging
   - Compliance reports (PCI DSS, GDPR)
   - Change tracking
   - Policy enforcement

### Architectural Evolution

**Phase 1: Monolith → Modular Monolith**

- Clear bounded contexts
- Separate deployable modules
- Shared database with schemas

**Phase 2: Modular Monolith → Microservices**

- Extract monitoring service
- Extract notification service
- Message queue for inter-service communication
- API Gateway

**Phase 3: Microservices → Event-Driven Architecture**

- Event sourcing for domain events
- CQRS for read/write separation
- Saga pattern for distributed transactions

```mermaid
graph TB
    subgraph "Phase 1: Current (Modular Monolith)"
        MONOLITH[Single Application<br/>Multiple Modules]
        DB1[(Shared Database)]
        MONOLITH --> DB1
    end

    subgraph "Phase 2: Microservices"
        API[API Gateway]
        MONITOR_SVC[Monitoring Service]
        NOTIFY_SVC[Notification Service]
        INVENTORY_SVC[Inventory Service]

        DB2[(Monitoring DB)]
        DB3[(Notification DB)]
        DB4[(Inventory DB)]

        MQ[Message Queue]

        API --> MONITOR_SVC
        API --> NOTIFY_SVC
        API --> INVENTORY_SVC

        MONITOR_SVC --> DB2
        NOTIFY_SVC --> DB3
        INVENTORY_SVC --> DB4

        MONITOR_SVC --> MQ
        NOTIFY_SVC --> MQ
        INVENTORY_SVC --> MQ
    end

    subgraph "Phase 3: Event-Driven"
        EVENT_STORE[(Event Store)]
        READ_DB[(Read Models)]
        SAGA[Saga Orchestrator]

        MONITOR_SVC --> EVENT_STORE
        EVENT_STORE --> READ_DB
        EVENT_STORE --> SAGA
    end

    MONOLITH -.->|Evolution| API
    DB2 -.->|Future| EVENT_STORE
```

---

## Conclusion

The Network Monitoring Platform is architected for **long-term success** using industry best practices:

✅ **Domain-Driven Design** ensures business logic clarity
✅ **Clean Architecture** enables technology independence
✅ **Event-Driven Processing** provides scalability
✅ **Type Safety** reduces runtime errors
✅ **Explicit Error Handling** improves reliability
✅ **Modular Structure** facilitates evolution

The system is currently in **early development** with a solid foundation:

- Complete domain kernel and value objects
- Comprehensive database schema
- Working monitoring services
- Email notification system

**Next priorities** are:

1. Complete REST API implementation
2. Add authentication/authorization
3. Implement remaining repository layer
4. Build frontend dashboard
5. Add SNMP monitoring

The architecture supports evolution from a **monolithic application** to a **distributed microservices platform** as the business grows, making it suitable for the long-term SaaS vision.

---

**Document Version**: 1.0
**Last Updated**: 2025-12-03
**Maintainer**: Architecture Team
