import rateLimit from 'express-rate-limit';

type RateLimitType = 'read' | 'write' | 'delete' | 'bulk-import';

const LIMITS: Record<RateLimitType, { max: number; windowMs: number }> =
  {
    read: { max: 100, windowMs: 60_000 },
    write: { max: 20, windowMs: 60_000 },
    delete: { max: 10, windowMs: 60_000 },
    'bulk-import': { max: 5, windowMs: 3_600_000 }
  };

export function createRateLimiter(type: RateLimitType) {
  const { max, windowMs } = LIMITS[type];
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests' }
  });
}
