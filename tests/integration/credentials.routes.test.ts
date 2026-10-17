// Source: src/presentation/http/routes/credentials.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import {
  cleanDatabase,
  seedDevice,
  seedDeviceModel,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { DependencyContainer } from '../../src/infrastructure/di/container';

const HTTP_LOGIN = {
  httpUsername: 'ubnt',
  httpPassword: 'super-secret'
};
const SNMP_V2 = { snmpVersion: 2, snmpCommunity: 'public-ro' };

describe('Credentials Routes', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let adminToken: string;
  let operatorToken: string;
  let viewerToken: string;
  let deviceId: string;

  const url = (id: string) => `/api/devices/${id}/credentials`;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
    operatorToken = await seedAndGetToken(app, prisma, 'OPERATOR');
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
    deviceId = await seedDevice(
      prisma,
      await seedDeviceModel(prisma)
    );
  });

  describe('PUT /api/devices/:id/credentials', () => {
    it('200 — saves an HTTP login and answers it masked, with no envelope', async () => {
      const res = await request(app)
        .put(url(deviceId))
        .set('Authorization', `Bearer ${adminToken}`)
        .send(HTTP_LOGIN);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        deviceId,
        httpUsername: 'ubnt',
        httpPassword: '***',
        hasHttpCredentials: true,
        hasSnmpCredentials: false
      });
      expect(res.body.success).toBeUndefined();
    });

    it('[DEV-133] 200 — saves SNMP alone, as a Mimosa has', async () => {
      const res = await request(app)
        .put(url(deviceId))
        .set('Authorization', `Bearer ${adminToken}`)
        .send(SNMP_V2);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        snmpVersion: 2,
        snmpCommunity: '***',
        httpUsername: null,
        hasHttpCredentials: false,
        hasSnmpCredentials: true
      });
    });

    it('[DEV-133] 400 — rejects a body with neither HTTP nor SNMP', async () => {
      const res = await request(app)
        .put(url(deviceId))
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'An HTTP login or SNMP access is required'
      });
    });

    it('[DEV-120] 400 — rejects a username without its password', async () => {
      const res = await request(app)
        .put(url(deviceId))
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ httpUsername: 'ubnt' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'httpUsername and httpPassword must be set together'
      });
    });

    it('[DEV-127] 400 — rejects an out-of-range port', async () => {
      const res = await request(app)
        .put(url(deviceId))
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...HTTP_LOGIN, httpPort: 70000 });

      expect(res.status).toBe(400);
    });

    it('[DEV-121] 404 — rejects a device that does not exist', async () => {
      const res = await request(app)
        .put(url(GHOST_ID))
        .set('Authorization', `Bearer ${adminToken}`)
        .send(HTTP_LOGIN);

      expect(res.status).toBe(404);
    });

    it('400 — rejects a malformed device id', async () => {
      const res = await request(app)
        .put(url(INVALID_ID))
        .set('Authorization', `Bearer ${adminToken}`)
        .send(HTTP_LOGIN);

      expect(res.status).toBe(400);
    });

    it('403 — an operator cannot write credentials', async () => {
      const res = await request(app)
        .put(url(deviceId))
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(HTTP_LOGIN);

      expect(res.status).toBe(403);
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app)
        .put(url(deviceId))
        .send(HTTP_LOGIN);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/devices/:id/credentials', () => {
    it('[DEV-128] 200 — a viewer reads the saved credentials, secrets masked', async () => {
      await request(app)
        .put(url(deviceId))
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...HTTP_LOGIN, ...SNMP_V2 });

      const res = await request(app)
        .get(url(deviceId))
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        httpPassword: '***',
        snmpCommunity: '***',
        hasHttpCredentials: true,
        hasSnmpCredentials: true
      });
      expect(JSON.stringify(res.body)).not.toContain('super-secret');
      expect(JSON.stringify(res.body)).not.toContain('public-ro');
    });

    it('[DEV-131] 404 — a device with no credentials saved', async () => {
      const res = await request(app)
        .get(url(deviceId))
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: 'No credentials configured for this device'
      });
    });

    it('400 — rejects a malformed device id', async () => {
      const res = await request(app)
        .get(url(INVALID_ID))
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(400);
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app).get(url(deviceId));

      expect(res.status).toBe(401);
    });
  });

  describe('[DEV-134] POST /api/devices/:id/credentials/reveal', () => {
    const PASSWORD = 'integration-test-pass';
    const reveal = (
      id: string,
      token: string,
      revealToken?: string
    ) => {
      const req = request(app)
        .post(`${url(id)}/reveal`)
        .set('Authorization', `Bearer ${token}`);
      return revealToken
        ? req.set('X-Credential-Reveal-Token', revealToken)
        : req;
    };
    const unlock = async (token: string) => {
      const res = await request(app)
        .post('/api/users/me/credential-reveal')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD });
      expect(res.status).toBe(200);
      return res.body.data.revealToken as string;
    };
    const saveAll = () =>
      request(app)
        .put(url(deviceId))
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...HTTP_LOGIN, ...SNMP_V2 });

    it('200 — an unlocked operator sees the secrets in plaintext, uncached', async () => {
      await saveAll();

      const res = await reveal(
        deviceId,
        operatorToken,
        await unlock(operatorToken)
      );

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toEqual({
        deviceId,
        snmpVersion: 2,
        snmpCommunity: 'public-ro',
        snmpV3AuthUser: null,
        snmpV3AuthProto: null,
        snmpV3AuthKey: null,
        snmpV3PrivProto: null,
        snmpV3PrivKey: null,
        snmpPort: 161,
        httpUsername: 'ubnt',
        httpPassword: 'super-secret',
        httpPort: 443,
        sshPort: 22,
        apiPort: 8728
      });
    });

    it('[IDN-086] one unlock opens every device for its five minutes', async () => {
      await saveAll();
      const revealToken = await unlock(adminToken);

      const first = await reveal(deviceId, adminToken, revealToken);
      const again = await reveal(deviceId, adminToken, revealToken);

      expect(first.status).toBe(200);
      expect(again.status).toBe(200);
    });

    it('[IDN-086] 403 — without an unlock', async () => {
      await saveAll();

      const res = await reveal(deviceId, operatorToken);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe(
        'Enter your password to see device credentials'
      );
      expect(JSON.stringify(res.body)).not.toContain('super-secret');
    });

    it("[IDN-086] 403 — with another user's unlock", async () => {
      await saveAll();

      const res = await reveal(
        deviceId,
        operatorToken,
        await unlock(adminToken)
      );

      expect(res.status).toBe(403);
    });

    it('[IDN-086] 403 — with a session token in place of an unlock', async () => {
      await saveAll();

      const res = await reveal(
        deviceId,
        operatorToken,
        operatorToken
      );

      expect(res.status).toBe(403);
    });

    it('[IDN-035] 403 — a viewer cannot reveal credentials', async () => {
      await saveAll();

      const res = await reveal(deviceId, viewerToken);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('[DEV-131] 404 — a device with no credentials saved', async () => {
      const res = await reveal(
        deviceId,
        operatorToken,
        await unlock(operatorToken)
      );

      expect(res.status).toBe(404);
    });

    it('400 — rejects a malformed device id', async () => {
      const res = await reveal(
        INVALID_ID,
        operatorToken,
        await unlock(operatorToken)
      );

      expect(res.status).toBe(400);
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app).post(`${url(deviceId)}/reveal`);

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/devices/:id/credentials', () => {
    it('204 — removes the saved credentials', async () => {
      await request(app)
        .put(url(deviceId))
        .set('Authorization', `Bearer ${adminToken}`)
        .send(HTTP_LOGIN);

      const res = await request(app)
        .delete(url(deviceId))
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
      expect(
        await prisma.deviceCredentials.findUnique({
          where: { deviceId }
        })
      ).toBeNull();
    });

    it('[DEV-132] 204 — succeeds when nothing was saved', async () => {
      const res = await request(app)
        .delete(url(deviceId))
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });

    it('403 — an operator cannot delete credentials', async () => {
      const res = await request(app)
        .delete(url(deviceId))
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(403);
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app).delete(url(deviceId));

      expect(res.status).toBe(401);
    });
  });
});
