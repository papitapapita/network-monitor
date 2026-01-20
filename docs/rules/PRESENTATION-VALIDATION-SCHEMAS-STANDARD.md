# PRESENTATION VALIDATION SCHEMAS STANDARD

## Table of Contents

1. [Purpose of Validation Schemas in DDD](#1-purpose-of-validation-schemas-in-ddd)
2. [Responsibilities of Validation Schemas](#2-responsibilities-of-validation-schemas)
3. [Boundaries of Validation Schemas](#3-boundaries-of-validation-schemas)
4. [Connections with Other Layers](#4-connections-with-other-layers)
5. [Validation Schema Lifetime & Lifecycle](#5-validation-schema-lifetime--lifecycle)
6. [Validation Schema Structure Template](#6-validation-schema-structure-template)
7. [Orthogonality Principles](#7-orthogonality-principles)
8. [Naming Conventions](#8-naming-conventions)
9. [Error Handling Patterns](#9-error-handling-patterns)
10. [Testing Strategy](#10-testing-strategy)
11. [Examples](#11-examples)
12. [Summary Checklist](#12-summary-checklist)

---

## 1. Purpose of Validation Schemas in DDD

**Validation Schemas are presentation layer components that define the structure and validation rules for incoming HTTP requests using Zod, ensuring data integrity before reaching business logic.**

### Core Characteristics:

- **Type-Safe Validation**: Uses Zod for compile-time and runtime type safety
- **HTTP-Specific**: Validates HTTP request structure (body, params, query, headers)
- **Fail-Fast**: Rejects invalid requests before business logic executes
- **Declarative**: Schema definitions are declarative, not imperative
- **Reusable**: Schemas can be composed and extended
- **Auto-Documentation**: TypeScript types inferred from schemas

### Why Validation Schemas?

1. **Security**: Prevent malformed data from entering the system
2. **Type Safety**: Compile-time guarantees about request structure
3. **Performance**: Fail fast on invalid data (don't waste CPU on business logic)
4. **Separation of Concerns**: HTTP validation separate from domain validation
5. **Better Error Messages**: Descriptive validation errors for API consumers
6. **DRY**: Reusable validation patterns

### Validation Schemas vs Domain Validation:

| Aspect                 | Validation Schemas (Presentation) | Domain Validation (Domain)        |
| ---------------------- | --------------------------------- | --------------------------------- |
| **Layer**              | Presentation                      | Domain                            |
| **Purpose**            | HTTP request structure validation | Business rule validation          |
| **Examples**           | "IP must match regex"             | "IP must not be in private range" |
|                        | "Name cannot be empty"            | "Name must be unique"             |
|                        | "Port must be 1-65535"            | "Device must be online to poll"   |
| **When**               | BEFORE use case execution         | DURING domain logic               |
| **Error Response**     | 400 Bad Request                   | 400/409 with domain error         |
| **Technology**         | Zod schemas                       | Value object validation           |
| **Knows About**        | HTTP, JSON                        | Business rules                    |

---

## 2. Responsibilities of Validation Schemas

### MUST DO:

1. **Validate Request Structure**

   - Define expected shape of req.body, req.params, req.query
   - Specify required vs optional fields
   - Set data types (string, number, boolean, etc.)

2. **Validate Data Formats**

   - Regex patterns (IP address, MAC address, UUID, email)
   - String lengths (min, max)
   - Number ranges (min, max)
   - Enum values

3. **Provide Default Values**

   - Set sensible defaults for optional fields
   - Example: `limit` defaults to 20, `offset` defaults to 0

4. **Transform Input**

   - Convert query strings to numbers (e.g., `"20"` → `20`)
   - Trim whitespace
   - Normalize formats (e.g., lowercase emails)

5. **Generate TypeScript Types**

   - Use `z.infer<typeof schema>` for type safety
   - Export types for controllers to use

6. **Provide Descriptive Error Messages**

   - Custom error messages for each validation rule
   - Use `.describe()` for field documentation

7. **Define Constants for Reusability**
   - Extract regex patterns, enum values, limits
   - Share across schemas

---

## 3. Boundaries of Validation Schemas

### MUST NOT DO:

1. **❌ Contain Business Logic**

   - NO uniqueness checks (e.g., "IP already exists")
   - NO database queries
   - NO domain rules (e.g., "device must be online")
   - **Why**: Business logic belongs in domain/application layers

2. **❌ Access External Services**

   - NO database calls
   - NO API requests
   - NO file system access
   - **Why**: Schemas are pure data validation

3. **❌ Depend on Domain Entities**

   - NO imports of aggregates, entities, value objects
   - Only primitive types and DTOs
   - **Why**: Presentation should not know domain internals

4. **❌ Perform Complex Transformations**

   - NO data enrichment (adding fields)
   - NO lookups or joins
   - Only simple coercion (string → number)
   - **Why**: Transformations are business logic

5. **❌ Validate Business Rules**

   - NO "device must be online to activate"
   - NO "order total must match sum of items"
   - **Why**: Business rules are domain responsibility

6. **❌ Be Overly Restrictive**

   - Don't duplicate domain validation
   - Only validate HTTP-level concerns
   - **Why**: Let domain handle business constraints

---

## 4. Connections with Other Layers

```
┌──────────────────────────────────────────────────┐
│          PRESENTATION LAYER                       │
│                                                    │
│  ┌────────────────┐        ┌─────────────────┐   │
│  │ Validation     │  used  │   Middleware    │   │
│  │ Schemas (Zod)  │───────→│ (validateRequest)│  │
│  └────────────────┘   by   └─────────────────┘   │
│          ↓                          ↓             │
│  (TypeScript types)          (validates req)      │
│          ↓                          ↓             │
│  ┌────────────────┐        ┌─────────────────┐   │
│  │  Controllers   │←───────│   Routes        │   │
│  └────────────────┘ called └─────────────────┘   │
└──────────────────────────────────────────────────┘
                    ↓
         APPLICATION LAYER (Use Cases)

Validation Flow:
1. Request arrives
2. Middleware validates with Zod schema
3. If invalid → 400 response (stop)
4. If valid → Controller executes → Use case
```

---

## 5. Validation Schema Lifetime & Lifecycle

### Instantiation Flow:

```typescript
// 1. Module Load - Schemas created at import time
// src/presentation/http/validation/network-device.schemas.ts

export const createNetworkDeviceSchema = z.object({
  body: z.object({
    ipAddress: z.string().regex(IP_ADDRESS_REGEX, 'Invalid IP'),
    name: z.string().min(1).max(255)
    // ...
  })
});

// 2. Route Definition - Schema passed to middleware
// src/presentation/http/routes/network-device.routes.ts

router.post(
  '/',
  validateRequest(createNetworkDeviceSchema), // Schema used here
  controller.create
);

// 3. Request Arrives - Middleware executes validation
// src/presentation/http/middleware/validateRequest.ts

export function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.errors
      });
    }

    next(); // Valid → continue to controller
  };
}

// 4. Controller Receives Validated Data
controller.create(req, res); // req.body is now validated
```

### Key Lifecycle Characteristics:

- **Created at import time**: Schemas are constants, created once
- **Immutable**: Never modified after creation
- **Stateless**: No instance state
- **Reusable**: Same schema used for all requests

---

## 6. Validation Schema Structure Template

### Basic Schema Template

```typescript
import { z } from 'zod';

/**
 * Zod validation schemas for [Resource] HTTP endpoints.
 *
 * These schemas validate incoming HTTP requests before they reach
 * the use cases, ensuring data integrity at the presentation layer.
 */

// =====================================
// SHARED CONSTANTS
// =====================================

/**
 * IP address regex pattern.
 * Matches: 0.0.0.0 to 255.255.255.255
 */
const IP_ADDRESS_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

/**
 * UUID v4 regex pattern.
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Valid [resource] statuses.
 */
const STATUSES = ['STATUS_1', 'STATUS_2', 'STATUS_3'] as const;

// =====================================
// CREATE SCHEMA
// =====================================

/**
 * Schema for creating a new [resource].
 *
 * POST /api/[resources]
 *
 * Validates:
 * - Required fields: [field1, field2, field3]
 * - Optional fields: [field4, field5]
 * - Field formats: [regex, min/max, enums]
 */
export const create[Resource]Schema = z.object({
  body: z.object({
    // Required string field with format validation
    [field1]: z
      .string()
      .regex(IP_ADDRESS_REGEX, 'Invalid [field1] format')
      .describe('[Field1] in [format]'),

    // Required string with length constraints
    [field2]: z
      .string()
      .min(1, '[Field2] cannot be empty')
      .max(255, '[Field2] cannot exceed 255 characters')
      .trim()
      .describe('Human-readable [field2]'),

    // Required enum field
    [field3]: z
      .enum(STATUSES, {
        errorMap: () => ({
          message: `[Field3] must be one of: ${STATUSES.join(', ')}`
        })
      })
      .describe('[Field3] type'),

    // Optional field with default
    [field4]: z
      .string()
      .max(1000, '[Field4] cannot exceed 1000 characters')
      .nullable()
      .optional()
      .describe('Optional [field4]'),

    // Optional number with range validation
    [field5]: z
      .number()
      .int('[Field5] must be an integer')
      .min(1, '[Field5] must be between 1 and 65535')
      .max(65535, '[Field5] must be between 1 and 65535')
      .optional()
      .default(8080)
      .describe('[Field5] number')
  })
});

// =====================================
// UPDATE SCHEMA
// =====================================

/**
 * Schema for updating an existing [resource].
 *
 * PUT /api/[resources]/:id
 *
 * Validates:
 * - ID parameter must be valid UUID
 * - At least one field must be provided
 * - All fields are optional (partial update)
 */
export const update[Resource]Schema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid [resource] ID (must be UUID)')
      .describe('[Resource] UUID')
  }),
  body: z
    .object({
      [field2]: z
        .string()
        .min(1)
        .max(255)
        .trim()
        .optional()
        .describe('New [field2]'),

      [field4]: z
        .string()
        .max(1000)
        .nullable()
        .optional()
        .describe('New [field4]'),

      [field5]: z
        .number()
        .int()
        .min(1)
        .max(65535)
        .optional()
        .describe('New [field5]')
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update'
    })
});

// =====================================
// LIST SCHEMA
// =====================================

/**
 * Schema for listing [resources] with query parameters.
 *
 * GET /api/[resources]
 *
 * Validates:
 * - Pagination: limit (1-100), offset (≥0)
 * - Filters: status, type
 */
export const list[Resource]sSchema = z.object({
  query: z.object({
    limit: z
      .string()
      .regex(/^\d+$/, 'Limit must be a positive number')
      .transform(Number)
      .refine((n) => n > 0 && n <= 100, {
        message: 'Limit must be between 1 and 100'
      })
      .optional()
      .describe('Maximum number of results'),

    offset: z
      .string()
      .regex(/^\d+$/, 'Offset must be a non-negative number')
      .transform(Number)
      .refine((n) => n >= 0, {
        message: 'Offset must be non-negative'
      })
      .optional()
      .describe('Offset for pagination'),

    status: z
      .enum(STATUSES)
      .optional()
      .describe('Filter by status')
  })
});

// =====================================
// GET BY ID SCHEMA
// =====================================

/**
 * Schema for getting a [resource] by ID.
 *
 * GET /api/[resources]/:id
 */
export const getByIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid [resource] ID (must be UUID)')
      .describe('[Resource] UUID')
  })
});

// =====================================
// DELETE SCHEMA
// =====================================

/**
 * Schema for deleting a [resource].
 *
 * DELETE /api/[resources]/:id
 */
export const delete[Resource]Schema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(UUID_REGEX, 'Invalid [resource] ID (must be UUID)')
      .describe('[Resource] UUID to delete')
  })
});

// =====================================
// TYPE EXPORTS
// =====================================

/**
 * TypeScript types inferred from Zod schemas.
 * Use these types in controllers for type safety.
 */
export type Create[Resource]Input = z.infer<typeof create[Resource]Schema>['body'];
export type Update[Resource]Input = z.infer<typeof update[Resource]Schema>['body'];
export type List[Resource]sQuery = z.infer<typeof list[Resource]sSchema>['query'];
export type GetByIdParams = z.infer<typeof getByIdSchema>['params'];
export type Delete[Resource]Params = z.infer<typeof delete[Resource]Schema>['params'];
```

---

### Complex Schema Template (with Nested Objects)

```typescript
import { z } from 'zod';

/**
 * Schema for creating an order with line items.
 */

// Nested object schema (reusable)
const orderItemSchema = z.object({
  productId: z.string().regex(UUID_REGEX, 'Invalid product ID'),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(1000, 'Quantity cannot exceed 1000'),
  price: z
    .number()
    .min(0, 'Price must be non-negative')
    .refine((val) => Number.isFinite(val), 'Price must be a valid number')
});

export const createOrderSchema = z.object({
  body: z.object({
    customerId: z
      .string()
      .regex(UUID_REGEX, 'Invalid customer ID')
      .describe('Customer UUID'),

    items: z
      .array(orderItemSchema)
      .min(1, 'Order must have at least one item')
      .max(100, 'Order cannot have more than 100 items')
      .describe('Order line items'),

    shippingAddress: z.object({
      street: z.string().min(1).max(255),
      city: z.string().min(1).max(100),
      state: z.string().length(2, 'State must be 2 characters'),
      zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code')
    }),

    notes: z
      .string()
      .max(5000)
      .optional()
      .describe('Optional order notes')
  })
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>['body'];
```

---

## 7. Orthogonality Principles

### Principle 1: Validation Schemas Are HTTP-Specific

Schemas validate HTTP request structure, NOT business rules.

**✅ Good Example:**

```typescript
// ✅ HTTP-level validation (structure, format)
export const createNetworkDeviceSchema = z.object({
  body: z.object({
    ipAddress: z
      .string()
      .regex(IP_ADDRESS_REGEX, 'Invalid IP address format'), // ✅ Format validation

    name: z
      .string()
      .min(1, 'Name cannot be empty') // ✅ Length validation
      .max(255, 'Name cannot exceed 255 characters'),

    managementPort: z
      .number()
      .int()
      .min(1, 'Port must be between 1 and 65535') // ✅ Range validation
      .max(65535)
  })
});
```

**❌ Bad Example:**

```typescript
// ❌ Business rule validation (belongs in domain)
export const createNetworkDeviceSchema = z.object({
  body: z.object({
    ipAddress: z
      .string()
      .regex(IP_ADDRESS_REGEX, 'Invalid IP')
      .refine(async (ip) => {
        // ❌ BAD: Database query in schema
        const existing = await prisma.networkDevice.findUnique({
          where: { ipAddress: ip }
        });
        return !existing;
      }, 'IP address already exists'), // ❌ Business rule

    deviceType: z
      .string()
      .refine(async (type) => {
        // ❌ BAD: Business logic in schema
        const device = await getDeviceByType(type);
        return device.isActive;
      }, 'Device type must be active') // ❌ Business rule
  })
});
```

**Why this matters**: Business rules should be validated in the domain layer where they can be properly tested and reused.

---

### Principle 2: Extract Reusable Patterns

Common validation patterns should be extracted as constants.

**✅ Good Example:**

```typescript
// ✅ Shared constants at top of file
const IP_ADDRESS_REGEX = /^(?:(?:25[0-5]|...).$/;
const MAC_ADDRESS_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-...$/;

const DEVICE_TYPES = ['ROUTER', 'SWITCH', 'FIREWALL'] as const;

// ✅ Reuse across schemas
export const createNetworkDeviceSchema = z.object({
  body: z.object({
    ipAddress: z.string().regex(IP_ADDRESS_REGEX, 'Invalid IP'),
    macAddress: z.string().regex(MAC_ADDRESS_REGEX, 'Invalid MAC'),
    deviceType: z.enum(DEVICE_TYPES)
  })
});

export const updateNetworkDeviceSchema = z.object({
  body: z.object({
    ipAddress: z.string().regex(IP_ADDRESS_REGEX, 'Invalid IP').optional(),
    macAddress: z.string().regex(MAC_ADDRESS_REGEX, 'Invalid MAC').optional()
  })
});
```

**❌ Bad Example:**

```typescript
// ❌ Duplicated regex patterns
export const createSchema = z.object({
  body: z.object({
    ipAddress: z.string().regex(/^(?:(?:25[0-5]|...).$/,'Invalid IP')
  })
});

export const updateSchema = z.object({
  body: z.object({
    ipAddress: z.string().regex(/^(?:(?:25[0-5]|...).$/,'Invalid IP').optional()
    // ❌ Same regex duplicated
  })
});
```

**Why this matters**: DRY principle. Changes to validation logic should be in one place.

---

### Principle 3: Provide Descriptive Error Messages

Each validation rule should have a clear, user-friendly error message.

**✅ Good Example:**

```typescript
export const createNetworkDeviceSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Device name cannot be empty') // ✅ Specific message
      .max(255, 'Device name cannot exceed 255 characters'), // ✅ Includes limit

    managementPort: z
      .number()
      .int('Management port must be an integer') // ✅ Type error
      .min(1, 'Port must be between 1 and 65535') // ✅ Range error
      .max(65535, 'Port must be between 1 and 65535'),

    deviceType: z.enum(DEVICE_TYPES, {
      errorMap: () => ({
        message: `Device type must be one of: ${DEVICE_TYPES.join(', ')}`
      })
    }) // ✅ Shows valid options
  })
});
```

**❌ Bad Example:**

```typescript
export const createNetworkDeviceSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255), // ❌ No error messages

    managementPort: z.number().int().min(1).max(65535), // ❌ No context

    deviceType: z.enum(DEVICE_TYPES) // ❌ Doesn't show valid options
  })
});
```

**Why this matters**: Good error messages help API consumers debug issues quickly.

---

### Principle 4: Transform Query Strings to Proper Types

Query parameters are always strings; transform them to correct types.

**✅ Good Example:**

```typescript
export const listNetworkDevicesSchema = z.object({
  query: z.object({
    limit: z
      .string()
      .regex(/^\d+$/, 'Limit must be a positive number')
      .transform(Number) // ✅ Convert string to number
      .refine((n) => n > 0 && n <= 100, {
        message: 'Limit must be between 1 and 100'
      }),

    offset: z
      .string()
      .regex(/^\d+$/, 'Offset must be a non-negative number')
      .transform(Number) // ✅ Convert string to number
      .refine((n) => n >= 0, {
        message: 'Offset must be non-negative'
      })
  })
});

// Result: { limit: 20, offset: 0 } (numbers, not strings)
```

**❌ Bad Example:**

```typescript
export const listNetworkDevicesSchema = z.object({
  query: z.object({
    limit: z.number().min(1).max(100), // ❌ Won't work! Query params are strings
    offset: z.number().min(0) // ❌ Won't work!
  })
});

// Request: GET /devices?limit=20
// Result: Validation fails because "20" is a string, not a number
```

**Why this matters**: HTTP query parameters are always strings. You must transform them.

---

## 8. Naming Conventions

### Schema Constant Names

**Pattern:** `[action][Resource]Schema`

**✅ Good Examples:**

- `createNetworkDeviceSchema`
- `updateNetworkDeviceSchema`
- `listNetworkDevicesSchema`
- `getByIdSchema`
- `deleteNetworkDeviceSchema`
- `getByIpSchema` (custom query)

**❌ Bad Examples:**

- `NetworkDeviceCreateSchema` (wrong order)
- `createSchema` (not specific enough)
- `CREATE_NETWORK_DEVICE_SCHEMA` (don't use SCREAMING_SNAKE_CASE)
- `networkDeviceCreate` (missing 'Schema' suffix)

---

### Type Export Names

**Pattern:** `[Action][Resource][InputType]`

**✅ Good Examples:**

- `CreateNetworkDeviceInput` (from body schema)
- `UpdateNetworkDeviceInput` (from body schema)
- `ListNetworkDevicesQuery` (from query schema)
- `GetByIdParams` (from params schema)
- `DeleteNetworkDeviceParams` (from params schema)

**❌ Bad Examples:**

- `CreateNetworkDeviceDTO` (DTO is application layer, not presentation)
- `NetworkDeviceCreateType` (wrong order)
- `CreateInput` (not specific enough)

---

### File Names

**Pattern:** `[resource-name].schemas.ts` (kebab-case)

**✅ Good Examples:**

- `network-device.schemas.ts`
- `user.schemas.ts`
- `order.schemas.ts`
- `polling-configuration.schemas.ts`

**❌ Bad Examples:**

- `NetworkDeviceSchemas.ts` (use kebab-case, not PascalCase)
- `network-device-validation.ts` (.schemas.ts is standard)
- `schemas.ts` (not specific)

---

### Constant Names (Regex, Enums)

**Pattern:** `SCREAMING_SNAKE_CASE` for constants

**✅ Good Examples:**

- `IP_ADDRESS_REGEX`
- `MAC_ADDRESS_REGEX`
- `UUID_REGEX`
- `DEVICE_TYPES`
- `DEVICE_STATUSES`
- `MANAGEMENT_PROTOCOLS`

**❌ Bad Examples:**

- `ipAddressRegex` (use SCREAMING_SNAKE_CASE for constants)
- `deviceTypes` (not clear it's a constant)

---

## 9. Error Handling Patterns

### Pattern 1: Validation Middleware Integration

Validation schemas are used by middleware that catches Zod errors.

```typescript
// middleware/validateRequest.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * Middleware factory for validating requests with Zod schemas.
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 */
export function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Parse and validate request
      const result = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query,
        headers: req.headers
      });

      // Valid - continue to controller
      next();
    } catch (error) {
      // Invalid - return 400 with error details
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
        return;
      }

      // Unexpected error
      next(error);
    }
  };
}
```

---

### Pattern 2: Zod Error Response Format

Validation errors should return structured error responses.

**Example Error Response:**

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "body.ipAddress",
      "message": "Invalid IP address format"
    },
    {
      "field": "body.name",
      "message": "Device name cannot be empty"
    },
    {
      "field": "body.managementPort",
      "message": "Port must be between 1 and 65535"
    }
  ]
}
```

---

### Pattern 3: Custom Validation with `.refine()`

For complex validation that doesn't fit into built-in validators.

```typescript
export const updateNetworkDeviceSchema = z.object({
  body: z
    .object({
      name: z.string().min(1).max(255).optional(),
      description: z.string().max(1000).optional(),
      managementPort: z.number().int().min(1).max(65535).optional()
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update'
    })
});
```

---

### Pattern 4: Conditional Validation

Validate fields based on other field values.

```typescript
export const createDeviceSchema = z.object({
  body: z
    .object({
      deviceType: z.enum(['ROUTER', 'SWITCH', 'ACCESS_POINT']),
      ssid: z.string().optional(),
      frequency: z.number().optional()
    })
    .refine(
      (data) => {
        // If device is ACCESS_POINT, SSID is required
        if (data.deviceType === 'ACCESS_POINT') {
          return data.ssid !== undefined && data.ssid.length > 0;
        }
        return true;
      },
      {
        message: 'SSID is required for ACCESS_POINT devices',
        path: ['ssid'] // Error shows on ssid field
      }
    )
});
```

---

## 10. Testing Strategy

### Test Structure

Validation schemas should be tested to ensure:
1. Valid data passes
2. Invalid data fails with correct errors
3. Transformations work correctly
4. Default values are applied

#### Validation Schema Test Template

```typescript
import { z } from 'zod';
import {
  createNetworkDeviceSchema,
  updateNetworkDeviceSchema,
  listNetworkDevicesSchema
} from './network-device.schemas';

describe('Network Device Validation Schemas', () => {
  describe('createNetworkDeviceSchema', () => {
    it('should accept valid data', () => {
      const validData = {
        body: {
          ipAddress: '192.168.1.100',
          name: 'Router-01',
          deviceType: 'ROUTER',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          deviceId: '123e4567-e89b-12d3-a456-426614174000',
          managementPort: 161
        }
      };

      const result = createNetworkDeviceSchema.safeParse(validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.ipAddress).toBe('192.168.1.100');
        expect(result.data.body.name).toBe('Router-01');
      }
    });

    it('should reject invalid IP address', () => {
      const invalidData = {
        body: {
          ipAddress: 'invalid-ip',
          name: 'Router-01',
          deviceType: 'ROUTER',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          deviceId: '123e4567-e89b-12d3-a456-426614174000'
        }
      };

      const result = createNetworkDeviceSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Invalid IP');
      }
    });

    it('should reject empty device name', () => {
      const invalidData = {
        body: {
          ipAddress: '192.168.1.100',
          name: '',
          deviceType: 'ROUTER',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          deviceId: '123e4567-e89b-12d3-a456-426614174000'
        }
      };

      const result = createNetworkDeviceSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('cannot be empty');
      }
    });

    it('should reject invalid device type', () => {
      const invalidData = {
        body: {
          ipAddress: '192.168.1.100',
          name: 'Router-01',
          deviceType: 'INVALID_TYPE',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          deviceId: '123e4567-e89b-12d3-a456-426614174000'
        }
      };

      const result = createNetworkDeviceSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });

    it('should apply default values', () => {
      const data = {
        body: {
          ipAddress: '192.168.1.100',
          name: 'Router-01',
          deviceType: 'ROUTER',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          deviceId: '123e4567-e89b-12d3-a456-426614174000'
          // managementPort not provided
        }
      };

      const result = createNetworkDeviceSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.managementPort).toBe(161); // Default value
      }
    });

    it('should trim whitespace from name', () => {
      const data = {
        body: {
          ipAddress: '192.168.1.100',
          name: '  Router-01  ',
          deviceType: 'ROUTER',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          deviceId: '123e4567-e89b-12d3-a456-426614174000'
        }
      };

      const result = createNetworkDeviceSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.name).toBe('Router-01'); // Trimmed
      }
    });
  });

  describe('updateNetworkDeviceSchema', () => {
    it('should accept valid update data', () => {
      const validData = {
        params: {
          id: '123e4567-e89b-12d3-a456-426614174000'
        },
        body: {
          name: 'Updated Router'
        }
      };

      const result = updateNetworkDeviceSchema.safeParse(validData);

      expect(result.success).toBe(true);
    });

    it('should reject update with no fields', () => {
      const invalidData = {
        params: {
          id: '123e4567-e89b-12d3-a456-426614174000'
        },
        body: {}
      };

      const result = updateNetworkDeviceSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('At least one field');
      }
    });

    it('should reject invalid UUID', () => {
      const invalidData = {
        params: {
          id: 'not-a-uuid'
        },
        body: {
          name: 'Updated Router'
        }
      };

      const result = updateNetworkDeviceSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('UUID');
      }
    });
  });

  describe('listNetworkDevicesSchema', () => {
    it('should accept valid query parameters', () => {
      const validData = {
        query: {
          limit: '20',
          offset: '0',
          status: 'ONLINE'
        }
      };

      const result = listNetworkDevicesSchema.safeParse(validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.limit).toBe(20); // Transformed to number
        expect(result.data.query.offset).toBe(0); // Transformed to number
      }
    });

    it('should reject limit > 100', () => {
      const invalidData = {
        query: {
          limit: '200'
        }
      };

      const result = listNetworkDevicesSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('between 1 and 100');
      }
    });

    it('should reject negative offset', () => {
      const invalidData = {
        query: {
          offset: '-1'
        }
      };

      const result = listNetworkDevicesSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });

    it('should transform string numbers to numbers', () => {
      const data = {
        query: {
          limit: '50',
          offset: '10'
        }
      };

      const result = listNetworkDevicesSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.query.limit).toBe('number');
        expect(typeof result.data.query.offset).toBe('number');
        expect(result.data.query.limit).toBe(50);
        expect(result.data.query.offset).toBe(10);
      }
    });
  });
});
```

---

### Coverage Requirements

- [ ] Valid data passes validation
- [ ] Invalid data fails with correct error messages
- [ ] Required fields are enforced
- [ ] Optional fields work correctly
- [ ] Default values are applied
- [ ] Transformations work (string → number)
- [ ] Regex patterns match/reject correctly
- [ ] Enums reject invalid values
- [ ] Min/max constraints enforced
- [ ] Custom refinements work correctly

---

## 11. Examples

### Example 1: Complete Network Device Schemas

See your actual implementation in `src/presentation/http/validation/network-device.schemas.ts` (lines 1-324) - this is already a perfect example following all the standards!

---

### Example 2: Schemas with Nested Objects

```typescript
import { z } from 'zod';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Reusable nested schema
const addressSchema = z.object({
  street: z.string().min(1).max(255),
  city: z.string().min(1).max(100),
  state: z.string().length(2, 'State must be 2 characters (e.g., "CA")'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format')
});

const orderItemSchema = z.object({
  productId: z.string().regex(UUID_REGEX),
  quantity: z.number().int().min(1).max(1000),
  unitPrice: z.number().min(0)
});

export const createOrderSchema = z.object({
  body: z.object({
    customerId: z.string().regex(UUID_REGEX),

    shippingAddress: addressSchema,
    billingAddress: addressSchema.optional(),

    items: z
      .array(orderItemSchema)
      .min(1, 'Order must have at least one item')
      .max(100, 'Order cannot exceed 100 items'),

    notes: z.string().max(5000).optional()
  })
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>['body'];
```

---

### Example 3: Schema with Conditional Validation

```typescript
export const createRadioDeviceSchema = z.object({
  body: z
    .object({
      ipAddress: z.string().regex(IP_ADDRESS_REGEX),
      name: z.string().min(1).max(255),
      deviceType: z.enum(['ACCESS_POINT', 'STATION', 'PTP_RADIO']),

      // Fields specific to certain device types
      ssid: z.string().min(1).max(32).optional(),
      frequency: z.number().min(2400).max(6000).optional(),
      channelWidth: z.enum(['20', '40', '80', '160']).optional()
    })
    .refine(
      (data) => {
        // ACCESS_POINT requires SSID
        if (data.deviceType === 'ACCESS_POINT') {
          return data.ssid !== undefined && data.ssid.length > 0;
        }
        return true;
      },
      {
        message: 'SSID is required for ACCESS_POINT devices',
        path: ['ssid']
      }
    )
    .refine(
      (data) => {
        // Wireless devices require frequency
        if (['ACCESS_POINT', 'STATION'].includes(data.deviceType)) {
          return data.frequency !== undefined;
        }
        return true;
      },
      {
        message: 'Frequency is required for wireless devices',
        path: ['frequency']
      }
    )
});
```

---

## 12. Summary Checklist

### Structure

- [ ] File named `[resource-name].schemas.ts` (kebab-case)
- [ ] All schemas exported as constants (e.g., `createNetworkDeviceSchema`)
- [ ] TypeScript types exported from schemas (e.g., `CreateNetworkDeviceInput`)
- [ ] Shared constants extracted (regex, enums)

### Responsibilities

- [ ] Validates HTTP request structure (body, params, query)
- [ ] Validates data formats (regex, min/max, enums)
- [ ] Provides default values where appropriate
- [ ] Transforms input (query strings → numbers)
- [ ] Provides descriptive error messages

### Boundaries

- [ ] No business logic in schemas
- [ ] No database queries in schemas
- [ ] No domain entity imports
- [ ] Only HTTP-level validation (not business rules)

### Schema Coverage

- [ ] Create schema (POST)
- [ ] Update schema (PUT/PATCH)
- [ ] List schema (GET collection with query params)
- [ ] Get by ID schema (GET single with params)
- [ ] Delete schema (DELETE with params)
- [ ] Custom endpoint schemas (if applicable)

### Quality

- [ ] All fields have `.describe()` documentation
- [ ] All validation rules have custom error messages
- [ ] Regex patterns are constants (DRY)
- [ ] Enums show valid options in error messages
- [ ] Query parameters transformed to correct types

### Testing

- [ ] Valid data passes validation
- [ ] Invalid data fails with correct errors
- [ ] Default values applied correctly
- [ ] Transformations work (string → number)
- [ ] Required field validation works
- [ ] Optional field validation works
- [ ] Custom refinements tested
- [ ] >90% code coverage

---

**Remember**: Validation schemas are the first line of defense against bad data. They should validate HTTP request structure and format, but NOT business rules. Business rules belong in the domain layer where they can be properly tested and reused across different protocols.
