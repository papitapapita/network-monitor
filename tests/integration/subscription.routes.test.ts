// Source: src/presentation/http/routes/subscription.routes.ts and the
// subscription guard mounted ahead of every /api and /agent/v1 route. The
// terms are read at boot, so each stage boots its own app.

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import { DependencyContainer } from '../../src/infrastructure/di/container';

const DAY_MS = 24 * 60 * 60 * 1000;
const COLOMBIA_OFFSET_MS = -5 * 60 * 60 * 1000;

// A last-paid day `days` before today, in Colombian time.
function lastPaidDayAgo(days: number): string {
  return new Date(Date.now() + COLOMBIA_OFFSET_MS - days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function bootWith(lastPaidDay: string) {
  const ctx = {} as {
    app: Application;
    container: DependencyContainer;
    prisma: PrismaClient;
  };

  beforeAll(async () => {
    process.env.SUBSCRIPTION_PAID_UNTIL = lastPaidDay;
    process.env.SUBSCRIPTION_GRACE_DAYS = '3';
    process.env.SUBSCRIPTION_READ_ONLY_DAYS = '7';
    const built = await createTestApp();
    ctx.app = built.app;
    ctx.container = built.container;
    ctx.prisma = built.container.getPrisma();
  });

  afterAll(async () => {
    delete process.env.SUBSCRIPTION_PAID_UNTIL;
    delete process.env.SUBSCRIPTION_GRACE_DAYS;
    delete process.env.SUBSCRIPTION_READ_ONLY_DAYS;
    await ctx.container.disconnect();
  });

  return ctx;
}

describe('Subscription Routes — /api/subscription', () => {
  describe('read-only (between grace and lock)', () => {
    const ctx = bootWith(lastPaidDayAgo(6));
    let token: string;

    beforeAll(async () => {
      token = await seedAndGetToken(ctx.app, ctx.prisma, 'ADMIN');
    });

    it('401 — the status needs a token', async () => {
      const res = await request(ctx.app).get('/api/subscription');

      expect(res.status).toBe(401);
    });

    it('[INS-024] 200 — reports READ_ONLY', async () => {
      const res = await request(ctx.app)
        .get('/api/subscription')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        state: 'READ_ONLY',
        readOnly: true,
        locked: false
      });
    });

    it('[INS-025] 200 — reads still work', async () => {
      const res = await request(ctx.app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('[INS-025] 402 — every write is refused, even for an admin', async () => {
      const res = await request(ctx.app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Torre', type: 'TOWER' });

      expect(res.status).toBe(402);
      expect(res.body.error).toContain('read-only');
    });

    it('[INS-025] 402 — no agent can be paired', async () => {
      const res = await request(ctx.app)
        .post('/agent/v1/enroll')
        .send({ pairingCode: 'x', hostname: 'pc' });

      expect(res.status).toBe(402);
    });
  });

  describe('locked', () => {
    const ctx = bootWith(lastPaidDayAgo(30));
    let token: string;

    beforeAll(async () => {
      token = await seedAndGetToken(ctx.app, ctx.prisma, 'VIEWER');
    });

    it('[INS-025] signing in still works', () => {
      expect(token).toEqual(expect.any(String));
    });

    it('[INS-024] 200 — any role still reads the status', async () => {
      const res = await request(ctx.app)
        .get('/api/subscription')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        state: 'LOCKED',
        readOnly: true,
        locked: true
      });
    });

    it('[INS-025] 402 — every other route, reads included', async () => {
      const res = await request(ctx.app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(402);
      expect(res.body.error).toContain('locked');
    });
  });
});
