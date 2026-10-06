import { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

type RateLimitType =
  | 'read'
  | 'write'
  | 'delete'
  | 'bulk-import'
  | 'enroll'
  | 'sign-in';

const LIMITS: Record<
  RateLimitType,
  { max: number; windowMs: number }
> = {
  read: { max: 100, windowMs: 60_000 },
  write: { max: 60, windowMs: 60_000 },
  delete: { max: 60, windowMs: 60_000 },
  'bulk-import': { max: 5, windowMs: 3_600_000 },
  enroll: { max: 10, windowMs: 900_000 },
  'sign-in': { max: 10, windowMs: 900_000 }
};

// Authenticated callers get their own bucket so several operators behind one
// office NAT do not drain a shared per-IP quota.
function keyGenerator(req: Request): string {
  return req.user?.userId ?? ipKeyGenerator(req.ip ?? '');
}

export function createRateLimiter(type: RateLimitType) {
  const { max, windowMs } = LIMITS[type];
  return rateLimit({
    windowMs,
    limit: max,
    keyGenerator,
    // Only failed sign-ins spend the budget, so an office whose staff all
    // sign in from one address is never held up by its own successes
    // (IDN-103).
    skipSuccessfulRequests: type === 'sign-in',
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests' }
  });
}
