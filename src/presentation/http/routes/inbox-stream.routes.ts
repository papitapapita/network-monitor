import { Router } from 'express';
import { SessionValidator } from 'application/identity/services/SessionValidator';
import { ITokenService } from 'application/identity/interfaces/ITokenService';
import { ILogger } from 'application/shared/interfaces';
import { InboxStreamController } from '../controllers';
import {
  validateRequest,
  authorize,
  createAuditLogMiddleware,
  createStreamAuthenticateMiddleware
} from '../middleware';
import { streamInboxSchema } from '../validation';

/**
 * Server-Sent Events route for the signed-in user's inbox. Mounted under /api
 * by the router index, ahead of the global Bearer-only authenticate
 * middleware, like wireless-stream.routes.ts and for the same reason:
 * EventSource cannot send headers.
 *
 * Routes:
 * - GET /api/notifications/stream - Live unread count, then each change
 *
 * No rate limiter: the controller's connection caps bound it instead.
 */
export function createInboxStreamRoutes(
  controller: InboxStreamController,
  tokenService: ITokenService,
  sessions: SessionValidator,
  logger: ILogger
): Router {
  const router = Router({ mergeParams: true });

  router.get(
    '/notifications/stream',
    createAuditLogMiddleware(logger),
    createStreamAuthenticateMiddleware(tokenService, sessions),
    authorize('read'),
    validateRequest(streamInboxSchema),
    controller.stream
  );

  return router;
}
