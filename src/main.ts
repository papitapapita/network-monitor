import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'http';
import { setupRoutes } from './presentation/http/routes';
import { setupDependencies } from './infrastructure/di/container';
import { WinstonLogger } from './infrastructure/logging/WinstonLogger';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || 'http://localhost:3001'
)
  .split(',')
  .map((o) => o.trim());

const logger = new WinstonLogger();

async function bootstrap(): Promise<Server> {
  const app: Application = express();

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
  setupRoutes(app, container);

  // Start polling orchestrators
  container.pollingOrchestrator.start();
  container.wirelessPollingOrchestrator.start();
  container.dataRetentionOrchestrator.start();
  container.suspensionReconciliationOrchestrator?.start();

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

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, closing server...');
    // server.close() waits for open connections, and an SSE stream never
    // closes on its own — end them first or shutdown hangs indefinitely.
    container.eventStreamHub.closeAll();
    server.close(async () => {
      await container.pollingOrchestrator.stop();
      await container.wirelessPollingOrchestrator.stop();
      container.dataRetentionOrchestrator.stop();
      await container.suspensionReconciliationOrchestrator?.stop();
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
