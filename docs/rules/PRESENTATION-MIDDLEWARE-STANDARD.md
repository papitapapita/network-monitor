# PRESENTATION MIDDLEWARE STANDARD

## Table of Contents

1. [Purpose of Middleware in DDD](#1-purpose-of-middleware-in-ddd)
2. [Responsibilities of Middleware](#2-responsibilities-of-middleware)
3. [Boundaries of Middleware](#3-boundaries-of-middleware)
4. [Connections with Other Layers](#4-connections-with-other-layers)
5. [Middleware Lifetime & Lifecycle](#5-middleware-lifetime--lifecycle)
6. [Middleware Structure Template](#6-middleware-structure-template)
7. [Orthogonality Principles](#7-orthogonality-principles)
8. [Naming Conventions](#8-naming-conventions)
9. [Error Handling Patterns](#9-error-handling-patterns)
10. [Testing Strategy](#10-testing-strategy)
11. [Examples](#11-examples)
12. [Summary Checklist](#12-summary-checklist)

---

## 1. Purpose of Middleware in DDD

**Middleware are presentation layer components that intercept HTTP requests/responses to handle cross-cutting concerns, executing before or after route handlers without containing any business logic.**

### Core Characteristics:

- **Cross-Cutting Concerns**: Handles concerns that apply across multiple routes (auth, validation, logging)
- **Pipeline Pattern**: Executes in sequence before/after controllers
- **Single Responsibility**: Each middleware handles ONE specific concern
- **Composable**: Multiple middleware can be chained together
- **Reusable**: Same middleware used across different routes
- **Stateless**: No instance state modified between requests

### Why Middleware?

1. **Separation of Concerns**: Isolates cross-cutting logic from route handlers
2. **DRY Principle**: Shared logic written once, applied to many routes
3. **Testability**: Cross-cutting concerns can be tested in isolation
4. **Composability**: Build complex pipelines from simple, focused middleware
5. **Maintainability**: Changes to cross-cutting logic in one place
6. **Framework Alignment**: Leverages Express/Fastify middleware patterns

### Middleware vs Controller:

| Aspect              | Middleware                       | Controller                      |
| ------------------- | -------------------------------- | ------------------------------- |
| **Purpose**         | Cross-cutting concerns           | Request/response coordination   |
| **Scope**           | Multiple routes                  | Single resource                 |
| **Business Logic**  | NONE                             | NONE (delegates to use cases)   |
| **Request Flow**    | Intercepts, may short-circuit    | Terminates request              |
| **Response**        | May modify or pass through       | Always sends final response     |
| **Examples**        | Auth, validation, logging, CORS  | CRUD operations, actions        |
| **Execution Order** | Before controller                | After all middleware pass       |

### Middleware vs Domain Services:

| Aspect             | Middleware (Presentation)          | Domain Service (Domain)          |
| ------------------ | ---------------------------------- | -------------------------------- |
| **Layer**          | Presentation                       | Domain                           |
| **Purpose**        | HTTP-level concerns                | Business logic operations        |
| **Knowledge**      | HTTP, Express, Headers, Cookies    | Domain entities, business rules  |
| **Dependencies**   | Request/Response, Logger           | Repositories, other services     |
| **Examples**       | Request validation, auth header    | Calculate device health score    |

---

## 2. Responsibilities of Middleware

### MUST DO:

1. **Handle Cross-Cutting Concerns**

   - Authentication (verify tokens, sessions)
   - Authorization (check permissions)
   - Request validation (delegate to Zod schemas)
   - Request logging and tracing
   - Rate limiting
   - CORS handling
   - Request parsing (body, cookies)

2. **Control Request Flow**

   - Call `next()` to pass to next middleware/controller
   - Short-circuit with error response if validation fails
   - Attach data to `req` object for downstream use (e.g., `req.user`)

3. **Transform Request/Response**

   - Parse and normalize headers
   - Add request IDs for tracing
   - Compress responses
   - Set security headers

4. **Provide Consistent Error Responses**

   - Return appropriate HTTP status codes (400, 401, 403, 500)
   - Use consistent error response structure
   - Never leak internal details

5. **Be Idempotent and Side-Effect Free**

   - Same request produces same outcome
   - No database modifications (except logging)
   - No state mutations

6. **Log Appropriately**
   - Log entry/exit for debugging
   - Log errors with context
   - Include request ID for correlation

---

## 3. Boundaries of Middleware

### MUST NOT DO:

1. **❌ Contain Business Logic**

   - NO domain calculations
   - NO business rule validation
   - NO workflow orchestration
   - **Why**: Business logic belongs in domain/application layers

2. **❌ Access Repositories Directly**

   - NO database queries for business data
   - Exception: Auth middleware may verify tokens in DB
   - **Why**: Data access should go through use cases

3. **❌ Depend on Domain Entities**

   - NO imports of aggregates, entities, or value objects
   - Only use DTOs and primitives
   - **Why**: Presentation should not know domain internals

4. **❌ Modify Request Body Semantically**

   - NO enriching request with business data
   - OK to normalize/sanitize input
   - **Why**: Data enrichment is business logic

5. **❌ Make External API Calls for Business Data**

   - NO calling external services for business operations
   - Exception: Auth services for token validation
   - **Why**: External calls are infrastructure/application concern

6. **❌ Store State Between Requests**

   - NO instance variables modified during request
   - Each request is independent
   - **Why**: Stateful middleware breaks in concurrent environments

7. **❌ Perform Complex Transformations**

   - NO data mapping or conversion
   - Only simple normalization (trim, lowercase)
   - **Why**: Complex transformations are business logic

8. **❌ Catch and Suppress All Errors**
   - Don't swallow errors silently
   - Always log and respond appropriately
   - **Why**: Silent failures hide bugs

---

## 4. Connections with Other Layers

```
┌────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                           │
│                                                                  │
│  Request Flow:                                                   │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐ │
│  │  CORS    │──→│  Auth    │──→│ Validate │──→│  Controller  │ │
│  │Middleware│   │Middleware│   │Middleware│   │              │ │
│  └──────────┘   └──────────┘   └──────────┘   └──────────────┘ │
│       │              │              │                │          │
│       │ 403          │ 401          │ 400            │          │
│       ▼              ▼              ▼                ▼          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Error Handler                        │   │
│  │              (Global Error Middleware)                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               │ Uses (Auth only)
                               ▼
┌────────────────────────────────────────────────────────────────┐
│                  INFRASTRUCTURE LAYER                           │
│  - Token verification service                                   │
│  - Rate limiter (Redis)                                         │
│  - Logger                                                       │
└────────────────────────────────────────────────────────────────┘

Middleware Categories:
1. Global (applied to all routes): CORS, logging, error handler
2. Route-specific: validation, auth, rate limiting
3. Error handling: catches errors from all middleware/controllers
```

### Dependency Rules:

✅ **Middleware CAN depend on:**

- Express types (Request, Response, NextFunction)
- Validation libraries (Zod)
- Authentication libraries (JWT, Passport)
- Logger interface (ILogger)
- Rate limiter services
- Configuration/environment

❌ **Middleware CANNOT depend on:**

- Domain entities, aggregates, value objects
- Use cases
- Repositories
- Application services (except auth-related)
- Other middleware (call, don't import)

---

## 5. Middleware Lifetime & Lifecycle

### Instantiation Flow:

```typescript
// 1. Application Startup - Create middleware (if factory-based)
const validateRequest = createValidationMiddleware();
const authenticate = createAuthMiddleware(authService);
const rateLimit = createRateLimitMiddleware(redisClient);

// 2. Register Global Middleware (order matters!)
app.use(express.json()); // Built-in: parse JSON
app.use(cors(corsOptions)); // Global: CORS
app.use(requestLogger); // Global: logging
app.use(addRequestId); // Global: tracing

// 3. Register Route-Specific Middleware
router.post(
  '/devices',
  authenticate, // Route: verify token
  validateRequest(createDeviceSchema), // Route: validate body
  controller.create // Handler
);

// 4. Register Error Handler (MUST be last)
app.use(errorHandler);

// 5. Request Arrives
// POST /api/network-devices

// 6. Middleware Chain Executes
// a. express.json() → parses body
// b. cors() → checks origin
// c. requestLogger → logs request
// d. addRequestId → adds X-Request-Id
// e. authenticate → verifies JWT
// f. validateRequest → validates body against schema
// g. controller.create → handles request

// 7. Response Sent
// If any middleware fails, chain short-circuits
```

### Key Lifecycle Characteristics:

- **Created at startup**: Middleware factories called once
- **Stateless execution**: No state between requests
- **Order-dependent**: Execution order affects behavior
- **Short-circuit capable**: Can terminate request early
- **Error propagation**: Errors flow to error handler

### Middleware Execution Order:

```
Request → [Global Middleware] → [Route Middleware] → Controller
                                                          │
Response ← [Global Middleware] ← [Route Middleware] ←─────┘
```

---

## 6. Middleware Structure Template

### Factory Pattern Template (Recommended)

Use factory pattern when middleware needs configuration or dependencies.

```typescript
import { Request, Response, NextFunction } from 'express';

/**
 * Factory function for creating [MiddlewareName] middleware.
 *
 * [Description of what this middleware does]
 *
 * @param config - Configuration options
 * @returns Express middleware function
 *
 * @example
 * const middleware = create[MiddlewareName]Middleware({
 *   option1: 'value',
 *   option2: true
 * });
 * router.use(middleware);
 */

interface [MiddlewareName]Config {
  [option1]: [type];
  [option2]?: [type];
}

export const create[MiddlewareName]Middleware = (config: [MiddlewareName]Config) => {
  // Validate config at creation time
  if (!config.[option1]) {
    throw new Error('[MiddlewareName] requires [option1]');
  }

  // Return the actual middleware function
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // 1. Extract data from request
      const [data] = req.[headers|body|params|query].[field];

      // 2. Perform middleware logic
      if (![validationCondition]) {
        res.status([statusCode]).json({
          success: false,
          error: '[Error message]'
        });
        return;
      }

      // 3. Optionally attach data to request
      (req as any).[customProperty] = [value];

      // 4. Pass to next middleware
      next();
    } catch (error) {
      // 5. Handle unexpected errors
      next(error);
    }
  };
};
```

### Simple Middleware Template (No Dependencies)

Use when middleware needs no configuration.

```typescript
import { Request, Response, NextFunction } from 'express';

/**
 * [MiddlewareName] middleware.
 *
 * [Description of what this middleware does]
 *
 * @example
 * router.use([middlewareName]);
 */
export const [middlewareName] = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // 1. Perform middleware logic
    const [value] = req.[property];

    // 2. Validate or transform
    if (![condition]) {
      res.status([statusCode]).json({
        success: false,
        error: '[Error message]'
      });
      return;
    }

    // 3. Optionally modify request
    (req as any).[customProperty] = [value];

    // 4. Continue to next
    next();
  } catch (error) {
    next(error);
  }
};
```

### Async Middleware Template

Use when middleware performs async operations.

```typescript
import { Request, Response, NextFunction } from 'express';

/**
 * Async [MiddlewareName] middleware.
 *
 * [Description]
 */
export const [middlewareName] = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Async operation
    const result = await [asyncOperation]();

    if (!result) {
      res.status([statusCode]).json({
        success: false,
        error: '[Error message]'
      });
      return;
    }

    (req as any).[property] = result;
    next();
  } catch (error) {
    next(error);
  }
};
```

### Error Handler Middleware Template

Error handlers have 4 parameters and must be registered last.

```typescript
import { Request, Response, NextFunction } from 'express';
import { ILogger } from '../../../application/interfaces/ILogger';

/**
 * Global error handler middleware.
 *
 * Catches all errors from middleware and controllers.
 * MUST be registered last in the middleware chain.
 *
 * @param logger - Logger instance for error logging
 */
export const createErrorHandler = (logger: ILogger) => {
  return (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    // Log error with context
    logger.error('Unhandled error', error, {
      method: req.method,
      path: req.path,
      requestId: (req as any).requestId
    });

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      ...(isDevelopment && { details: error.message, stack: error.stack })
    });
  };
};
```

---

## 7. Orthogonality Principles

### Principle 1: Single Responsibility

Each middleware handles exactly ONE cross-cutting concern.

**✅ Good Example:**

```typescript
// ✅ Separate middleware for each concern
export const addRequestId = (req: Request, res: Response, next: NextFunction) => {
  (req as any).requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', (req as any).requestId);
  next();
};

export const logRequest = (req: Request, res: Response, next: NextFunction) => {
  logger.info('Request received', {
    method: req.method,
    path: req.path,
    requestId: (req as any).requestId
  });
  next();
};

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  // ... authentication logic only
};
```

**❌ Bad Example:**

```typescript
// ❌ Multiple concerns in one middleware
export const doEverything = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // ❌ Request ID generation
  (req as any).requestId = crypto.randomUUID();

  // ❌ Logging
  console.log('Request:', req.method, req.path);

  // ❌ Authentication
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ❌ Validation
  if (!req.body.name) {
    return res.status(400).json({ error: 'Name required' });
  }

  // ❌ Rate limiting
  const count = await redis.incr(req.ip);
  if (count > 100) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  next();
};
```

**Why this matters**: Single responsibility makes middleware testable, reusable, and maintainable.

---

### Principle 2: Composability Over Complexity

Build complex behavior by composing simple middleware.

**✅ Good Example:**

```typescript
// ✅ Compose simple middleware
router.post(
  '/devices',
  addRequestId,           // 1. Add tracing
  logRequest,             // 2. Log request
  authenticate,           // 3. Verify auth
  authorize('admin'),     // 4. Check permissions
  validateRequest(schema), // 5. Validate body
  controller.create       // 6. Handle request
);

// Each middleware can be tested independently
// Each middleware can be reused across routes
```

**❌ Bad Example:**

```typescript
// ❌ One monolithic middleware that does everything
router.post(
  '/devices',
  superMiddleware, // Does auth, validation, logging, etc.
  controller.create
);
```

**Why this matters**: Composability enables flexible pipeline construction and independent testing.

---

### Principle 3: Fail Fast and Clearly

Middleware should reject invalid requests immediately with clear error messages.

**✅ Good Example:**

```typescript
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  // ✅ Fail fast: Missing header
  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: 'Authorization header is required'
    });
    return;
  }

  // ✅ Fail fast: Invalid format
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authorization header must use Bearer scheme'
    });
    return;
  }

  const token = authHeader.replace('Bearer ', '');

  // ✅ Fail fast: Empty token
  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Token is required'
    });
    return;
  }

  try {
    const decoded = await verifyToken(token);
    (req as any).user = decoded;
    next();
  } catch (error) {
    // ✅ Clear error for invalid token
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};
```

**❌ Bad Example:**

```typescript
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    const decoded = await verifyToken(token);
    (req as any).user = decoded;
    next();
  } catch (error) {
    // ❌ Generic error - doesn't help debug
    res.status(401).json({ error: 'Unauthorized' });
  }
};
```

**Why this matters**: Clear error messages help API consumers debug issues quickly.

---

### Principle 4: No Business Logic

Middleware handles HTTP-level concerns only. Business logic belongs in domain/application.

**✅ Good Example:**

```typescript
// ✅ HTTP-level validation (structure, format)
export const validateRequest = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query
    });

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.errors
      });
      return;
    }

    next();
  };
};
```

**❌ Bad Example:**

```typescript
// ❌ Business logic in middleware
export const validateDevice = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // ❌ Business rule: Check if IP is already in use
  const existingDevice = await deviceRepository.findByIp(req.body.ipAddress);
  if (existingDevice) {
    return res.status(409).json({ error: 'IP already exists' });
  }

  // ❌ Business rule: Check if device can be activated
  if (req.body.status === 'ACTIVE' && !canDeviceBeActivated(req.body)) {
    return res.status(400).json({ error: 'Device cannot be activated' });
  }

  // ❌ Business calculation
  req.body.healthScore = calculateDeviceHealth(req.body);

  next();
};
```

**Why this matters**: Business logic in middleware can't be reused by other protocols (WebSocket, CLI) and can't be properly tested.

---

### Principle 5: Stateless Execution

Middleware must not store state between requests.

**✅ Good Example:**

```typescript
// ✅ Factory creates middleware with config (immutable)
export const createRateLimiter = (options: RateLimitOptions) => {
  // Config captured at creation time
  const { maxRequests, windowMs } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Each request is independent
    const key = req.ip;
    const count = await redis.get(key);

    if (count && parseInt(count) > maxRequests) {
      res.status(429).json({
        success: false,
        error: 'Too many requests'
      });
      return;
    }

    await redis.incr(key);
    await redis.expire(key, windowMs / 1000);
    next();
  };
};
```

**❌ Bad Example:**

```typescript
// ❌ Stateful middleware - DANGEROUS
let requestCount = 0; // ❌ Global state
const requestTimes: number[] = []; // ❌ Global state

export const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  requestCount++; // ❌ Modifying shared state
  requestTimes.push(Date.now()); // ❌ Memory leak

  if (requestCount > 100) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  next();
};
```

**Why this matters**: Stateful middleware causes race conditions and memory leaks in concurrent environments.

---

## 8. Naming Conventions

### Middleware Function Names

**Pattern:** `camelCase` describing the action

**✅ Good Examples:**

- `validateRequest` (validates HTTP request)
- `authenticate` (verifies authentication)
- `authorize` (checks authorization)
- `logRequest` (logs incoming request)
- `addRequestId` (adds request ID header)
- `parseJson` (parses JSON body)
- `handleCors` (handles CORS)
- `rateLimit` (rate limits requests)
- `compressResponse` (compresses response)

**❌ Bad Examples:**

- `validator` (noun, not verb)
- `authMiddleware` (redundant 'middleware')
- `doAuth` (unnecessary 'do' prefix)
- `AUTHENTICATE` (not camelCase)
- `authentication_middleware` (snake_case)

---

### Factory Function Names

**Pattern:** `create[MiddlewareName]` or `create[MiddlewareName]Middleware`

**✅ Good Examples:**

- `createValidationMiddleware`
- `createAuthMiddleware`
- `createRateLimiter`
- `createErrorHandler`
- `createRequestLogger`

**❌ Bad Examples:**

- `validationMiddlewareFactory` (too verbose)
- `makeAuth` (not descriptive)
- `getMiddleware` ('get' implies retrieval, not creation)

---

### File Names

**Pattern:** `[middlewareName].ts` (camelCase) or `[middleware-name].middleware.ts` (kebab-case)

**✅ Good Examples:**

```
src/presentation/http/middleware/
├── validateRequest.ts
├── authenticate.ts
├── authorize.ts
├── rateLimiter.ts
├── requestLogger.ts
├── errorHandler.ts
├── addRequestId.ts
└── index.ts (exports all)
```

**Alternative (kebab-case with suffix):**

```
src/presentation/http/middleware/
├── validate-request.middleware.ts
├── authenticate.middleware.ts
└── index.ts
```

**❌ Bad Examples:**

- `Middleware.ts` (too generic)
- `auth.ts` (too vague)
- `ValidateRequestMiddleware.ts` (PascalCase for functions)

---

### Type Names

**Pattern:** `[MiddlewareName]Config` or `[MiddlewareName]Options`

**✅ Good Examples:**

```typescript
interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
}

interface AuthMiddlewareOptions {
  tokenSecret: string;
  excludePaths?: string[];
}

interface ValidationMiddlewareConfig {
  schema: ZodSchema;
  stripUnknown?: boolean;
}
```

---

## 9. Error Handling Patterns

### Pattern 1: Validation Error (400 Bad Request)

```typescript
export const validateRequest = (schema: ZodSchema) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        params: req.params,
        query: req.query
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // ✅ Structured validation error
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
        return;
      }
      next(error);
    }
  };
};
```

**Response Format:**

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    { "field": "body.ipAddress", "message": "Invalid IP format", "code": "invalid_string" },
    { "field": "body.name", "message": "Name is required", "code": "invalid_type" }
  ]
}
```

---

### Pattern 2: Authentication Error (401 Unauthorized)

```typescript
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    // ✅ Clear error: missing header
    res.status(401).json({
      success: false,
      error: 'Authorization header is required'
    });
    return;
  }

  if (!authHeader.startsWith('Bearer ')) {
    // ✅ Clear error: wrong format
    res.status(401).json({
      success: false,
      error: 'Authorization must use Bearer scheme'
    });
    return;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = await verifyToken(token);
    (req as any).user = decoded;
    next();
  } catch (error) {
    // ✅ Clear error: invalid token
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};
```

---

### Pattern 3: Authorization Error (403 Forbidden)

```typescript
export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user) {
      // Should not happen if authenticate runs first
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      // ✅ Clear error: permission denied
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: user.role
      });
      return;
    }

    next();
  };
};
```

---

### Pattern 4: Rate Limit Error (429 Too Many Requests)

```typescript
export const createRateLimiter = (options: RateLimitOptions) => {
  const { maxRequests, windowMs } = options;

  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const key = `rate_limit:${req.ip}`;
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, Math.ceil(windowMs / 1000));
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));

    if (count > maxRequests) {
      const ttl = await redis.ttl(key);
      res.setHeader('Retry-After', ttl);

      // ✅ Clear error with retry info
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: ttl
      });
      return;
    }

    next();
  };
};
```

---

### Pattern 5: Global Error Handler (500 Internal Server Error)

```typescript
export const createErrorHandler = (logger: ILogger) => {
  return (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const requestId = (req as any).requestId || 'unknown';

    // ✅ Log full error server-side
    logger.error('Unhandled error', error, {
      requestId,
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.body,
      stack: error.stack
    });

    // ✅ Never leak internal details to client
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      requestId // Include for support reference
    });
  };
};
```

---

### Error Response Consistency

All middleware should use the same error response structure:

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  details?: Array<{ field: string; message: string; code?: string }>;
  requestId?: string;
  retryAfter?: number;
}
```

| Status | When to Use               | Error Message Examples                  |
| ------ | ------------------------- | --------------------------------------- |
| 400    | Validation failed         | "Validation failed", "Invalid format"   |
| 401    | Not authenticated         | "Authorization required", "Token expired" |
| 403    | Not authorized            | "Insufficient permissions"              |
| 404    | Route not found           | "Endpoint not found"                    |
| 429    | Rate limit exceeded       | "Too many requests"                     |
| 500    | Unexpected server error   | "Internal server error"                 |

---

## 10. Testing Strategy

### Test Structure

Middleware should be tested in isolation with mocked Express objects.

#### Unit Test Template

```typescript
import { Request, Response, NextFunction } from 'express';
import { validateRequest } from './validateRequest';
import { z } from 'zod';

describe('validateRequest middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      body: {},
      params: {},
      query: {}
    };

    mockRes = {
      status: statusMock,
      json: jsonMock
    };

    mockNext = jest.fn();
  });

  describe('when validation passes', () => {
    it('should call next()', async () => {
      const schema = z.object({
        body: z.object({
          name: z.string().min(1)
        })
      });

      mockReq.body = { name: 'Test' };

      const middleware = validateRequest(schema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('when validation fails', () => {
    it('should return 400 with error details', async () => {
      const schema = z.object({
        body: z.object({
          name: z.string().min(1, 'Name is required')
        })
      });

      mockReq.body = { name: '' };

      const middleware = validateRequest(schema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'body.name',
            message: expect.stringContaining('Name is required')
          })
        ])
      });
    });

    it('should return 400 for missing required fields', async () => {
      const schema = z.object({
        body: z.object({
          name: z.string(),
          email: z.string().email()
        })
      });

      mockReq.body = {};

      const middleware = validateRequest(schema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe('when unexpected error occurs', () => {
    it('should call next with error', async () => {
      const error = new Error('Unexpected');
      const schema = {
        parseAsync: jest.fn().mockRejectedValue(error)
      } as any;

      const middleware = validateRequest(schema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
```

---

#### Authentication Middleware Test

```typescript
import { authenticate } from './authenticate';
import { Request, Response, NextFunction } from 'express';

describe('authenticate middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      headers: {}
    };

    mockRes = {
      status: statusMock,
      json: jsonMock
    };

    mockNext = jest.fn();
  });

  describe('when no authorization header', () => {
    it('should return 401', async () => {
      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Authorization header is required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('when invalid token format', () => {
    it('should return 401 for non-Bearer token', async () => {
      mockReq.headers = { authorization: 'Basic abc123' };

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Authorization must use Bearer scheme'
      });
    });
  });

  describe('when valid token', () => {
    it('should attach user to request and call next', async () => {
      const validToken = 'valid.jwt.token';
      mockReq.headers = { authorization: `Bearer ${validToken}` };

      // Mock token verification
      jest.spyOn(tokenService, 'verify').mockResolvedValue({
        id: 'user-123',
        role: 'admin'
      });

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as any).user).toEqual({
        id: 'user-123',
        role: 'admin'
      });
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('when expired token', () => {
    it('should return 401', async () => {
      mockReq.headers = { authorization: 'Bearer expired.token.here' };

      jest.spyOn(tokenService, 'verify').mockRejectedValue(
        new Error('Token expired')
      );

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired token'
      });
    });
  });
});
```

---

#### Integration Test Template

```typescript
import request from 'supertest';
import express from 'express';
import { validateRequest } from './validateRequest';
import { authenticate } from './authenticate';
import { createNetworkDeviceSchema } from '../validation/network-device.schemas';

describe('Middleware Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('validateRequest + controller', () => {
    beforeEach(() => {
      app.post(
        '/test',
        validateRequest(createNetworkDeviceSchema),
        (req, res) => {
          res.status(201).json({ success: true, data: req.body });
        }
      );
    });

    it('should pass valid request to controller', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          ipAddress: '192.168.1.1',
          name: 'Router-01',
          deviceType: 'ROUTER',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          deviceId: '123e4567-e89b-12d3-a456-426614174000'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should reject invalid request', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          ipAddress: 'invalid',
          name: ''
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeInstanceOf(Array);
    });
  });

  describe('middleware chain', () => {
    beforeEach(() => {
      app.post(
        '/protected',
        authenticate,
        validateRequest(createNetworkDeviceSchema),
        (req, res) => {
          res.status(201).json({ success: true });
        }
      );
    });

    it('should reject unauthenticated request before validation', async () => {
      const response = await request(app)
        .post('/protected')
        .send({ invalid: 'data' })
        .expect(401);

      // Auth fails first, validation never runs
      expect(response.body.error).toContain('Authorization');
    });

    it('should validate after authentication passes', async () => {
      const response = await request(app)
        .post('/protected')
        .set('Authorization', 'Bearer valid.token.here')
        .send({ invalid: 'data' })
        .expect(400);

      // Auth passes, validation fails
      expect(response.body.error).toBe('Validation failed');
    });
  });
});
```

---

### Coverage Requirements

1. **Happy Path Tests**
   - Valid input passes through
   - `next()` called without arguments
   - Request properties attached correctly

2. **Error Path Tests**
   - Missing required data → appropriate status code
   - Invalid format → clear error message
   - Unexpected errors → passed to `next(error)`

3. **Edge Case Tests**
   - Empty strings
   - Null/undefined values
   - Boundary values
   - Malformed headers

4. **Integration Tests**
   - Middleware chain order
   - Short-circuit behavior
   - Error handler catches errors

---

## 11. Examples

### Example 1: Request Validation Middleware

```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Express middleware factory for validating requests using Zod schemas.
 *
 * Validates:
 * - req.body
 * - req.params
 * - req.query
 *
 * If validation fails, returns 400 Bad Request with detailed error messages.
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 *
 * @example
 * router.post(
 *   '/devices',
 *   validateRequest(createNetworkDeviceSchema),
 *   controller.create
 * );
 */
export const validateRequest = (schema: ZodSchema) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: formattedErrors
        });
        return;
      }

      next(error);
    }
  };
};
```

---

### Example 2: Authentication Middleware

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Authentication middleware using JWT.
 *
 * Extracts and verifies JWT from Authorization header.
 * Attaches decoded user to req.user on success.
 *
 * @example
 * router.use(authenticate);
 * // or
 * router.get('/protected', authenticate, controller.method);
 */

interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: 'Authorization header is required'
    });
    return;
  }

  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authorization must use Bearer scheme'
    });
    return;
  }

  const token = authHeader.substring(7);

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Token is required'
    });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token has expired'
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
      return;
    }

    next(error);
  }
};
```

---

### Example 3: Authorization Middleware

```typescript
import { Request, Response, NextFunction } from 'express';

/**
 * Authorization middleware factory.
 *
 * Checks if authenticated user has required role(s).
 * Must be used AFTER authenticate middleware.
 *
 * @param allowedRoles - Roles that can access the route
 * @returns Express middleware function
 *
 * @example
 * router.delete(
 *   '/devices/:id',
 *   authenticate,
 *   authorize('admin', 'super_admin'),
 *   controller.delete
 * );
 */
export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: user.role
      });
      return;
    }

    next();
  };
};
```

---

### Example 4: Request ID Middleware

```typescript
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Adds unique request ID for tracing.
 *
 * - Generates UUID for each request
 * - Attaches to req.requestId
 * - Sets X-Request-Id response header
 *
 * @example
 * app.use(addRequestId); // Apply globally
 */

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export const addRequestId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Use existing header if provided (for distributed tracing)
  const existingId = req.headers['x-request-id'] as string;
  const requestId = existingId || crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
};
```

---

### Example 5: Request Logger Middleware

```typescript
import { Request, Response, NextFunction } from 'express';
import { ILogger } from '../../../application/interfaces/ILogger';

/**
 * Request logging middleware factory.
 *
 * Logs incoming requests and response times.
 *
 * @param logger - Logger instance
 * @returns Express middleware function
 *
 * @example
 * app.use(createRequestLogger(logger));
 */
export const createRequestLogger = (logger: ILogger) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    // Log request
    logger.info('Incoming request', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;

      logger.info('Request completed', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`
      });
    });

    next();
  };
};
```

---

### Example 6: Error Handler Middleware

```typescript
import { Request, Response, NextFunction } from 'express';
import { ILogger } from '../../../application/interfaces/ILogger';

/**
 * Global error handler middleware.
 *
 * MUST be registered last in middleware chain.
 * Catches all unhandled errors from middleware and controllers.
 *
 * @param logger - Logger instance
 * @returns Express error handler middleware
 *
 * @example
 * // Register last!
 * app.use(createErrorHandler(logger));
 */
export const createErrorHandler = (logger: ILogger) => {
  return (
    error: Error,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: NextFunction
  ): void => {
    // Log full error details server-side
    logger.error('Unhandled error', error, {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      query: req.query,
      userId: req.user?.id
    });

    // Determine status code
    const statusCode = (error as any).statusCode || 500;

    // Never leak internal details in production
    const isDevelopment = process.env.NODE_ENV === 'development';

    res.status(statusCode).json({
      success: false,
      error: statusCode === 500 ? 'Internal server error' : error.message,
      requestId: req.requestId,
      ...(isDevelopment && {
        details: error.message,
        stack: error.stack
      })
    });
  };
};
```

---

## 12. Summary Checklist

### Structure

- [ ] Middleware file placed in `src/presentation/http/middleware/`
- [ ] File named `[middlewareName].ts` (camelCase)
- [ ] Factory pattern used when config/dependencies needed
- [ ] Exported via `index.ts` for clean imports
- [ ] TypeScript types defined for config/options

### Responsibilities

- [ ] Handles exactly ONE cross-cutting concern
- [ ] Calls `next()` to pass control
- [ ] Returns early with error response when validation fails
- [ ] Logs appropriately (entry, exit, errors)
- [ ] Attaches data to `req` when needed (e.g., `req.user`)

### Boundaries

- [ ] Contains NO business logic
- [ ] Does NOT access repositories directly
- [ ] Does NOT import domain entities
- [ ] Does NOT perform complex transformations
- [ ] Is stateless (no instance variables modified)

### Error Handling

- [ ] Returns appropriate HTTP status codes (400, 401, 403, 429, 500)
- [ ] Uses consistent error response structure
- [ ] Provides clear, specific error messages
- [ ] Never leaks internal error details
- [ ] Passes unexpected errors to `next(error)`

### Orthogonality

- [ ] Single responsibility (one concern per middleware)
- [ ] Composable with other middleware
- [ ] Fails fast with clear errors
- [ ] No business logic
- [ ] Stateless execution

### Testing

- [ ] Unit tests with mocked Request/Response
- [ ] Tests for happy path (validation passes)
- [ ] Tests for error paths (various failure scenarios)
- [ ] Tests for edge cases (empty values, malformed input)
- [ ] Integration tests for middleware chains
- [ ] >90% code coverage

### Code Quality

- [ ] JSDoc comments on middleware functions
- [ ] TypeScript strict mode enabled
- [ ] Consistent error response format
- [ ] No `any` types (use `unknown` for errors)
- [ ] Follows naming conventions

---

**Remember**: Middleware are reusable, composable units that handle cross-cutting concerns. Each middleware should do ONE thing well. If you find yourself writing business logic in middleware, STOP and move it to the appropriate layer (domain or application). Middleware is about HTTP-level concerns only.
