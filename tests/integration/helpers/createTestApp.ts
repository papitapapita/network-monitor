import express, {
  Application,
  Request,
  Response,
  NextFunction
} from 'express';
import { setupRoutes } from '../../../src/presentation/http/routes';
import {
  setupDependencies,
  DependencyContainer
} from '../../../src/infrastructure/di/container';

export interface TestApp {
  app: Application;
  container: DependencyContainer;
}

/**
 * Creates a fully-wired Express app backed by the real DI container and
 * database, without starting an HTTP server or the polling orchestrator.
 *
 * Call `container.disconnect()` in afterAll to release the DB connection.
 */
export async function createTestApp(): Promise<TestApp> {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const container = await setupDependencies();
  setupRoutes(app, container);

  // Generic error handler (mirrors main.ts)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use(
    (
      _err: Error,
      _req: Request,
      res: Response,
      _next: NextFunction
    ) => {
      res
        .status(500)
        .json({ success: false, error: 'Internal server error' });
    }
  );

  return { app, container };
}
