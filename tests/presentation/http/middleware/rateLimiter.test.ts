// Source: src/presentation/http/middleware/rateLimiter.ts

import express, {
  Express,
  Request,
  Response,
  NextFunction
} from 'express';
import request from 'supertest';
import { createRateLimiter } from '../../../../src/presentation/http/middleware/rateLimiter';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const makeApp = (userId?: string): Express => {
  const app = express();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (userId) {
      req.user = {
        userId,
        email: 'operator@isp.test',
        role: 'ADMIN'
      };
    }
    next();
  });
  app.delete(
    '/things/:id',
    createRateLimiter('delete'),
    (_req, res) => {
      res.status(204).send();
    }
  );
  return app;
};

const deleteTimes = async (
  app: Express,
  count: number,
  token?: string
): Promise<number[]> => {
  const statuses: number[] = [];
  for (let i = 0; i < count; i++) {
    const req = request(app).delete(`/things/${i}`);
    if (token) req.set('Authorization', `Bearer ${token}`);
    const res = await req;
    statuses.push(res.status);
  }
  return statuses;
};

// ---------------------------------------------------------------------------

describe('createRateLimiter', () => {
  describe('[DEV-146] delete limiter', () => {
    it('allows more than ten deletions in the same window', async () => {
      const statuses = await deleteTimes(makeApp('user-1'), 25);

      expect(statuses.every((status) => status === 204)).toBe(true);
    });

    it('rejects once the window budget is spent', async () => {
      const statuses = await deleteTimes(makeApp('user-1'), 61);

      expect(statuses[59]).toBe(204);
      expect(statuses[60]).toBe(429);
    });

    it('counts each authenticated user separately', async () => {
      const app = express();
      let currentUserId = 'user-1';
      app.use((req: Request, _res: Response, next: NextFunction) => {
        req.user = {
          userId: currentUserId,
          email: 'operator@isp.test',
          role: 'ADMIN'
        };
        next();
      });
      app.delete(
        '/things/:id',
        createRateLimiter('delete'),
        (_req, res) => {
          res.status(204).send();
        }
      );

      await deleteTimes(app, 60);
      currentUserId = 'user-2';
      const [status] = await deleteTimes(app, 1);

      expect(status).toBe(204);
    });
  });
});
