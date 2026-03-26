import express, { Application } from 'express';
import cors from 'cors';
import { Server } from 'http';
import { setupRoutes } from './presentation/http/routes';
import { setupDependencies } from './infrastructure/di/container';
import { WinstonLogger } from './infrastructure/logging/WinstonLogger';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN =
  process.env.CORS_ORIGIN || 'http://localhost:3001';

async function bootstrap(): Promise<Server> {
  const app: Application = express();
  const logger = new WinstonLogger();

  // Middleware
  app.use(
    cors({
      origin: CORS_ORIGIN,
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

  // Start polling orchestrator
  container.pollingOrchestrator.start();

  // Error handling middleware
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
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
    logger.info(`CORS enabled for: ${CORS_ORIGIN}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, closing server...');
    server.close(async () => {
      await container.pollingOrchestrator.stop();
      await container.disconnect();
      logger.info('Server closed');
      process.exit(0);
    });
  });

  return server;
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
