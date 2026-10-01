// Source: src/presentation/http/routes/vendor-settings.routes.ts and the
// subscription guard's exemption for it.

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import { cleanDatabase } from './helpers/db';
import { DependencyContainer } from '../../src/infrastructure/di/container';

const SETTINGS = {
  vendorTelegramChatId: '8468052749',
  subscriptionPaidUntil: '2099-12-31',
  subscriptionGraceDays: 3,
  subscriptionReadOnlyDays: 7,
  pingResultRetentionDays: 15,
  alertRetentionDays: 60,
  wirelessSnapshotRetentionDays: 10,
  wirelessAlertRecordRetentionDays: 45,
  issuer: {
    name: 'Otro ISP',
    documentLabel: 'NIT',
    document: '900123456-7',
    address: 'Calle 1 # 2-3',
    city: 'Granada',
    contactPhone: '300 000 0000',
    contactEmail: 'cobros@otro.example',
    accentColorHex: '#336699'
  },
  whatsApp: {
    phoneNumberId: '123456789',
    templateName: 'suspension_notice',
    templateLanguage: 'es',
    apiVersion: 'v21.0'
  },
  enforcementRouter: null
};

describe('Vendor Settings Routes — /api/installation/settings', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let vendorToken: string;
  let adminToken: string;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    vendorToken = await seedAndGetToken(app, prisma, 'VENDOR');
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
  });

  describe('GET', () => {
    it('[INS-029] 200 — the env defaults before anything is saved', async () => {
      const res = await request(app)
        .get('/api/installation/settings')
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        vendorTelegramChatId: null,
        subscriptionPaidUntil: null,
        subscriptionGraceDays: 3,
        subscriptionReadOnlyDays: 7,
        pingResultRetentionDays: 30,
        alertRetentionDays: 90,
        wirelessSnapshotRetentionDays: 30,
        wirelessAlertRecordRetentionDays: 90,
        // tests/integration/setup.ts sets ISSUER_* for the billing suites
        issuer: expect.objectContaining({ documentLabel: 'NIT' }),
        whatsApp: null,
        enforcementRouter: null
      });
    });

    it('[INS-030] 403 — the customer cannot read them', async () => {
      const res = await request(app)
        .get('/api/installation/settings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app).get(
        '/api/installation/settings'
      );
      expect(res.status).toBe(401);
    });
  });

  describe('PUT', () => {
    it('[INS-028] 200 — saves, and a GET reads them back', async () => {
      const put = await request(app)
        .put('/api/installation/settings')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send(SETTINGS);
      const get = await request(app)
        .get('/api/installation/settings')
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(put.status).toBe(200);
      expect(put.body).toEqual({ success: true, data: SETTINGS });
      expect(get.body.data).toEqual(SETTINGS);
    });

    it('[INS-028] 200 — the subscription status follows the saved terms at once', async () => {
      await request(app)
        .put('/api/installation/settings')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send(SETTINGS);

      const res = await request(app)
        .get('/api/subscription')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.body.data.state).toBe('ACTIVE');
      expect(res.body.data.paidThrough).toBe(
        '2100-01-01T05:00:00.000Z'
      );
    });

    it.each([
      ['subscriptionPaidUntil', '31/12/2099'],
      ['vendorTelegramChatId', 'jonathan'],
      ['alertRetentionDays', 0],
      ['subscriptionGraceDays', 120],
      ['issuer', { ...SETTINGS.issuer, contactEmail: 'cobros' }],
      ['whatsApp', { ...SETTINGS.whatsApp, apiVersion: '21' }],
      ['enforcementRouter', { deviceId: 'router-1', apiPort: 8728 }]
    ])(
      '[INS-028] 400 — refuses %s=%s and saves nothing',
      async (field, value) => {
        const res = await request(app)
          .put('/api/installation/settings')
          .set('Authorization', `Bearer ${vendorToken}`)
          .send({ ...SETTINGS, [field]: value });

        expect(res.status).toBe(400);
        expect(await prisma.vendorSettings.count()).toBe(0);
      }
    );

    it('400 — refuses an unknown field inside a group', async () => {
      const res = await request(app)
        .put('/api/installation/settings')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          ...SETTINGS,
          whatsApp: { ...SETTINGS.whatsApp, accessToken: 'secret' }
        });

      expect(res.status).toBe(400);
    });

    it('400 — refuses a body missing a setting', async () => {
      const { alertRetentionDays: _omit, ...partial } = SETTINGS;

      const res = await request(app)
        .put('/api/installation/settings')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send(partial);

      expect(res.status).toBe(400);
    });

    it('[INS-030] 403 — the customer cannot change them', async () => {
      const res = await request(app)
        .put('/api/installation/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(SETTINGS);

      expect(res.status).toBe(403);
    });
  });

  describe('[INS-030] on a locked install', () => {
    it('the vendor reads and saves the settings, which unlocks it', async () => {
      await request(app)
        .put('/api/installation/settings')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ ...SETTINGS, subscriptionPaidUntil: '2020-01-31' });

      const locked = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`);
      const read = await request(app)
        .get('/api/installation/settings')
        .set('Authorization', `Bearer ${vendorToken}`);
      const pay = await request(app)
        .put('/api/installation/settings')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send(SETTINGS);
      const unlocked = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(locked.status).toBe(402);
      expect(read.status).toBe(200);
      expect(pay.status).toBe(200);
      expect(unlocked.status).toBe(200);
    });

    it('the customer still cannot use the route', async () => {
      await request(app)
        .put('/api/installation/settings')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ ...SETTINGS, subscriptionPaidUntil: '2020-01-31' });

      const res = await request(app)
        .put('/api/installation/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(SETTINGS);

      expect(res.status).toBe(403);
    });
  });
});
