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

  describe('[IDN-103] sign-in limiter', () => {
    const makeSignInApp = (status: () => number): Express => {
      const app = express();
      app.post(
        '/login',
        createRateLimiter('sign-in'),
        (_req, res) => {
          res.status(status()).send();
        }
      );
      return app;
    };

    const postTimes = async (app: Express, count: number) => {
      const statuses: number[] = [];
      for (let i = 0; i < count; i++) {
        statuses.push((await request(app).post('/login')).status);
      }
      return statuses;
    };

    it('refuses an address after ten failed sign-ins', async () => {
      const statuses = await postTimes(
        makeSignInApp(() => 401),
        11
      );

      expect(statuses[9]).toBe(401);
      expect(statuses[10]).toBe(429);
    });

    it('does not spend the budget on successful sign-ins', async () => {
      const statuses = await postTimes(
        makeSignInApp(() => 200),
        30
      );

      expect(statuses.every((s) => s === 200)).toBe(true);
    });
  });

  describe('[IDN-104] per-address limiter', () => {
    const makeAddressApp = (userIds: string[]): Express => {
      let next = 0;
      const app = express();
      app.use((req: Request, _res: Response, done: NextFunction) => {
        req.user = {
          userId: userIds[next++ % userIds.length],
          email: 'operator@isp.test',
          role: 'ADMIN'
        };
        done();
      });
      app.get(
        '/anything',
        createRateLimiter('address'),
        (_req, res) => {
          res.status(200).send();
        }
      );
      return app;
    };

    it('refuses the address after 1000 requests in a minute, whoever signs them', async () => {
      const app = makeAddressApp(['user-a', 'user-b']);
      const statuses: number[] = [];
      for (let i = 0; i < 1001; i++) {
        statuses.push((await request(app).get('/anything')).status);
      }

      expect(statuses[999]).toBe(200);
      expect(statuses[1000]).toBe(429);
    });
  });

  describe('[IDN-105] password reset limiter', () => {
    it('refuses an address after ten requests in an hour, whatever the answer', async () => {
      const app = express();
      app.post(
        '/password/forgot',
        createRateLimiter('password-reset'),
        (_req, res) => {
          res.status(200).send();
        }
      );
      const statuses: number[] = [];
      for (let i = 0; i < 11; i++) {
        statuses.push(
          (await request(app).post('/password/forgot')).status
        );
      }

      expect(statuses[9]).toBe(200);
      expect(statuses[10]).toBe(429);
    });
  });
});
