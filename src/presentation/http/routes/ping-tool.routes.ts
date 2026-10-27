import { Router } from 'express';
import { SessionValidator } from 'application/identity/services/SessionValidator';
import { ITokenService } from 'application/identity/interfaces/ITokenService';
import { ILogger } from 'application/shared/interfaces';
import { PingToolController } from '../controllers';
import {
  validateRequest,
  authorize,
  createAuditLogMiddleware,
  createStreamAuthenticateMiddleware
} from '../middleware';
import { streamPingToolSchema } from '../validation';

/**
 * Server-Sent Events route for pinging any address from the app. Mounted
 * under /api ahead of the global Bearer-only authenticate middleware, like
 * network-sweep.routes.ts and for the same reason: EventSource cannot send
 * headers.
 *
 * Routes:
 * - GET /api/network/ping/stream - Ping an address, from the server or an agent
 *
 * No rate limiter — at most 10 runs at once (MON-122) bound it.
 */
export function createPingToolRoutes(
  controller: PingToolController,
  tokenService: ITokenService,
  sessions: SessionValidator,
  logger: ILogger
): Router {
  const router = Router({ mergeParams: true });

  // same permission as a manual poll — both make the server ping
  router.get(
    '/network/ping/stream',
    createAuditLogMiddleware(logger),
    createStreamAuthenticateMiddleware(tokenService, sessions),
    authorize('create'),
    validateRequest(streamPingToolSchema),
    controller.stream
  );

  return router;
}
