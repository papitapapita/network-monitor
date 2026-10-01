// Source: src/presentation/http/routes/notification-settings.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import { cleanDatabase } from './helpers/db';
import { DependencyContainer } from '../../src/infrastructure/di/container';

// .env.test supplies the defaults: TELEGRAM_CHAT_ID=-1000000000001,
// DEVICE_DOWN_ALERT_DELAY_MINUTES=60, wireless alerts on.
const ENV_DEFAULTS = {
  telegramChatId: '-1000000000001',
  downAlertDelayMinutes: 60,
  wirelessAlertsEnabled: true
};

const SAVED = {
  telegramChatId: '-1009998887776',
  downAlertDelayMinutes: 15,
  wirelessAlertsEnabled: false
};

describe('Notification Settings Routes — /api/notification-settings', () => {
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
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    // Minted after the clean: a token outlives nothing its account doesn't.
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
    operatorToken = await seedAndGetToken(app, prisma, 'OPERATOR');
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
  });

  describe('GET /api/notification-settings', () => {
    it('[NOT-201] 200 — answers the env defaults before anything is saved', async () => {
      const res = await request(app)
        .get('/api/notification-settings')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: ENV_DEFAULTS });
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app).get(
        '/api/notification-settings'
      );
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/notification-settings', () => {
    it('[NOT-200] 200 — saves the settings, and a GET reads them back', async () => {
      const put = await request(app)
        .put('/api/notification-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(SAVED);
      const get = await request(app)
        .get('/api/notification-settings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(put.status).toBe(200);
      expect(put.body).toEqual({ success: true, data: SAVED });
      expect(get.body.data).toEqual(SAVED);
    });

    it('[NOT-200] 200 — accepts null to leave the install without a chat', async () => {
      const res = await request(app)
        .put('/api/notification-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...SAVED, telegramChatId: null });

      expect(res.status).toBe(200);
      expect(res.body.data.telegramChatId).toBeNull();
    });

    it('[NOT-200] 400 — refuses a chat id Telegram would not accept', async () => {
      const res = await request(app)
        .put('/api/notification-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...SAVED, telegramChatId: 'my-group' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        'telegramChatId must be a numeric chat id or a @channel name'
      );
      expect(await prisma.notificationSettings.count()).toBe(0);
    });

    it('[NOT-200] 400 — refuses a delay out of range', async () => {
      const res = await request(app)
        .put('/api/notification-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...SAVED, downAlertDelayMinutes: 2000 });

      expect(res.status).toBe(400);
    });

    it('400 — refuses a body missing a setting', async () => {
      const res = await request(app)
        .put('/api/notification-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ telegramChatId: '-100' });

      expect(res.status).toBe(400);
    });

    it('400 — refuses an unknown field', async () => {
      const res = await request(app)
        .put('/api/notification-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...SAVED, botToken: 'x' });

      expect(res.status).toBe(400);
    });

    it('[IDN-034] 403 — an OPERATOR cannot change them', async () => {
      const res = await request(app)
        .put('/api/notification-settings')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(SAVED);

      expect(res.status).toBe(403);
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app)
        .put('/api/notification-settings')
        .send(SAVED);
      expect(res.status).toBe(401);
    });
  });

  // The delivered path needs Telegram; it is covered with a fake sender in
  // SendTestNotificationUseCase.integration.test.ts.
  describe('POST /api/notification-settings/test', () => {
    it('[NOT-202] 409 — no chat saved and none given', async () => {
      await request(app)
        .put('/api/notification-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...SAVED, telegramChatId: null });

      const res = await request(app)
        .post('/api/notification-settings/test')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        success: false,
        error: 'No Telegram chat is configured for this install'
      });
    });

    it('[NOT-202] 400 — refuses a chat id that could not be saved', async () => {
      const res = await request(app)
        .post('/api/notification-settings/test')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ telegramChatId: 'my-group' });

      expect(res.status).toBe(400);
    });

    it('[IDN-034] 403 — an OPERATOR cannot send one', async () => {
      const res = await request(app)
        .post('/api/notification-settings/test')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app)
        .post('/api/notification-settings/test')
        .send({});
      expect(res.status).toBe(401);
    });
  });
});
