// Source: src/presentation/http/routes/wireless-stream.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanDatabase,
  seedWirelessDeviceModel,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { readSseStream } from './helpers/sse';
import { DependencyContainer } from '../../src/infrastructure/di/container';

// ─────────────────────────────────────────────────────────────
// Local seed helpers
// ─────────────────────────────────────────────────────────────

async function seedStation(
  prisma: PrismaClient,
  deviceModelId: string,
  opts: {
    ip: string;
    linkCapacityKbps: number | null;
    withSnapshot: boolean;
    txBps?: number;
    rxBps?: number;
  }
): Promise<string> {
  const device = await prisma.device.create({
    data: {
      name: `Station ${opts.ip}`,
      owner: 'COMPANY',
      status: 'ACTIVE',
      monitoringEnabled: true,
      ipAddress: opts.ip,
      deviceModelId
    }
  });

  await prisma.wirelessPollingConfiguration.create({
    data: {
      deviceId: device.id,
      ipAddress: opts.ip,
      enabled: true,
      intervalSecs: 3600,
      deviceType: 'STATION',
      linkCapacityKbps: opts.linkCapacityKbps
    }
  });

  if (opts.withSnapshot) {
    await prisma.wirelessSnapshot.create({
      data: {
        deviceId: device.id,
        deviceType: 'STATION',
        collectedAt: new Date(),
        collectionMethod: 'http_api',
        throughputTxBps: BigInt(opts.txBps ?? 0),
        throughputRxBps: BigInt(opts.rxBps ?? 0)
      }
    });
  }

  return device.id;
}

// ─────────────────────────────────────────────────────────────

describe('Wireless throughput stream routes', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let token: string;
  let deviceModelId: string;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    container = testApp.container;
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    container.eventStreamHub.closeAll();
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    deviceModelId = await seedWirelessDeviceModel(prisma);
    token = await seedAndGetToken(app, prisma, 'ADMIN');
  });

  afterEach(() => {
    container.eventStreamHub.closeAll();
  });

  describe('GET /api/devices/:id/wireless/throughput/stream', () => {
    it('streams the current reading with utilisation against the plan', async () => {
      const deviceId = await seedStation(prisma, deviceModelId, {
        ip: '192.168.50.10',
        linkCapacityKbps: 50_000,
        withSnapshot: true,
        txBps: 8_000_000,
        rxBps: 2_000_000
      });

      const res = await readSseStream(
        app,
        `/api/devices/${deviceId}/wireless/throughput/stream`,
        { token }
      );

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain(
        'text/event-stream'
      );
      expect(res.headers['cache-control']).toContain('no-cache');

      expect(res.events).toHaveLength(1);
      expect(res.events[0].event).toBe('throughput');
      expect(res.events[0].data).toMatchObject({
        deviceId,
        deviceType: 'STATION',
        throughputTxBps: 8_000_000,
        throughputRxBps: 2_000_000,
        throughputTotalBps: 10_000_000,
        linkCapacityKbps: 50_000,
        utilisationPercent: 20,
        stale: false
      });
    });

    // [WLS-147] linkCapacityKbps is optional, so utilisation may be unknowable
    it('reports null utilisation when no capacity is configured', async () => {
      const deviceId = await seedStation(prisma, deviceModelId, {
        ip: '192.168.50.11',
        linkCapacityKbps: null,
        withSnapshot: true,
        txBps: 1_000_000
      });

      const res = await readSseStream(
        app,
        `/api/devices/${deviceId}/wireless/throughput/stream`,
        { token }
      );

      expect(res.events[0].data).toMatchObject({
        linkCapacityKbps: null,
        utilisationPercent: null
      });
    });

    it('accepts a Bearer header as well as ?token=', async () => {
      const deviceId = await seedStation(prisma, deviceModelId, {
        ip: '192.168.50.12',
        linkCapacityKbps: 10_000,
        withSnapshot: true
      });

      const res = await readSseStream(
        app,
        `/api/devices/${deviceId}/wireless/throughput/stream`,
        { token, bearer: true }
      );

      expect(res.status).toBe(200);
      expect(res.events[0].event).toBe('throughput');
    });

    describe('[WLS-140] never polled', () => {
      it('answers 404 as JSON without opening a stream', async () => {
        const deviceId = await seedStation(prisma, deviceModelId, {
          ip: '192.168.50.13',
          linkCapacityKbps: 10_000,
          withSnapshot: false
        });

        const res = await request(app)
          .get(`/api/devices/${deviceId}/wireless/throughput/stream`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
        expect(res.headers['content-type']).toContain(
          'application/json'
        );
        expect(res.body).toEqual({
          error: 'No wireless data found for device'
        });
      });

      it('answers 404 for a device that does not exist', async () => {
        const res = await request(app)
          .get(`/api/devices/${GHOST_ID}/wireless/throughput/stream`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
      });
    });

    it('rejects a malformed device id with 400', async () => {
      const res = await request(app)
        .get(`/api/devices/${INVALID_ID}/wireless/throughput/stream`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/wireless/throughput/stream', () => {
    it('opens with a throughput-snapshot frame listing every polled device', async () => {
      await seedStation(prisma, deviceModelId, {
        ip: '192.168.50.20',
        linkCapacityKbps: 10_000,
        withSnapshot: true,
        txBps: 5_000_000
      });
      await seedStation(prisma, deviceModelId, {
        ip: '192.168.50.21',
        linkCapacityKbps: 50_000,
        withSnapshot: true,
        txBps: 5_000_000
      });

      const res = await readSseStream(
        app,
        '/api/wireless/throughput/stream',
        { token }
      );

      expect(res.status).toBe(200);
      expect(res.events[0].event).toBe('throughput-snapshot');

      const payload = res.events[0].data as {
        total: number;
        devices: { utilisationPercent: number | null }[];
      };
      expect(payload.total).toBe(2);
      expect(
        payload.devices.map((d) => d.utilisationPercent).sort()
      ).toEqual([10, 50]);
    });

    it('returns an empty fleet rather than failing', async () => {
      const res = await readSseStream(
        app,
        '/api/wireless/throughput/stream',
        { token }
      );

      expect(res.status).toBe(200);
      expect(res.events[0].data).toEqual({ devices: [], total: 0 });
    });

    // a device that has never been polled has no reading to report
    it('omits configured devices with no snapshot', async () => {
      await seedStation(prisma, deviceModelId, {
        ip: '192.168.50.22',
        linkCapacityKbps: 10_000,
        withSnapshot: true
      });
      await seedStation(prisma, deviceModelId, {
        ip: '192.168.50.23',
        linkCapacityKbps: 10_000,
        withSnapshot: false
      });

      const res = await readSseStream(
        app,
        '/api/wireless/throughput/stream',
        { token }
      );

      expect((res.events[0].data as { total: number }).total).toBe(1);
    });
  });

  describe('[WLS-149] authentication', () => {
    it('rejects a request with no credentials', async () => {
      const res = await request(app).get(
        '/api/wireless/throughput/stream'
      );

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        success: false,
        error: 'Authentication required'
      });
    });

    it('rejects an invalid query token', async () => {
      const res = await request(app).get(
        '/api/wireless/throughput/stream?token=nonsense'
      );

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        success: false,
        error: 'Invalid token'
      });
    });

    it('rejects an invalid Bearer header', async () => {
      const res = await request(app)
        .get('/api/wireless/throughput/stream')
        .set('Authorization', 'Bearer nonsense');

      expect(res.status).toBe(401);
    });

    // authorize('read') is granted to every role, so there is no 403 case
    // on these routes — VIEWER is the least-privileged caller and passes
    it('allows a VIEWER', async () => {
      const viewerToken = await seedAndGetToken(
        app,
        prisma,
        'VIEWER'
      );

      const res = await readSseStream(
        app,
        '/api/wireless/throughput/stream',
        { token: viewerToken }
      );

      expect(res.status).toBe(200);
    });
  });
});
