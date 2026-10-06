// Source: src/presentation/http/routes/billing-settings.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import { cleanDatabase } from './helpers/db';
import { DependencyContainer } from '../../src/infrastructure/di/container';

const DEFAULTS = {
  automaticBillingEnabled: false,
  billingMode: 'ADVANCE',
  issueLeadDays: 5,
  graceDays: 3,
  automaticCutEnabled: false
};

const SAVED = {
  automaticBillingEnabled: true,
  billingMode: 'ARREARS',
  issueLeadDays: 7,
  graceDays: 2,
  automaticCutEnabled: true
};

describe('Billing Settings Routes — /api/billing-settings', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let adminToken: string;
  let operatorToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await prisma.billingSettings.deleteMany();
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
    operatorToken = await seedAndGetToken(app, prisma, 'OPERATOR');
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
  });

  describe('GET /api/billing-settings', () => {
    it('[BIL-281] 200 — answers the defaults before anything is saved', async () => {
      const res = await request(app)
        .get('/api/billing-settings')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: DEFAULTS });
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app).get('/api/billing-settings');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/billing-settings', () => {
    it('[BIL-280] 200 — saves the settings, and a GET reads them back', async () => {
      const put = await request(app)
        .put('/api/billing-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(SAVED);
      const get = await request(app)
        .get('/api/billing-settings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(put.status).toBe(200);
      expect(put.body).toEqual({ success: true, data: SAVED });
      expect(get.body.data).toEqual(SAVED);
    });

    it('[BIL-280] 400 — refuses lead days out of range, saving nothing', async () => {
      const res = await request(app)
        .put('/api/billing-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...SAVED, issueLeadDays: 20 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        'issueLeadDays must be a whole number from 1 to 14'
      );
      expect(await prisma.billingSettings.count()).toBe(0);
    });

    it('[BIL-280] 400 — refuses an unknown billing mode', async () => {
      const res = await request(app)
        .put('/api/billing-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...SAVED, billingMode: 'WEEKLY' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        'billingMode must be one of ADVANCE, ARREARS'
      );
    });

    it('400 — refuses a body missing a setting', async () => {
      const res = await request(app)
        .put('/api/billing-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ automaticBillingEnabled: true });

      expect(res.status).toBe(400);
    });

    it('400 — refuses an unknown field', async () => {
      const res = await request(app)
        .put('/api/billing-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...SAVED, cutDay: 4 });

      expect(res.status).toBe(400);
    });

    it('[BIL-285] 403 — an OPERATOR cannot change them', async () => {
      const res = await request(app)
        .put('/api/billing-settings')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(SAVED);

      expect(res.status).toBe(403);
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app)
        .put('/api/billing-settings')
        .send(SAVED);
      expect(res.status).toBe(401);
    });
  });
});
