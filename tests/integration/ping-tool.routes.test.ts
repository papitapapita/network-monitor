// Source: src/presentation/http/routes/ping-tool.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PingToolController } from '../../src/presentation/http/controllers/PingToolController';
import { DependencyContainer } from '../../src/infrastructure/di/container';
import { createTestApp } from './helpers/createTestApp';
import { cleanDatabase, seedAgent } from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { readSseStream } from './helpers/sse';
import { FakePingService } from './helpers/FakePingService';
import {
  buildPingTool,
  FakeAgentPingProbe
} from './helpers/pingTool';

const PATH = '/api/network/ping/stream';

describe('Ping tool routes', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let ping: FakePingService;
  let agentProbe: FakeAgentPingProbe;
  let token: string;

  beforeAll(async () => {
    const testApp = await createTestApp((c) => {
      ping = new FakePingService();
      agentProbe = new FakeAgentPingProbe();
      c.pingToolController = new PingToolController(
        buildPingTool(c.getPrisma(), ping, agentProbe, c.getLogger()),
        c.getLogger()
      );
    });
    app = testApp.app;
    container = testApp.container;
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    token = await seedAndGetToken(app, prisma, 'OPERATOR');
    ping.pinged.length = 0;
    ping.setResult({ isReachable: true, latencyMs: 3 });
  });

  describe(`GET ${PATH}`, () => {
    it('streams where it pings from, one frame per ping, then the totals', async () => {
      const res = await readSseStream(
        app,
        `${PATH}?ip=10.80.0.1&count=2`,
        {
          token,
          expectEvents: 4
        }
      );

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain(
        'text/event-stream'
      );
      expect(res.events.map((e) => e.event)).toEqual([
        'ping-start',
        'ping-reply',
        'ping-reply',
        'ping-done'
      ]);
      expect(res.events[0].data).toMatchObject({
        ipAddress: '10.80.0.1',
        source: 'SERVER',
        count: 2
      });
      expect(res.events[1].data).toMatchObject({
        seq: 1,
        outcome: 'REPLY',
        latencyMs: 3,
        detail: null
      });
      expect(res.events[3].data).toMatchObject({
        sent: 2,
        received: 2,
        lossPercent: 0,
        minMs: 3,
        avgMs: 3,
        maxMs: 3,
        cancelled: false
      });
    });

    it('sends 4 pings when no count is given', async () => {
      const res = await readSseStream(app, `${PATH}?ip=10.80.0.1`, {
        token,
        bearer: true,
        expectEvents: 6
      });

      expect(res.events.at(-1)!.data).toMatchObject({ sent: 4 });
    });

    it('pings through the chosen agent', async () => {
      const agent = await seedAgent(prisma, {
        name: 'Torre Norte',
        status: 'ACTIVE'
      });

      const res = await readSseStream(
        app,
        `${PATH}?ip=10.80.0.1&count=1&agentId=${agent.id}`,
        { token, expectEvents: 3 }
      );

      expect(res.events[0].data).toMatchObject({
        source: 'AGENT',
        agentName: 'Torre Norte'
      });
      expect(agentProbe.calls).toContainEqual({
        agentId: agent.id,
        ipAddress: '10.80.0.1'
      });
    });

    it('answers 404 for an agent that does not exist', async () => {
      const res = await request(app)
        .get(
          `${PATH}?ip=10.80.0.1&agentId=0b0f6c8e-6a0e-4d43-9b4e-2f4f3c1d9a10&token=${token}`
        )
        .expect(404);

      expect(res.body).toEqual({ error: 'Agent not found' });
    });

    it.each([
      ['no ip', `${PATH}?count=2`],
      ['a hostname', `${PATH}?ip=example.com`],
      ['a count above 100', `${PATH}?ip=10.80.0.1&count=101`],
      ['a malformed agentId', `${PATH}?ip=10.80.0.1&agentId=abc`]
    ])('answers 400 for %s', async (_, path) => {
      await request(app).get(`${path}&token=${token}`).expect(400);
      expect(ping.pinged).toHaveLength(0);
    });

    it('answers 401 without a token', async () => {
      await request(app).get(`${PATH}?ip=10.80.0.1`).expect(401);
    });

    it('answers 403 to a viewer', async () => {
      const viewer = await seedAndGetToken(app, prisma, 'VIEWER');

      await request(app)
        .get(`${PATH}?ip=10.80.0.1&token=${viewer}`)
        .expect(403);
      expect(ping.pinged).toHaveLength(0);
    });
  });
});
