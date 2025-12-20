# Bounded Contexts & Strategic Design

## Overview

This document describes the **bounded contexts** within the Network Monitoring Platform, strategic design decisions, coding conventions, architectural patterns, and development guidelines. It serves as a comprehensive guide for developers working on the system.

---

## Table of Contents

1. [Strategic Domain Model](#strategic-domain-model)
2. [Bounded Contexts](#bounded-contexts)
3. [Architectural Patterns](#architectural-patterns)
4. [Coding Conventions](#coding-conventions)
5. [Testing Strategy](#testing-strategy)
6. [Error Handling Guidelines](#error-handling-guidelines)
7. [Security Guidelines](#security-guidelines)
8. [Performance Guidelines](#performance-guidelines)
9. [Patterns to Use](#patterns-to-use)
10. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

---

## Strategic Domain Model

### Core Domain

The **Core Domain** is the competitive differentiator—what makes this system unique:

**Real-time Network Monitoring & Alerting**

- Multi-protocol device polling (ICMP, SNMP, SSH, HTTP)
- Event-driven alert system
- Adaptive polling strategies
- Network topology discovery

**Why it's core**: No existing solution provides affordable, scalable monitoring specifically tailored for small/medium ISPs in rural areas.

---

### Supporting Subdomains

These are important but not differentiating:

1. **Device Inventory Management**

   - Track physical devices
   - Warranty management
   - Location tracking

2. **Maintenance Coordination**

   - Technician assignment
   - Work order management
   - Service history

3. **User Management**
   - Authentication/authorization
   - Role-based access control
   - User preferences

---

### Generic Subdomains

These could be replaced with off-the-shelf solutions:

1. **Email Notifications**

   - Current: Nodemailer
   - Could use: SendGrid, AWS SES, Mailgun

2. **Logging**

   - Current: Winston (not yet integrated)
   - Could use: Datadog, New Relic, Splunk

3. **Caching**
   - Future: Redis
   - Could use: Memcached, AWS ElastiCache

---

## Bounded Contexts

The system is organized into **7 bounded contexts**, each with clear boundaries and responsibilities.

### 1. Device Catalog Context

**Ubiquitous Language**: DeviceModel, Supplier, Vendor, Manufacturer, Specifications

**Responsibilities**:

- Maintain catalog of available device models
- Associate models with suppliers
- Store device specifications

**Aggregates**:

- Supplier
- DeviceModel

**Bounded By**:

- Does NOT contain physical devices (that's Inventory context)
- Does NOT contain pricing (future Procurement context)
- Does NOT contain network configuration (that's Network Management context)

**Integration Points**:

- ← **Inventory Context**: Physical devices reference models from this context
- ← **Procurement Context** (future): Purchase orders reference models

**Repository Interfaces**:

```typescript
interface ISupplierRepository {
  findById(id: string): Promise<Supplier | null>;
  findActiveSuppliers(): Promise<Supplier[]>;
  save(supplier: Supplier): Promise<void>;
}

interface IDeviceModelRepository {
  findById(id: string): Promise<DeviceModel | null>;
  findByManufacturer(vendor: Vendors): Promise<DeviceModel[]>;
  save(model: DeviceModel): Promise<void>;
}
```

---

### 2. Inventory Context

**Ubiquitous Language**: Device, Asset, Location, Serial Number, Warranty, Ownership

**Responsibilities**:

- Track physical hardware assets
- Manage device lifecycle (from purchase to retirement)
- Associate devices with locations
- Track warranty status

**Aggregates**:

- Device (with Location)
- PurchaseOrder

**Bounded By**:

- Physical hardware only (serial numbers, locations)
- Does NOT contain network configuration (IP addresses, etc.)
- Does NOT contain monitoring data

**Integration Points**:

- → **Device Catalog Context**: References DeviceModel for specifications
- → **Network Management Context**: Physical devices are configured as network devices
- ← **Maintenance Context**: Maintenance logs reference physical devices

**Repository Interfaces**:

```typescript
interface IDeviceRepository {
  findById(id: string): Promise<Device | null>;
  findBySerialNumber(serialNumber: string): Promise<Device | null>;
  findByStatus(status: DeviceStatus): Promise<Device[]>;
  findUnderWarranty(): Promise<Device[]>;
  save(device: Device): Promise<void>;
}

interface ILocationRepository {
  findById(id: string): Promise<Location | null>;
  findByCity(city: string): Promise<Location[]>;
  save(location: Location): Promise<void>;
}
```

---

### 3. Network Management Context

**Ubiquitous Language**: NetworkDevice, IP Address, MAC Address, Configuration, Connectivity, Protocol

**Responsibilities**:

- Manage logical network devices
- Store network configuration (IP, MAC, protocols)
- Track network topology (links, connections)
- Manage device credentials

**Aggregates**:

- NetworkDevice (with RadioAntenna, AccessPoint, Link, DeviceSoftware, DeviceSecurity, DeviceEnergy)

**Bounded By**:

- Logical network configuration only
- Does NOT contain monitoring metrics (that's Monitoring context)
- Does NOT contain physical location (that's Inventory context)

**Integration Points**:

- ← **Inventory Context**: NetworkDevice references Physical Device
- → **Monitoring Context**: Provides devices to monitor
- ← **Maintenance Context**: Configuration changes logged

**Repository Interfaces**:

```typescript
interface INetworkDeviceRepository {
  findById(id: string): Promise<NetworkDevice | null>;
  findByIpAddress(ip: string): Promise<NetworkDevice | null>;
  findByMacAddress(mac: string): Promise<NetworkDevice | null>;
  findByStatus(status: NetworkDeviceStatus): Promise<NetworkDevice[]>;
  findByRole(role: NetworkDeviceRole): Promise<NetworkDevice[]>;
  save(device: NetworkDevice): Promise<void>;
}

interface IRadioAntennaRepository {
  findById(id: string): Promise<RadioAntenna | null>;
  findByNetworkDeviceId(
    deviceId: string
  ): Promise<RadioAntenna | null>;
  save(radio: RadioAntenna): Promise<void>;
}
```

---

### 4. Monitoring Context (CORE DOMAIN)

**Ubiquitous Language**: Polling, Poller, Health Check, Metrics, Telemetry, Uptime, Status

**Responsibilities**:

- Execute polling operations
- Collect device metrics
- Track device availability
- Store time-series monitoring data
- Detect anomalies

**Aggregates**:

- DeviceMonitoring
- PollingResult (transient)

**Bounded By**:

- Monitoring and metrics collection only
- Does NOT determine what actions to take (that's Alerting context)
- Does NOT configure devices (that's Network Management context)

**Integration Points**:

- ← **Network Management Context**: Gets list of devices to monitor
- → **Alerting Context**: Emits events when metrics exceed thresholds
- → **Analytics Context** (future): Provides metrics for analysis

**Domain Services**:

```typescript
interface IPollerService {
  initialize(config: PollingConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  addDevice(device: NetworkDevice): void;
  removeDevice(deviceId: string): void;
  pauseDevice(deviceId: string): void;
  resumeDevice(deviceId: string): void;
}

interface IPollingStrategyService {
  determinePollingInterval(device: NetworkDevice): number;
  selectProtocol(device: NetworkDevice): ManagementProtocol;
  calculateRetryBackoff(consecutiveFailures: number): number;
}
```

**Repository Interfaces**:

```typescript
interface IDeviceMonitoringRepository {
  findByDeviceId(deviceId: string): Promise<DeviceMonitoring | null>;
  saveMetrics(
    deviceId: string,
    metrics: DeviceMetrics
  ): Promise<void>;
  getMetricsHistory(
    deviceId: string,
    from: Date,
    to: Date
  ): Promise<DeviceMetrics[]>;
}
```

---

### 5. Alerting Context (CORE DOMAIN)

**Ubiquitous Language**: Alert, Notification, Threshold, Severity, Escalation, Acknowledgment

**Responsibilities**:

- Evaluate alert rules
- Trigger notifications
- Manage alert lifecycle
- Handle alert escalation
- Track alert acknowledgments

**Aggregates**:

- Alert
- AlertRule
- NotificationChannel

**Bounded By**:

- Alert generation and delivery only
- Does NOT collect metrics (that's Monitoring context)
- Does NOT perform maintenance (that's Maintenance context)

**Integration Points**:

- ← **Monitoring Context**: Receives device events (offline, high latency, etc.)
- → **Notification Delivery** (external): Sends emails, SMS, etc.
- → **User Management Context**: Gets user preferences for notifications

**Domain Services**:

```typescript
interface IAlertEvaluationService {
  evaluateMetrics(
    metrics: DeviceMetrics,
    rules: AlertRule[]
  ): Alert[];
  determineAlertSeverity(metrics: DeviceMetrics): AlertSeverity;
  shouldEscalate(alert: Alert): boolean;
}

interface INotificationService {
  sendNotification(
    alert: Alert,
    channels: NotificationChannel[]
  ): Promise<void>;
  formatAlertMessage(alert: Alert): string;
}
```

---

### 6. Maintenance Context

**Ubiquitous Language**: Maintenance, Technician, Work Order, Preventive, Corrective, Service Record

**Responsibilities**:

- Schedule and track maintenance activities
- Assign technicians to work orders
- Record maintenance history
- Track technician workload

**Aggregates**:

- DeviceMaintenanceLog
- Technician

**Bounded By**:

- Maintenance activities only
- Does NOT configure devices (that's Network Management context)
- Does NOT determine when maintenance is needed (that's Alerting context)

**Integration Points**:

- ← **Network Management Context**: Maintenance performed on network devices
- ← **Alerting Context**: Alerts may create work orders
- → **Inventory Context**: Updates device status after maintenance

**Repository Interfaces**:

```typescript
interface IMaintenanceLogRepository {
  findById(id: string): Promise<DeviceMaintenanceLog | null>;
  findByDeviceId(deviceId: string): Promise<DeviceMaintenanceLog[]>;
  findByTechnicianId(
    technicianId: string
  ): Promise<DeviceMaintenanceLog[]>;
  findByType(type: MaintenanceType): Promise<DeviceMaintenanceLog[]>;
  save(log: DeviceMaintenanceLog): Promise<void>;
}

interface ITechnicianRepository {
  findById(id: string): Promise<Technician | null>;
  findAvailableTechnicians(): Promise<Technician[]>;
  save(technician: Technician): Promise<void>;
}
```

---

### 7. User Management Context

**Ubiquitous Language**: User, Role, Permission, Authentication, Authorization

**Responsibilities**:

- Manage user accounts
- Handle authentication
- Enforce authorization
- Store user preferences

**Aggregates**:

- User
- Role

**Bounded By**:

- User identity and access control only
- Does NOT contain business logic from other contexts

**Integration Points**:

- → **All Contexts**: Provides user identity for audit logs
- ← **Alerting Context**: User preferences for notifications

**Repository Interfaces** (Future):

```typescript
interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

interface IRoleRepository {
  findById(id: string): Promise<Role | null>;
  findByName(name: string): Promise<Role | null>;
  save(role: Role): Promise<void>;
}
```

---

## Architectural Patterns

### Clean Architecture Layers

The system follows **strict layered architecture** with dependency inversion:

```
┌─────────────────────────────────────┐
│     Presentation Layer (HTTP)       │ ← Controllers, Routes, Validators
├─────────────────────────────────────┤
│     Application Layer               │ ← Use Cases, Services, Orchestration
├─────────────────────────────────────┤
│     Domain Layer (Business Logic)   │ ← Entities, Value Objects, Domain Services
├─────────────────────────────────────┤
│     Infrastructure Layer            │ ← Repositories, External Services, ORM
└─────────────────────────────────────┘
```

**Dependency Rule**: Inner layers NEVER depend on outer layers.

---

### Repository Pattern

All data access goes through repositories:

**Interface (Domain Layer)**:

```typescript
// src/domain/repository/INetworkDeviceRepository.ts
export interface INetworkDeviceRepository {
  findById(id: string): Promise<NetworkDevice | null>;
  save(device: NetworkDevice): Promise<void>;
  delete(id: string): Promise<void>;
}
```

**Implementation (Infrastructure Layer)**:

```typescript
// src/infrastructure/repositories/PrismaNetworkDeviceRepository.ts
export class PrismaNetworkDeviceRepository
  implements INetworkDeviceRepository
{
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<NetworkDevice | null> {
    const data = await this.prisma.networkDevice.findUnique({
      where: { id }
    });
    if (!data) return null;
    return NetworkDeviceMapper.toDomain(data);
  }

  async save(device: NetworkDevice): Promise<void> {
    const data = NetworkDeviceMapper.toPersistence(device);
    await this.prisma.networkDevice.upsert({
      where: { id: device.id.toString() },
      create: data,
      update: data
    });
  }
}
```

---

### Use Case Pattern

Use cases orchestrate domain logic without containing business rules:

```typescript
// src/application/network-device/use-cases/CreateNetworkDeviceUseCase.ts
export class CreateNetworkDeviceUseCase {
  constructor(
    private networkDeviceRepo: INetworkDeviceRepository,
    private deviceRepo: IDeviceRepository
  ) {}

  async execute(
    request: CreateNetworkDeviceDTO
  ): Result<NetworkDeviceDTO> {
    // 1. Validate input
    const deviceResult = await this.deviceRepo.findById(
      request.deviceId
    );
    if (!deviceResult) {
      return Result.fail('Physical device not found');
    }

    // 2. Create domain entity
    const networkDeviceResult = NetworkDevice.create({
      name: request.name,
      type: request.type,
      ipAddress: request.ipAddress,
      macAddress: request.macAddress
      // ... other props
    });

    if (!networkDeviceResult.isSuccess) {
      return Result.fail(networkDeviceResult.error);
    }

    // 3. Persist
    const networkDevice = networkDeviceResult.value;
    await this.networkDeviceRepo.save(networkDevice);

    // 4. Emit domain events
    EventDispatcher.dispatchEventsForAggregate(networkDevice.id);

    // 5. Return DTO
    return Result.ok(NetworkDeviceMapper.toDTO(networkDevice));
  }
}
```

---

### Mapper Pattern

Mappers translate between layers:

```typescript
export class NetworkDeviceMapper {
  // Domain → DTO (for API responses)
  public static toDTO(device: NetworkDevice): NetworkDeviceDTO {
    return {
      id: device.id.toString(),
      name: device.name,
      ipAddress: device.ipAddress
      // ...
    };
  }

  // DTO → Domain (for API requests)
  public static toDomain(raw: any): NetworkDevice {
    const result = NetworkDevice.create(
      {
        name: raw.name
        // ...
      },
      new UniqueEntityID(raw.id)
    );

    return result.isSuccess ? result.value : null;
  }

  // Domain → Persistence (for database)
  public static toPersistence(
    device: NetworkDevice
  ): PrismaNetworkDevice {
    return {
      id: device.id.toString(),
      name: device.name
      // ...
    };
  }
}
```

---

## Coding Conventions

### File Organization

```
src/
├── domain/
│   ├── entities/          # One file per entity
│   ├── value-objects/     # One file per value object
│   ├── repository/        # Repository interfaces
│   └── services/          # Domain services
├── application/
│   ├── [context-name]/
│   │   └── use-cases/     # One file per use case
│   └── services/          # Application services
├── infrastructure/
│   ├── repositories/      # Repository implementations
│   ├── mappers/           # DTO ↔ Domain mappers
│   └── external/          # External service integrations
└── presentation/
    ├── http/
    │   ├── controllers/   # HTTP request handlers
    │   ├── routes/        # Route definitions
    │   └── validators/    # Zod schemas
    └── websocket/         # WebSocket handlers
```

---

### Naming Conventions

**Files**:

- PascalCase for classes: `NetworkDevice.ts`, `Email.ts`
- camelCase for functions: `createNetworkDevice.ts`
- kebab-case for routes: `network-device.routes.ts`

**Classes**:

- Entities: `NetworkDevice`, `Supplier`
- Value Objects: `Email`, `PhoneNumber`
- Aggregates: `NetworkDevice` (extends `AggregateRoot`)
- Services: `PollerService`, `AlertEvaluationService`
- Use Cases: `CreateNetworkDeviceUseCase`
- Controllers: `CreateNetworkDeviceController`
- Repositories: `PrismaNetworkDeviceRepository`

**Interfaces**:

- Prefix with `I`: `INetworkDeviceRepository`, `IPollerService`

**Events**:

- Past tense: `NetworkDeviceCreatedEvent`, `DeviceOfflineEvent`

**DTOs**:

- Suffix with `DTO`: `NetworkDeviceDTO`, `CreateNetworkDeviceDTO`

---

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "resolveJsonModule": true
  }
}
```

**Required TypeScript Features**:

- ✅ Strict mode enabled
- ✅ Explicit return types for public methods
- ✅ Interfaces over `any` types
- ✅ Readonly properties where appropriate
- ✅ Optional chaining (`?.`) and nullish coalescing (`??`)

---

### Code Style

**Prettier Configuration**:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "none",
  "printWidth": 80,
  "tabWidth": 2
}
```

**ESLint Rules**:

- No unused variables
- No console.log in production code (use Winston)
- Prefer `const` over `let`
- No `var`
- Prefer arrow functions for callbacks

---

## Testing Strategy

### Test Organization

Tests mirror the source code structure:

```
tests/
├── domain/
│   ├── entities/
│   │   └── Supplier.test.ts
│   └── value-objects/
│       ├── Email.test.ts
│       ├── PhoneNumber.test.ts
│       └── Address.test.ts
├── application/
│   └── network-device/
│       └── CreateNetworkDeviceUseCase.test.ts
├── infrastructure/
│   └── repositories/
│       └── PrismaNetworkDeviceRepository.test.ts
└── presentation/
    └── http/
        └── controllers/
            └── CreateNetworkDeviceController.test.ts
```

---

### Testing Pyramid

```
        ┌─────────────┐
        │  E2E Tests  │  ← Few, slow, expensive
        │             │     Test full workflows
        ├─────────────┤
        │ Integration │  ← Some, moderate speed
        │    Tests    │     Test layer boundaries
        ├─────────────┤
        │   Unit      │  ← Many, fast, cheap
        │   Tests     │     Test business logic
        └─────────────┘
```

**Target Coverage**:

- Domain Layer: 100% (pure business logic)
- Application Layer: 90% (use cases)
- Infrastructure Layer: 70% (repositories, integrations)
- Presentation Layer: 60% (controllers)

---

### Unit Testing

**Domain Entities and Value Objects**:

```typescript
describe('Email Value Object', () => {
  it('should create valid email', () => {
    const result = Email.create('user@example.com');
    expect(result.isSuccess).toBe(true);
    expect(result.value.toString()).toBe('user@example.com');
  });

  it('should reject invalid email format', () => {
    const result = Email.create('invalid-email');
    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('valid email');
  });

  it('should normalize email to lowercase', () => {
    const result = Email.create('USER@EXAMPLE.COM');
    expect(result.value.toString()).toBe('user@example.com');
  });
});
```

**Use Cases**:

```typescript
describe('CreateNetworkDeviceUseCase', () => {
  let useCase: CreateNetworkDeviceUseCase;
  let mockNetworkDeviceRepo: jest.Mocked<INetworkDeviceRepository>;
  let mockDeviceRepo: jest.Mocked<IDeviceRepository>;

  beforeEach(() => {
    mockNetworkDeviceRepo = {
      save: jest.fn(),
      findByIpAddress: jest.fn()
    } as any;

    mockDeviceRepo = {
      findById: jest.fn()
    } as any;

    useCase = new CreateNetworkDeviceUseCase(
      mockNetworkDeviceRepo,
      mockDeviceRepo
    );
  });

  it('should create network device successfully', async () => {
    // Arrange
    mockDeviceRepo.findById.mockResolvedValue(mockPhysicalDevice);
    mockNetworkDeviceRepo.findByIpAddress.mockResolvedValue(null);

    // Act
    const result = await useCase.execute({
      name: 'Router-01',
      ipAddress: '192.168.1.1'
      // ...
    });

    // Assert
    expect(result.isSuccess).toBe(true);
    expect(mockNetworkDeviceRepo.save).toHaveBeenCalled();
  });
});
```

---

### Integration Testing

**Repository Integration Tests**:

```typescript
describe('PrismaNetworkDeviceRepository', () => {
  let prisma: PrismaClient;
  let repository: PrismaNetworkDeviceRepository;

  beforeAll(async () => {
    prisma = new PrismaClient();
    repository = new PrismaNetworkDeviceRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should save and retrieve network device', async () => {
    // Arrange
    const device = NetworkDevice.create({
      name: 'Test-Device',
      ipAddress: '10.0.0.1'
      // ...
    }).value;

    // Act
    await repository.save(device);
    const retrieved = await repository.findById(device.id.toString());

    // Assert
    expect(retrieved).not.toBeNull();
    expect(retrieved.name).toBe('Test-Device');
  });
});
```

---

### E2E Testing (Future)

**API Endpoint Tests**:

```typescript
describe('POST /api/network-devices', () => {
  it('should create network device via API', async () => {
    const response = await request(app)
      .post('/api/network-devices')
      .send({
        name: 'Router-01',
        ipAddress: '192.168.1.1'
        // ...
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.name).toBe('Router-01');
  });
});
```

---

## Error Handling Guidelines

### Use Result Pattern for Expected Errors

```typescript
// ✅ Good
public static create(email: string): Result<Email> {
  if (!email.includes('@')) {
    return Result.fail<Email>('Invalid email format');
  }
  return Result.ok<Email>(new Email({ value: email }));
}

// ❌ Bad
public static create(email: string): Email {
  if (!email.includes('@')) {
    throw new Error('Invalid email format'); // Don't throw for expected errors
  }
  return new Email({ value: email });
}
```

---

### Use Exceptions for Unexpected Errors

```typescript
// ✅ Good - unexpected infrastructure failure
async save(device: NetworkDevice): Promise<void> {
  try {
    await this.prisma.networkDevice.create({ data: device });
  } catch (error) {
    throw new DatabaseConnectionError('Failed to save device', error);
  }
}
```

---

### HTTP Error Responses

```typescript
// In Controller
const result = await useCase.execute(request);

if (!result.isSuccess) {
  // Business rule violation
  return res.status(400).json({
    error: result.error,
    code: 'BUSINESS_RULE_VIOLATION'
  });
}

return res.status(201).json(result.value);
```

---

## Security Guidelines

### Input Validation

**Always validate at API boundary**:

```typescript
// ✅ Good - validate with Zod at controller
const validation = CreateNetworkDeviceSchema.safeParse(req.body);
if (!validation.success) {
  return res.status(400).json({ errors: validation.error });
}
```

---

### Credential Storage

```typescript
// ✅ Good - store encrypted
interface DeviceSecurityProps {
  username: string;
  password: string; // Encrypted before storage
  SNMPPassword?: string; // Encrypted before storage
}

// ❌ Bad - store plaintext
interface DeviceSecurityProps {
  username: string;
  password: string; // Plaintext
}
```

---

### SQL Injection Prevention

**Prisma automatically prevents SQL injection** via parameterized queries:

```typescript
// ✅ Safe - Prisma parameterizes
await prisma.networkDevice.findMany({
  where: { ipAddress: userInput }
});

// ❌ Dangerous - raw SQL with concatenation
await prisma.$executeRaw(
  `SELECT * FROM device WHERE ip = '${userInput}'`
);
```

---

## Performance Guidelines

### Database Queries

**Use selective field loading**:

```typescript
// ✅ Good - only load needed fields
const devices = await prisma.networkDevice.findMany({
  select: {
    id: true,
    name: true,
    ipAddress: true
  }
});

// ❌ Bad - load everything
const devices = await prisma.networkDevice.findMany();
```

**Use eager loading to avoid N+1 queries**:

```typescript
// ✅ Good - single query with join
const devices = await prisma.networkDevice.findMany({
  include: { deviceMonitoring: true }
});

// ❌ Bad - N+1 queries
const devices = await prisma.networkDevice.findMany();
for (const device of devices) {
  const monitoring = await prisma.deviceMonitoring.findUnique({
    where: { networkDeviceId: device.id }
  });
}
```

---

### Caching Strategy (Future)

```typescript
// Cache device configuration (rarely changes)
const device = await cache.getOrSet(
  `device:${id}`,
  () => repository.findById(id),
  { ttl: 300 } // 5 minutes
);

// Don't cache monitoring metrics (frequently changes)
const metrics = await repository.getMetrics(deviceId);
```

---

## Patterns to Use

### ✅ Recommended Patterns

| Pattern                  | Use Case            | Example                             |
| ------------------------ | ------------------- | ----------------------------------- |
| **Result Pattern**       | Expected errors     | `Result<Email>` instead of throwing |
| **Factory Pattern**      | Entity creation     | `NetworkDevice.create()`            |
| **Repository Pattern**   | Data access         | `INetworkDeviceRepository`          |
| **Strategy Pattern**     | Multiple algorithms | Multiple poller protocols           |
| **Observer Pattern**     | Event handling      | EventEmitter for domain events      |
| **Dependency Injection** | Loose coupling      | Constructor injection               |
| **DTO Pattern**          | Layer boundaries    | API DTOs separate from domain       |
| **Mapper Pattern**       | Object translation  | Domain ↔ DTO ↔ Persistence        |
| **Guard Pattern**        | Validation          | `Guard.againstNullOrUndefined()`    |

---

## Anti-Patterns to Avoid

### ❌ Patterns to Avoid

| Anti-Pattern              | Why Avoid                         | Do This Instead                    |
| ------------------------- | --------------------------------- | ---------------------------------- |
| **Anemic Domain Model**   | Business logic in services        | Put logic in entities              |
| **God Object**            | Single class does everything      | Single Responsibility Principle    |
| **Primitive Obsession**   | Using strings for domain concepts | Value Objects (Email, PhoneNumber) |
| **Magic Numbers**         | Hardcoded values                  | Named constants or configuration   |
| **Leaky Abstractions**    | Implementation details exposed    | Proper encapsulation               |
| **Shotgun Surgery**       | One change affects many files     | Better cohesion                    |
| **Big Ball of Mud**       | No clear structure                | Layered architecture               |
| **Singleton**             | Global state                      | Dependency injection               |
| **Circular Dependencies** | A depends on B depends on A       | Inversion of control               |

---

### ❌ Code Smells to Avoid

**Long Parameter Lists**:

```typescript
// ❌ Bad
function createDevice(
  name: string,
  ip: string,
  mac: string,
  type: string,
  protocol: string,
  port: number,
  enabled: boolean
) {
  // ...
}

// ✅ Good
interface CreateDeviceProps {
  name: string;
  ip: string;
  mac: string;
  type: string;
  protocol: string;
  port: number;
  enabled: boolean;
}

function createDevice(props: CreateDeviceProps) {
  // ...
}
```

**Magic Strings**:

```typescript
// ❌ Bad
if (device.status === 'online') {
}

// ✅ Good
if (device.status === NetworkDeviceStatus.ONLINE) {
}
```

**Inconsistent Naming**:

```typescript
// ❌ Bad
class NetworkDevice {
  get_name(): string {}
  fetchIPAddress(): string {}
  macAddress(): string {}
}

// ✅ Good
class NetworkDevice {
  get name(): string {}
  get ipAddress(): string {}
  get macAddress(): string {}
}
```

---

## Summary

This document defines the **strategic design** of the Network Monitoring Platform:

1. **7 Bounded Contexts** with clear responsibilities
2. **Clean Architecture** with strict dependency rules
3. **Coding Conventions** for consistency
4. **Testing Strategy** with test pyramid
5. **Error Handling** with Result pattern
6. **Security Guidelines** for safe development
7. **Performance Guidelines** for scalability
8. **Recommended Patterns** for quality code
9. **Anti-Patterns to Avoid** for maintainability

Following these guidelines ensures a **consistent**, **maintainable**, and **scalable** codebase that can evolve with changing business requirements.

---

**Document Version**: 1.0
**Last Updated**: 2025-12-03
**Maintainer**: Architecture Team
