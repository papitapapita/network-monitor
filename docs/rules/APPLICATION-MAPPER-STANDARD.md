# Application Layer Mapper Design Specification (DDD-Compliant)

**Version:** 1.0
**Last Updated:** 2025-12-11
**Status:** Authoritative Standard

---

## Table of Contents

1. [Purpose of Mappers in DDD](#1-purpose-of-mappers-in-ddd)
2. [Responsibilities of an Application Mapper](#2-responsibilities-of-an-application-mapper)
3. [Mapper Structure](#3-mapper-structure)
4. [Orthogonality Guidelines](#4-orthogonality-guidelines)
5. [Error Handling Rules](#5-error-handling-rules)
6. [Naming Conventions](#6-naming-conventions)
7. [Style Rules](#7-style-rules)
8. [Common Patterns](#8-common-patterns)
9. [Anti-Patterns](#9-anti-patterns)
10. [Validation Checklist](#10-validation-checklist)

---

## 1. Purpose of Mappers in DDD

### Strict Definition

Application layer mappers are **pure data translators** that convert between Data Transfer Objects (DTOs) and Domain entities. They exist at the boundary between the presentation/infrastructure layer and the domain layer.

### Core Principles

- **Pure Translation**: Mappers perform structural transformation only, with zero business logic
- **Orthogonality**: Complete separation between data transformation and domain behavior
- **Stateless**: Mappers maintain no state between invocations
- **Deterministic**: Same input always produces same output
- **Zero Domain Rules**: No validation, no business decisions, no invariant enforcement

### Why Mappers Exist

1. **Isolate external representation** from internal domain structure
2. **Enable independent evolution** of DTOs and domain models
3. **Prevent presentation concerns** from leaking into domain
4. **Simplify testing** by separating transformation from business logic
5. **Maintain clean boundaries** between architectural layers

---

## 2. Responsibilities of an Application Mapper

### ✅ Allowed Responsibilities

Mappers MAY perform these actions:

#### Data Structure Transformation

- Convert DTO fields to raw primitives for domain constructors
- Convert domain entity fields to DTO primitives
- Flatten nested domain structures into DTOs
- Unflatten DTO structures for domain consumption

#### Type Conversion

- Convert strings to numbers, dates, or other primitive types
- Convert domain IDs to string representations
- Convert timestamps between Date objects and ISO strings
- Transform optional values to nullable (e.g., `undefined` → `null`)

#### Field Mapping

- Rename fields between layers (e.g., `ipAddr` → `ipAddress`)
- Extract nested values from domain aggregates
- Combine or split fields for DTO representation
- Provide data-level defaults for optional DTO fields (e.g., `?? null`, `?? 'ETHERNET'`)

#### Enum and String Mapping

- Convert enum values to string representations
- Convert string representations to primitive values (NOT domain enums)
- Extract string values from domain Value Objects

### ❌ Prohibited Responsibilities

Mappers MUST NOT perform these actions:

#### Business Logic

- ❌ Create Value Objects (e.g., `IPAddress.create()`, `MACAddress.create()`)
- ❌ Create domain entities or aggregates
- ❌ Call Value Object validation methods
- ❌ Enforce business rules or invariants
- ❌ Make business decisions (e.g., "if type is X, then do Y")
- ❌ Apply business defaults (e.g., polling interval based on device type)
- ❌ Map string enums to domain enums (business logic)

#### Orchestration

- ❌ Call repository methods
- ❌ Dispatch domain events
- ❌ Coordinate multiple domain operations
- ❌ Handle transactions
- ❌ Manage aggregate lifecycle

#### Side Effects

- ❌ Perform I/O operations (network, file system, database)
- ❌ Log messages (except critical unexpected errors)
- ❌ Modify global state
- ❌ Call external services
- ❌ Generate IDs or timestamps

#### Validation

- ❌ Validate business rules
- ❌ Check field constraints (length, range, format)
- ❌ Verify uniqueness or existence
- ❌ Interpret or construct error messages
- ❌ Perform cross-field validation

---

## 3. Mapper Structure

### Canonical Template

```typescript
/**
 * Mapper for pure data structure transformation between DTOs and Domain.
 *
 * Responsibilities (ONLY):
 * - Transform data structures (DTO ↔ Domain)
 * - Map field names (if different between layers)
 * - Flatten/unflatten nested structures
 * - Provide default values for optional fields (data-level defaults only)
 *
 * Does NOT:
 * - Validate business rules (use case responsibility)
 * - Create value objects (use case responsibility)
 * - Create domain entities (use case responsibility)
 * - Make business decisions (use case responsibility)
 * - Call repositories or external services
 */
export class EntityNameMapper {

  /**
   * Converts a Domain entity to response DTO.
   * Pure data transformation only.
   *
   * @param entity - Domain entity
   * @returns Response DTO with complete entity information
   */
  public static toDTO(entity: EntityName): EntityNameResponseDTO {
    return {
      id: entity.id.toString(),
      name: entity.name,
      // Extract primitive values from Value Objects
      valueObject: entity.valueObject.toString(),
      // Extract nested aggregate data
      nested: {
        id: entity.nested.id.toString(),
        field: entity.nested.field
      },
      // Convert timestamps
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }

  /**
   * Converts an array of entities to list response DTO.
   *
   * @param entities - Array of domain entities
   * @param total - Total count (for pagination metadata)
   * @param limit - Current limit
   * @param offset - Current offset
   * @returns List response DTO with pagination metadata
   */
  public static toListDTO(
    entities: EntityName[],
    total: number,
    limit: number = 20,
    offset: number = 0
  ): EntityNameListResponseDTO {
    return {
      items: entities.map((entity) => this.toDTO(entity)),
      total,
      hasMore: offset + entities.length < total,
      limit,
      offset
    };
  }

  /**
   * Extracts raw data from CreateDTO with data-level defaults.
   *
   * Pure data transformation - no validation, no business logic.
   * Returns raw primitives that use case will validate and convert.
   *
   * @param dto - Create entity DTO from HTTP request
   * @returns Object with raw data ready for use case processing
   */
  public static extractCreateData(dto: CreateEntityNameDTO) {
    return {
      // Required fields (as-is, no validation)
      requiredField1: dto.requiredField1,
      requiredField2: dto.requiredField2,

      // Optional fields with data-level defaults (not business defaults)
      optionalField: dto.optionalField ?? null,
      optionalEnum: dto.optionalEnum ?? 'DEFAULT_VALUE',
      optionalNumber: dto.optionalNumber ?? 0,
      optionalBoolean: dto.optionalBoolean ?? false
    };
  }

  /**
   * Extracts update data from UpdateDTO.
   *
   * Pure data transformation - no validation, no domain method calls.
   * Returns only the fields present in the DTO for use case to process.
   *
   * @param dto - Update entity DTO with partial fields
   * @returns Object with only the fields that were provided in DTO
   */
  public static extractUpdateData(dto: UpdateEntityNameDTO) {
    const updates: any = {};

    if (dto.field1 !== undefined) updates.field1 = dto.field1;
    if (dto.field2 !== undefined) updates.field2 = dto.field2;
    if (dto.field3 !== undefined) updates.field3 = dto.field3;

    return updates;
  }
}
```

### Method Signatures

#### Required Methods

1. **`toDTO(entity: T): TDTO`**
   - Converts domain entity to response DTO
   - Always returns a DTO (never fails)
   - Extracts primitive values from Value Objects

2. **`extractCreateData(dto: CreateDTO): object`**
   - Extracts raw data from create DTO
   - Returns plain object with primitives
   - Applies data-level defaults only

3. **`extractUpdateData(dto: UpdateDTO): object`**
   - Extracts raw data from update DTO
   - Returns only provided fields
   - No defaults for update operations

#### Optional Methods

4. **`toListDTO(entities: T[], total, limit, offset): ListDTO`**
   - Converts array of entities to paginated list DTO
   - Adds pagination metadata

---

## 4. Orthogonality Guidelines

### Definition of Orthogonality

Two components are orthogonal when changes to one don't require changes to the other. Mappers must be orthogonal to:
- Domain business logic
- Use case orchestration
- Value Object validation rules
- Business rule changes

### Achieving Orthogonality

#### 1. Domain Independence

```typescript
// ✅ GOOD - Mapper extracts value, doesn't know validation rules
public static toDTO(device: NetworkDevice): DeviceDTO {
  return {
    ipAddress: device.ipAddress.toString(), // Extract only
    macAddress: device.macAddress.toString() // Extract only
  };
}

// ❌ BAD - Mapper knows about IP validation
public static toDTO(device: NetworkDevice): DeviceDTO {
  const ip = device.ipAddress.toString();
  if (!this.isValidIP(ip)) { // Business logic in mapper!
    throw new Error('Invalid IP');
  }
  return { ipAddress: ip };
}
```

#### 2. DTO Independence from Domain

```typescript
// ✅ GOOD - DTO changes don't affect domain
public static extractCreateData(dto: CreateDeviceDTO) {
  return {
    name: dto.deviceName,        // DTO uses "deviceName"
    type: dto.type,               // Domain uses "type"
    ip: dto.ipAddress            // Field name mapping
  };
}

// ❌ BAD - Tightly coupled field names
public static extractCreateData(dto: CreateDeviceDTO) {
  return dto; // Assumes DTO and domain have identical structures
}
```

#### 3. Business Rules Isolation

```typescript
// ✅ GOOD - No business decisions
public static extractCreateData(dto: CreateDeviceDTO) {
  return {
    deviceType: dto.deviceType,  // Just pass the string
    port: dto.port ?? 161        // Data-level default
  };
}

// ❌ BAD - Business logic in mapper
public static extractCreateData(dto: CreateDeviceDTO) {
  // Mapper makes business decision based on device type!
  const interval = dto.deviceType === 'ACCESS_POINT' ? 30 : 60;
  return {
    deviceType: dto.deviceType,
    pollingInterval: interval    // Business rule!
  };
}
```

### Stability Under Change

Good mappers remain stable when:
- Domain validation rules change
- Business workflows evolve
- Value Object implementations change
- DTO field names are renamed
- New optional fields are added to DTOs

---

## 5. Error Handling Rules

### Principle: Mappers Don't Handle Errors

Mappers assume valid domain entities when converting to DTOs. Error handling is the responsibility of use cases.

### Domain → DTO (Never Fails)

```typescript
// ✅ GOOD - Direct conversion, no error handling needed
public static toDTO(device: NetworkDevice): NetworkDeviceDTO {
  return {
    id: device.id.toString(),
    name: device.name,
    ipAddress: device.ipAddress.toString()
  };
}

// ❌ BAD - Unnecessary error handling in mapper
public static toDTO(device: NetworkDevice): NetworkDeviceDTO {
  try {
    if (!device.ipAddress) {
      throw new Error('IP address is required');
    }
    return {
      id: device.id.toString(),
      name: device.name,
      ipAddress: device.ipAddress.toString()
    };
  } catch (error) {
    throw new Error('Failed to map device');
  }
}
```

### DTO → Raw Data (No Validation)

```typescript
// ✅ GOOD - Extract data, let use case handle validation
public static extractCreateData(dto: CreateDeviceDTO) {
  return {
    name: dto.name,
    ipAddress: dto.ipAddress,
    port: dto.port ?? 161
  };
}

// ❌ BAD - Mapper validates
public static extractCreateData(dto: CreateDeviceDTO) {
  if (!dto.name || dto.name.length > 255) {
    throw new Error('Invalid name');
  }
  if (!this.isValidIP(dto.ipAddress)) {
    throw new Error('Invalid IP');
  }
  return {
    name: dto.name,
    ipAddress: dto.ipAddress
  };
}
```

### Exception: Unexpected Errors Only

```typescript
// ✅ ACCEPTABLE - Only for truly unexpected errors
public static toDTO(entity: ComplexEntity): ComplexDTO {
  try {
    return {
      id: entity.id.toString(),
      // ... complex nested extraction
    };
  } catch (error) {
    // Only catch unexpected runtime errors (null refs, etc.)
    throw new Error(`Unexpected error in mapper: ${error.message}`);
  }
}
```

---

## 6. Naming Conventions

### Class Names

**Pattern:** `{EntityName}Mapper`

```typescript
// ✅ GOOD
export class NetworkDeviceMapper { }
export class PollingConfigurationMapper { }
export class UserMapper { }

// ❌ BAD
export class DeviceMapperService { }  // Don't add "Service"
export class MapNetworkDevice { }     // Wrong format
export class NetworkDeviceDTO { }     // This is a DTO, not a mapper
```

### Method Names

| Purpose | Method Name | Returns |
|---------|-------------|---------|
| Domain → DTO | `toDTO()` | Single DTO |
| Domain[] → DTO | `toListDTO()` | List DTO with pagination |
| CreateDTO → Raw Data | `extractCreateData()` | Plain object |
| UpdateDTO → Raw Data | `extractUpdateData()` | Plain object |

```typescript
// ✅ GOOD - Clear, consistent naming
export class DeviceMapper {
  public static toDTO(device: NetworkDevice): DeviceDTO { }
  public static toListDTO(devices: NetworkDevice[], ...): DeviceListDTO { }
  public static extractCreateData(dto: CreateDeviceDTO): object { }
  public static extractUpdateData(dto: UpdateDeviceDTO): object { }
}

// ❌ BAD - Inconsistent naming
export class DeviceMapper {
  public static convertToDTO(device: NetworkDevice): DeviceDTO { }
  public static fromDomain(device: NetworkDevice): DeviceDTO { }
  public static toDomainInput(dto: CreateDeviceDTO): object { }
  public static getUpdateFields(dto: UpdateDeviceDTO): object { }
}
```

### File Names

**Pattern:** `{EntityName}Mapper.ts`

```
✅ GOOD
src/application/mappers/NetworkDeviceMapper.ts
src/application/mappers/PollingConfigurationMapper.ts

❌ BAD
src/application/mappers/device-mapper.ts
src/application/mappers/Mapper.ts
src/application/NetworkDeviceMapper.ts
```

---

## 7. Style Rules

### Static Class Pattern

```typescript
// ✅ GOOD - Static methods, no instantiation
export class EntityMapper {
  public static toDTO(entity: Entity): EntityDTO {
    // ...
  }
}

// ❌ BAD - Instance methods
export class EntityMapper {
  constructor() { }

  public toDTO(entity: Entity): EntityDTO {
    // ...
  }
}
```

### No Dependencies

```typescript
// ✅ GOOD - Pure functions, no dependencies
export class DeviceMapper {
  public static toDTO(device: NetworkDevice): DeviceDTO {
    return { ... };
  }
}

// ❌ BAD - Injected dependencies
export class DeviceMapper {
  constructor(
    private logger: ILogger,           // No!
    private validator: IValidator      // No!
  ) {}
}
```

### No Side Effects

```typescript
// ✅ GOOD - Pure transformation
public static toDTO(device: NetworkDevice): DeviceDTO {
  return {
    id: device.id.toString(),
    name: device.name
  };
}

// ❌ BAD - Side effects
public static toDTO(device: NetworkDevice): DeviceDTO {
  this.logger.info(`Mapping device ${device.id}`);  // Side effect!
  this.cache.set(device.id, device);                // Side effect!
  return {
    id: device.id.toString(),
    name: device.name
  };
}
```

### Synchronous by Default

```typescript
// ✅ GOOD - Synchronous transformation
public static toDTO(entity: Entity): EntityDTO {
  return { ... };
}

// ❌ BAD - Unnecessary async
public static async toDTO(entity: Entity): Promise<EntityDTO> {
  return { ... };  // No async operation needed!
}

// ✅ ACCEPTABLE - Only if truly necessary
public static async toDTOWithRelations(
  entity: Entity,
  relations: Promise<Relation[]>
): Promise<EntityDTO> {
  const resolvedRelations = await relations;
  return { entity, relations: resolvedRelations };
}
```

### TypeScript Best Practices

```typescript
// ✅ GOOD - Explicit types, clear structure
public static toDTO(device: NetworkDevice): NetworkDeviceDTO {
  return {
    id: device.id.toString(),
    name: device.name,
    status: device.status.toString()
  };
}

// ❌ BAD - Implicit any, unclear return type
public static toDTO(device) {
  return {
    id: device.id.toString(),
    name: device.name,
    // ... mapper returns 'any'
  };
}
```

---

## 8. Common Patterns

### Pattern 1: Value Object Extraction

```typescript
// Domain entity has Value Objects
class NetworkDevice {
  ipAddress: IPAddress;    // Value Object
  macAddress: MACAddress;  // Value Object
}

// ✅ GOOD - Extract primitive values
public static toDTO(device: NetworkDevice): DeviceDTO {
  return {
    ipAddress: device.ipAddress.toString(),   // or .value
    macAddress: device.macAddress.toString()
  };
}
```

### Pattern 2: Nested Aggregate Flattening

```typescript
// Domain has nested aggregates
class Order {
  customer: Customer;
  items: OrderItem[];
}

// ✅ GOOD - Flatten for DTO
public static toDTO(order: Order): OrderDTO {
  return {
    orderId: order.id.toString(),
    customerId: order.customer.id.toString(),
    customerName: order.customer.name,
    items: order.items.map(item => ({
      productId: item.product.id.toString(),
      quantity: item.quantity,
      price: item.price.value
    }))
  };
}
```

### Pattern 3: Optional Field Defaults

```typescript
// ✅ GOOD - Data-level defaults for optional fields
public static extractCreateData(dto: CreateDeviceDTO) {
  return {
    name: dto.name,
    description: dto.description ?? null,           // Data default
    port: dto.port ?? 161,                          // Data default
    enableRemoteAccess: dto.enableRemoteAccess ?? false
  };
}
```

### Pattern 4: Partial Updates

```typescript
// ✅ GOOD - Only extract provided fields
public static extractUpdateData(dto: UpdateDeviceDTO) {
  const updates: Partial<DeviceProps> = {};

  if (dto.name !== undefined) updates.name = dto.name;
  if (dto.description !== undefined) updates.description = dto.description;
  if (dto.port !== undefined) updates.port = dto.port;

  return updates;
}
```

### Pattern 5: Enum to String Conversion

```typescript
// Domain uses enums
enum DeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE'
}

// ✅ GOOD - Convert enum to string
public static toDTO(device: NetworkDevice): DeviceDTO {
  return {
    status: device.status.toString()  // or device.status as string
  };
}

// ❌ BAD - Mapper maps string to enum (business logic!)
public static extractCreateData(dto: CreateDeviceDTO) {
  return {
    status: this.mapToStatusEnum(dto.status)  // Use case responsibility!
  };
}
```

### Pattern 6: ID Conversion

```typescript
// ✅ GOOD - Extract string ID from Value Object
public static toDTO(device: NetworkDevice): DeviceDTO {
  return {
    id: device.id.toString(),
    parentId: device.parent?.id.toString() ?? null
  };
}
```

### Pattern 7: Timestamp Handling

```typescript
// ✅ GOOD - Convert Date objects as-is or to ISO strings
public static toDTO(entity: Entity): EntityDTO {
  return {
    createdAt: entity.createdAt,              // Keep as Date
    updatedAt: entity.updatedAt.toISOString() // Convert to ISO string
  };
}
```

---

## 9. Anti-Patterns

### ❌ Anti-Pattern 1: Validation in Mapper

```typescript
// ❌ BAD
public static extractCreateData(dto: CreateDeviceDTO) {
  if (!dto.name || dto.name.trim().length === 0) {
    throw new Error('Name is required');
  }
  if (dto.name.length > 255) {
    throw new Error('Name too long');
  }
  return { name: dto.name };
}

// ✅ GOOD - Use case validates
public static extractCreateData(dto: CreateDeviceDTO) {
  return { name: dto.name };  // Just extract
}
```

### ❌ Anti-Pattern 2: Value Object Creation

```typescript
// ❌ BAD - Mapper creates Value Objects
public static extractCreateData(dto: CreateDeviceDTO) {
  const ipAddress = IPAddress.create(dto.ipAddress);  // NO!
  if (ipAddress.isFailure) {
    throw new Error(ipAddress.error);
  }
  return { ipAddress: ipAddress.value };
}

// ✅ GOOD - Return raw string
public static extractCreateData(dto: CreateDeviceDTO) {
  return { ipAddress: dto.ipAddress };  // Use case creates VO
}
```

### ❌ Anti-Pattern 3: Business Logic

```typescript
// ❌ BAD - Mapper applies business rules
public static extractCreateData(dto: CreateDeviceDTO) {
  // Business rule: ACCESS_POINT gets 30s interval
  const interval = dto.deviceType === 'ACCESS_POINT' ? 30 : 60;
  return {
    deviceType: dto.deviceType,
    pollingInterval: interval  // Business logic!
  };
}

// ✅ GOOD - Use case determines business defaults
public static extractCreateData(dto: CreateDeviceDTO) {
  return {
    deviceType: dto.deviceType  // Just pass through
  };
}
```

### ❌ Anti-Pattern 4: Repository Calls

```typescript
// ❌ BAD - Mapper calls repository
public static async toDTO(device: NetworkDevice): Promise<DeviceDTO> {
  const stats = await this.statsRepo.getStats(device.id);  // NO!
  return {
    id: device.id.toString(),
    stats: stats
  };
}

// ✅ GOOD - Use case fetches related data
public static toDTO(device: NetworkDevice, stats: Stats): DeviceDTO {
  return {
    id: device.id.toString(),
    stats: {
      uptime: stats.uptime,
      lastSeen: stats.lastSeen
    }
  };
}
```

### ❌ Anti-Pattern 5: Entity Construction

```typescript
// ❌ BAD - Mapper constructs entity
public static toDomain(dto: CreateDeviceDTO): Result<NetworkDevice> {
  const ipAddress = IPAddress.create(dto.ipAddress);
  const macAddress = MACAddress.create(dto.macAddress);

  return NetworkDevice.create({
    ipAddress: ipAddress.value,
    macAddress: macAddress.value,
    // ... construct entire entity
  });
}

// ✅ GOOD - Use case constructs entity
public static extractCreateData(dto: CreateDeviceDTO) {
  return {
    ipAddress: dto.ipAddress,
    macAddress: dto.macAddress
    // ... just raw data
  };
}
```

### ❌ Anti-Pattern 6: Enum Mapping with Business Logic

```typescript
// ❌ BAD - Mapper maps to domain enums
public static extractCreateData(dto: CreateDeviceDTO) {
  return {
    deviceType: this.mapDeviceType(dto.deviceType)  // Business logic!
  };
}

private static mapDeviceType(typeStr: string): NetworkDeviceType {
  // Business decision with fallback
  return NetworkDeviceType[typeStr] ?? NetworkDeviceType.UNKNOWN;
}

// ✅ GOOD - Pass string, let use case map
public static extractCreateData(dto: CreateDeviceDTO) {
  return {
    deviceType: dto.deviceType  // Use case maps to enum
  };
}
```

### ❌ Anti-Pattern 7: Logging

```typescript
// ❌ BAD - Mapper logs
public static toDTO(device: NetworkDevice): DeviceDTO {
  this.logger.info(`Mapping device ${device.id}`);  // NO!
  return { ... };
}

// ✅ GOOD - No logging
public static toDTO(device: NetworkDevice): DeviceDTO {
  return { ... };  // Pure transformation
}
```

---

## 10. Validation Checklist

Use this checklist when creating or reviewing mappers:

### Structure Checklist

- [ ] Class name follows `{EntityName}Mapper` pattern
- [ ] All methods are static
- [ ] No constructor or dependencies
- [ ] File located in `src/application/mappers/`
- [ ] Proper JSDoc comments on class and methods

### Responsibility Checklist

- [ ] Mapper only transforms data structures
- [ ] No Value Object creation
- [ ] No entity/aggregate construction
- [ ] No business rule validation
- [ ] No enum mapping with business logic
- [ ] No repository calls
- [ ] No event dispatching

### Method Checklist

- [ ] `toDTO()` method present and returns DTO
- [ ] `extractCreateData()` returns plain object with primitives
- [ ] `extractUpdateData()` returns only provided fields
- [ ] `toListDTO()` present if needed for lists
- [ ] All methods are pure functions (no side effects)

### Code Quality Checklist

- [ ] No try/catch unless for unexpected errors
- [ ] No logging statements
- [ ] No async unless absolutely necessary
- [ ] Explicit TypeScript types on all parameters and returns
- [ ] No `any` types
- [ ] Clear, descriptive parameter names

### Orthogonality Checklist

- [ ] Changing domain validation won't require mapper changes
- [ ] Changing DTO structure won't affect domain
- [ ] Mapper doesn't know about business rules
- [ ] Value Object implementations can change without mapper changes

### Testing Checklist

- [ ] Mapper can be tested in isolation
- [ ] No mocks needed for mapper tests
- [ ] Tests verify structural transformation only
- [ ] Tests don't validate business logic

---

## Final Instruction

**This document is the authoritative standard for all application-layer mappers in this project.**

When creating, modifying, or reviewing any mapper:

1. **Reference this document** to ensure compliance
2. **Validate against the checklist** in Section 10
3. **Follow the patterns** in Section 8
4. **Avoid the anti-patterns** in Section 9
5. **Maintain orthogonality** as defined in Section 4

**Mappers are pure data transformers. Nothing more, nothing less.**

Any deviation from this standard must be explicitly documented and justified with a compelling architectural reason.

---

**Document Status:** This is a living document. Update as architectural patterns evolve, but maintain the core principle: **Mappers transform data structure, Use Cases orchestrate business logic.**
