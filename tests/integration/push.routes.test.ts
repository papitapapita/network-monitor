// Source: src/presentation/http/routes/push.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import { cleanDatabase } from './helpers/db';
import { FakePushSender } from './helpers/FakePushSender';
import { PUSH_KEYS } from './helpers/pushSubscriptions';
import { DependencyContainer } from '../../src/infrastructure/di/container';
import { PushController } from '../../src/presentation/http/controllers/PushController';
import { PrismaPushSubscriptionRepository } from '../../src/infrastructure/persistence/PrismaPushSubscriptionRepository';
import {
  SubscribePushUseCase,
  UnsubscribePushUseCase,
  SendTestPushUseCase
} from '../../src/application/notifications/use-cases';

const PUBLIC_KEY = 'BTestPublicKey';
const ENDPOINT = 'https://push.example.com/phone-1';

describe('Push Routes — /api/push', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let sender: FakePushSender;
  let viewerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    sender = new FakePushSender();
    ({ app, container } = await createTestApp((c) => {
      const repository = new PrismaPushSubscriptionRepository(
        c.getPrisma()
      );
      const logger = c.getLogger();
      c.pushController = new PushController(
        PUBLIC_KEY,
        new SubscribePushUseCase(repository, logger),
        new UnsubscribePushUseCase(repository, logger),
        new SendTestPushUseCase(repository, sender, logger),
        logger
      );
    }));
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    sender.sent.length = 0;
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
  });

  const subscribe = (token: string, body: object) =>
    request(app)
      .post('/api/push/subscriptions')
      .set('Authorization', `Bearer ${token}`)
      .set('User-Agent', 'Mozilla/5.0 (Linux; Android 14)')
      .send(body);

  describe('GET /api/push/public-key', () => {
    it('[NOT-228] 200 — returns the server’s public key', async () => {
      const res = await request(app)
        .get('/api/push/public-key')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: { enabled: true, publicKey: PUBLIC_KEY }
      });
    });

    it('401 — rejects a request with no token', async () => {
      const res = await request(app).get('/api/push/public-key');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/push/subscriptions', () => {
    it('[NOT-225] 200 — a VIEWER subscribes their own phone', async () => {
      const res = await subscribe(viewerToken, {
        endpoint: ENDPOINT,
        keys: PUSH_KEYS,
        expirationTime: null
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        endpoint: ENDPOINT,
        userAgent: 'Mozilla/5.0 (Linux; Android 14)'
      });
      const viewer = await prisma.user.findUniqueOrThrow({
        where: { email: 'viewer-test@example.local' }
      });
      const row = await prisma.pushSubscription.findUniqueOrThrow({
        where: { endpoint: ENDPOINT }
      });
      expect(row.userId).toBe(viewer.id);
    });

    it('400 — rejects a body without keys', async () => {
      const res = await subscribe(viewerToken, {
        endpoint: ENDPOINT
      });
      expect(res.status).toBe(400);
    });

    it('[NOT-220] 400 — rejects an endpoint that is not https', async () => {
      const res = await subscribe(viewerToken, {
        endpoint: 'http://push.example.com/phone-1',
        keys: PUSH_KEYS
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('endpoint must be an https URL');
    });

    it('401 — rejects a request with no token', async () => {
      const res = await request(app)
        .post('/api/push/subscriptions')
        .send({ endpoint: ENDPOINT, keys: PUSH_KEYS });
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/push/subscriptions', () => {
    it('[NOT-225] 200 — removes the caller’s phone', async () => {
      await subscribe(viewerToken, {
        endpoint: ENDPOINT,
        keys: PUSH_KEYS
      });

      const res = await request(app)
        .delete('/api/push/subscriptions')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ endpoint: ENDPOINT });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: null });
      expect(await prisma.pushSubscription.count()).toBe(0);
    });

    it('[NOT-225] 200 — leaves another user’s phone subscribed', async () => {
      await subscribe(viewerToken, {
        endpoint: ENDPOINT,
        keys: PUSH_KEYS
      });

      const res = await request(app)
        .delete('/api/push/subscriptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ endpoint: ENDPOINT });

      expect(res.status).toBe(200);
      expect(await prisma.pushSubscription.count()).toBe(1);
    });

    it('400 — requires an endpoint', async () => {
      const res = await request(app)
        .delete('/api/push/subscriptions')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/push/test', () => {
    it('[NOT-226] 200 — sends to the caller’s phones', async () => {
      await subscribe(viewerToken, {
        endpoint: ENDPOINT,
        keys: PUSH_KEYS
      });

      const res = await request(app)
        .post('/api/push/test')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ delivered: 1 });
      expect(sender.sent[0].payload.tag).toBe('test');
    });

    it('[NOT-226] 409 — when the caller has no phone subscribed', async () => {
      const res = await request(app)
        .post('/api/push/test')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(409);
    });

    it('[NOT-226] 502 — when no phone received it', async () => {
      await subscribe(viewerToken, {
        endpoint: ENDPOINT,
        keys: PUSH_KEYS
      });
      sender.failing.add(ENDPOINT);

      const res = await request(app)
        .post('/api/push/test')
        .set('Authorization', `Bearer ${viewerToken}`);

      sender.failing.clear();
      expect(res.status).toBe(502);
    });
  });
});

describe('Push Routes — VAPID keys unset', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let token: string;
  const saved = {
    pub: process.env.VAPID_PUBLIC_KEY,
    priv: process.env.VAPID_PRIVATE_KEY
  };

  beforeAll(async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
    await cleanDatabase(prisma);
    token = await seedAndGetToken(app, prisma, 'VIEWER');
  });

  afterAll(async () => {
    if (saved.pub !== undefined)
      process.env.VAPID_PUBLIC_KEY = saved.pub;
    if (saved.priv !== undefined)
      process.env.VAPID_PRIVATE_KEY = saved.priv;
    await cleanDatabase(prisma);
    await container.disconnect();
  });

  it('[NOT-228] GET /public-key reports phone notifications off', async () => {
    const res = await request(app)
      .get('/api/push/public-key')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data).toEqual({
      enabled: false,
      publicKey: null
    });
  });

  it('[NOT-228] POST /subscriptions answers 503', async () => {
    const res = await request(app)
      .post('/api/push/subscriptions')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: ENDPOINT, keys: PUSH_KEYS });

    expect(res.status).toBe(503);
  });
});
