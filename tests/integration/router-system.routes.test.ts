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
});
