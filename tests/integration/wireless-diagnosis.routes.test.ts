// Source: src/presentation/http/routes/wireless-diagnosis.routes.ts

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
import { FakePingService } from './helpers/FakePingService';
import { FakeWirelessCollector } from './helpers/FakeWirelessCollector';
import {
  buildLinkDiagnosis,
  seedDiagnosableDevice,
  LinkDiagnosisStack
} from './helpers/linkDiagnosis';
import { DependencyContainer } from '../../src/infrastructure/di/container';
import { LinkDiagnosisController } from '../../src/presentation/http/controllers/LinkDiagnosisController';

const path = (id: string) => `/api/devices/${id}/wireless/diagnosis`;

describe('Wireless diagnosis routes', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let stack: LinkDiagnosisStack;
  let adminToken: string;
  let deviceModelId: string;
  const ping = new FakePingService();
  const collector = new FakeWirelessCollector();

  beforeAll(async () => {
    ({ app, container } = await createTestApp((c) => {
      // one session at a time so the cap is reachable in a test
      stack = buildLinkDiagnosis(
        c.getPrisma(),
        c.eventStreamHub,
        { ping, collector },
        { maxSessions: 1 }
      );
      c.linkDiagnosisController = new LinkDiagnosisController(
        stack.start,
        stack.get,
        stack.stop,
        c.getLogger()
      );
    }));
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    stack.runner.stopAll();
    await container.disconnect();
  });

  beforeEach(async () => {
    collector.reset();
    await cleanDatabase(prisma);
    deviceModelId = await seedWirelessDeviceModel(prisma);
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
  });

  afterEach(() => {
    stack.runner.stopAll();
  });

  const seedStation = (ip = '192.168.70.10') =>
    seedDiagnosableDevice(prisma, deviceModelId, { ip });

  describe('POST /api/devices/:id/wireless/diagnosis', () => {
    it('should start a diagnosis and answer 201', async () => {
      const deviceId = await seedStation();

      const res = await request(app)
        .post(path(deviceId))
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ durationSeconds: 30 });

      expect(res.status).toBe(201);
      expect(res.body.started).toBe(true);
      expect(res.body.diagnosis).toMatchObject({
        deviceId,
        deviceType: 'STATION',
        status: 'RUNNING',
        durationSeconds: 30,
        target: { ipAddress: '192.168.70.10' },
        parent: null
      });
      expect(res.body.diagnosis.samples).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('secret');
    });

    it('should default to 60 seconds with no body', async () => {
      const deviceId = await seedStation();

      const res = await request(app)
        .post(path(deviceId))
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(201);
      expect(res.body.diagnosis.durationSeconds).toBe(60);
    });

    it('should join a running diagnosis with 200', async () => {
      const deviceId = await seedStation();
      await request(app)
        .post(path(deviceId))
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .post(path(deviceId))
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.started).toBe(false);
    });

    it('should answer 429 past the session cap', async () => {
      const first = await seedStation('192.168.70.10');
      const second = await seedStation('192.168.70.11');
      await request(app)
        .post(path(first))
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .post(path(second))
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(429);
      expect(res.body.error).toBe(
        'Too many diagnosis sessions running'
      );
    });

    it('should answer 404 for a device with no wireless config', async () => {
      const deviceId = await seedDiagnosableDevice(
        prisma,
        deviceModelId,
        {
          ip: '192.168.70.12',
          withConfig: false
        }
      );

      const res = await request(app)
        .post(path(deviceId))
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should answer 404 for an unknown device', async () => {
      const res = await request(app)
        .post(path(GHOST_ID))
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should answer 409 for a device with monitoring disabled', async () => {
      const deviceId = await seedDiagnosableDevice(
        prisma,
        deviceModelId,
        {
          ip: '192.168.70.13',
          monitoringEnabled: false
        }
      );

      const res = await request(app)
        .post(path(deviceId))
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/^Cannot diagnose device/);
    });

    it('should answer 400 without credentials', async () => {
      const deviceId = await seedDiagnosableDevice(
        prisma,
        deviceModelId,
        {
          ip: '192.168.70.14',
          withCredentials: false
        }
      );

      const res = await request(app)
        .post(path(deviceId))
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        'Credentials not configured for device'
      );
    });

    it.each([5, 301, 12.5, '60'])(
      'should answer 400 for durationSeconds %p',
      async (durationSeconds) => {
        const deviceId = await seedStation();

        const res = await request(app)
          .post(path(deviceId))
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ durationSeconds });

        expect(res.status).toBe(400);
      }
    );

    it('should answer 400 for a malformed id', async () => {
      const res = await request(app)
        .post(path(INVALID_ID))
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('should answer 403 for a VIEWER', async () => {
      const deviceId = await seedStation();
      const viewerToken = await seedAndGetToken(
        app,
        prisma,
        'VIEWER'
      );

      const res = await request(app)
        .post(path(deviceId))
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow an OPERATOR', async () => {
      const deviceId = await seedStation();
      const operatorToken = await seedAndGetToken(
        app,
        prisma,
        'OPERATOR'
      );

      const res = await request(app)
        .post(path(deviceId))
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(201);
    });

    it('should answer 401 without a token', async () => {
      const res = await request(app).post(path(GHOST_ID));

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/devices/:id/wireless/diagnosis', () => {
    it('should return the running session with its samples', async () => {
      const deviceId = await seedStation();
      await request(app)
        .post(path(deviceId))
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .get(path(deviceId))
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('RUNNING');
      expect(res.body.samples).toEqual(
        expect.objectContaining({
          ping: expect.any(Array),
          radio: expect.any(Array)
        })
      );
      expect(res.body.report).toEqual(
        expect.objectContaining({
          verdict: expect.any(String),
          faultLocation: expect.any(String),
          findings: expect.any(Array)
        })
      );
    });

    it('should let a VIEWER read a session', async () => {
      const deviceId = await seedStation();
      await request(app)
        .post(path(deviceId))
        .set('Authorization', `Bearer ${adminToken}`);
      const viewerToken = await seedAndGetToken(
        app,
        prisma,
        'VIEWER'
      );

      const res = await request(app)
        .get(path(deviceId))
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
    });

    it('should answer 404 when no session exists', async () => {
      const deviceId = await seedStation();

      const res = await request(app)
        .get(path(deviceId))
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should answer 400 for a malformed id', async () => {
      const res = await request(app)
        .get(path(INVALID_ID))
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('should answer 401 without a token', async () => {
      const res = await request(app).get(path(GHOST_ID));

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/devices/:id/wireless/diagnosis', () => {
    it('should stop a running session and keep it readable', async () => {
      const deviceId = await seedStation();
      await request(app)
        .post(path(deviceId))
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .delete(path(deviceId))
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('STOPPED');
      expect(res.body.endedAt).not.toBeNull();

      const after = await request(app)
        .get(path(deviceId))
        .set('Authorization', `Bearer ${adminToken}`);
      expect(after.body.status).toBe('STOPPED');
    });

    it('should answer 404 when nothing is running', async () => {
      const deviceId = await seedStation();

      const res = await request(app)
        .delete(path(deviceId))
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should answer 403 for a VIEWER', async () => {
      const viewerToken = await seedAndGetToken(
        app,
        prisma,
        'VIEWER'
      );

      const res = await request(app)
        .delete(path(GHOST_ID))
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });

    it('should answer 400 for a malformed id', async () => {
      const res = await request(app)
        .delete(path(INVALID_ID))
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('should answer 401 without a token', async () => {
      const res = await request(app).delete(path(GHOST_ID));

      expect(res.status).toBe(401);
    });
  });
});
