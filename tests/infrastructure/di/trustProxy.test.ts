import express from 'express';
import request from 'supertest';
import { loadTrustProxy } from '../../../src/infrastructure/di/trustProxy';
import { createRateLimiter } from '../../../src/presentation/http/middleware';

describe('loadTrustProxy', () => {
  it.each([
    [undefined, false],
    ['', false],
    ['false', false],
    ['1', 1],
    ['loopback', 'loopback'],
    ['10.0.0.0/8, 127.0.0.1', '10.0.0.0/8, 127.0.0.1']
  ])('[INS-040] %p → %p', (value, expected) => {
    expect(loadTrustProxy({ TRUST_PROXY: value })).toEqual(expected);
  });

  it('[INS-040] refuses to trust every caller', () => {
    expect(() => loadTrustProxy({ TRUST_PROXY: 'true' })).toThrow(
      'TRUST_PROXY=true'
    );
  });

  describe('behind a proxy on this machine', () => {
    const appTrusting = (setting: boolean | number | string) => {
      const app = express();
      app.set('trust proxy', setting);
      app.post(
        '/enroll',
        createRateLimiter('enroll'),
        (_req, res) => {
          res.status(201).end();
        }
      );
      return app;
    };

    const enrollFrom = (app: express.Application, client: string) =>
      request(app).post('/enroll').set('X-Forwarded-For', client);

    it('[INS-040] limits each real caller separately once the proxy is trusted', async () => {
      const app = appTrusting(
        loadTrustProxy({ TRUST_PROXY: 'loopback' })
      );
      for (let i = 0; i < 10; i++)
        await enrollFrom(app, '203.0.113.7');

      expect((await enrollFrom(app, '203.0.113.7')).status).toBe(429);
      expect((await enrollFrom(app, '198.51.100.20')).status).toBe(
        201
      );
    });

    it('[INS-040] without it, every caller behind the proxy shares one limit', async () => {
      const app = appTrusting(loadTrustProxy({}));
      for (let i = 0; i < 10; i++)
        await enrollFrom(app, '203.0.113.7');

      expect((await enrollFrom(app, '198.51.100.20')).status).toBe(
        429
      );
    });
  });
});
