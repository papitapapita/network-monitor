# PRESENTATION ROUTE DEFINITIONS STANDARD

## Table of Contents

1. [Purpose of Route Definitions in DDD](#1-purpose-of-route-definitions-in-ddd)
2. [Responsibilities of Route Definitions](#2-responsibilities-of-route-definitions)
3. [Boundaries of Route Definitions](#3-boundaries-of-route-definitions)
4. [Connections with Other Layers](#4-connections-with-other-layers)
5. [Route Definition Lifetime & Lifecycle](#5-route-definition-lifetime--lifecycle)
6. [Route Definition Structure Template](#6-route-definition-structure-template)
7. [Orthogonality Principles](#7-orthogonality-principles)
8. [Naming Conventions](#8-naming-conventions)
9. [Error Handling Patterns](#9-error-handling-patterns)
10. [Testing Strategy](#10-testing-strategy)
11. [Examples](#11-examples)
12. [Summary Checklist](#12-summary-checklist)

---

## 1. Purpose of Route Definitions in DDD

**Route Definitions are presentation layer components that wire HTTP endpoints to controllers and middleware, defining the API surface of the application.**

### Core Characteristics:

- **Configuration-as-Code**: Routes are pure configuration with no logic
- **Middleware Composition**: Chains validation, auth, logging middleware
- **Controller Binding**: Maps HTTP paths to controller methods
- **RESTful Structure**: Follows REST conventions for resources
- **Factory Pattern**: Exported as factory functions that accept controllers
- **Type-Safe**: Leverages TypeScript for compile-time safety

### Why Route Definitions?

1. **Single Source of Truth**: All API endpoints defined in one place
2. **Testability**: Routes can be tested in isolation from business logic
3. **Middleware Composition**: Clean separation of cross-cutting concerns
4. **Discoverability**: Easy to see all available endpoints
5. **Maintainability**: Changes to routing don't affect business logic
6. **Documentation**: Routes serve as living API documentation

### Route Definition vs Controller:

| Aspect           | Route Definition             | Controller                  |
| ---------------- | ---------------------------- | --------------------------- |
| **Purpose**      | Wire endpoints               | Handle requests             |
| **Contents**     | Paths, middleware, bindings  | Business logic coordination |
| **Logic**        | NONE (pure configuration)    | Request/response handling   |
| **Dependencies** | Controller, middleware       | Use cases, logger           |
| **Returns**      | Express Router               | void (sends HTTP response)  |
| **Testing**      | Endpoint configuration tests | Integration/unit tests      |

---

## 2. Responsibilities of Route Definitions

### MUST DO:

1. **Define HTTP Endpoints**

   - Specify HTTP method (GET, POST, PUT, DELETE, PATCH)
   - Define URL path (e.g., `/api/network-devices/:id`)
   - Map to controller methods

2. **Compose Middleware Chain**

   - Validation middleware (Zod schemas)
   - Authentication middleware (if needed)
   - Authorization middleware (if needed)
   - Logging middleware (if needed)

3. **Follow RESTful Conventions**

   - `GET /resources` - List resources
   - `GET /resources/:id` - Get single resource
   - `POST /resources` - Create resource
   - `PUT /resources/:id` - Update resource (full)
   - `PATCH /resources/:id` - Update resource (partial)
   - `DELETE /resources/:id` - Delete resource

4. **Document Each Endpoint**

   - JSDoc comment for each route
   - Specify request structure (body, params, query)
   - Specify response structure
   - Document status codes

5. **Export Router Factory**

   - Function that accepts controller
   - Returns configured Express Router
   - Pure function (no side effects)

6. **Group Related Routes**
   - One route file per resource/aggregate
   - All routes for same base path in one file

7. **Route Grouping/Prefixing (Versioning)**
   - Routes MUST NOT define their own global prefix (e.g., `/api/v1`)
   - The main application entry point mounts routers on versioned prefixes
   - This enables supporting multiple API versions simultaneously as bounded contexts evolve
   - **Why**: Decouples route definitions from deployment concerns, allowing the same router to be mounted under different versions

   ```typescript
   // ✅ Good: Route factory has no version prefix
   export function createNetworkDeviceRoutes(controller: NetworkDeviceController): Router {
     const router = Router();
     router.get('/', controller.list);      // Just '/', not '/api/v1/network-devices'
     router.get('/:id', controller.getById);
     return router;
   }

   // ✅ Good: Main app mounts with version prefix
   // app.ts or main.ts
   app.use('/api/v1/network-devices', createNetworkDeviceRoutes(v1Controller));
   app.use('/api/v2/network-devices', createNetworkDeviceRoutes(v2Controller));
   ```

   ```typescript
   // ❌ Bad: Route factory defines global prefix
   export function createNetworkDeviceRoutes(controller: NetworkDeviceController): Router {
     const router = Router();
     router.get('/api/v1/network-devices', controller.list);  // ❌ Hardcoded prefix
     return router;
   }
   ```

---

## 3. Boundaries of Route Definitions

### MUST NOT DO:

1. **❌ Contain Business Logic**

   - NO validation logic (use middleware)
   - NO calculations or transformations
   - NO database access
   - **Why**: Routes are pure configuration

2. **❌ Instantiate Dependencies**

   - NO `new Controller()` inside routes
   - Accept controllers as parameters
   - **Why**: Dependency injection happens at app level

3. **❌ Handle Errors Directly**

   - NO try-catch blocks
   - Delegate to controller and error middleware
   - **Why**: Error handling is controller/middleware responsibility

4. **❌ Access Request/Response Objects**

   - NO direct manipulation of req/res
   - Only pass to controller methods
   - **Why**: Routes just wire, controllers handle

5. **❌ Perform Validation**

   - NO inline validation
   - Use validation middleware with Zod schemas
   - **Why**: Validation is middleware responsibility

6. **❌ Modify Request/Response**

   - NO `req.body.foo = 'bar'`
   - Middleware can transform, routes cannot
   - **Why**: Routes are declarative, not imperative

---

## 4. Connections with Other Layers

```
┌──────────────────────────────────────────────────┐
│          PRESENTATION LAYER                      │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │   Route Definitions                         │ │
│  │   - Define endpoints                        │ │
│  │   - Compose middleware                      │ │
│  │   - Bind controllers                        │ │
│  └─────────────────────────────────────────────┘ │
│              ↓                   ↓               │
│    ┌─────────────┐    ┌────────────────┐         │
│    │ Middleware  │    │  Controllers   │         │
│    └─────────────┘    └────────────────┘         │
└──────────────────────────────────────────────────┘
                          ↓
                 APPLICATION LAYER
                   (Use Cases)

Route Definition Dependencies:
- Express Router
- Controllers (injected)
- Validation Schemas
- Middleware functions
```

---

## 5. Route Definition Lifetime & Lifecycle

### Instantiation Flow:

```typescript
// 1. Application Startup - Create dependencies
const prisma = new PrismaClient();
const repository = new PrismaNetworkDeviceRepository(prisma);
const mapper = new NetworkDeviceMapper();
const logger = new ConsoleLogger('NetworkDeviceController');

// 2. Create use cases
const createUseCase = new CreateNetworkDeviceUseCase(
  repository,
  mapper
);
const listUseCase = new ListNetworkDevicesUseCase(repository, mapper);
// ... other use cases

// 3. Create controller
const controller = new NetworkDeviceController(
  createUseCase,
  listUseCase,
  getUseCase,
  updateUseCase,
  deleteUseCase,
  logger
);

// 4. Create routes (factory function)
const networkDeviceRoutes = createNetworkDeviceRoutes(controller);

// 5. Mount router on base path
app.use('/api/network-devices', networkDeviceRoutes);

// 6. Express server listens
app.listen(3000);

// 7. Request arrives:
// POST /api/network-devices
//   ↓
// 8. Express matches route: POST /
//   ↓
// 9. Validation middleware executes (Zod schema)
//   ↓
// 10. Controller method executes: controller.create(req, res)
//   ↓
// 11. Response sent
```

### Key Lifecycle Characteristics:

- **Created once at startup**: Routes are configured during app initialization
- **Immutable**: Once created, routes don't change (no hot-reloading in production)
- **Stateless**: Routes hold no state, just configuration
- **Long-lived**: Exist for application lifetime

---

## 6. Route Definition Structure Template

### Basic Route Factory Template

````typescript
import { Router } from 'express';
import { [Resource]Controller } from '../controllers/[Resource]Controller';
import { validateRequest } from '../middleware/validateRequest';
import {
  create[Resource]Schema,
  update[Resource]Schema,
  list[Resource]sSchema,
  getByIdSchema,
  delete[Resource]Schema
} from '../validation/[resource].schemas';

/**
 * Creates Express router for [Resource] endpoints.
 *
 * @param controller - [Resource]Controller instance
 * @returns Express router with all CRUD routes
 *
 * Base path: /api/[resources]
 *
 * Routes:
 * - POST   /                - Create [resource]
 * - GET    /                - List [resources]
 * - GET    /:id             - Get [resource] by ID
 * - PUT    /:id             - Update [resource]
 * - DELETE /:id             - Delete [resource]
 *
 * @example
 * ```typescript
 * const controller = new [Resource]Controller(...);
 * const router = create[Resource]Routes(controller);
 * app.use('/api/[resources]', router);
 * ```
 */
export function create[Resource]Routes(
  controller: [Resource]Controller
): Router {
  const router = Router();

  /**
   * POST /api/[resources]
   * Create a new [resource]
   *
   * Body: Create[Resource]DTO
   * Response: 201 Created with [Resource]ResponseDTO
   * Errors: 400 (validation), 409 (duplicate)
   */
  router.post(
    '/',
    validateRequest(create[Resource]Schema),
    controller.create
  );

  /**
   * GET /api/[resources]
   * List [resources] with pagination and filters
   *
   * Query params:
   * - limit (optional): Max results (default: 20, max: 100)
   * - offset (optional): Pagination offset (default: 0)
   * - [filter1] (optional): Filter by [field]
   * - [filter2] (optional): Filter by [field]
   *
   * Response: 200 OK with [Resource]ListResponseDTO
   * Errors: 400 (invalid query params)
   */
  router.get(
    '/',
    validateRequest(list[Resource]sSchema),
    controller.list
  );

  /**
   * GET /api/[resources]/:id
   * Get a [resource] by ID
   *
   * Params:
   * - id (required): [Resource] UUID
   *
   * Response: 200 OK with [Resource]ResponseDTO
   * Errors: 404 (not found), 400 (invalid UUID)
   */
  router.get(
    '/:id',
    validateRequest(getByIdSchema),
    controller.getById
  );

  /**
   * PUT /api/[resources]/:id
   * Update a [resource]
   *
   * Params:
   * - id (required): [Resource] UUID
   *
   * Body: Update[Resource]DTO (at least one field required)
   *
   * Response: 200 OK with [Resource]ResponseDTO
   * Errors: 404 (not found), 400 (validation), 409 (conflict)
   */
  router.put(
    '/:id',
    validateRequest(update[Resource]Schema),
    controller.update
  );

  /**
   * DELETE /api/[resources]/:id
   * Delete a [resource]
   *
   * Params:
   * - id (required): [Resource] UUID
   *
   * Response: 204 No Content
   * Errors: 404 (not found)
   */
  router.delete(
    '/:id',
    validateRequest(delete[Resource]Schema),
    controller.delete
  );

  return router;
}
````

---

### Complex Route Template (with Custom Endpoints)

```typescript
import { Router } from 'express';
import { NetworkDeviceController } from '../controllers/NetworkDeviceController';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate } from '../middleware/authenticate';
import {
  createNetworkDeviceSchema,
  getByIpSchema,
  activateDeviceSchema
} from '../validation/network-device.schemas';

/**
 * Creates Express router for NetworkDevice endpoints.
 *
 * Includes both standard CRUD and custom action endpoints.
 *
 * @param controller - NetworkDeviceController instance
 * @returns Express router with all routes
 */
export function createNetworkDeviceRoutes(
  controller: NetworkDeviceController
): Router {
  const router = Router();

  // =====================================
  // STANDARD CRUD ENDPOINTS
  // =====================================

  /**
   * POST /api/network-devices
   * Create a new network device
   */
  router.post(
    '/',
    authenticate, // Auth middleware
    validateRequest(createNetworkDeviceSchema),
    controller.create
  );

  /**
   * GET /api/network-devices
   * List network devices
   */
  router.get(
    '/',
    validateRequest(listNetworkDevicesSchema),
    controller.list
  );

  // =====================================
  // CUSTOM QUERY ENDPOINTS (before :id)
  // =====================================

  /**
   * GET /api/network-devices/by-ip?ip=192.168.1.1
   * Get network device by IP address
   *
   * IMPORTANT: Place before /:id route to avoid conflict
   */
  router.get(
    '/by-ip',
    validateRequest(getByIpSchema),
    controller.getByIp
  );

  /**
   * GET /api/network-devices/stats
   * Get network device statistics
   */
  router.get('/stats', authenticate, controller.getStats);

  // =====================================
  // STANDARD CRUD WITH :id
  // =====================================

  /**
   * GET /api/network-devices/:id
   * Get network device by ID
   */
  router.get(
    '/:id',
    validateRequest(getByIdSchema),
    controller.getById
  );

  /**
   * PUT /api/network-devices/:id
   * Update network device
   */
  router.put(
    '/:id',
    authenticate,
    validateRequest(updateNetworkDeviceSchema),
    controller.update
  );

  /**
   * DELETE /api/network-devices/:id
   * Delete network device
   */
  router.delete(
    '/:id',
    authenticate,
    validateRequest(deleteNetworkDeviceSchema),
    controller.delete
  );

  // =====================================
  // CUSTOM ACTION ENDPOINTS
  // =====================================

  /**
   * POST /api/network-devices/:id/activate
   * Activate a network device
   */
  router.post(
    '/:id/activate',
    authenticate,
    validateRequest(activateDeviceSchema),
    controller.activate
  );

  /**
   * POST /api/network-devices/:id/deactivate
   * Deactivate a network device
   */
  router.post(
    '/:id/deactivate',
    authenticate,
    validateRequest(deactivateDeviceSchema),
    controller.deactivate
  );

  /**
   * POST /api/network-devices/:id/test-connection
   * Test device connectivity
   */
  router.post(
    '/:id/test-connection',
    authenticate,
    controller.testConnection
  );

  return router;
}
```

---

## 7. Orthogonality Principles

### Principle 1: Routes Are Pure Configuration

Routes declare endpoints but contain NO logic. All logic is in controllers/middleware.

**✅ Good Example:**

```typescript
export function createNetworkDeviceRoutes(
  controller: NetworkDeviceController
): Router {
  const router = Router();

  // ✅ Pure configuration - just wiring
  router.post(
    '/',
    validateRequest(createNetworkDeviceSchema),
    controller.create
  );

  router.get('/', validateRequest(listSchema), controller.list);

  return router;
}
```

**❌ Bad Example:**

```typescript
export function createNetworkDeviceRoutes(
  controller: NetworkDeviceController
): Router {
  const router = Router();

  // ❌ BAD: Logic in route definition
  router.post(
    '/',
    (req, res, next) => {
      // ❌ BAD: Validation logic
      if (!req.body.ipAddress) {
        return res.status(400).json({ error: 'IP required' });
      }

      // ❌ BAD: Business logic
      if (req.body.ipAddress.startsWith('192.168.')) {
        req.body.isPrivate = true;
      }

      next();
    },
    controller.create
  );

  return router;
}
```

**Why this matters**: Logic in routes makes them untestable and violates single responsibility.

---

### Principle 2: Middleware Order Matters

Middleware executes left-to-right. Order is critical.

**✅ Good Example:**

```typescript
router.post(
  '/',
  authenticate, // 1. Check auth first
  validateRequest(schema), // 2. Then validate
  controller.create // 3. Finally execute
);
```

**❌ Bad Example:**

```typescript
router.post(
  '/',
  validateRequest(schema), // ❌ Validates before auth check
  authenticate, // ❌ Wastes CPU on invalid requests
  controller.create
);
```

**Correct middleware order:**

1. **Authentication** - Verify identity
2. **Authorization** - Check permissions
3. **Validation** - Validate request structure
4. **Business logic** - Controller execution

---

### Principle 3: Custom Routes Before :id Routes

Routes with static paths must come before parameterized routes.

**✅ Good Example:**

```typescript
// ✅ Static routes first
router.get('/by-ip', controller.getByIp);
router.get('/stats', controller.getStats);

// ✅ Parameterized routes last
router.get('/:id', controller.getById);
```

**❌ Bad Example:**

```typescript
// ❌ BAD: :id route catches everything
router.get('/:id', controller.getById);

// ❌ BAD: These will never match (Express thinks "by-ip" is an ID)
router.get('/by-ip', controller.getByIp);
router.get('/stats', controller.getStats);
```

**Why this matters**: Express matches routes in order. `:id` matches any string, so it must come last.

---

### Principle 4: One Router Per Resource

Each resource/aggregate gets its own route file.

**✅ Good Example:**

```
src/presentation/http/routes/
  ├── network-device.routes.ts     (all NetworkDevice endpoints)
  ├── user.routes.ts               (all User endpoints)
  ├── order.routes.ts              (all Order endpoints)
  └── index.ts                     (exports all routers)
```

**❌ Bad Example:**

```
src/presentation/http/routes/
  └── index.ts  (all routes for all resources in one file - 1000+ lines)
```

**Why this matters**: Separation by resource makes routes discoverable and maintainable.

---

## 8. Naming Conventions

### Route Factory Function Names

**Pattern:** `create[Resource]Routes`

**✅ Good Examples:**

- `createNetworkDeviceRoutes`
- `createUserRoutes`
- `createOrderRoutes`
- `createPollingConfigurationRoutes`

**❌ Bad Examples:**

- `networkDeviceRoutes` (not a function name)
- `getRoutes` (too generic)
- `routes` (not descriptive)
- `setupNetworkDeviceRoutes` (use 'create' prefix)

---

### File Names

**Pattern:** `[resource-name].routes.ts` (kebab-case)

**✅ Good Examples:**

- `network-device.routes.ts`
- `user.routes.ts`
- `order.routes.ts`
- `polling-configuration.routes.ts`

**❌ Bad Examples:**

- `NetworkDeviceRoutes.ts` (use kebab-case, not PascalCase)
- `network-device-routes.ts` (redundant, .routes.ts already indicates routes)
- `routes.ts` (not descriptive)
- `api.ts` (too generic)

---

### Endpoint Paths

**Pattern:** REST conventions

**✅ Good Examples:**

```typescript
POST   /api/network-devices            // Create
GET    /api/network-devices            // List
GET    /api/network-devices/:id        // Get by ID
PUT    /api/network-devices/:id        // Update (full)
PATCH  /api/network-devices/:id        // Update (partial)
DELETE /api/network-devices/:id        // Delete

// Custom queries (before :id)
GET    /api/network-devices/by-ip      // Query by field
GET    /api/network-devices/search     // Search

// Custom actions (after :id)
POST   /api/network-devices/:id/activate     // Action
POST   /api/network-devices/:id/deactivate   // Action
```

**❌ Bad Examples:**

```typescript
GET    /api/getNetworkDevices          // ❌ Verb in path
POST   /api/network-device             // ❌ Singular (use plural)
GET    /api/NetworkDevices             // ❌ PascalCase (use kebab-case)
DELETE /api/network-devices/delete/:id // ❌ Redundant 'delete'
POST   /api/network-devices/:id        // ❌ POST to existing resource (use PUT/PATCH)
```

---

## 9. Error Handling Patterns

### Pattern 1: Let Controllers Handle Errors

Routes don't handle errors—controllers and error middleware do.

```typescript
// ✅ Good: No error handling in routes
router.post('/', validateRequest(schema), controller.create);

// Controller handles errors
export class NetworkDeviceController {
  public create = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.createUseCase.execute(req.body);

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res
          .status(statusCode)
          .json({ success: false, error: result.error });
        return;
      }

      res.status(201).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };
}
```

---

### Pattern 2: Validation Middleware Catches Schema Errors

Validation middleware (Zod) handles request validation before controller.

```typescript
// Route definition
router.post(
  '/',
  validateRequest(createNetworkDeviceSchema), // Validation middleware
  controller.create
);

// Validation middleware (middleware/validateRequest.ts)
export function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query
      });

      // Valid - continue to controller
      next();
    } catch (error) {
      // Invalid - return 400
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors
        });
      }
    }
  };
}
```

---

### Pattern 3: Global Error Handler (Last Resort)

Express error-handling middleware catches all unhandled errors.

```typescript
// app.ts
app.use('/api/network-devices', networkDeviceRoutes);

// Global error handler (MUST be last middleware)
app.use(
  (err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', err);

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
);
```

---

## 10. Testing Strategy

### Test Structure

Routes should be tested to ensure:

1. Correct paths are registered
2. Middleware is applied in correct order
3. Controllers are called with correct parameters

#### Route Configuration Test

```typescript
import { Router } from 'express';
import { createNetworkDeviceRoutes } from './network-device.routes';
import { NetworkDeviceController } from '../controllers/NetworkDeviceController';

// Mock controller
const mockController = {
  create: jest.fn(),
  list: jest.fn(),
  getById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
} as unknown as NetworkDeviceController;

describe('Network Device Routes', () => {
  let router: Router;

  beforeEach(() => {
    router = createNetworkDeviceRoutes(mockController);
  });

  it('should create Express router', () => {
    expect(router).toBeDefined();
    expect(typeof router).toBe('function'); // Express router is a function
  });

  it('should register POST / route', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods)
      }));

    expect(routes).toContainEqual({
      path: '/',
      methods: ['post']
    });
  });

  it('should register GET / route', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods)
      }));

    expect(routes).toContainEqual({
      path: '/',
      methods: ['get']
    });
  });

  it('should register GET /:id route', () => {
    const routes = router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods)
      }));

    expect(routes).toContainEqual({
      path: '/:id',
      methods: ['get']
    });
  });

  it('should have validation middleware for POST /', () => {
    const postRoute = router.stack.find(
      (layer: any) =>
        layer.route &&
        layer.route.path === '/' &&
        layer.route.methods.post
    );

    // Should have at least 2 handlers: validation + controller
    expect(postRoute.route.stack.length).toBeGreaterThanOrEqual(2);
  });
});
```

#### Integration Test (End-to-End)

```typescript
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../../../test/helpers/createTestApp';

describe('Network Device Routes Integration', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  it('should handle POST /api/network-devices', async () => {
    const response = await request(app)
      .post('/api/network-devices')
      .send({
        ipAddress: '192.168.1.100',
        name: 'Test Device',
        deviceType: 'ROUTER',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        deviceId: '123e4567-e89b-12d3-a456-426614174000'
      })
      .expect(201);

    expect(response.body.success).toBe(true);
  });

  it('should validate request on POST /api/network-devices', async () => {
    const response = await request(app)
      .post('/api/network-devices')
      .send({
        ipAddress: 'invalid-ip' // Invalid IP
      })
      .expect(400);

    expect(response.body.success).toBe(false);
  });

  it('should handle GET /api/network-devices', async () => {
    await request(app).get('/api/network-devices').expect(200);
  });

  it('should handle custom route GET /api/network-devices/by-ip', async () => {
    await request(app)
      .get('/api/network-devices/by-ip?ip=192.168.1.1')
      .expect(200);
  });
});
```

---

### Coverage Requirements

- [ ] All routes registered correctly
- [ ] Middleware applied in correct order
- [ ] Custom routes come before `:id` routes
- [ ] Integration tests for all endpoints
- [ ] Validation middleware tests

---

## 11. Examples

### Example 1: Basic CRUD Routes

```typescript
import { Router } from 'express';
import { NetworkDeviceController } from '../controllers/NetworkDeviceController';
import { validateRequest } from '../middleware/validateRequest';
import {
  createNetworkDeviceSchema,
  updateNetworkDeviceSchema,
  listNetworkDevicesSchema,
  getByIdSchema,
  deleteNetworkDeviceSchema
} from '../validation/network-device.schemas';

/**
 * Creates Express router for NetworkDevice endpoints.
 *
 * @param controller - NetworkDeviceController instance
 * @returns Express router with all CRUD routes
 */
export function createNetworkDeviceRoutes(
  controller: NetworkDeviceController
): Router {
  const router = Router();

  /**
   * POST /api/network-devices
   * Create a new network device
   */
  router.post(
    '/',
    validateRequest(createNetworkDeviceSchema),
    controller.create
  );

  /**
   * GET /api/network-devices
   * List network devices with pagination and filters
   */
  router.get(
    '/',
    validateRequest(listNetworkDevicesSchema),
    controller.list
  );

  /**
   * GET /api/network-devices/:id
   * Get a network device by ID
   */
  router.get(
    '/:id',
    validateRequest(getByIdSchema),
    controller.getById
  );

  /**
   * PUT /api/network-devices/:id
   * Update a network device
   */
  router.put(
    '/:id',
    validateRequest(updateNetworkDeviceSchema),
    controller.update
  );

  /**
   * DELETE /api/network-devices/:id
   * Delete a network device
   */
  router.delete(
    '/:id',
    validateRequest(deleteNetworkDeviceSchema),
    controller.delete
  );

  return router;
}
```

---

### Example 2: Routes with Authentication

```typescript
import { Router } from 'express';
import { NetworkDeviceController } from '../controllers/NetworkDeviceController';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import {
  createNetworkDeviceSchema,
  updateNetworkDeviceSchema
} from '../validation/network-device.schemas';

/**
 * Creates Express router for NetworkDevice endpoints with auth.
 */
export function createNetworkDeviceRoutes(
  controller: NetworkDeviceController
): Router {
  const router = Router();

  /**
   * POST /api/network-devices
   * Create a new network device
   *
   * Requires authentication and 'device:write' permission
   */
  router.post(
    '/',
    authenticate, // Check JWT token
    authorize(['device:write']), // Check permissions
    validateRequest(createNetworkDeviceSchema),
    controller.create
  );

  /**
   * GET /api/network-devices
   * List network devices
   *
   * Public endpoint (no auth)
   */
  router.get('/', controller.list);

  /**
   * GET /api/network-devices/:id
   * Get network device by ID
   *
   * Public endpoint (no auth)
   */
  router.get('/:id', controller.getById);

  /**
   * PUT /api/network-devices/:id
   * Update network device
   *
   * Requires authentication and 'device:write' permission
   */
  router.put(
    '/:id',
    authenticate,
    authorize(['device:write']),
    validateRequest(updateNetworkDeviceSchema),
    controller.update
  );

  /**
   * DELETE /api/network-devices/:id
   * Delete network device
   *
   * Requires authentication and 'device:delete' permission
   */
  router.delete(
    '/:id',
    authenticate,
    authorize(['device:delete']),
    controller.delete
  );

  return router;
}
```

---

### Example 3: Routes with Custom Endpoints

```typescript
import { Router } from 'express';
import { NetworkDeviceController } from '../controllers/NetworkDeviceController';
import { validateRequest } from '../middleware/validateRequest';
import {
  createNetworkDeviceSchema,
  getByIpSchema,
  activateDeviceSchema
} from '../validation/network-device.schemas';

/**
 * Creates Express router for NetworkDevice endpoints.
 * Includes custom query and action endpoints.
 */
export function createNetworkDeviceRoutes(
  controller: NetworkDeviceController
): Router {
  const router = Router();

  // =====================================
  // STANDARD CRUD ENDPOINTS
  // =====================================

  router.post(
    '/',
    validateRequest(createNetworkDeviceSchema),
    controller.create
  );

  router.get('/', controller.list);

  // =====================================
  // CUSTOM QUERY ENDPOINTS (before :id)
  // =====================================

  /**
   * GET /api/network-devices/by-ip?ip=192.168.1.1
   * Get network device by IP address
   *
   * MUST come before /:id route
   */
  router.get(
    '/by-ip',
    validateRequest(getByIpSchema),
    controller.getByIp
  );

  /**
   * GET /api/network-devices/offline
   * Get all offline devices
   */
  router.get('/offline', controller.getOfflineDevices);

  /**
   * GET /api/network-devices/stats
   * Get device statistics
   */
  router.get('/stats', controller.getStats);

  // =====================================
  // STANDARD CRUD WITH :id
  // =====================================

  router.get('/:id', controller.getById);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.delete);

  // =====================================
  // CUSTOM ACTION ENDPOINTS (after :id)
  // =====================================

  /**
   * POST /api/network-devices/:id/activate
   * Activate a device
   */
  router.post(
    '/:id/activate',
    validateRequest(activateDeviceSchema),
    controller.activate
  );

  /**
   * POST /api/network-devices/:id/deactivate
   * Deactivate a device
   */
  router.post('/:id/deactivate', controller.deactivate);

  /**
   * POST /api/network-devices/:id/test-connection
   * Test device connectivity
   */
  router.post('/:id/test-connection', controller.testConnection);

  /**
   * GET /api/network-devices/:id/polling-history
   * Get device polling history
   */
  router.get('/:id/polling-history', controller.getPollingHistory);

  return router;
}
```

---

## 12. Summary Checklist

### Structure

- [ ] Route file named `[resource-name].routes.ts` (kebab-case)
- [ ] Factory function named `create[Resource]Routes`
- [ ] Function accepts controller as parameter
- [ ] Function returns Express Router
- [ ] All routes documented with JSDoc comments

### Responsibilities

- [ ] Routes define HTTP method, path, middleware, and controller binding
- [ ] No logic in route definitions (pure configuration)
- [ ] Middleware composed in correct order (auth → validation → controller)
- [ ] RESTful conventions followed

### Boundaries

- [ ] No business logic in routes
- [ ] No validation logic in routes (use middleware)
- [ ] No error handling in routes (controllers handle)
- [ ] No dependency instantiation in routes

### Route Organization

- [ ] Standard CRUD routes defined (POST /, GET /, GET /:id, PUT /:id, DELETE /:id)
- [ ] Custom query routes placed BEFORE `:id` routes
- [ ] Custom action routes placed AFTER `:id` routes
- [ ] Routes grouped logically with comments

### Middleware

- [ ] Authentication middleware applied where needed
- [ ] Validation middleware applied to all routes
- [ ] Middleware order is correct (auth → validation → controller)

### Testing

- [ ] Integration tests for all endpoints
- [ ] Route configuration tests
- [ ] Middleware application tests

### Code Quality

- [ ] All routes documented with JSDoc
- [ ] Consistent formatting
- [ ] No duplicate route definitions

---

**Remember**: Routes are pure configuration—they wire endpoints to controllers and middleware but contain NO logic. If you find yourself writing logic in routes, STOP and move it to middleware or controllers.
