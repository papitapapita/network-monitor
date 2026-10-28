// Source: src/presentation/http/routes/router-system.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { cleanDatabase, GHOST_ID, INVALID_ID } from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import {
  FakeRouterOsPrinter,
  rb4011
} from './helpers/FakeRouterOsPrinter';
import { seedMikrotikModel, seedRouter } from './helpers/portSpeeds';
import { buildRouterSystems } from './helpers/routerSystems';
import { DependencyContainer } from '../../src/infrastructure/di/container';
import { RouterSystemController } from '../../src/presentation/http/controllers/RouterSystemController';

const LIST_PATH = '/api/routers/system';
const routerPath = (id: string) => `/api/routers/${id}/system`;
const THRESHOLDS_PATH = '/api/routers/health-thresholds';
const THRESHOLDS = {
  cpuPercent: 85,
  minFreeMemoryPercent: 15,
  minFreeDiskPercent: 8,
  maxTemperatureC: 70,
  minVoltage: 22.5
};
const DEFAULTS = {
  cpuPercent: 90,
  minFreeMemoryPercent: 10,
  minFreeDiskPercent: 5,
  maxTemperatureC: 75,
  minVoltage: null
};

describe('Router system routes', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let viewerToken: string;
  let coreId: string;
  const printer = new FakeRouterOsPrinter();

  beforeAll(async () => {
    ({ app, container } = await createTestApp((c) => {
      const stack = buildRouterSystems(c.getPrisma(), printer);
      c.routerSystemController = new RouterSystemController(
        stack.list,
        stack.get,
        stack.getThresholds,
        stack.updateThresholds,
        c.getLogger()
      );
    }));
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    printer.reset();
    await cleanDatabase(prisma);
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
    coreId = await seedRouter(prisma, {
      name: 'Core',
      deviceModelId: await seedMikrotikModel(prisma),
      ip: '10.0.0.1'
    });
    printer.serve('10.0.0.1', rb4011());
  });

  describe('GET /api/routers/system', () => {
    it('[MON-162] should answer 200 with every router and its last reading to a viewer', async () => {
      await request(app)
        .get(routerPath(coreId))
        .set('Authorization', `Bearer ${viewerToken}`);

      const res = await request(app)
        .get(LIST_PATH)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.success).toBe(true);
      expect(res.body.data.routers).toEqual([
        expect.objectContaining({
          deviceId: coreId,
          name: 'Core',
          readable: true,
          lastError: null,
          system: expect.objectContaining({
            identity: 'Core-Insetel',
            serialNumber: 'D4440E1A2B3C',
            routerOsVersion: '7.15.3'
          })
        })
      ]);
    });

    it('[MON-162] should answer 200 with no reading for a router never read', async () => {
      const res = await request(app)
        .get(LIST_PATH)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.routers[0]).toMatchObject({
        system: null,
        readAt: null,
        attemptedAt: null
      });
      expect(printer.batches).toEqual([]);
    });

    it('should answer 401 without a token', async () => {
      const res = await request(app).get(LIST_PATH);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/routers/:id/system', () => {
    const get = (id: string) =>
      request(app)
        .get(routerPath(id))
        .set('Authorization', `Bearer ${viewerToken}`);

    it('[MON-163] should answer 200 with that router read now to a viewer', async () => {
      const res = await get(coreId);

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.data.router).toMatchObject({
        deviceId: coreId,
        readAt: expect.any(String),
        system: expect.objectContaining({
          model: 'RB4011iGS+',
          macAddress: 'DC:2C:6E:00:00:01',
          uptimeSeconds: 93600,
          voltage: expect.closeTo(24.1, 3)
        })
      });
    });

    it('[MON-163] should answer 200 with the error when the router does not answer', async () => {
      printer.refuse('10.0.0.1', 'RouterOS API error: timeout');

      const res = await get(coreId);

      expect(res.status).toBe(200);
      expect(res.body.data.router).toMatchObject({
        system: null,
        lastError: 'RouterOS API error: timeout'
      });
    });

    it('should answer 401 without a token', async () => {
      const res = await request(app).get(routerPath(coreId));

      expect(res.status).toBe(401);
    });

    it('should answer 400 for a malformed id', async () => {
      const res = await get(INVALID_ID);

      expect(res.status).toBe(400);
    });

    it('should answer 404 for a device that is not one of the MikroTiks', async () => {
      const res = await get(GHOST_ID);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        success: false,
        error: 'Router not found'
      });
    });
  });

  describe('GET /api/routers/health-thresholds', () => {
    it('[MON-172] should answer 200 with the defaults to a viewer when none were saved', async () => {
      const res = await request(app)
        .get(THRESHOLDS_PATH)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: { thresholds: DEFAULTS, defaults: DEFAULTS }
      });
    });

    it('should answer 401 without a token', async () => {
      const res = await request(app).get(THRESHOLDS_PATH);

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/routers/health-thresholds', () => {
    let adminToken: string;

    beforeEach(async () => {
      adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
    });

    const put = (token: string, body: unknown) =>
      request(app)
        .put(THRESHOLDS_PATH)
        .set('Authorization', `Bearer ${token}`)
        .send(body as object);

    it('[MON-172] should answer 200 and keep the thresholds an administrator saves', async () => {
      const res = await put(adminToken, THRESHOLDS);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        thresholds: {
          ...THRESHOLDS,
          minVoltage: expect.closeTo(22.5, 3)
        },
        defaults: DEFAULTS
      });
      const read = await request(app)
        .get(THRESHOLDS_PATH)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(read.body.data.thresholds.cpuPercent).toBe(85);
    });

    it('[MON-172] should answer 400 for a limit out of range', async () => {
      const res = await put(adminToken, {
        ...THRESHOLDS,
        maxTemperatureC: 150
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        'maxTemperatureC must be a whole number from 40 to 110'
      );
    });

    it('should answer 400 for a body missing a limit', async () => {
      const { minVoltage: _omitted, ...partial } = THRESHOLDS;

      const res = await put(adminToken, partial);

      expect(res.status).toBe(400);
    });

    it('should answer 403 to a viewer', async () => {
      const res = await put(viewerToken, THRESHOLDS);

      expect(res.status).toBe(403);
    });

    it('should answer 401 without a token', async () => {
      const res = await request(app)
        .put(THRESHOLDS_PATH)
        .send(THRESHOLDS);

      expect(res.status).toBe(401);
    });
  });
});
