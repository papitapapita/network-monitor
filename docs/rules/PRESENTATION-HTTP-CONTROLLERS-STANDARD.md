# PRESENTATION HTTP CONTROLLERS STANDARD

## Table of Contents

1. [Purpose of HTTP Controllers in DDD](#1-purpose-of-http-controllers-in-ddd)
2. [Responsibilities of an HTTP Controller](#2-responsibilities-of-an-http-controller)
3. [Boundaries of an HTTP Controller](#3-boundaries-of-an-http-controller)
4. [Connections with Other Layers](#4-connections-with-other-layers)
5. [HTTP Controller Lifetime & Lifecycle](#5-http-controller-lifetime--lifecycle)
6. [HTTP Controller Structure Template](#6-http-controller-structure-template)
7. [Orthogonality Principles](#7-orthogonality-principles)
8. [Naming Conventions](#8-naming-conventions)
9. [Error Handling Patterns](#9-error-handling-patterns)
10. [Testing Strategy](#10-testing-strategy)
11. [Examples](#11-examples)
12. [Summary Checklist](#12-summary-checklist)

---

## 1. Purpose of HTTP Controllers in DDD

**HTTP Controllers are presentation layer components that coordinate HTTP request/response handling by delegating business logic to use cases and translating domain results into HTTP responses.**

### Core Characteristics:

- **Thin Orchestration Layer**: Contains NO business logic, only coordination
- **Use Case Delegation**: Calls application use cases for all operations
- **HTTP Translation**: Converts HTTP requests to DTOs and Results to HTTP responses
- **Status Code Mapping**: Maps domain errors to appropriate HTTP status codes
- **Framework Binding**: Couples to web framework (Express, Fastify, etc.) but NOT to domain
- **Stateless**: No instance state between requests

### Why HTTP Controllers?

1. **Separation of Concerns**: Isolates HTTP concerns from business logic
2. **Protocol Independence**: Domain/Application layers don't know about HTTP
3. **Testability**: Business logic can be tested without HTTP server
4. **Framework Flexibility**: Can swap web frameworks without changing domain
5. **Clean Architecture**: Maintains dependency inversion (presentation → application → domain)
6. **Single Responsibility**: Each controller handles one aggregate or bounded context

### HTTP Controller vs Use Case:

| Aspect             | HTTP Controller                      | Use Case                      |
| ------------------ | ------------------------------------ | ----------------------------- |
| **Layer**          | Presentation                         | Application                   |
| **Purpose**        | HTTP request/response handling       | Business logic orchestration  |
| **Dependencies**   | Express, Use Cases, Logger           | Domain, Repositories, Mappers |
| **Business Logic** | NONE (pure coordination)             | ALL business rules            |
| **HTTP Knowledge** | YES (status codes, headers, cookies) | NO (protocol-agnostic)        |
| **Error Handling** | HTTP status code mapping             | Result<T> pattern             |
| **Testing**        | Integration tests (with HTTP)        | Unit tests (no HTTP)          |
| **Reusability**    | HTTP-only                            | Reusable across protocols     |

---

## 2. Responsibilities of an HTTP Controller

### MUST DO:

1. **Receive and Parse HTTP Requests**

   - Extract data from `req.body`, `req.params`, `req.query`, `req.headers`
   - Build DTOs from request data
   - Delegate validation to middleware (Zod schemas)

2. **Invoke Use Cases**

   - Call appropriate use case with DTO
   - Pass all necessary parameters
   - Await async results

3. **Map Results to HTTP Responses**

   - Convert `Result.ok()` to 2xx responses
   - Convert `Result.fail()` to 4xx/5xx responses
   - Map domain errors to HTTP status codes (404, 409, 400, 500)

4. **Set Appropriate HTTP Status Codes**

   - **200 OK**: Successful GET, PUT
   - **201 Created**: Successful POST
   - **204 No Content**: Successful DELETE
   - **400 Bad Request**: Validation errors
   - **404 Not Found**: Resource not found
   - **409 Conflict**: Duplicate resource
   - **500 Internal Server Error**: Unexpected errors

5. **Structure Response Bodies Consistently**

   - Success: `{ success: true, data: T }`
   - Failure: `{ success: false, error: string }`
   - List: `{ success: true, data: T[], total?: number, limit?: number, offset?: number }`

6. **Handle Unexpected Errors**

   - Catch all errors thrown by use cases or infrastructure
   - Log errors with context
   - Return 500 with generic message (never leak internal details)

7. **Inject Dependencies via Constructor**

   - Use cases (one per operation)
   - Logger
   - NO repositories, NO domain entities

8. **Use Arrow Functions for Route Handlers**
   - Ensures `this` binding for class methods
   - Example: `public create = async (req, res) => { ... }`

---

## 3. Boundaries of an HTTP Controller

### MUST NOT DO:

1. **❌ Contain Business Logic**

   - NO validation beyond HTTP structure
   - NO calculations or transformations
   - NO business rules
   - **Why**: Business logic belongs in domain/application layers

2. **❌ Access Repositories Directly**

   - NO database queries
   - NO Prisma client usage
   - **Why**: Controllers must go through use cases (dependency inversion)

3. **❌ Depend on Domain Entities**

   - NO imports of aggregates, entities, or value objects
   - Only DTOs and Result types
   - **Why**: Presentation should not know domain internals

4. **❌ Perform Data Mapping**

   - NO domain ↔ DTO conversion
   - Use cases return DTOs already
   - **Why**: Mapping is application layer responsibility

5. **❌ Handle Domain Events**

   - NO event dispatching
   - NO event registration
   - **Why**: Events are domain/application concern

6. **❌ Store State Between Requests**

   - NO instance properties modified during request handling
   - Only constructor-injected dependencies
   - **Why**: Controllers must be stateless for scalability

7. **❌ Perform Authorization/Authentication**

   - Delegate to middleware
   - Controller only executes after auth passes
   - **Why**: Auth is cross-cutting concern, use middleware

8. **❌ Leak Internal Error Details**
   - Never expose stack traces to clients
   - Never expose internal implementation details
   - **Why**: Security and information hiding

---

## 4. Connections with Other Layers

```
┌──────────────────────────────────────────────────┐
│          PRESENTATION LAYER                      │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │   HTTP Controllers                          │ │
│  │   - Receive HTTP requests                   │ │
│  │   - Map to DTOs                             │ │
│  │   - Invoke use cases                        │ │
│  │   - Map results to HTTP responses           │ │
│  └─────────────────────────────────────────────┘ │
│                       ↓                          │
└───────────────────────┼──────────────────────────┘
                        │
                        │ Depends on Use Cases
                        ↓
┌──────────────────────────────────────────────────┐
│          APPLICATION LAYER                       │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │   Use Cases                                 │ │
│  │   - Business logic orchestration            │ │
│  │   - Return Result<DTO>                      │ │
│  └─────────────────────────────────────────────┘ │
│                       ↓                          │
└───────────────────────┼──────────────────────────┘
                        │
                        │ Uses Domain
                        ↓
┌──────────────────────────────────────────────────┐
│          DOMAIN LAYER                            │
│   - Aggregates, Entities, Value Objects          │
│   - Business rules                               │
└──────────────────────────────────────────────────┘

Related Presentation Components:
- Routes (define endpoints, wire middleware)
- Validation Schemas (Zod, validate requests)
- Middleware (auth, logging, validation)
- Error Handlers (global error handling)
```

---

## 5. HTTP Controller Lifetime & Lifecycle

### Instantiation Flow:

```typescript
// 1. Application Startup - Instantiate use cases
const createUseCase = new CreateNetworkDeviceUseCase(
  repository,
  mapper
);
const listUseCase = new ListNetworkDevicesUseCase(repository, mapper);
const logger = new ConsoleLogger('NetworkDeviceController');

// 2. Instantiate Controller (singleton per app)
const controller = new NetworkDeviceController(
  createUseCase,
  listUseCase,
  logger
);

// 3. Register routes
const router = createNetworkDeviceRoutes(controller);
app.use('/api/network-devices', router);

// 4. Request arrives
// GET /api/network-devices/123

// 5. Express calls controller method (bound via arrow function)
controller.getById(req, res);

// 6. Controller executes:
//    a. Extract params: { id: '123' }
//    b. Call use case: await getUseCase.execute({ id: '123' })
//    c. Check result: if (result.isFailure) { ... }
//    d. Map to HTTP: res.status(200).json({ success: true, data: ... })

// 7. Response sent to client

// 8. Controller remains in memory for next request (singleton)
```

### Key Lifecycle Characteristics:

- **Singleton**: One controller instance per application
- **Stateless**: No state modified between requests
- **Long-lived**: Exists for application lifetime
- **Request-scoped execution**: Each request is independent
- **Dependency injection at startup**: All dependencies injected via constructor

---

## 6. HTTP Controller Structure Template

### Basic Controller Template

````typescript
import { Request, Response } from 'express';
import { IUseCase } from '../../../application/interfaces/IUseCase';
import { ILogger } from '../../../application/interfaces/ILogger';
import { Result } from '../../../domain';

/**
 * [Resource]Controller
 *
 * HTTP controller for [Resource] CRUD operations.
 *
 * Endpoints:
 * - POST   /api/[resources]          - Create [resource]
 * - GET    /api/[resources]          - List [resources]
 * - GET    /api/[resources]/:id      - Get [resource] by ID
 * - PUT    /api/[resources]/:id      - Update [resource]
 * - DELETE /api/[resources]/:id      - Delete [resource]
 *
 * @example
 * ```typescript
 * const controller = new [Resource]Controller(
 *   createUseCase,
 *   listUseCase,
 *   getUseCase,
 *   updateUseCase,
 *   deleteUseCase,
 *   logger
 * );
 * ```
 */
export class [Resource]Controller {
  constructor(
    private readonly createUseCase: IUseCase<CreateDTO, ResponseDTO>,
    private readonly listUseCase: IUseCase<ListQueryDTO, ListResponseDTO>,
    private readonly getUseCase: IUseCase<GetDTO, ResponseDTO>,
    private readonly updateUseCase: IUseCase<UpdateDTO, ResponseDTO>,
    private readonly deleteUseCase: IUseCase<DeleteDTO, void>,
    private readonly logger: ILogger
  ) {}

  /**
   * POST /api/[resources]
   * Creates a new [resource].
   */
  public create = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.createUseCase.execute(req.body);

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  /**
   * GET /api/[resources]
   * Lists [resources] with pagination and optional filters.
   */
  public list = async (req: Request, res: Response): Promise<void> => {
    try {
      const query = {
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
        // ... other filters
      };

      const result = await this.listUseCase.execute(query);

      if (result.isFailure) {
        res.status(400).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  /**
   * GET /api/[resources]/:id
   * Gets a [resource] by ID.
   */
  public getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.getUseCase.execute({
        id: req.params.id
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  /**
   * PUT /api/[resources]/:id
   * Updates a [resource].
   */
  public update = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.updateUseCase.execute({
        id: req.params.id,
        ...req.body
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  /**
   * DELETE /api/[resources]/:id
   * Deletes a [resource].
   */
  public delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.deleteUseCase.execute({
        id: req.params.id
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({
          success: false,
          error: result.error
        });
        return;
      }

      // 204 No Content - successful deletion
      res.status(204).send();
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  /**
   * Maps error messages to HTTP status codes.
   *
   * This method analyzes error messages from use cases and maps them
   * to appropriate HTTP status codes. This is the ONLY place where
   * error-to-status-code mapping should occur.
   *
   * @param errorMessage - Error message from use case Result
   * @returns Appropriate HTTP status code
   */
  private getErrorStatusCode(errorMessage: string): number {
    // Not Found - 404
    if (errorMessage.includes('not found')) {
      return 404;
    }

    // Conflict - 409 (duplicates, uniqueness violations)
    if (
      errorMessage.includes('already exists') ||
      errorMessage.includes('duplicate')
    ) {
      return 409;
    }

    // Bad Request - 400 (validation, invalid input)
    if (
      errorMessage.includes('Invalid') ||
      errorMessage.includes('validation') ||
      errorMessage.includes('required')
    ) {
      return 400;
    }

    // Default to 500 for unknown errors
    return 500;
  }

  /**
   * Handles unexpected errors (exceptions thrown by use cases or infrastructure).
   *
   * This method:
   * 1. Logs the full error with context
   * 2. Returns a generic 500 error to the client (no leak)
   *
   * @param error - The caught error
   * @param res - Express response object
   */
  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      `Unexpected error in ${this.constructor.name}`,
      error as Error,
      {
        error: errorMessage
      }
    );

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
````

### Complex Controller Template (with Custom Endpoints)

```typescript
/**
 * NetworkDeviceController (with custom endpoints)
 */
export class NetworkDeviceController {
  constructor(
    private readonly createUseCase: CreateNetworkDeviceUseCase,
    private readonly getByIpUseCase: GetNetworkDeviceByIpUseCase,
    private readonly activateUseCase: ActivateNetworkDeviceUseCase,
    private readonly logger: ILogger
  ) {}

  /**
   * GET /api/network-devices/by-ip?ip=192.168.1.1
   * Gets a network device by IP address.
   *
   * Custom query endpoint for searching by IP.
   */
  public getByIp = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.getByIpUseCase.execute({
        ipAddress: req.query.ip as string
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  /**
   * POST /api/network-devices/:id/activate
   * Activates a network device.
   *
   * Custom action endpoint (non-CRUD).
   */
  public activate = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.activateUseCase.execute({
        id: req.params.id
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  // ... standard CRUD methods ...
  // ... error handling methods ...
}
```

---

## 7. Orthogonality Principles

### Principle 1: Controllers Are Protocol Adapters (NO Business Logic)

Controllers translate between HTTP and application layer. They contain ZERO business logic.

**✅ Good Example:**

```typescript
public create = async (req: Request, res: Response): Promise<void> => {
  try {
    // Pure coordination - just call use case
    const result = await this.createUseCase.execute(req.body);

    if (result.isFailure) {
      const statusCode = this.getErrorStatusCode(result.error!);
      res.status(statusCode).json({ success: false, error: result.error });
      return;
    }

    res.status(201).json({ success: true, data: result.value });
  } catch (error) {
    this.handleUnexpectedError(error, res);
  }
};
```

**❌ Bad Example:**

```typescript
public create = async (req: Request, res: Response): Promise<void> => {
  try {
    // ❌ BAD: Business logic in controller
    if (req.body.ipAddress.startsWith('192.168.')) {
      // ❌ BAD: IP validation logic
      return res.status(400).json({ error: 'Private IPs not allowed' });
    }

    // ❌ BAD: Direct repository access
    const existing = await this.repository.findByIp(req.body.ipAddress);
    if (existing) {
      return res.status(409).json({ error: 'IP already exists' });
    }

    // ❌ BAD: Creating domain entities directly
    const device = NetworkDevice.create({ ... });

    const result = await this.createUseCase.execute(req.body);
    res.status(201).json({ success: true, data: result.value });
  } catch (error) {
    this.handleUnexpectedError(error, res);
  }
};
```

**Why this matters**: Business logic in controllers makes it impossible to reuse that logic from other protocols (WebSocket, CLI, gRPC). Use cases are protocol-agnostic.

---

### Principle 2: Error Mapping is HTTP-Specific

Controllers map domain error messages to HTTP status codes. Use cases return generic `Result.fail()`.

**✅ Good Example:**

```typescript
// Use Case (application layer)
if (!ipAddress.isValid()) {
  return Result.fail<NetworkDeviceResponseDTO>('Invalid IP address format');
}

// Controller (presentation layer)
private getErrorStatusCode(errorMessage: string): number {
  if (errorMessage.includes('Invalid')) {
    return 400; // Bad Request
  }
  // ... other mappings
}
```

**❌ Bad Example:**

```typescript
// ❌ BAD: Use case returning HTTP status codes
export class CreateNetworkDeviceUseCase {
  async execute(
    dto: CreateDTO
  ): Promise<{ statusCode: number; data?: any }> {
    if (!ipAddress.isValid()) {
      return { statusCode: 400, data: null }; // ❌ HTTP knowledge in use case
    }
    // ...
  }
}
```

**Why this matters**: Use cases should be reusable across HTTP, WebSocket, CLI, etc. HTTP status codes are presentation-layer concern.

---

### Principle 3: Controllers Are Stateless

Controllers must not store state between requests. All dependencies are injected at construction.

**✅ Good Example:**

```typescript
export class NetworkDeviceController {
  // ✅ Dependencies injected once, never modified
  constructor(
    private readonly createUseCase: CreateNetworkDeviceUseCase,
    private readonly logger: ILogger
  ) {}

  // ✅ Arrow function for 'this' binding
  public create = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    // Request-scoped variables only
    const result = await this.createUseCase.execute(req.body);
    // ...
  };
}
```

**❌ Bad Example:**

```typescript
export class NetworkDeviceController {
  // ❌ BAD: Mutable instance state
  private currentRequest?: Request;
  private requestCount = 0;

  public create = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    // ❌ BAD: Modifying instance state during request
    this.currentRequest = req;
    this.requestCount++;

    const result = await this.createUseCase.execute(req.body);
    // ...
  };
}
```

**Why this matters**: Stateful controllers break in concurrent environments (multiple requests). Controllers must be safe for concurrent access.

---

### Principle 4: Response Structure Consistency

All successful responses follow the same structure: `{ success: true, data: T }`.

**✅ Good Example:**

```typescript
// GET /api/devices/123
res.status(200).json({
  success: true,
  data: { id: '123', name: 'Router-01', ... }
});

// GET /api/devices
res.status(200).json({
  success: true,
  data: [
    { id: '123', ... },
    { id: '456', ... }
  ],
  total: 100,
  limit: 20,
  offset: 0
});

// Error response
res.status(404).json({
  success: false,
  error: 'Device not found'
});
```

**❌ Bad Example:**

```typescript
// ❌ BAD: Inconsistent response structure
res.status(200).json({ device: { ... } }); // Missing success flag, wrong key

// ❌ BAD: Different error structure
res.status(404).json({ message: 'Not found' }); // Should be 'error', not 'message'
```

**Why this matters**: Consistent API responses make client integration easier and reduce bugs.

---

## 8. Naming Conventions

### Controller Class Names

**Pattern:** `[Resource]Controller`

**✅ Good Examples:**

- `NetworkDeviceController`
- `UserController`
- `OrderController`
- `PollingConfigurationController`

**❌ Bad Examples:**

- `DeviceHandler` (not descriptive enough)
- `NetworkDeviceManager` (sounds like service)
- `DeviceAPI` (too generic)
- `Devices` (missing Controller suffix)

---

### Method Names

**Pattern:** HTTP verb or action (lowercase)

**✅ Good Examples:**

- `create` (POST)
- `list` (GET collection)
- `getById` (GET single)
- `update` (PUT/PATCH)
- `delete` (DELETE)
- `getByIp` (custom query)
- `activate` (custom action)

**❌ Bad Examples:**

- `createNetworkDevice` (redundant, controller already scoped to NetworkDevice)
- `handleCreate` (unnecessary 'handle' prefix)
- `post` (HTTP verb is too generic)
- `doUpdate` (unnecessary 'do' prefix)

---

### Private Method Names

**Pattern:** Descriptive action in camelCase

**✅ Good Examples:**

- `getErrorStatusCode(errorMessage: string): number`
- `handleUnexpectedError(error: unknown, res: Response): void`
- `buildSuccessResponse<T>(data: T): SuccessResponse<T>`

**❌ Bad Examples:**

- `_getStatusCode` (no underscore prefix)
- `mapError` (too vague)
- `helper` (not descriptive)

---

### File Names

**Pattern:** `[Resource]Controller.ts`

**✅ Good Examples:**

- `NetworkDeviceController.ts`
- `UserController.ts`
- `OrderController.ts`

**❌ Bad Examples:**

- `network-device-controller.ts` (use PascalCase, not kebab-case)
- `deviceController.ts` (inconsistent casing)
- `Controller.ts` (too generic)

---

## 9. Error Handling Patterns

### Pattern 1: Result Pattern from Use Cases

Controllers receive `Result<T>` from use cases and map to HTTP responses.

```typescript
public create = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await this.createUseCase.execute(req.body);

    if (result.isFailure) {
      // Map domain error to HTTP status code
      const statusCode = this.getErrorStatusCode(result.error!);
      res.status(statusCode).json({
        success: false,
        error: result.error
      });
      return;
    }

    // Success
    res.status(201).json({
      success: true,
      data: result.value
    });
  } catch (error) {
    // Unexpected infrastructure error
    this.handleUnexpectedError(error, res);
  }
};
```

---

### Pattern 2: Error Message to Status Code Mapping

Centralized error mapping logic in private method.

```typescript
/**
 * Maps domain error messages to HTTP status codes.
 *
 * Decision tree:
 * - "not found" → 404 Not Found
 * - "already exists" | "duplicate" → 409 Conflict
 * - "Invalid" | "validation" | "required" → 400 Bad Request
 * - Default → 500 Internal Server Error
 */
private getErrorStatusCode(errorMessage: string): number {
  // Resource not found
  if (errorMessage.includes('not found')) {
    return 404;
  }

  // Duplicate/conflict
  if (
    errorMessage.includes('already exists') ||
    errorMessage.includes('duplicate')
  ) {
    return 409;
  }

  // Validation errors
  if (
    errorMessage.includes('Invalid') ||
    errorMessage.includes('validation') ||
    errorMessage.includes('required') ||
    errorMessage.includes('At least one')
  ) {
    return 400;
  }

  // Unauthorized (if applicable)
  if (
    errorMessage.includes('Unauthorized') ||
    errorMessage.includes('permission')
  ) {
    return 403;
  }

  // Default: Internal Server Error
  return 500;
}
```

---

### Pattern 3: Unexpected Error Handling

All unexpected errors (thrown exceptions) are caught and logged.

```typescript
/**
 * Handles unexpected errors thrown by use cases or infrastructure.
 *
 * This method:
 * 1. Extracts error message safely
 * 2. Logs full error with context (for debugging)
 * 3. Returns generic 500 response (security - no leak)
 *
 * @param error - Caught exception
 * @param res - Express response object
 */
private handleUnexpectedError(error: unknown, res: Response): void {
  const errorMessage =
    error instanceof Error ? error.message : String(error);

  // Log full error details (for internal debugging)
  this.logger.error(
    `Unexpected error in ${this.constructor.name}`,
    error as Error,
    {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    }
  );

  // Return generic error to client (security)
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
}
```

**Key Points:**

- NEVER leak internal error details to client
- ALWAYS log full error server-side
- Return generic "Internal server error" message

---

### Pattern 4: HTTP Status Code Reference

Standard HTTP status codes for REST APIs:

| Status Code | When to Use                             | Example                            |
| ----------- | --------------------------------------- | ---------------------------------- |
| **200 OK**  | Successful GET, PUT                     | Device retrieved/updated           |
| **201**     | Successful POST (resource created)      | Device created                     |
| **204**     | Successful DELETE (no content)          | Device deleted                     |
| **400**     | Validation error, invalid input         | Invalid IP format                  |
| **401**     | Authentication required                 | No token provided                  |
| **403**     | Forbidden (authenticated but no access) | User lacks permission              |
| **404**     | Resource not found                      | Device with ID not found           |
| **409**     | Conflict (duplicate, version mismatch)  | IP already exists                  |
| **422**     | Unprocessable entity (semantic error)   | Valid JSON but business rule fails |
| **500**     | Internal server error (unexpected)      | Database connection failed         |
| **503**     | Service unavailable (temporary)         | Database is down                   |

---

## 10. Testing Strategy

### Test Structure

Controllers should have **integration tests** (with HTTP server) and **unit tests** (mocked use cases).

#### Integration Test Template

```typescript
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../../../test/helpers/createTestApp';
import { PrismaClient } from '@/generated/prisma';

describe('NetworkDeviceController Integration Tests', () => {
  let app: Express;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    app = createTestApp(); // Creates Express app with routes
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/network-devices', () => {
    it('should create a network device with valid data', async () => {
      const response = await request(app)
        .post('/api/network-devices')
        .send({
          ipAddress: '192.168.1.100',
          name: 'Test Router',
          deviceType: 'ROUTER',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          deviceId: '123e4567-e89b-12d3-a456-426614174000'
        })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          ipAddress: '192.168.1.100',
          name: 'Test Router'
        }
      });
    });

    it('should return 400 for invalid IP address', async () => {
      const response = await request(app)
        .post('/api/network-devices')
        .send({
          ipAddress: 'invalid-ip',
          name: 'Test Router',
          deviceType: 'ROUTER',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          deviceId: '123e4567-e89b-12d3-a456-426614174000'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid IP')
      });
    });

    it('should return 409 for duplicate IP address', async () => {
      // Create first device
      await request(app).post('/api/network-devices').send({
        ipAddress: '192.168.1.101',
        name: 'Router 1',
        deviceType: 'ROUTER',
        macAddress: 'AA:BB:CC:DD:EE:01',
        deviceId: '123e4567-e89b-12d3-a456-426614174001'
      });

      // Try to create duplicate
      const response = await request(app)
        .post('/api/network-devices')
        .send({
          ipAddress: '192.168.1.101', // Same IP
          name: 'Router 2',
          deviceType: 'ROUTER',
          macAddress: 'AA:BB:CC:DD:EE:02',
          deviceId: '123e4567-e89b-12d3-a456-426614174002'
        })
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('already exists')
      });
    });
  });

  describe('GET /api/network-devices/:id', () => {
    it('should return device by ID', async () => {
      // Create device first
      const createResponse = await request(app)
        .post('/api/network-devices')
        .send({
          ipAddress: '192.168.1.102',
          name: 'Test Device',
          deviceType: 'SWITCH',
          macAddress: 'AA:BB:CC:DD:EE:03',
          deviceId: '123e4567-e89b-12d3-a456-426614174003'
        });

      const deviceId = createResponse.body.data.id;

      // Get device
      const response = await request(app)
        .get(`/api/network-devices/${deviceId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: deviceId,
          ipAddress: '192.168.1.102',
          name: 'Test Device'
        }
      });
    });

    it('should return 404 for non-existent device', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174999';
      const response = await request(app)
        .get(`/api/network-devices/${fakeId}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('not found')
      });
    });
  });

  describe('DELETE /api/network-devices/:id', () => {
    it('should delete device and return 204', async () => {
      // Create device
      const createResponse = await request(app)
        .post('/api/network-devices')
        .send({
          ipAddress: '192.168.1.103',
          name: 'To Delete',
          deviceType: 'ROUTER',
          macAddress: 'AA:BB:CC:DD:EE:04',
          deviceId: '123e4567-e89b-12d3-a456-426614174004'
        });

      const deviceId = createResponse.body.data.id;

      // Delete device
      await request(app)
        .delete(`/api/network-devices/${deviceId}`)
        .expect(204);

      // Verify deletion
      await request(app)
        .get(`/api/network-devices/${deviceId}`)
        .expect(404);
    });
  });
});
```

#### Unit Test Template (Mocked Use Cases)

```typescript
import { Request, Response } from 'express';
import { NetworkDeviceController } from './NetworkDeviceController';
import { CreateNetworkDeviceUseCase } from '../../../application/use-cases/CreateNetworkDeviceUseCase';
import { Result } from '../../../domain';
import { ILogger } from '../../../application/interfaces/ILogger';

// Mock implementations
const mockCreateUseCase = {
  execute: jest.fn()
} as unknown as CreateNetworkDeviceUseCase;

const mockLogger = {
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
} as unknown as ILogger;

describe('NetworkDeviceController Unit Tests', () => {
  let controller: NetworkDeviceController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create controller
    controller = new NetworkDeviceController(
      mockCreateUseCase,
      // ... other use cases
      mockLogger
    );

    // Mock Express req/res
    jsonMock = jest.fn();
    statusMock = jest
      .fn()
      .mockReturnValue({ json: jsonMock, send: jest.fn() });

    mockReq = {
      body: {},
      params: {},
      query: {}
    };

    mockRes = {
      status: statusMock,
      json: jsonMock
    };
  });

  describe('create', () => {
    it('should return 201 on successful creation', async () => {
      // Arrange
      const mockDTO = {
        ipAddress: '192.168.1.100',
        name: 'Router-01',
        deviceType: 'ROUTER',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        deviceId: '123e4567-e89b-12d3-a456-426614174000'
      };

      const mockResponse = {
        id: 'device-id-123',
        ...mockDTO
      };

      mockReq.body = mockDTO;
      (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
        Result.ok(mockResponse)
      );

      // Act
      await controller.create(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockCreateUseCase.execute).toHaveBeenCalledWith(mockDTO);
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockResponse
      });
    });

    it('should return 400 on validation error', async () => {
      // Arrange
      mockReq.body = { ipAddress: 'invalid' };
      (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
        Result.fail('Invalid IP address format')
      );

      // Act
      await controller.create(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid IP address format'
      });
    });

    it('should return 409 on duplicate error', async () => {
      // Arrange
      mockReq.body = { ipAddress: '192.168.1.1' };
      (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
        Result.fail('Device with ipAddress already exists')
      );

      // Act
      await controller.create(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Device with ipAddress already exists'
      });
    });

    it('should return 500 and log on unexpected error', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      mockReq.body = { ipAddress: '192.168.1.1' };
      (mockCreateUseCase.execute as jest.Mock).mockRejectedValue(
        error
      );

      // Act
      await controller.create(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Unexpected error'),
        error,
        expect.any(Object)
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error'
      });
    });
  });
});
```

---

### Coverage Requirements

Controllers should achieve **>80% code coverage** with the following test categories:

1. **Happy Path Tests** (successful operations)

   - Create resource → 201
   - Get resource → 200
   - Update resource → 200
   - Delete resource → 204
   - List resources → 200

2. **Error Path Tests** (expected failures)

   - Validation errors → 400
   - Resource not found → 404
   - Duplicate resource → 409
   - At least one field required → 400

3. **Edge Case Tests**

   - Empty query parameters
   - Invalid UUID format
   - Missing required fields
   - Boundary values (min/max)

4. **Exception Tests**
   - Unexpected errors from use cases
   - Logging verification
   - Generic error response (no leak)

---

## 11. Examples

### Example 1: Basic CRUD Controller

```typescript
import { Request, Response } from 'express';
import { CreateNetworkDeviceUseCase } from '../../../application/use-cases/CreateNetworkDeviceUseCase';
import { ListNetworkDevicesUseCase } from '../../../application/use-cases/ListNetworkDevicesUseCase';
import { GetNetworkDeviceUseCase } from '../../../application/use-cases/GetNetworkDeviceUseCase';
import { UpdateNetworkDeviceUseCase } from '../../../application/use-cases/UpdateNetworkDeviceUseCase';
import { DeleteNetworkDeviceUseCase } from '../../../application/use-cases/DeleteNetworkDeviceUseCase';
import { ILogger } from '../../../application/interfaces/ILogger';

/**
 * NetworkDeviceController
 *
 * HTTP controller for NetworkDevice CRUD operations.
 *
 * Endpoints:
 * - POST   /api/network-devices          - Create device
 * - GET    /api/network-devices          - List devices
 * - GET    /api/network-devices/:id      - Get device by ID
 * - PUT    /api/network-devices/:id      - Update device
 * - DELETE /api/network-devices/:id      - Delete device
 */
export class NetworkDeviceController {
  constructor(
    private readonly createUseCase: CreateNetworkDeviceUseCase,
    private readonly listUseCase: ListNetworkDevicesUseCase,
    private readonly getUseCase: GetNetworkDeviceUseCase,
    private readonly updateUseCase: UpdateNetworkDeviceUseCase,
    private readonly deleteUseCase: DeleteNetworkDeviceUseCase,
    private readonly logger: ILogger
  ) {}

  public create = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.createUseCase.execute(req.body);

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public list = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const query = {
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset
          ? Number(req.query.offset)
          : undefined,
        status: req.query.status as string | undefined,
        deviceType: req.query.deviceType as string | undefined
      };

      const result = await this.listUseCase.execute(query);

      if (result.isFailure) {
        res.status(400).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public getById = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.getUseCase.execute({
        id: req.params.id
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public update = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.updateUseCase.execute({
        id: req.params.id,
        ...req.body
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public delete = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.deleteUseCase.execute({
        id: req.params.id
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.status(204).send();
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  private getErrorStatusCode(errorMessage: string): number {
    if (errorMessage.includes('not found')) {
      return 404;
    }
    if (
      errorMessage.includes('already exists') ||
      errorMessage.includes('duplicate')
    ) {
      return 409;
    }
    if (
      errorMessage.includes('Invalid') ||
      errorMessage.includes('validation') ||
      errorMessage.includes('At least one')
    ) {
      return 400;
    }
    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      `Unexpected error in ${this.constructor.name}`,
      error as Error,
      {
        error: errorMessage
      }
    );

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
```

---

### Example 2: Controller with Custom Endpoints

```typescript
/**
 * NetworkDeviceController (with custom query and action endpoints)
 */
export class NetworkDeviceController {
  constructor(
    private readonly createUseCase: CreateNetworkDeviceUseCase,
    private readonly getByIpUseCase: GetNetworkDeviceByIpUseCase,
    private readonly activateUseCase: ActivateNetworkDeviceUseCase,
    private readonly deactivateUseCase: DeactivateNetworkDeviceUseCase,
    private readonly logger: ILogger
  ) {}

  /**
   * GET /api/network-devices/by-ip?ip=192.168.1.1
   * Custom query endpoint for finding device by IP.
   */
  public getByIp = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.getByIpUseCase.execute({
        ipAddress: req.query.ip as string
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  /**
   * POST /api/network-devices/:id/activate
   * Custom action endpoint for activating a device.
   */
  public activate = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.activateUseCase.execute({
        id: req.params.id
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  /**
   * POST /api/network-devices/:id/deactivate
   * Custom action endpoint for deactivating a device.
   */
  public deactivate = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.deactivateUseCase.execute({
        id: req.params.id
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  // ... error handling methods ...
}
```

---

## 12. Summary Checklist

Use this checklist to verify your HTTP controller implementation:

### Structure

- [ ] Controller class named `[Resource]Controller`
- [ ] File named `[Resource]Controller.ts` (PascalCase)
- [ ] All dependencies injected via constructor
- [ ] All route handler methods are arrow functions (`public create = async (req, res) => { ... }`)
- [ ] No instance state modified during request handling

### Responsibilities

- [ ] Controller delegates ALL business logic to use cases
- [ ] Controller extracts data from req.body/params/query
- [ ] Controller calls use cases with DTOs
- [ ] Controller maps `Result<T>` to HTTP responses
- [ ] Controller sets appropriate HTTP status codes (200, 201, 204, 400, 404, 409, 500)
- [ ] Controller uses consistent response structure: `{ success: boolean, data?: T, error?: string }`

### Boundaries

- [ ] Controller contains ZERO business logic
- [ ] Controller does NOT access repositories directly
- [ ] Controller does NOT import domain entities/aggregates
- [ ] Controller does NOT perform data mapping (domain ↔ DTO)
- [ ] Controller does NOT handle domain events
- [ ] Controller does NOT perform validation (delegated to middleware)

### Error Handling

- [ ] All route handlers wrapped in try-catch
- [ ] `Result.fail()` mapped to appropriate HTTP status codes
- [ ] Private `getErrorStatusCode()` method for error mapping
- [ ] Private `handleUnexpectedError()` method for exceptions
- [ ] All unexpected errors logged with full context
- [ ] Generic error messages returned to client (no leak)

### Testing

- [ ] Integration tests for all endpoints (with supertest)
- [ ] Unit tests with mocked use cases
- [ ] Happy path tests (successful operations)
- [ ] Error path tests (validation, not found, conflict)
- [ ] Exception tests (unexpected errors, logging)
- [ ] > 80% code coverage

### Code Quality

- [ ] All methods have JSDoc comments
- [ ] TypeScript strict mode enabled
- [ ] No `any` types (use `unknown` for errors)
- [ ] Consistent formatting (Prettier)
- [ ] No console.log (use logger)

### Orthogonality

- [ ] Controller is protocol adapter (no business logic)
- [ ] Controller is stateless
- [ ] Error mapping is HTTP-specific (use cases are protocol-agnostic)
- [ ] Response structure is consistent across all endpoints

---

**Remember**: Controllers are thin coordination layers. If you find yourself writing business logic in a controller, STOP and move it to a use case. Controllers translate between HTTP and application layer—nothing more.
