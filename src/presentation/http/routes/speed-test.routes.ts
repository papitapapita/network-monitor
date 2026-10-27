import { Router } from 'express';
import { SessionValidator } from 'application/identity/services/SessionValidator';
import { ITokenService } from 'application/identity/interfaces/ITokenService';
import { ILogger } from 'application/shared/interfaces';
import { SpeedTestController } from '../controllers';
import {
  validateRequest,
  authorize,
  createAuditLogMiddleware,
  createRateLimiter,
  createStreamAuthenticateMiddleware
} from '../middleware';
import {
  listSpeedTestsSchema,
  streamSpeedTestSchema
} from '../validation';

/**
 * Server-Sent Events route that runs the internet speed test. Mounted under
 * /api ahead of the global Bearer-only authenticate middleware, like
 * network-sweep.routes.ts and for the same reason: EventSource cannot send
 * headers.
 *
 * Routes:
 * - GET /api/network/speed-test/stream - Measure the server's internet now
 *
 * No rate limiter — one test at a time (MON-101) bounds it.
 */
export function createSpeedTestStreamRoutes(
  controller: SpeedTestController,
  tokenService: ITokenService,
  sessions: SessionValidator,
  logger: ILogger
): Router {
  const router = Router({ mergeParams: true });

  router.get(
    '/network/speed-test/stream',
    createAuditLogMiddleware(logger),
    createStreamAuthenticateMiddleware(tokenService, sessions),
    authorize('create'),
    validateRequest(streamSpeedTestSchema),
    controller.stream
  );

  return router;
}

// The kept results, mounted at /api/network/speed-tests behind the global
// authenticate middleware (MON-103).
export function createSpeedTestRoutes(
  controller: SpeedTestController
): Router {
  const router = Router();

  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(listSpeedTestsSchema),
    controller.list
  );

  return router;
}
