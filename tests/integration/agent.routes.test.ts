// Source: src/presentation/http/routes/agent.routes.ts
// Tests the full HTTP stack for probe-agent administration via supertest
// against a real Postgres DB.

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanAgents,
  seedAgent,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { DependencyContainer } from '../../src/infrastructure/di/container';
import { PairingKey } from '../../src/application/probe-agents/services';

describe('Agent Routes — /api/agents', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let adminToken: string;
  let operatorToken: string;
  let viewerToken: string;

  const as = (token: string) => `Bearer ${token}`;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanAgents(prisma);
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
    operatorToken = await seedAndGetToken(app, prisma, 'OPERATOR');
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
  });

  describe('Authentication', () => {
    it('401 — rejects every route without a token', async () => {
      const responses = await Promise.all([
        request(app).post('/api/agents').send({ name: 'X' }),
        request(app).get('/api/agents'),
        request(app).get(`/api/agents/${GHOST_ID}`),
        request(app).post(`/api/agents/${GHOST_ID}/pairing-key`),
        request(app).post(`/api/agents/${GHOST_ID}/revoke`)
      ]);

      for (const res of responses) {
        expect(res.status).toBe(401);
      }
    });
  });

  describe('Authorization (RBAC)', () => {
    it.each([
      ['create', '/api/agents'],
      ['reissue', `/api/agents/${GHOST_ID}/pairing-key`],
      ['revoke', `/api/agents/${GHOST_ID}/revoke`]
    ])(
      '[AGT-009] 403 — an OPERATOR cannot %s',
      async (_label, path) => {
        const res = await request(app)
          .post(path)
          .set('Authorization', as(operatorToken))
          .send({ name: 'Torre Norte' });

        expect(res.status).toBe(403);
      }
    );

    it('[AGT-009] 200 — a VIEWER can list and read agents', async () => {
      const { id } = await seedAgent(prisma);

      const list = await request(app)
        .get('/api/agents')
        .set('Authorization', as(viewerToken));
      const one = await request(app)
        .get(`/api/agents/${id}`)
        .set('Authorization', as(viewerToken));

      expect(list.status).toBe(200);
      expect(one.status).toBe(200);
    });
  });

  describe('POST /api/agents', () => {
    it('[AGT-001] 201 — returns the agent and a pairing key once', async () => {
      const res = await request(app)
        .post('/api/agents')
        .set('Authorization', as(adminToken))
        .send({ name: 'Torre Norte' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.agent).toMatchObject({
        name: 'Torre Norte',
        status: 'PENDING'
      });
      const parts = PairingKey.parse(res.body.data.pairingKey).value;
      expect(parts.backendUrl).toBe('https://agents.test.local');
    });

    it('[AGT-002] the key is never shown again', async () => {
      const created = await request(app)
        .post('/api/agents')
        .set('Authorization', as(adminToken))
        .send({ name: 'Torre Norte' });

      const read = await request(app)
        .get(`/api/agents/${created.body.data.agent.id}`)
        .set('Authorization', as(adminToken));

      expect(read.body.data).not.toHaveProperty('pairingKey');
      expect(JSON.stringify(read.body)).not.toContain(
        PairingKey.parse(created.body.data.pairingKey).value
          .pairingCode
      );
    });

    it('[AGT-006] 409 — duplicate name', async () => {
      await seedAgent(prisma, { name: 'Torre Norte' });

      const res = await request(app)
        .post('/api/agents')
        .set('Authorization', as(adminToken))
        .send({ name: 'Torre Norte' });

      expect(res.status).toBe(409);
    });

    it('400 — missing or too long name', async () => {
      const missing = await request(app)
        .post('/api/agents')
        .set('Authorization', as(adminToken))
        .send({});
      const long = await request(app)
        .post('/api/agents')
        .set('Authorization', as(adminToken))
        .send({ name: 'a'.repeat(61) });

      expect(missing.status).toBe(400);
      expect(long.status).toBe(400);
    });
  });

  describe('GET /api/agents', () => {
    it('200 — lists agents without secret material', async () => {
      await seedAgent(prisma, { status: 'ACTIVE' });

      const res = await request(app)
        .get('/api/agents')
        .set('Authorization', as(adminToken));

      expect(res.status).toBe(200);
      expect(res.body.data.agents).toHaveLength(1);
      expect(res.body.data.agents[0]).not.toHaveProperty('tokenHash');
      expect(res.body.data.agents[0]).not.toHaveProperty(
        'pairingCodeHash'
      );
    });
  });

  describe('GET /api/agents/:id', () => {
    it('404 — unknown agent', async () => {
      const res = await request(app)
        .get(`/api/agents/${GHOST_ID}`)
        .set('Authorization', as(adminToken));

      expect(res.status).toBe(404);
    });

    it('400 — malformed id', async () => {
      const res = await request(app)
        .get(`/api/agents/${INVALID_ID}`)
        .set('Authorization', as(adminToken));

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/agents/:id/pairing-key', () => {
    it('[AGT-004] 200 — issues a new key for a pending agent', async () => {
      const { id } = await seedAgent(prisma);

      const res = await request(app)
        .post(`/api/agents/${id}/pairing-key`)
        .set('Authorization', as(adminToken));

      expect(res.status).toBe(200);
      expect(
        PairingKey.parse(res.body.data.pairingKey).isSuccess
      ).toBe(true);
    });

    it('[AGT-004] 409 — an enrolled agent gets no new key', async () => {
      const { id } = await seedAgent(prisma, { status: 'ACTIVE' });

      const res = await request(app)
        .post(`/api/agents/${id}/pairing-key`)
        .set('Authorization', as(adminToken));

      expect(res.status).toBe(409);
    });

    it('404 — unknown agent', async () => {
      const res = await request(app)
        .post(`/api/agents/${GHOST_ID}/pairing-key`)
        .set('Authorization', as(adminToken));

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/agents/:id/revoke', () => {
    it('[AGT-005] 200 — revokes the agent', async () => {
      const { id } = await seedAgent(prisma, { status: 'ACTIVE' });

      const res = await request(app)
        .post(`/api/agents/${id}/revoke`)
        .set('Authorization', as(adminToken));

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REVOKED');
    });

    it('[AGT-005] 409 — already revoked', async () => {
      const { id } = await seedAgent(prisma, { status: 'REVOKED' });

      const res = await request(app)
        .post(`/api/agents/${id}/revoke`)
        .set('Authorization', as(adminToken));

      expect(res.status).toBe(409);
    });

    it('400 — malformed id', async () => {
      const res = await request(app)
        .post(`/api/agents/${INVALID_ID}/revoke`)
        .set('Authorization', as(adminToken));

      expect(res.status).toBe(400);
    });
  });
});
