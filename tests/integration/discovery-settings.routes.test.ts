// Source: src/presentation/http/routes/discovery-settings.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import { cleanDatabase, seedAgent } from './helpers/db';
import { DependencyContainer } from '../../src/infrastructure/di/container';

const URL = '/api/network/discovery-settings';

const SAVED = {
  enabled: true,
  intervalHours: 24,
  segments: [{ cidr: '192.168.1.0/24', agentId: null }]
};

describe('Discovery Settings Routes — /api/network/discovery-settings', () => {
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
    await prisma.discoverySettings.deleteMany();
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
    operatorToken = await seedAndGetToken(app, prisma, 'OPERATOR');
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
  });

  describe(`GET ${URL}`, () => {
    it('[DEV-210] 200 — answers the defaults before anything is saved', async () => {
      const res = await request(app)
        .get(URL)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          enabled: false,
          intervalHours: 24,
          segments: [],
          lastRunAt: null
        }
      });
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app).get(URL);
      expect(res.status).toBe(401);
    });
  });

  describe(`PUT ${URL}`, () => {
    it('[DEV-210] 200 — saves the settings, and a GET reads them back', async () => {
      const agent = await seedAgent(prisma, { status: 'ACTIVE' });
      const body = {
        ...SAVED,
        segments: [
          ...SAVED.segments,
          { cidr: '10.0.0.0/22', agentId: agent.id }
        ]
      };

      const put = await request(app)
        .put(URL)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);
      const get = await request(app)
        .get(URL)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(put.status).toBe(200);
      expect(put.body).toEqual({
        success: true,
        data: { ...body, lastRunAt: null }
      });
      expect(get.body.data).toEqual(put.body.data);
    });

    it('[DEV-210] 400 — refuses a segment wider than /22, saving nothing', async () => {
      const res = await request(app)
        .put(URL)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...SAVED,
          segments: [{ cidr: '10.0.0.0/16', agentId: null }]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        'segment "10.0.0.0/16" must be an IPv4 CIDR from /22 to /30'
      );
      expect(await prisma.discoverySettings.count()).toBe(0);
    });

    it('[DEV-210] 400 — refuses an interval under one hour', async () => {
      const res = await request(app)
        .put(URL)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...SAVED, intervalHours: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        'intervalHours must be a whole number from 1 to 168'
      );
    });

    it('[DEV-212] 400 — refuses a revoked agent', async () => {
      const agent = await seedAgent(prisma, { status: 'REVOKED' });

      const res = await request(app)
        .put(URL)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...SAVED,
          segments: [{ cidr: '10.0.0.0/24', agentId: agent.id }]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        'segment 10.0.0.0/24: agentId must be an agent that is not revoked'
      );
    });

    it('400 — refuses a body missing a setting', async () => {
      const res = await request(app)
        .put(URL)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: true });

      expect(res.status).toBe(400);
    });

    it('400 — refuses an unknown field', async () => {
      const res = await request(app)
        .put(URL)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...SAVED, startHour: 3 });

      expect(res.status).toBe(400);
    });

    it('[DEV-213] 403 — an OPERATOR cannot change them', async () => {
      const res = await request(app)
        .put(URL)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(SAVED);

      expect(res.status).toBe(403);
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app).put(URL).send(SAVED);
      expect(res.status).toBe(401);
    });
  });
});

describe('[DEV-212] Discovery Settings Routes — a server hosted off site', () => {
  let app: Application;
  let container: DependencyContainer;

  beforeAll(async () => {
    process.env.SERVER_ON_SITE = 'false';
    try {
      ({ app, container } = await createTestApp());
    } finally {
      delete process.env.SERVER_ON_SITE;
    }
  });

  afterAll(async () => {
    await container.disconnect();
  });

  it('409 — refuses a segment swept from the server', async () => {
    const prisma = container.getPrisma();
    await cleanDatabase(prisma);
    const adminToken = await seedAndGetToken(app, prisma, 'ADMIN');

    const res = await request(app)
      .put(URL)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(SAVED);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error:
        'segment 192.168.1.0/24 needs an agent — this server is not on the monitored network'
    });
  });
});
