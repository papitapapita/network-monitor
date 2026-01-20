# APPLICATION DTOS STANDARD

## Table of Contents

1. [Purpose of DTOs in DDD](#1-purpose-of-dtos-in-ddd)
2. [Responsibilities of a DTO](#2-responsibilities-of-a-DTO)
3. [Boundaries of a DTO](#3-boundaries-of-a-dto)
4. [Connections with Other Layers](#4-connections-with-other-layers)
5. [Types of DTOs](#5-types-of-dtos)
6. [DTO Structure Templates](#6-dto-structure-templates)
7. [Orthogonality Principles](#7-orthogonality-principles)
8. [Naming Conventions](#8-naming-conventions)
9. [Validation Patterns](#9-validation-patterns)
10. [Testing Strategy](#10-testing-strategy)
11. [Examples](#11-examples)

---

## 1. Purpose of DTOs in DDD

**DTOs (Data Transfer Objects) are simple data structures used to transfer data between layers, specifically across architectural boundaries.**

### Core Characteristics:

- **Data Holders**: Contain only data, no business logic
- **Serializable**: Can be converted to/from JSON
- **Flat Structure**: Simple properties, no complex domain objects
- **Boundary Objects**: Cross layer boundaries (API ↔ Application)
- **Version-able**: Can evolve independently of domain

### Why DTOs?

1. **Layer Separation**: Keep domain independent of presentation
2. **API Contracts**: Define stable external interfaces
3. **Serialization**: Easy JSON conversion for HTTP APIs
4. **Versioning**: Support API versioning without changing domain
5. **Decoupling**: Presentation doesn't know about domain structure
6. **Security**: Don't expose internal domain structure

### DTOs vs Domain Objects:

| Aspect         | DTO                | Domain Object         |
| -------------- | ------------------ | --------------------- |
| **Purpose**    | Data transfer      | Business logic        |
| **Validation** | Format validation  | Business rules        |
| **Location**   | Application layer  | Domain layer          |
| **Structure**  | Flat, simple types | Complex, rich objects |
| **Mutability** | Usually mutable    | Often immutable (VOs) |
| **Logic**      | None               | Business behavior     |

---

## 2. Responsibilities of a DTO

### MUST DO:

1. **Hold Data**

   - Properties for data transfer
   - Simple types (string, number, boolean, Date)
   - Nested DTOs if needed

2. **Be Serializable**

   - Convert to/from JSON
   - No circular references
   - No methods (except getters/setters)

3. **Define API Contract**

   - Clear property types
   - Optional vs required fields
   - Documentation for consumers

4. **Enable Validation**
   - Provide structure for validation
   - Clear types for validation rules
   - No validation logic itself (done in validators/use cases)

---

## 3. Boundaries of a DTO

### MUST NOT DO:

1. **❌ Contain Business Logic**

   - No validation methods
   - No calculations
   - No domain rules
   - Pure data only

2. **❌ Reference Domain Objects**

   - No entities
   - No aggregates
   - No value objects
   - Use primitives or nested DTOs

3. **❌ Have Methods**

   - No behavior
   - Only data properties
   - Getters/setters acceptable

4. **❌ Know About Domain**

   - DTOs don't import domain types

5. **❌ Expose Internal IDs**
   - Use string IDs externally
   - Don't expose UniqueEntityID objects
   - Convert at boundary

---

## 4. Connections with Other Layers

```
┌─────────────────────────────────────────────────────────────┐
│                 PRESENTATION LAYER (API)                    │
│  ┌───────────────────────────────────────────────────┐      │
│  │  Controllers/Resolvers                            │      │
│  │  - Receive DTOs from HTTP requests                │      │
│  │  - Send DTOs in HTTP responses                    │      │
│  │  - Validate DTO format (basic)                    │      │
│  └───────────────────────────────────────────────────┘      │
│         │                                  ▲                │
│         │ Request DTO                      │ Response DTO   │
│         ▼                                  │                │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  APPLICATION LAYER                          │
│  ┌───────────────────────────────────────────────────┐      │
│  │  DTOs (You are here)                              │      │
│  │  - Request DTOs (input)                           │      │
│  │  - Response DTOs (output)                         │      │
│  │  - Simple data structures                         │      │
│  │  - Serializable to/from JSON                      │      │
│  └───────────────────────────────────────────────────┘      │
│         │                                   ▲               │
│         │                                   │               │
│  ┌───────────────────────────────────────────────────┐      │
│  │  Use Cases                                        │      │
│  │  - Receive Request DTOs                           │      │
│  │  - Extract data from DTOs through mappers         │      │
│  │  - Create domain objects                          │      │
│  │  - Call domain operations                         │      │
│  │  - Convert results to Response DTOs               │      │
│  └───────────────────────────────────────────────────┘      │
│         │                                 ▲                 │
│         │ Domain objects                  │ Domain objects  │
│         ▼                                 │                 │
│  ┌───────────────────────────────────────────────────┐      │
│  │  Mappers                                          │      │
│  │  - DTO → Domain (extractCreateData, etc.)         │      │
│  │  - Domain → DTO (toDTO, toListDTO)                │      │
│  └───────────────────────────────────────────────────┘      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     DOMAIN LAYER                            │
│  - Entities, Aggregates, Value Objects                      │
│  - Never knows about DTOs                                   │
│  - Pure business logic                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Types of DTOs

### 1. Request DTOs (Input)

Used as input to use cases:

```typescript
// Create request
export interface CreateNetworkDeviceRequestDTO {
  name: string;
  ipAddress: string;
  macAddress: string;
  deviceType: string;
  description?: string;
}

// Update request
export interface UpdateNetworkDeviceRequestDTO {
  name?: string;
  description?: string;
  status?: string;
}

// Query request
export interface GetDevicesByStatusRequestDTO {
  status: string;
  limit?: number;
  offset?: number;
}
```

### 2. Response DTOs (Output)

Used as output from use cases:

```typescript
// Single entity response
export interface NetworkDeviceResponseDTO {
  id: string;
  name: string;
  ipAddress: string;
  macAddress: string;
  status: string;
  createdAt: string; // ISO date string
  updatedAt: string;
}

// List response
export interface NetworkDeviceListResponseDTO {
  devices: NetworkDeviceResponseDTO[];
  total: number;
  limit: number;
  offset: number;
}
```

### 3. Nested DTOs

DTOs can contain other DTOs:

```typescript
export interface OrderResponseDTO {
  id: string;
  customerId: string;
  items: OrderItemDTO[]; // Nested DTO
  shipping: ShippingInfoDTO; // Nested DTO
  total: number;
  status: string;
}

export interface OrderItemDTO {
  id: string;
  productId: string;
  quantity: number;
  price: number;
}

export interface ShippingInfoDTO {
  address: string;
  city: string;
  state: string;
  zipCode: string;
}
```

### 4. Command DTOs

For command-style operations:

```typescript
export interface ConfirmOrderCommandDTO {
  orderId: string;
}

export interface CancelOrderCommandDTO {
  orderId: string;
  reason: string;
}

export interface ProcessPaymentCommandDTO {
  orderId: string;
  paymentMethodId: string;
}
```

### 5. Query DTOs

For query operations:

```typescript
export interface GetOrdersQueryDTO {
  customerId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface SearchDevicesQueryDTO {
  searchTerm: string;
  deviceType?: string;
  status?: string;
}
```

---

## 6. DTO Structure Templates

### Request DTO Template:

````typescript
/**
 * Request DTO for [Operation Name].
 *
 * Used By:
 * - [Use Case Name]
 *
 * API Endpoint:
 * - POST /api/[endpoint]
 *
 * Validation Rules:
 * - [Field 1]: [Rules]
 * - [Field 2]: [Rules]
 *
 * @example
 * ```json
 * {
 *   "field1": "value",
 *   "field2": 123
 * }
 * ```
 */
export interface OperationNameRequestDTO {
  /**
   * [Field description]
   * Required/Optional
   * Validation: [rules]
   */
  field1: string;

  /**
   * [Field description]
   * Required/Optional
   * Validation: [rules]
   */
  field2: number;

  /**
   * [Field description]
   * Optional
   */
  field3?: boolean;
}
````

### Response DTO Template:

````typescript
/**
 * Response DTO for [Entity Name].
 *
 * Returned By:
 * - [Use Case 1]
 * - [Use Case 2]
 *
 * API Endpoint:
 * - GET /api/[endpoint]/:id
 *
 * @example
 * ```json
 * {
 *   "id": "123",
 *   "field1": "value",
 *   "createdAt": "2024-01-01T00:00:00Z"
 * }
 * ```
 */
export interface EntityNameResponseDTO {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * [Field description]
   */
  field1: string;

  /**
   * [Field description]
   */
  field2: number;

  /**
   * When entity was created (ISO 8601)
   */
  createdAt: string;

  /**
   * When entity was last updated (ISO 8601)
   */
  updatedAt: string;
}
````

### List Response DTO Template:

```typescript
/**
 * Paginated list response for [Entity Name].
 *
 * Returned By:
 * - [Use Case Name]
 *
 * API Endpoint:
 * - GET /api/[endpoint]
 */
export interface EntityNameListResponseDTO {
  /**
   * Array of entities
   */
  items: EntityNameResponseDTO[];

  /**
   * Total number of entities (before pagination)
   */
  total: number;

  /**
   * Number of items per page
   */
  limit: number;

  /**
   * Number of items skipped
   */
  offset: number;

  /**
   * Whether there are more items
   */
  hasMore: boolean;
}
```

### Error Response DTO:

```typescript
/**
 * Standard error response DTO.
 *
 * Used for all error responses across the API.
 */
export interface ErrorResponseDTO {
  /**
   * Error message
   */
  message: string;

  /**
   * Error code (for client-side handling)
   */
  code?: string;

  /**
   * Field-specific errors (for validation)
   */
  errors?: FieldError[];

  /**
   * Stack trace (development only)
   */
  stack?: string;
}

export interface FieldError {
  field: string;
  message: string;
  code?: string;
}
```

---

## 7. Orthogonality Principles

### 1. Flat Structure

Keep DTOs simple and flat:

```typescript
// ✅ GOOD - Flat structure with nested DTOs
export interface OrderResponseDTO {
  id: string;
  customerId: string;
  total: number;
  items: OrderItemDTO[]; // Array of DTOs
  shipping: ShippingDTO; // Nested DTO
}

// ❌ BAD - Deep nesting
export interface OrderResponseDTO {
  id: string;
  customer: {
    id: string;
    profile: {
      name: string;
      address: {
        street: string;
        city: {
          name: string;
          state: {
            code: string;
            // Too deep!
          };
        };
      };
    };
  };
}
```

### 2. Primitive Types

Use primitives for external representation:

```typescript
// ✅ GOOD - Primitives
export interface DeviceResponseDTO {
  id: string; // Not UniqueEntityID
  ipAddress: string; // Not IPAddress VO
  macAddress: string; // Not MACAddress VO
  status: string; // Not enum (for API flexibility)
  createdAt: string; // ISO date string
}

// ❌ BAD - Domain types
export interface DeviceResponseDTO {
  id: NetworkDeviceId; // Domain type!
  ipAddress: IPAddress; // Value Object!
  status: NetworkDeviceStatus; // Enum!
}
```

### 3. No Business Logic

DTOs have no methods or logic:

```typescript
// ✅ GOOD - Data only
export interface ProductDTO {
  id: string;
  name: string;
  price: number;
  inStock: boolean;
}

// ❌ BAD - Methods/logic
export interface ProductDTO {
  id: string;
  name: string;
  price: number;
  stockQuantity: number;

  // Business logic in DTO!
  isInStock(): boolean {
    return this.stockQuantity > 0;
  }

  calculateDiscount(percent: number): number {
    return this.price * (percent / 100);
  }
}
```

### 4. Consistent Naming

Use consistent patterns across DTOs:

```typescript
// ✅ GOOD - Consistent patterns
export interface CreateOrderRequestDTO {}
export interface UpdateOrderRequestDTO {}
export interface OrderResponseDTO {}
export interface OrderListResponseDTO {}

export interface CreateProductRequestDTO {}
export interface UpdateProductRequestDTO {}
export interface ProductResponseDTO {}
export interface ProductListResponseDTO {}
```

---

## 8. Naming Conventions

### DTO Names:

- Describe purpose clearly
- End with `DTO` suffix
- Use descriptive prefixes

```typescript
// Request DTOs
export interface CreateNetworkDeviceRequestDTO {}
export interface UpdateNetworkDeviceRequestDTO {}
export interface DeleteNetworkDeviceRequestDTO {}

// Response DTOs
export interface NetworkDeviceDTO {} // or
export interface NetworkDeviceResponseDTO {} // more explicit
export interface NetworkDeviceListDTO {} // for lists

// Query DTOs
export interface GetDevicesByStatusQueryDTO {}
export interface SearchDevicesQueryDTO {}

// Command DTOs
export interface ConfirmOrderCommandDTO {}
export interface CancelOrderCommandDTO {}
```

### Property Names:

- Use camelCase
- Be descriptive
- Match API contract

```typescript
export interface OrderDTO {
  id: string; // ✅ camelCase
  orderId: string; // ✅ if needed for clarity
  customerId: string; // ✅ descriptive
  totalAmount: number; // ✅ clear
  createdAt: string; // ✅ timestamp

  // ❌ BAD
  ID: string; // Wrong case
  customer_id: string; // snake_case
  amt: number; // Abbreviated
  created: string; // Ambiguous
}
```

### File Names:

```
src/application/dtos/
  network-device/
    CreateNetworkDeviceRequestDTO.ts      // ✅
    UpdateNetworkDeviceRequestDTO.ts      // ✅
    NetworkDeviceResponseDTO.ts           // ✅
    NetworkDeviceListResponseDTO.ts       // ✅

  orders/
    CreateOrderRequestDTO.ts              // ✅
    OrderResponseDTO.ts                   // ✅
```

---

## 9. Validation Patterns

### Where Validation Happens:

```typescript
// 1. DTO defines structure (no validation)
export interface CreateOrderRequestDTO {
  customerId: string;
  items: OrderItemDTO[];
  shippingAddress: string;
}

// 2. Validator validates DTO format (in presentation/application)
export class CreateOrderRequestValidator {
  validate(dto: CreateOrderRequestDTO): ValidationResult {
    const errors: FieldError[] = [];

    if (!dto.customerId || dto.customerId.trim().length === 0) {
      errors.push({ field: 'customerId', message: 'Customer ID is required' });
    }

    if (!dto.items || dto.items.length === 0) {
      errors.push({ field: 'items', message: 'At least one item required' });
    }

    return errors.length > 0
      ? ValidationResult.fail(errors)
      : ValidationResult.ok();
  }
}

// 3. Use Case creates domain objects (business validation)
export class CreateOrderUseCase {
  async execute(request: CreateOrderRequestDTO): Promise<Result<OrderDTO>> {
    // Format already validated by validator

    // Create Value Objects (domain validation)
    const customerId = CustomerId.create(request.customerId);
    if (customerId.isFailure) {
      return Result.fail(customerId.error);
    }

    // Create aggregate (business rules)
    const order = Order.create({ ... });
    if (order.isFailure) {
      return Result.fail(order.error);
    }

    // ...
  }
}
```

### Using Validation Libraries:

```typescript
import { z } from 'zod';

// Zod schema for DTO validation
export const CreateOrderRequestSchema = z.object({
  customerId: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive()
      })
    )
    .min(1),
  shippingAddress: z.string().min(1)
});

// Infer TypeScript type from schema
export type CreateOrderRequestDTO = z.infer<
  typeof CreateOrderRequestSchema
>;

// Validate in controller/handler
const validationResult =
  CreateOrderRequestSchema.safeParse(requestBody);
if (!validationResult.success) {
  return res
    .status(400)
    .json({ errors: validationResult.error.errors });
}

const dto = validationResult.data; // Validated DTO
```

---

## 10. Testing Strategy

### DTO Validation Tests:

```typescript
describe('CreateNetworkDeviceRequestDTO Validation', () => {
  let validator: CreateNetworkDeviceRequestValidator;

  beforeEach(() => {
    validator = new CreateNetworkDeviceRequestValidator();
  });

  describe('valid DTOs', () => {
    it('should pass validation with all required fields', () => {
      const dto: CreateNetworkDeviceRequestDTO = {
        name: 'Router-01',
        ipAddress: '192.168.1.1',
        macAddress: '00:11:22:33:44:55',
        deviceType: 'ROUTER'
      };

      const result = validator.validate(dto);

      expect(result.isValid).toBe(true);
    });

    it('should pass validation with optional fields', () => {
      const dto: CreateNetworkDeviceRequestDTO = {
        name: 'Router-01',
        ipAddress: '192.168.1.1',
        macAddress: '00:11:22:33:44:55',
        deviceType: 'ROUTER',
        description: 'Main router' // Optional
      };

      const result = validator.validate(dto);

      expect(result.isValid).toBe(true);
    });
  });

  describe('invalid DTOs', () => {
    it('should fail if name is missing', () => {
      const dto = {
        ipAddress: '192.168.1.1',
        macAddress: '00:11:22:33:44:55',
        deviceType: 'ROUTER'
      } as CreateNetworkDeviceRequestDTO;

      const result = validator.validate(dto);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'name' })
      );
    });

    it('should fail if IP address format is invalid', () => {
      const dto: CreateNetworkDeviceRequestDTO = {
        name: 'Router-01',
        ipAddress: 'invalid-ip',
        macAddress: '00:11:22:33:44:55',
        deviceType: 'ROUTER'
      };

      const result = validator.validate(dto);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'ipAddress' })
      );
    });
  });
});
```

### DTO Serialization Tests:

```typescript
describe('NetworkDeviceResponseDTO Serialization', () => {
  it('should serialize to JSON correctly', () => {
    const dto: NetworkDeviceResponseDTO = {
      id: 'device-123',
      name: 'Router-01',
      ipAddress: '192.168.1.1',
      macAddress: '00:11:22:33:44:55',
      status: 'ONLINE',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    const json = JSON.stringify(dto);
    const parsed = JSON.parse(json);

    expect(parsed).toEqual(dto);
  });

  it('should deserialize from JSON correctly', () => {
    const json = `{
      "id": "device-123",
      "name": "Router-01",
      "ipAddress": "192.168.1.1",
      "macAddress": "00:11:22:33:44:55",
      "status": "ONLINE",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }`;

    const dto: NetworkDeviceResponseDTO = JSON.parse(json);

    expect(dto.id).toBe('device-123');
    expect(dto.name).toBe('Router-01');
  });
});
```

---

## 11. Examples

### Example 1: NetworkDevice DTOs

```typescript
/**
 * Request DTO for creating a network device.
 *
 * Used By: CreateNetworkDeviceUseCase
 * API Endpoint: POST /api/devices
 *
 * Validation Rules:
 * - name: Required, 1-100 characters
 * - ipAddress: Required, valid IPv4 format
 * - macAddress: Required, valid MAC format
 * - deviceType: Required, one of: ROUTER, SWITCH, ACCESS_POINT, etc.
 * - description: Optional, max 500 characters
 */
export interface CreateNetworkDeviceRequestDTO {
  name: string;
  ipAddress: string;
  macAddress: string;
  deviceType: string;
  description?: string;
  pollingInterval?: number; // Seconds
}

/**
 * Request DTO for updating a network device.
 *
 * Used By: UpdateNetworkDeviceUseCase
 * API Endpoint: PATCH /api/devices/:id
 *
 * All fields optional (partial update).
 */
export interface UpdateNetworkDeviceRequestDTO {
  name?: string;
  description?: string;
  status?: string;
}

/**
 * Response DTO for network device.
 *
 * Returned By:
 * - GetNetworkDeviceUseCase
 * - CreateNetworkDeviceUseCase
 * - UpdateNetworkDeviceUseCase
 *
 * API Endpoints:
 * - GET /api/devices/:id
 * - POST /api/devices
 * - PATCH /api/devices/:id
 */
export interface NetworkDeviceResponseDTO {
  id: string;
  name: string;
  ipAddress: string;
  macAddress: string;
  deviceType: string;
  status: string;
  description: string | null;
  pollingEnabled: boolean;
  lastPollTime: string | null; // ISO date string
  createdAt: string;
  updatedAt: string;

  // Nested DTO for polling configuration
  polling: PollingConfigurationDTO;
}

export interface PollingConfigurationDTO {
  intervalSeconds: number;
  enabled: boolean;
  maxRetries: number;
  lastPollAt: string | null;
  nextPollAt: string | null;
}

/**
 * Paginated list response for network devices.
 *
 * Returned By: ListNetworkDevicesUseCase
 * API Endpoint: GET /api/devices
 */
export interface NetworkDeviceListResponseDTO {
  devices: NetworkDeviceResponseDTO[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
```

### Example 2: Order DTOs

```typescript
/**
 * Request DTO for creating an order.
 */
export interface CreateOrderRequestDTO {
  customerId: string;
  items: CreateOrderItemDTO[];
  shippingAddress: ShippingAddressDTO;
  paymentMethodId: string;
}

export interface CreateOrderItemDTO {
  productId: string;
  quantity: number;
  price: number;
}

export interface ShippingAddressDTO {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

/**
 * Response DTO for order.
 */
export interface OrderResponseDTO {
  id: string;
  orderNumber: string;
  customerId: string;
  items: OrderItemDTO[];
  shipping: ShippingAddressDTO;
  subtotal: number;
  tax: number;
  shippingCost: number;
  total: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export interface OrderItemDTO {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

/**
 * Query DTO for searching orders.
 */
export interface SearchOrdersQueryDTO {
  customerId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
  offset?: number;
}
```

### Example 3: Polling Result DTOs

```typescript
/**
 * Request DTO for executing device polling.
 */
export interface ExecutePollingRequestDTO {
  deviceId: string;
}

/**
 * Response DTO for polling result.
 */
export interface PollingResultResponseDTO {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceIpAddress: string;
  timestamp: string;
  status: string; // SUCCESS, PARTIAL_SUCCESS, FAILED, TIMEOUT
  deviceStatus: string; // ONLINE, OFFLINE, DEGRADED
  attemptNumber: number;
  errorMessage: string | null;

  // Nested metrics DTO (null if polling failed)
  metrics: PollingMetricsDTO | null;
}

export interface PollingMetricsDTO {
  responseTimes: number[];
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  jitter: number;
  packetsSent: number;
  packetsReceived: number;
  packetLoss: number;
  ttl: number | null;
}

/**
 * List response for polling history.
 */
export interface PollingHistoryResponseDTO {
  results: PollingResultResponseDTO[];
  deviceId: string;
  deviceName: string;
  startDate: string;
  endDate: string;
  total: number;
}
```

---

## Summary Checklist

When creating a DTO, ensure:

- ✅ Located in application layer (src/application/dtos/)
- ✅ Name ends with DTO suffix
- ✅ Contains only data properties (no methods)
- ✅ Uses primitive types (string, number, boolean, Date)
- ✅ All properties documented with JSDoc
- ✅ Serializable to/from JSON
- ✅ No references to domain objects
- ✅ Clear purpose (Request/Response/Query/Command)
- ✅ Validation handled separately (not in DTO)
- ✅ Consistent naming with other DTOs
- ✅ Optional fields marked with `?`
- ✅ Dates as ISO strings (not Date objects)
- ✅ Example JSON in documentation

---

**Remember**: DTOs are simple data structures for transferring data across boundaries. Keep them flat, use primitives, and let mappers handle the conversion to/from domain objects!
