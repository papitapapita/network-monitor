// Source: src/presentation/http/routes/speed-test.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { SpeedTestController } from '../../src/presentation/http/controllers/SpeedTestController';
import { DependencyContainer } from '../../src/infrastructure/di/container';
import { createTestApp } from './helpers/createTestApp';
import { cleanDatabase } from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { readSseStream } from './helpers/sse';
import {
  buildSpeedTestUseCases,
  FakeSpeedTester,
  seedSpeedTest
} from './helpers/speedTests';

const STREAM = '/api/network/speed-test/stream';
const HISTORY = '/api/network/speed-tests';

describe('Speed test routes', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let tester: FakeSpeedTester;
  let token: string;

  beforeAll(async () => {
    const testApp = await createTestApp((c) => {
      tester = new FakeSpeedTester();
      const { run, list } = buildSpeedTestUseCases(
        c.getPrisma(),
        tester,
        c.getLogger()
      );
      c.speedTestController = new SpeedTestController(
        run,
        list,
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
    tester.release();
  });

  describe(`GET ${STREAM}`, () => {
    it('streams the plan, the progress, then the kept result', async () => {
      const res = await readSseStream(app, STREAM, {
        token,
        expectEvents: 5
      });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain(
        'text/event-stream'
      );
      expect(res.events.map((e) => e.event)).toEqual([
        'speed-test-start',
        'speed-test-progress',
        'speed-test-progress',
        'speed-test-progress',
        'speed-test-done'
      ]);
      expect(res.events[0].data).toMatchObject({
        latencySamples: 10,
        downloadSeconds: 10,
        uploadSeconds: 10,
        startedAt: expect.any(String)
      });
      expect(res.events[2].data).toEqual({
        phase: 'DOWNLOAD',
        elapsedMs: 1000,
        mbps: 93.1,
        latencyMs: null
      });
      const done = res.events[4].data as { id: string };
      expect(done).toMatchObject({
        status: 'COMPLETED',
        downloadMbps: 95.4,
        uploadMbps: 42.1,
        startedByEmail: 'operator-test@example.local'
      });
      const row = await prisma.speedTestResult.findUniqueOrThrow({
        where: { id: done.id }
      });
      expect(row.status).toBe('COMPLETED');
    });

    it('accepts the token as a Bearer header too', async () => {
      const res = await readSseStream(app, STREAM, {
        token,
        bearer: true,
        expectEvents: 5
      });

      expect(res.status).toBe(200);
    });

    it('answers 409 while another test is running', async () => {
      tester.gated = true;
      const callsBefore = tester.calls;
      const first = readSseStream(app, STREAM, {
        token,
        expectEvents: 5
      });
      await waitFor(() => tester.calls > callsBefore);

      const second = await request(app)
        .get(`${STREAM}?token=${token}`)
        .expect(409);
      tester.release();
      const firstRes = await first;

      expect(second.body).toEqual({
        error: 'A speed test is already running'
      });
      expect(firstRes.events.at(-1)!.event).toBe('speed-test-done');
    });

    it('keeps nothing when the stream is closed mid-test', async () => {
      tester.gated = true;

      const res = await readSseStream(app, STREAM, {
        token,
        expectEvents: 1
      });
      await tester.finished;
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(res.events[0].event).toBe('speed-test-start');
      expect(await prisma.speedTestResult.count()).toBe(0);
    });

    it('answers 401 without a token', async () => {
      await request(app).get(STREAM).expect(401);
    });

    it('answers 403 to a viewer', async () => {
      const viewer = await seedAndGetToken(app, prisma, 'VIEWER');

      await request(app).get(`${STREAM}?token=${viewer}`).expect(403);
      expect(await prisma.speedTestResult.count()).toBe(0);
    });
  });

  describe(`GET ${HISTORY}`, () => {
    it('lists the kept tests, newest first, in the response envelope', async () => {
      const older = await seedSpeedTest(prisma, {
        startedAt: new Date('2026-10-20T10:00:00Z')
      });
      const newer = await seedSpeedTest(prisma, {
        startedAt: new Date('2026-10-27T10:00:00Z')
      });

      const res = await request(app)
        .get(`${HISTORY}?limit=1`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        total: 2,
        hasMore: true,
        limit: 1,
        offset: 0
      });
      expect(
        res.body.data.results.map((r: { id: string }) => r.id)
      ).toEqual([newer]);
      expect(older).toBeDefined();
    });

    it('lets a viewer read the history', async () => {
      const viewer = await seedAndGetToken(app, prisma, 'VIEWER');

      await request(app)
        .get(HISTORY)
        .set('Authorization', `Bearer ${viewer}`)
        .expect(200);
    });

    it('answers 400 for a limit above 100', async () => {
      await request(app)
        .get(`${HISTORY}?limit=101`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('answers 401 without a token', async () => {
      await request(app).get(HISTORY).expect(401);
    });
  });
});

async function waitFor(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 50 && !condition(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
