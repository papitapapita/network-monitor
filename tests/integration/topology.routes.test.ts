// Source: src/presentation/http/routes/topology.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanDatabase,
  seedDeviceModel,
  seedNetworkDevice,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { DependencyContainer } from '../../src/infrastructure/di/container';

// Every role holds `read`, so no role is refused here (no 403 case).
describe('Topology routes', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let viewerToken: string;
  let deviceModelId: string;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    deviceModelId = await seedDeviceModel(prisma);
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
  });

  async function seedChain(): Promise<{ ap: string; cpe: string }> {
    const ap = await seedNetworkDevice(prisma, deviceModelId, {
      name: 'AP Torre Norte',
      ipAddress: '10.0.3.2'
    });
    const cpe = await seedNetworkDevice(prisma, deviceModelId, {
      name: 'CPE Juan',
      ipAddress: '10.0.3.21',
      upstreamDeviceId: ap
    });
    return { ap, cpe };
  }

  describe('GET /api/topology', () => {
    it('200 — returns every node in the response envelope', async () => {
      const { ap, cpe } = await seedChain();

      const res = await request(app)
        .get('/api/topology')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(2);
      const byId = new Map(
        res.body.data.nodes.map((n: { id: string }) => [n.id, n])
      );
      expect(byId.get(ap)).toMatchObject({
        name: 'AP Torre Norte',
        upstreamDeviceId: null,
        childCount: 1,
        reachability: 'UNKNOWN'
      });
      expect(byId.get(cpe)).toMatchObject({ upstreamDeviceId: ap });
    });

    it('401 — without a token', async () => {
      const res = await request(app).get('/api/topology');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/topology/:deviceId/descendants', () => {
    it('200 — returns the device and what hangs off it', async () => {
      const { ap, cpe } = await seedChain();

      const res = await request(app)
        .get(`/api/topology/${ap}/descendants`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(
        res.body.data.nodes.map((n: { id: string }) => n.id)
      ).toEqual([ap, cpe]);
    });

    it('404 — for a device not in the topology', async () => {
      const res = await request(app)
        .get(`/api/topology/${GHOST_ID}/descendants`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('400 — for a malformed id', async () => {
      const res = await request(app)
        .get(`/api/topology/${INVALID_ID}/descendants`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(400);
    });

    it('401 — without a token', async () => {
      const res = await request(app).get(
        `/api/topology/${GHOST_ID}/descendants`
      );

      expect(res.status).toBe(401);
    });
  });
});
