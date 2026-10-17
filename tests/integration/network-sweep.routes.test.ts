// Source: src/presentation/http/routes/network-sweep.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { Result } from '../../src/domain/shared/core';
import { PingResponse } from '../../src/application/device-monitoring/interfaces';
import { NetworkSweepController } from '../../src/presentation/http/controllers/NetworkSweepController';
import { DependencyContainer } from '../../src/infrastructure/di/container';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanDatabase,
  seedDeviceModel,
  seedLocation
} from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { readSseStream } from './helpers/sse';
import { FakePingService } from './helpers/FakePingService';
import {
  buildNetworkSweep,
  seedSweepDevice
} from './helpers/networkSweep';

const PATH = '/api/network/sweep/stream';

// Holds every ping until release(), so a sweep can be caught mid-run.
class GatedPingService extends FakePingService {
  gated = false;
  private waiting: (() => void)[] = [];

  release(): void {
    this.gated = false;
    this.waiting.splice(0).forEach((resume) => resume());
  }

  async ping(
    ipAddress: string,
    timeoutMs?: number
  ): Promise<Result<PingResponse>> {
    if (this.gated) {
      await new Promise<void>((resume) => this.waiting.push(resume));
    }
    return super.ping(ipAddress, timeoutMs);
  }
}

describe('Network sweep routes', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let ping: GatedPingService;
  let token: string;
  let deviceModelId: string;

  beforeAll(async () => {
    const testApp = await createTestApp((c) => {
      ping = new GatedPingService();
      c.networkSweepController = new NetworkSweepController(
        buildNetworkSweep(c.getPrisma(), ping, c.getLogger()),
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
    deviceModelId = await seedDeviceModel(prisma);
    token = await seedAndGetToken(app, prisma, 'OPERATOR');
    ping.release();
    ping.pinged.length = 0;
    ping.setResult({ isReachable: true, latencyMs: 3 });
  });

  describe(`GET ${PATH}`, () => {
    it('streams the count, one result per device, then the totals', async () => {
      const alive = await seedSweepDevice(prisma, deviceModelId, {
        name: 'Alive',
        ip: '10.60.0.1'
      });
      const dead = await seedSweepDevice(prisma, deviceModelId, {
        name: 'Dead',
        ip: '10.60.0.2'
      });
      ping.setResultFor('10.60.0.2', {
        isReachable: false,
        latencyMs: null
      });

      const res = await readSseStream(app, PATH, {
        token,
        expectEvents: 4
      });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain(
        'text/event-stream'
      );
      expect(res.events.map((e) => e.event)).toEqual([
        'sweep-start',
        'sweep-result',
        'sweep-result',
        'sweep-done'
      ]);
      expect(res.events[0].data).toMatchObject({
        total: 2,
        toPing: 2
      });
      const results = res.events
        .slice(1, 3)
        .map((e) => e.data as { deviceId: string; outcome: string });
      expect(
        Object.fromEntries(
          results.map((r) => [r.deviceId, r.outcome])
        )
      ).toEqual({ [alive]: 'UP', [dead]: 'DOWN' });
      expect(res.events[3].data).toMatchObject({
        total: 2,
        up: 1,
        down: 1,
        skipped: 0,
        error: 0,
        cancelled: false
      });
    });

    it('accepts a Bearer header as well as ?token=', async () => {
      const res = await readSseStream(app, PATH, {
        token,
        bearer: true,
        expectEvents: 2
      });

      expect(res.status).toBe(200);
      expect(res.events.map((e) => e.event)).toEqual([
        'sweep-start',
        'sweep-done'
      ]);
    });

    it('applies the location and category filters', async () => {
      const locationId = await seedLocation(prisma);
      const wanted = await seedSweepDevice(prisma, deviceModelId, {
        name: 'Tower AP',
        ip: '10.60.1.1',
        category: 'ACCESS_POINT',
        locationId
      });
      await seedSweepDevice(prisma, deviceModelId, {
        name: 'Tower CPE',
        ip: '10.60.1.2',
        locationId
      });
      await seedSweepDevice(prisma, deviceModelId, {
        name: 'Other AP',
        ip: '10.60.1.3',
        category: 'ACCESS_POINT'
      });

      const res = await readSseStream(
        app,
        `${PATH}?locationId=${locationId}&category=ACCESS_POINT`,
        { token, expectEvents: 3 }
      );

      expect(res.events[0].data).toMatchObject({
        total: 1,
        filters: { locationId, category: 'ACCESS_POINT' }
      });
      expect(res.events[1].data).toMatchObject({ deviceId: wanted });
    });

    it('400 — rejects an unknown category', async () => {
      const res = await request(app)
        .get(`${PATH}?category=TOASTER`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it('400 — rejects a malformed location id', async () => {
      const res = await request(app)
        .get(`${PATH}?locationId=not-a-uuid`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it('401 — rejects a request with no credentials', async () => {
      const res = await request(app).get(PATH);

      expect(res.status).toBe(401);
    });

    it('403 — a VIEWER cannot start a sweep', async () => {
      const viewerToken = await seedAndGetToken(
        app,
        prisma,
        'VIEWER'
      );

      const res = await request(app)
        .get(PATH)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(ping.pinged).toHaveLength(0);
    });

    // MON-083
    it('409 — refuses a second sweep while one is running', async () => {
      await seedSweepDevice(prisma, deviceModelId, {
        name: 'Slow',
        ip: '10.60.2.1'
      });
      ping.gated = true;
      // the first sweep opens and then waits on its ping
      const first = await readSseStream(app, PATH, {
        token,
        expectEvents: 1
      });
      expect(first.events[0].event).toBe('sweep-start');

      const second = await request(app)
        .get(PATH)
        .set('Authorization', `Bearer ${token}`);

      expect(second.status).toBe(409);
      expect(second.body).toEqual({
        error: 'A network sweep is already running'
      });

      // the first stream was closed above; letting its ping finish frees
      // the slot for the next test
      ping.release();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const third = await readSseStream(app, PATH, {
        token,
        expectEvents: 3
      });
      expect(third.status).toBe(200);
    });
  });
});
