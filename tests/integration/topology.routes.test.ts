// Source: src/presentation/http/routes/topology.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanDatabase,
  seedDeviceModel,
  seedNetworkDevice,
  seedWirelessDeviceModel,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { DependencyContainer } from '../../src/infrastructure/di/container';
import { seedMikrotikModel, seedRouter } from './helpers/portSpeeds';

// Every role holds `read`, so only accepting suggestions has a 403 case.
describe('Topology routes', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let viewerToken: string;
  let operatorToken: string;
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
    operatorToken = await seedAndGetToken(app, prisma, 'OPERATOR');
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
  describe('GET /api/topology/suggestions', () => {
    it('200 — suggests the AP a station reports', async () => {
      const ap = await seedNetworkDevice(prisma, deviceModelId, {
        name: 'AP Torre Norte',
        ipAddress: '10.0.3.2'
      });
      const sta = await seedNetworkDevice(prisma, deviceModelId, {
        name: 'CPE Juan',
        ipAddress: '10.0.3.21'
      });
      await prisma.wirelessPollingConfiguration.create({
        data: {
          deviceId: sta,
          ipAddress: '10.0.3.21',
          enabled: true,
          intervalSecs: 300,
          deviceType: 'STATION'
        }
      });
      await prisma.wirelessSnapshot.create({
        data: {
          deviceId: sta,
          deviceType: 'STATION',
          collectedAt: new Date(),
          collectionMethod: 'HTTP',
          remoteApDeviceId: ap
        }
      });

      const res = await request(app)
        .get('/api/topology/suggestions')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        total: 1,
        unreadSwitches: [],
        suggestions: [
          {
            deviceId: sta,
            suggestedUpstreamDeviceId: ap,
            suggestedUpstreamDeviceName: 'AP Torre Norte',
            source: 'WIRELESS',
            matchedBy: 'MAC'
          }
        ]
      });
    });

    it('400 — for a malformed locationId', async () => {
      const res = await request(app)
        .get(`/api/topology/suggestions?locationId=${INVALID_ID}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(400);
    });

    it('401 — without a token', async () => {
      const res = await request(app).get('/api/topology/suggestions');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/topology/suggestions/accept', () => {
    it('200 — links the chosen devices and reports each outcome', async () => {
      const ap = await seedNetworkDevice(prisma, deviceModelId, {
        name: 'AP Torre Norte',
        ipAddress: '10.0.3.2'
      });
      const cpe = await seedNetworkDevice(prisma, deviceModelId, {
        name: 'CPE Juan',
        ipAddress: '10.0.3.21'
      });

      const res = await request(app)
        .post('/api/topology/suggestions/accept')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          links: [
            { deviceId: cpe, upstreamDeviceId: ap },
            { deviceId: GHOST_ID, upstreamDeviceId: ap }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        linked: 1,
        failed: 1,
        results: [
          { deviceId: cpe, outcome: 'LINKED', error: null },
          { deviceId: GHOST_ID, outcome: 'FAILED' }
        ]
      });
      const stored = await prisma.device.findUniqueOrThrow({
        where: { id: cpe }
      });
      expect(stored.upstreamDeviceId).toBe(ap);
    });

    it('400 — for an empty list', async () => {
      const res = await request(app)
        .post('/api/topology/suggestions/accept')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ links: [] });

      expect(res.status).toBe(400);
    });

    it('400 — for a malformed id', async () => {
      const res = await request(app)
        .post('/api/topology/suggestions/accept')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          links: [
            { deviceId: INVALID_ID, upstreamDeviceId: GHOST_ID }
          ]
        });

      expect(res.status).toBe(400);
    });

    it('400 — for the same device twice', async () => {
      const res = await request(app)
        .post('/api/topology/suggestions/accept')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          links: [
            { deviceId: GHOST_ID, upstreamDeviceId: GHOST_ID },
            { deviceId: GHOST_ID, upstreamDeviceId: GHOST_ID }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        'Each device can appear only once in a request'
      );
    });

    it('403 — for a viewer', async () => {
      const res = await request(app)
        .post('/api/topology/suggestions/accept')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          links: [{ deviceId: GHOST_ID, upstreamDeviceId: GHOST_ID }]
        });

      expect(res.status).toBe(403);
    });

    it('401 — without a token', async () => {
      const res = await request(app)
        .post('/api/topology/suggestions/accept')
        .send({
          links: [{ deviceId: GHOST_ID, upstreamDeviceId: GHOST_ID }]
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/topology/routers/:deviceId/neighbors', () => {
    it('200 — answers why a router without a login was not read', async () => {
      const hex = await seedRouter(prisma, {
        name: 'Hex Norte',
        deviceModelId: await seedMikrotikModel(prisma),
        login: null
      });

      const res = await request(app)
        .get(`/api/topology/routers/${hex}/neighbors`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          deviceId: hex,
          deviceName: 'Hex Norte',
          reason: 'The router has no username and password saved',
          ports: []
        }
      });
    });

    it('404 — for a device that is not a MikroTik router', async () => {
      const ap = await seedNetworkDevice(
        prisma,
        await seedWirelessDeviceModel(prisma),
        { name: 'AP Torre Norte', ipAddress: '10.0.3.2' }
      );

      const res = await request(app)
        .get(`/api/topology/routers/${ap}/neighbors`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('400 — for a malformed id', async () => {
      const res = await request(app)
        .get(`/api/topology/routers/${INVALID_ID}/neighbors`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(400);
    });

    it('401 — without a token', async () => {
      const res = await request(app).get(
        `/api/topology/routers/${GHOST_ID}/neighbors`
      );

      expect(res.status).toBe(401);
    });
  });
});
