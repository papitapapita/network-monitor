import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'http';
import { setupRoutes } from './presentation/http/routes';
import { setupDependencies } from './infrastructure/di/container';
import { WinstonLogger } from './infrastructure/logging/WinstonLogger';
import { loadTrustProxy } from './infrastructure/di/trustProxy';
import { loadAllowedOrigins } from './infrastructure/di/allowedOrigins';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = loadAllowedOrigins(process.env);

const logger = new WinstonLogger();

async function bootstrap(): Promise<Server> {
  const app: Application = express();
  app.set('trust proxy', loadTrustProxy(process.env));

  // Middleware
  app.use(helmet());
  app.use(
    cors({
      origin: ALLOWED_ORIGINS,
      credentials: true
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Setup dependency injection and routes
  const container = await setupDependencies();
  await container.ensureVendorAccount();
  setupRoutes(app, container);

  // Polling and the other background jobs run only while the subscription
  // allows them (ADR 0002, R17); the supervisor starts and stops them.
  await container.subscriptionJobSupervisor.start();
  container.agentLivenessOrchestrator.start();
  container.subscriptionReminderOrchestrator.start();

  // Error handling middleware.
  // Express identifies error handlers by arity: the `next` parameter must be
  // declared or this runs as ordinary middleware and every argument shifts.
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      logger.error('Unhandled error', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  );

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not found'
    });
  });

  // Start server
  const server = app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info(`CORS enabled for: ${ALLOWED_ORIGINS.join(', ')}`);
  });
  container.agentGateway.attach(server);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, closing server...');
    // server.close() waits for open connections, and an SSE stream never
    // closes on its own — end them first or shutdown hangs indefinitely.
    container.linkDiagnosisRunner.stopAll();
    container.eventStreamHub.closeAll();
    container.agentGateway.closeAll();
    server.close(async () => {
      await container.subscriptionJobSupervisor.stop();
      container.agentLivenessOrchestrator.stop();
      container.subscriptionReminderOrchestrator.stop();
      await container.disconnect();
      logger.info('Server closed');
      process.exit(0);
    });
  });

  return server;
}

bootstrap().catch((error) => {
  logger.error(
    'Failed to start server',
    error instanceof Error ? error : new Error(String(error))
  );
  process.exit(1);
});
