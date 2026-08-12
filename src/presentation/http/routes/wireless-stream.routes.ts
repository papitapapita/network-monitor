import { Router } from 'express';
import { ITokenService } from 'application/identity/interfaces/ITokenService';
import { ILogger } from 'application/shared/interfaces';
import { WirelessStreamController } from '../controllers';
import {
  validateRequest,
  authorize,
  createAuditLogMiddleware,
  createStreamAuthenticateMiddleware
} from '../middleware';
import {
  streamDeviceThroughputSchema,
  streamFleetThroughputSchema
} from '../validation';

/**
 * Server-Sent Events routes for live wireless throughput.
 * Mounted under /api by the router index, ahead of the global Bearer-only
 * authenticate middleware — these carry their own stream authentication.
 *
 * Routes:
 * - GET /api/devices/:id/wireless/throughput/stream - Live throughput, one device
 * - GET /api/wireless/throughput/stream             - Live throughput, whole fleet
 *
 * No rate limiter: express-rate-limit assumes short-lived requests, and the
 * controller's per-user and fleet-wide connection caps bound these instead.
 *
 * Audit logging and stream authentication are attached per route rather than
 * with router.use — this router mounts at '/', so anything registered as
 * middleware here would run on every /api request and double-log them.
 */
export function createWirelessStreamRoutes(
  controller: WirelessStreamController,
  tokenService: ITokenService,
  logger: ILogger
): Router {
  const router = Router({ mergeParams: true });

  const auditLog = createAuditLogMiddleware(logger);
  const streamAuth = createStreamAuthenticateMiddleware(tokenService);

  router.get(
    '/devices/:id/wireless/throughput/stream',
    auditLog,
    streamAuth,
    authorize('read'),
    validateRequest(streamDeviceThroughputSchema),
    controller.streamDeviceThroughput
  );

  router.get(
    '/wireless/throughput/stream',
    auditLog,
    streamAuth,
    authorize('read'),
    validateRequest(streamFleetThroughputSchema),
    controller.streamFleetThroughput
  );

  return router;
}
