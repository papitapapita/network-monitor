# Security Implementation Guide - REQ-002

## Overview

This guide covers the security infrastructure for the Network Management System according to REQ-002 security requirements (SEC-002.1 through SEC-002.5).

**Security Layers:**
1. **Authentication**: JWT-based identity verification
2. **Authorization**: Role-Based Access Control (RBAC)
3. **Rate Limiting**: Token bucket algorithm per user/IP
4. **Input Validation**: Zod schemas + domain validation
5. **Audit Logging**: Comprehensive CRUD operation logging

## Authentication (SEC-002.4)

### JWT Token Structure

```json
{
  "userId": "user-abc-123",
  "email": "admin@example.com",
  "role": "ADMIN",
  "iat": 1704636000,
  "exp": 1704722400
}
```

**Token Properties:**
- **Expiration**: 24 hours (configurable)
- **Algorithm**: HS256 (HMAC-SHA256)
- **Secret**: Environment variable `JWT_SECRET`

### Authentication Middleware

Create `src/presentation/http/middleware/authenticate.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Please provide a valid JWT token.',
      errorCode: 'AUTH_TOKEN_MISSING'
    });
    return;
  }

  const token = authHeader.substring(7); // Remove "Bearer "

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      email: string;
      role: string;
    };

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Authentication token has expired. Please log in again.',
        errorCode: 'AUTH_TOKEN_EXPIRED'
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid authentication token. Please provide a valid JWT.',
        errorCode: 'AUTH_TOKEN_INVALID'
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Authentication failed.',
        errorCode: 'AUTH_FAILED'
      });
    }
  }
}
```

**Usage:**
```typescript
import { authenticate } from './middleware/authenticate';

router.post('/api/devices', authenticate, controller.create);
router.get('/api/devices', authenticate, controller.list);
```

## Authorization (SEC-002.1)

### Role-Based Access Control (RBAC)

**Roles and Permissions (REQ-002):**

| Role         | Create | Read | Update | Delete | Activate | Restore | Bulk Import | Bulk Delete |
| ------------ | ------ | ---- | ------ | ------ | -------- | ------- | ----------- | ----------- |
| **Admin**    | ✓      | ✓    | ✓      | ✓      | ✓        | ✓       | ✓           | ✓           |
| **Operator** | ✓      | ✓    | ✓      | ✗      | ✓        | ✗       | ✓           | ✗           |
| **Viewer**   | ✗      | ✓    | ✗      | ✗      | ✗        | ✗       | ✗           | ✗           |

### Authorization Middleware

Create `src/presentation/http/middleware/authorize.ts`:

```typescript
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authenticate';

export type Permission =
  | 'device:create'
  | 'device:read'
  | 'device:update'
  | 'device:delete'
  | 'device:activate'
  | 'device:restore'
  | 'device:bulk-import'
  | 'device:bulk-delete';

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  ADMIN: [
    'device:create',
    'device:read',
    'device:update',
    'device:delete',
    'device:activate',
    'device:restore',
    'device:bulk-import',
    'device:bulk-delete'
  ],
  OPERATOR: [
    'device:create',
    'device:read',
    'device:update',
    'device:activate',
    'device:bulk-import'
  ],
  VIEWER: ['device:read']
};

export function authorize(...requiredPermissions: Permission[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        errorCode: 'AUTH_REQUIRED'
      });
      return;
    }

    const userRole = req.user.role;
    const userPermissions = ROLE_PERMISSIONS[userRole] || [];

    const hasPermission = requiredPermissions.every((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        error: `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
        errorCode: 'FORBIDDEN',
        requiredPermissions,
        userRole
      });
      return;
    }

    next();
  };
}
```

**Usage:**
```typescript
import { authenticate } from './middleware/authenticate';
import { authorize } from './middleware/authorize';

// Admin only
router.delete('/api/devices/:id', authenticate, authorize('device:delete'), controller.delete);

// Admin or Operator
router.post('/api/devices', authenticate, authorize('device:create'), controller.create);

// All authenticated users
router.get('/api/devices', authenticate, authorize('device:read'), controller.list);
```

## Rate Limiting (SEC-002.2)

### Token Bucket Algorithm

Create `src/presentation/http/middleware/rateLimit.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authenticate';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();

  constructor(
    private maxTokens: number,
    private refillRate: number, // tokens per second
    private refillInterval: number = 1000 // milliseconds
  ) {
    // Cleanup old buckets every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  checkLimit(key: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: this.maxTokens - 1,
        lastRefill: now
      };
      this.buckets.set(key, bucket);
      return { allowed: true };
    }

    // Refill tokens based on time elapsed
    const timeElapsed = now - bucket.lastRefill;
    const tokensToAdd = (timeElapsed / this.refillInterval) * this.refillRate;
    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true };
    }

    // Calculate retry-after in seconds
    const tokensNeeded = 1 - bucket.tokens;
    const retryAfter = Math.ceil(
      (tokensNeeded / this.refillRate) * (this.refillInterval / 1000)
    );

    return { allowed: false, retryAfter };
  }

  private cleanup(): void {
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes

    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > staleThreshold) {
        this.buckets.delete(key);
      }
    }
  }
}

// REQ-002 SEC-002.2: Rate limit tiers
const readLimiter = new RateLimiter(100, 100 / 60); // 100 requests/minute
const writeLimiter = new RateLimiter(20, 20 / 60); // 20 requests/minute
const deleteLimiter = new RateLimiter(10, 10 / 60); // 10 requests/minute
const bulkImportLimiter = new RateLimiter(5, 5 / 3600); // 5 requests/hour

export function rateLimitRead(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const key = req.user?.userId || req.ip;
  const result = readLimiter.checkLimit(key);

  if (!result.allowed) {
    res.status(429)
      .set('Retry-After', String(result.retryAfter))
      .json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
        errorCode: 'RATE_LIMIT_EXCEEDED',
        retryAfter: result.retryAfter
      });
    return;
  }

  next();
}

export function rateLimitWrite(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const key = req.user?.userId || req.ip;
  const result = writeLimiter.checkLimit(key);

  if (!result.allowed) {
    res.status(429)
      .set('Retry-After', String(result.retryAfter))
      .json({
        success: false,
        error: 'Rate limit exceeded for write operations. Please try again later.',
        errorCode: 'RATE_LIMIT_EXCEEDED',
        retryAfter: result.retryAfter
      });
    return;
  }

  next();
}

export function rateLimitDelete(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const key = req.user?.userId || req.ip;
  const result = deleteLimiter.checkLimit(key);

  if (!result.allowed) {
    res.status(429)
      .set('Retry-After', String(result.retryAfter))
      .json({
        success: false,
        error: 'Rate limit exceeded for delete operations. Please try again later.',
        errorCode: 'RATE_LIMIT_EXCEEDED',
        retryAfter: result.retryAfter
      });
    return;
  }

  next();
}

export function rateLimitBulkImport(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const key = req.user?.userId || req.ip;
  const result = bulkImportLimiter.checkLimit(key);

  if (!result.allowed) {
    res.status(429)
      .set('Retry-After', String(result.retryAfter))
      .json({
        success: false,
        error: 'Rate limit exceeded for bulk imports. Maximum 5 imports per hour.',
        errorCode: 'RATE_LIMIT_EXCEEDED',
        retryAfter: result.retryAfter
      });
    return;
  }

  next();
}
```

**Usage:**
```typescript
import {
  rateLimitRead,
  rateLimitWrite,
  rateLimitDelete,
  rateLimitBulkImport
} from './middleware/rateLimit';

// Apply rate limits to routes
router.get('/api/devices', authenticate, authorize('device:read'), rateLimitRead, controller.list);
router.post('/api/devices', authenticate, authorize('device:create'), rateLimitWrite, controller.create);
router.delete('/api/devices/:id', authenticate, authorize('device:delete'), rateLimitDelete, controller.delete);
router.post('/api/devices/import', authenticate, authorize('device:bulk-import'), rateLimitBulkImport, controller.bulkImport);
```

## Input Validation (SEC-002.3)

### Validation Layers

**Layer 1: Zod Schema Validation (HTTP)**
- Validates request structure
- Type checking
- Format validation (regex, enums)
- Length constraints

**Layer 2: Domain Validation (Business Rules)**
- Value object validation (IPAddress, MACAddress)
- Business invariants
- Uniqueness checks
- Cross-field validation

**Layer 3: Repository Validation (Data Integrity)**
- Database constraints
- Foreign key validation
- Unique constraints

### SQL Injection Prevention

Prisma ORM provides automatic SQL injection prevention via parameterized queries:

```typescript
// SAFE: Prisma parameterizes automatically
await prisma.networkDevice.findUnique({
  where: { ipAddress: req.body.ipAddress }
});

// UNSAFE: Never do this
await prisma.$executeRaw`SELECT * FROM network_devices WHERE ip = ${req.body.ipAddress}`;

// SAFE: Use Prisma.sql template
await prisma.$executeRaw`SELECT * FROM network_devices WHERE ip = ${Prisma.sql`${req.body.ipAddress}`}`;
```

### XSS Prevention

Express handles XSS automatically when:
- Using `res.json()` (automatically escapes)
- Setting `Content-Type: application/json`

**Additional protection:**
```typescript
import helmet from 'helmet';

app.use(helmet()); // Sets security headers

// Content Security Policy
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  })
);
```

### File Upload Validation

```typescript
import multer from 'multer';

const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Only accept CSV files
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

router.post('/api/devices/import', authenticate, upload.single('file'), controller.bulkImport);
```

## Audit Logging (SEC-002.5)

### Audit Log Middleware

Create `src/presentation/http/middleware/auditLog.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authenticate';
import { ILogger } from '../../../application/interfaces/ILogger';

export function auditLog(logger: ILogger) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    // Capture response
    const originalSend = res.send;
    let responseBody: any;

    res.send = function (body: any) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    // Log after response sent
    res.on('finish', () => {
      const duration = Date.now() - startTime;

      const auditEntry = {
        timestamp: new Date().toISOString(),
        userId: req.user?.userId || 'anonymous',
        userRole: req.user?.role || 'unauthenticated',
        action: `${req.method} ${req.path}`,
        ipAddress: req.ip,
        statusCode: res.statusCode,
        duration,
        requestId: req.headers['x-request-id'] || generateRequestId(),
        result: res.statusCode < 400 ? 'SUCCESS' : 'FAILURE',
        errorCode: res.statusCode >= 400 ? responseBody?.errorCode : undefined
      };

      if (auditEntry.result === 'SUCCESS') {
        logger.info('Audit log entry', auditEntry);
      } else {
        logger.warn('Audit log entry (failed)', auditEntry);
      }
    });

    next();
  };
}

function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
```

**Usage:**
```typescript
import { auditLog } from './middleware/auditLog';

app.use(auditLog(logger)); // Apply globally
```

## Complete Route Protection Example

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import {
  rateLimitRead,
  rateLimitWrite,
  rateLimitDelete
} from '../middleware/rateLimit';
import { auditLog } from '../middleware/auditLog';
import { validateRequest } from '../middleware/validateRequest';
import { NetworkDeviceController } from '../controllers/NetworkDeviceController';

const router = Router();
const controller = new NetworkDeviceController(...);

// Middleware stack (order matters!)
// 1. Audit logging (captures all requests)
// 2. Authentication (identify user)
// 3. Authorization (check permissions)
// 4. Rate limiting (prevent abuse)
// 5. Request validation (validate input)
// 6. Controller logic

router.post(
  '/api/devices',
  auditLog(logger),
  authenticate,
  authorize('device:create'),
  rateLimitWrite,
  validateRequest(createNetworkDeviceSchema),
  controller.create
);

router.get(
  '/api/devices',
  auditLog(logger),
  authenticate,
  authorize('device:read'),
  rateLimitRead,
  validateRequest(listNetworkDevicesSchema),
  controller.list
);

router.delete(
  '/api/devices/:id',
  auditLog(logger),
  authenticate,
  authorize('device:delete'),
  rateLimitDelete,
  validateRequest(deleteNetworkDeviceSchema),
  controller.delete
);

export { router };
```

## Security Best Practices

### 1. Environment Variables

**Never commit secrets to git:**

```bash
# .env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
DATABASE_URL=postgresql://user:password@localhost:5432/netmanage
```

```typescript
// .env.example (commit this)
JWT_SECRET=change-this-in-production
DATABASE_URL=postgresql://user:password@localhost:5432/netmanage
```

### 2. HTTPS in Production

```typescript
import https from 'https';
import fs from 'fs';

const options = {
  key: fs.readFileSync('path/to/private-key.pem'),
  cert: fs.readFileSync('path/to/certificate.pem')
};

https.createServer(options, app).listen(443);
```

### 3. CORS Configuration

```typescript
import cors from 'cors';

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);
```

### 4. Security Headers

```typescript
import helmet from 'helmet';

app.use(helmet());
app.use(helmet.noSniff());
app.use(helmet.frameguard({ action: 'deny' }));
app.use(helmet.xssFilter());
```

### 5. Password Hashing (if implementing user management)

```typescript
import bcrypt from 'bcrypt';

// Hash password
const hashedPassword = await bcrypt.hash(plainPassword, 10);

// Verify password
const isValid = await bcrypt.compare(plainPassword, hashedPassword);
```

## Testing Security

### Authentication Tests

```typescript
describe('Authentication Middleware', () => {
  it('should reject requests without token', async () => {
    const response = await request(app).get('/api/devices');
    expect(response.status).toBe(401);
    expect(response.body.errorCode).toBe('AUTH_TOKEN_MISSING');
  });

  it('should reject expired tokens', async () => {
    const expiredToken = generateExpiredToken();
    const response = await request(app)
      .get('/api/devices')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(response.status).toBe(401);
    expect(response.body.errorCode).toBe('AUTH_TOKEN_EXPIRED');
  });

  it('should accept valid tokens', async () => {
    const validToken = generateValidToken();
    const response = await request(app)
      .get('/api/devices')
      .set('Authorization', `Bearer ${validToken}`);
    expect(response.status).not.toBe(401);
  });
});
```

### Authorization Tests

```typescript
describe('Authorization Middleware', () => {
  it('should allow Admin to delete devices', async () => {
    const adminToken = generateToken({ role: 'ADMIN' });
    const response = await request(app)
      .delete('/api/devices/abc-123')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).not.toBe(403);
  });

  it('should deny Operator from deleting devices', async () => {
    const operatorToken = generateToken({ role: 'OPERATOR' });
    const response = await request(app)
      .delete('/api/devices/abc-123')
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(response.status).toBe(403);
    expect(response.body.errorCode).toBe('FORBIDDEN');
  });

  it('should deny Viewer from creating devices', async () => {
    const viewerToken = generateToken({ role: 'VIEWER' });
    const response = await request(app)
      .post('/api/devices')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ ipAddress: '192.168.1.1', macAddress: 'AA:BB:CC:DD:EE:FF' });
    expect(response.status).toBe(403);
  });
});
```

### Rate Limiting Tests

```typescript
describe('Rate Limiting', () => {
  it('should allow requests within limit', async () => {
    const token = generateToken();

    for (let i = 0; i < 20; i++) {
      const response = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${token}`)
        .send({ ipAddress: `192.168.1.${i}`, macAddress: `AA:BB:CC:DD:EE:${i}` });
      expect(response.status).not.toBe(429);
    }
  });

  it('should reject requests exceeding limit', async () => {
    const token = generateToken();

    // Exhaust rate limit
    for (let i = 0; i < 21; i++) {
      await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${token}`)
        .send({ ipAddress: `192.168.1.${i}`, macAddress: `AA:BB:CC:DD:EE:${i}` });
    }

    // Next request should be rate-limited
    const response = await request(app)
      .post('/api/devices')
      .set('Authorization', `Bearer ${token}`)
      .send({ ipAddress: '192.168.1.100', macAddress: 'AA:BB:CC:DD:EE:FF' });

    expect(response.status).toBe(429);
    expect(response.body.errorCode).toBe('RATE_LIMIT_EXCEEDED');
    expect(response.headers['retry-after']).toBeDefined();
  });
});
```

## Monitoring and Alerts

### Security Metrics to Monitor

1. **Authentication Failures**: Alert if >10 per minute
2. **Rate Limit Hits**: Alert if >50 per minute
3. **Authorization Denials**: Alert if unusual spike
4. **Invalid Tokens**: Alert if >100 per hour
5. **SQL Injection Attempts**: Alert immediately

### Log Analysis

```bash
# Find authentication failures
grep 'AUTH_TOKEN' logs/app.log | grep 'FAILURE'

# Count rate limit hits
grep 'RATE_LIMIT_EXCEEDED' logs/app.log | wc -l

# Find suspicious IP addresses
grep '401\|403\|429' logs/app.log | awk '{print $1}' | sort | uniq -c | sort -nr
```

## Incident Response

### Security Incident Checklist

1. **Immediate Actions**:
   - Rotate JWT secret (invalidates all tokens)
   - Block suspicious IP addresses
   - Review recent audit logs
   - Disable affected user accounts

2. **Investigation**:
   - Identify attack vector
   - Determine scope (affected users, data)
   - Collect evidence (logs, database snapshots)

3. **Remediation**:
   - Patch vulnerability
   - Reset affected user credentials
   - Notify affected users
   - Document incident

4. **Post-Incident**:
   - Conduct root cause analysis
   - Update security policies
   - Improve monitoring/alerting
   - Train team on lessons learned

## Related Documentation

- [REQ-002: Network Device CRUD](/docs/requirements/REQ-002-network-device-crud.md)
- [Security Policy](/docs/SECURITY-POLICY.md)
- [API Guidelines](/docs/API-GUIDELINES.md)
- [Audit Logging Requirements](/docs/requirements/REQ-002-network-device-crud.md#audit--logging-requirements)
