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
import { FakePingService } from './helpers/FakePingService';
import { FakeWirelessCollector } from './helpers/FakeWirelessCollector';
import {
  buildLinkDiagnosis,
  seedDiagnosableDevice,
  LinkDiagnosisStack
} from './helpers/linkDiagnosis';
import { WirelessStreamController } from '../../src/presentation/http/controllers/WirelessStreamController';
import {
  GetWirelessThroughputUseCase,
  GetFleetWirelessThroughputUseCase
} from '../../src/application/wireless-monitoring/use-cases';
import { PrismaWirelessSnapshotRepository } from '../../src/infrastructure/wireless-monitoring/repositories/PrismaWirelessSnapshotRepository';
import { PrismaWirelessDeviceConfigRepository } from '../../src/infrastructure/wireless-monitoring/repositories/PrismaWirelessDeviceConfigRepository';
import { ContractedCapacityAdapter } from '../../src/infrastructure/wireless-monitoring/adapters/ContractedCapacityAdapter';
import {
  PrismaContractedServiceRepository,
  PrismaServicePlanRepository
} from '../../src/infrastructure/customers';

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
  let diagnosis: LinkDiagnosisStack;

  beforeAll(async () => {
    // the diagnosis stream reads a runner wired to fakes, so no probe
    // leaves the test process; the throughput half keeps real repositories
    const testApp = await createTestApp((c) => {
      const p = c.getPrisma();
      const logger = c.getLogger();
      const snapshots = new PrismaWirelessSnapshotRepository(p);
      const configs = new PrismaWirelessDeviceConfigRepository(p);
      const capacity = new ContractedCapacityAdapter(
        new PrismaContractedServiceRepository(p),
        new PrismaServicePlanRepository(p)
      );
      diagnosis = buildLinkDiagnosis(
        p,
        c.eventStreamHub,
        {
          ping: new FakePingService(),
          collector: new FakeWirelessCollector()
        },
        // long intervals: after the opening probes nothing fires on its
        // own, so a test controls exactly which frames reach the stream
        { pingIntervalMs: 60_000, radioIntervalMs: 60_000 }
      );
      c.wirelessStreamController = new WirelessStreamController(
        new GetWirelessThroughputUseCase(
          snapshots,
          configs,
          capacity,
          logger
        ),
        new GetFleetWirelessThroughputUseCase(
          snapshots,
          configs,
          capacity,
          logger
        ),
        diagnosis.get,
        c.eventStreamHub,
        logger
      );
    });
    app = testApp.app;
    container = testApp.container;
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    diagnosis.runner.stopAll();
    container.eventStreamHub.closeAll();
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    deviceModelId = await seedWirelessDeviceModel(prisma);
    token = await seedAndGetToken(app, prisma, 'ADMIN');
  });

  afterEach(() => {
    diagnosis.runner.stopAll();
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

  describe('[WLS-186] GET /api/devices/:id/wireless/diagnosis/stream', () => {
    const streamPath = (id: string) =>
      `/api/devices/${id}/wireless/diagnosis/stream`;

    it('opens with the full session, then ends with the end frame', async () => {
      const deviceId = await seedDiagnosableDevice(
        prisma,
        deviceModelId,
        {
          ip: '192.168.50.30'
        }
      );
      const started = await diagnosis.start.execute({ deviceId });
      expect(started.isSuccess).toBe(true);
      // let the opening probes land before anyone subscribes
      await new Promise((resolve) => setTimeout(resolve, 50));
      setTimeout(
        () => void diagnosis.stop.execute({ deviceId }),
        300
      );

      const res = await readSseStream(app, streamPath(deviceId), {
        token,
        expectEvents: 2
      });

      expect(res.status).toBe(200);
      expect(res.events.map((e) => e.event)).toEqual([
        'diagnosis',
        'end'
      ]);
      expect(res.events[0].data).toMatchObject({
        deviceId,
        status: 'RUNNING',
        report: { target: { sent: 1, received: 1 } },
        samples: {
          ping: [
            expect.objectContaining({ hop: 'TARGET', latencyMs: 10 })
          ],
          radio: [expect.objectContaining({ ok: true })]
        }
      });
      expect(res.events[1].data).toMatchObject({
        deviceId,
        status: 'STOPPED'
      });
    });

    it('answers 404 as JSON when no session exists', async () => {
      const deviceId = await seedDiagnosableDevice(
        prisma,
        deviceModelId,
        {
          ip: '192.168.50.32'
        }
      );

      const res = await readSseStream(app, streamPath(deviceId), {
        token
      });

      expect(res.status).toBe(404);
      expect(res.events).toHaveLength(0);
    });

    it('rejects a malformed id', async () => {
      const res = await readSseStream(app, streamPath(INVALID_ID), {
        token
      });

      expect(res.status).toBe(400);
    });

    it('rejects a request with no credentials', async () => {
      const res = await request(app).get(streamPath(GHOST_ID));

      expect(res.status).toBe(401);
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
