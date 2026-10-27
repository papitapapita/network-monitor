// Source: src/presentation/http/routes/device-backup.routes.ts

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
import { seedDiagnosableDevice } from './helpers/linkDiagnosis';
import {
  FakeConfigFetcher,
  FAKE_AIROS_CONFIG
} from './helpers/FakeConfigFetcher';
import { buildDeviceBackups } from './helpers/deviceBackups';
import { DependencyContainer } from '../../src/infrastructure/di/container';
import { DeviceBackupController } from '../../src/presentation/http/controllers/DeviceBackupController';

const path = (id: string) => `/api/devices/${id}/backups`;
const downloadPath = (id: string, backupId: string) =>
  `${path(id)}/${backupId}/download`;

describe('Device backup routes', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let adminToken: string;
  let operatorToken: string;
  let viewerToken: string;
  let deviceModelId: string;
  const fetcher = new FakeConfigFetcher();

  beforeAll(async () => {
    ({ app, container } = await createTestApp((c) => {
      const stack = buildDeviceBackups(c.getPrisma(), fetcher);
      c.deviceBackupController = new DeviceBackupController(
        stack.list,
        stack.backUpNow,
        stack.download,
        c.getLogger()
      );
    }));
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    fetcher.reset();
    await cleanDatabase(prisma);
    deviceModelId = await seedWirelessDeviceModel(prisma);
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
    operatorToken = await seedAndGetToken(app, prisma, 'OPERATOR');
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
  });

  const seedAp = (opts: { withCredentials?: boolean } = {}) =>
    seedDiagnosableDevice(prisma, deviceModelId, {
      ip: '10.0.0.10',
      deviceType: 'ACCESS_POINT',
      ...opts
    });

  const backUp = (deviceId: string, token = adminToken) =>
    request(app)
      .post(path(deviceId))
      .set('Authorization', `Bearer ${token}`);

  describe('POST /api/devices/:id/backups', () => {
    it('should answer 201 with the new version', async () => {
      const deviceId = await seedAp();

      const res = await backUp(deviceId, operatorToken);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        outcome: 'SAVED',
        backup: { deviceId, format: 'AIROS_CFG', trigger: 'MANUAL' }
      });
      expect(res.body.backup).not.toHaveProperty('content');
    });

    it('should answer 200 when the device still holds the last version', async () => {
      const deviceId = await seedAp();
      await backUp(deviceId);

      const res = await backUp(deviceId);

      expect(res.status).toBe(200);
      expect(res.body.outcome).toBe('UNCHANGED');
    });

    it('[BKP-051] should answer 409 when the device cannot be backed up', async () => {
      const deviceId = await seedAp({ withCredentials: false });

      const res = await backUp(deviceId);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe(
        'Cannot back up this device: No HTTP credentials are configured for this device'
      );
    });

    it('[BKP-051] should answer 502 when the device fails', async () => {
      const deviceId = await seedAp();
      fetcher.fail('HTTPS_TIMEOUT (10.0.0.10:443)');

      const res = await backUp(deviceId);

      expect(res.status).toBe(502);
      expect(res.body.error).toBe(
        'Backup failed: HTTPS_TIMEOUT (10.0.0.10:443)'
      );
    });

    it('should answer 404 for an unknown device', async () => {
      const res = await backUp(GHOST_ID);

      expect(res.status).toBe(404);
    });

    it('should answer 400 for a malformed id', async () => {
      const res = await backUp(INVALID_ID);

      expect(res.status).toBe(400);
    });

    it('[BKP-041] should answer 403 to a viewer', async () => {
      const deviceId = await seedAp();

      const res = await backUp(deviceId, viewerToken);

      expect(res.status).toBe(403);
      expect(fetcher.calls).toHaveLength(0);
    });

    it('should answer 401 without a token', async () => {
      const res = await request(app).post(path(GHOST_ID));

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/devices/:id/backups', () => {
    it('[BKP-042] should list versions and state to a viewer, without the file', async () => {
      const deviceId = await seedAp();
      await backUp(deviceId);

      const res = await request(app)
        .get(path(deviceId))
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.backups).toHaveLength(1);
      expect(res.body.state.lastOutcome).toBe('SAVED');
      expect(JSON.stringify(res.body)).not.toContain('radio.1.mode');
    });

    it('should answer 404 for an unknown device', async () => {
      const res = await request(app)
        .get(path(GHOST_ID))
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

  describe('GET /api/devices/:id/backups/:backupId/download', () => {
    const seedBackup = async () => {
      const deviceId = await seedAp();
      const saved = await backUp(deviceId);
      return { deviceId, backupId: saved.body.backup.id as string };
    };

    it('[BKP-043] should send the file as an attachment that is not cached', async () => {
      const { deviceId, backupId } = await seedBackup();

      const res = await request(app)
        .get(downloadPath(deviceId, backupId))
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.text).toBe(FAKE_AIROS_CONFIG);
      expect(res.headers['content-type']).toBe(
        'text/plain; charset=utf-8'
      );
      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename="Radio-10-0-0-10-\d{8}-\d{4}Z\.cfg"$/
      );
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('[BKP-041] should answer 403 to an operator', async () => {
      const { deviceId, backupId } = await seedBackup();

      const res = await request(app)
        .get(downloadPath(deviceId, backupId))
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(403);
    });

    it('should answer 404 for an unknown backup', async () => {
      const { deviceId } = await seedBackup();

      const res = await request(app)
        .get(downloadPath(deviceId, GHOST_ID))
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Backup not found');
    });

    it('should answer 400 for a malformed backup id', async () => {
      const deviceId = await seedAp();

      const res = await request(app)
        .get(downloadPath(deviceId, INVALID_ID))
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('should answer 401 without a token', async () => {
      const res = await request(app).get(
        downloadPath(GHOST_ID, GHOST_ID)
      );

      expect(res.status).toBe(401);
    });
  });
});
