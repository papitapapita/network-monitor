import { Router } from 'express';
import { SessionValidator } from 'application/identity/services/SessionValidator';
import { ITokenService } from 'application/identity/interfaces/ITokenService';
import { ILogger } from 'application/shared/interfaces';
import { NetworkSweepController } from '../controllers';
import {
  validateRequest,
  authorize,
  createAuditLogMiddleware,
  createStreamAuthenticateMiddleware
} from '../middleware';
import { streamNetworkSweepSchema } from '../validation';

/**
 * Server-Sent Events route for an on-demand ping of the whole network.
 * Mounted under /api by the router index, ahead of the global Bearer-only
 * authenticate middleware, like wireless-stream.routes.ts and for the same
 * reason: EventSource cannot send headers.
 *
 * Routes:
 * - GET /api/network/sweep/stream - Ping every in-service device once, now
 *
 * A GET although it pings: it changes nothing (MON-080), and EventSource can
 * only GET. No rate limiter — one sweep at a time (MON-083) bounds it.
 */
export function createNetworkSweepRoutes(
  controller: NetworkSweepController,
  tokenService: ITokenService,
  sessions: SessionValidator,
  logger: ILogger
): Router {
  const router = Router({ mergeParams: true });

  // same permission as a manual poll — both make the server ping devices
  router.get(
    '/network/sweep/stream',
    createAuditLogMiddleware(logger),
    createStreamAuthenticateMiddleware(tokenService, sessions),
    authorize('create'),
    validateRequest(streamNetworkSweepSchema),
    controller.stream
  );

  return router;
}
