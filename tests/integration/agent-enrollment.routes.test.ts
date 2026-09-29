// Source: src/presentation/http/routes/agent-enrollment.routes.ts
// Agents enroll without a user JWT — the one-time pairing code is the
// credential. The limiter allows 10 attempts per IP per 15 minutes and is
// shared by every test in this file, so the 429 case runs last.

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { cleanAgents, seedAgent } from './helpers/db';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Agent Enrollment Routes — /agent/v1', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanAgents(prisma);
  });

  it('[AGT-003] 201 — enrolls with only the pairing code, no JWT', async () => {
    const { id, pairingCode } = await seedAgent(prisma, {
      name: 'Torre Norte'
    });

    const res = await request(app)
      .post('/agent/v1/enroll')
      .send({ pairingCode });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.agentName).toBe('Torre Norte');
    expect(res.body.data.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const row = await prisma.probeAgent.findUnique({ where: { id } });
    expect(row!.status).toBe('ACTIVE');
  });

  it('[AGT-008] 401 — same answer for a used, expired or unknown code', async () => {
    const used = await seedAgent(prisma);
    await request(app)
      .post('/agent/v1/enroll')
      .send({ pairingCode: used.pairingCode });
    const expired = await seedAgent(prisma, {
      pairingExpiresAt: new Date(Date.now() - 1_000)
    });

    const responses = [
      await request(app)
        .post('/agent/v1/enroll')
        .send({ pairingCode: used.pairingCode }),
      await request(app)
        .post('/agent/v1/enroll')
        .send({ pairingCode: expired.pairingCode }),
      await request(app)
        .post('/agent/v1/enroll')
        .send({ pairingCode: 'never-issued' })
    ];

    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired pairing code');
    }
  });

  it('400 — missing pairing code', async () => {
    const res = await request(app).post('/agent/v1/enroll').send({});

    expect(res.status).toBe(400);
  });

  it('is not reachable under /api', async () => {
    const res = await request(app)
      .post('/api/agent/v1/enroll')
      .send({ pairingCode: 'x' });

    expect(res.status).toBe(401);
  });

  it('[AGT-008] 429 — throttles repeated attempts from one address', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await request(app)
        .post('/agent/v1/enroll')
        .send({ pairingCode: `guess-${i}` });
      statuses.push(res.status);
    }

    expect(statuses).toContain(429);
  });
});
