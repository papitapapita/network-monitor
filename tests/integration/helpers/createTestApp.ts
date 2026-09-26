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
 * `configure` runs after the container is built and before routes are
 * mounted — the place to swap a controller onto a Fake* outbound port for a
 * route whose real adapter would touch the network.
 *
 * Call `container.disconnect()` in afterAll to release the DB connection.
 */
export async function createTestApp(
  configure?: (container: DependencyContainer) => void
): Promise<TestApp> {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const container = await setupDependencies();
  configure?.(container);
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
