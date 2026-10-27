// Source: src/presentation/http/routes/radio-settings.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { RadioSettingsController } from '../../src/presentation/http/controllers';
import { DependencyContainer } from '../../src/infrastructure/di/container';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import {
  cleanAgents,
  cleanDatabase,
  GHOST_ID,
  INVALID_ID,
  seedAgent,
  seedWirelessDeviceModel
} from './helpers/db';
import { seedDiagnosableDevice } from './helpers/linkDiagnosis';
import {
  FakeAgentRadioSettings,
  FakeRadio
} from './helpers/FakeRadio';
import {
  AP_CONFIG,
  buildRadioSettings
} from './helpers/radioSettings';

describe('Radio Settings Routes', () => {
  const PASSWORD = 'integration-test-pass';
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let adminToken: string;
  let operatorToken: string;
  let viewerToken: string;
  let deviceModelId: string;
  const radio = new FakeRadio();
  const agent = new FakeAgentRadioSettings();

  beforeAll(async () => {
    ({ app, container } = await createTestApp((c) => {
      const stack = buildRadioSettings(c.getPrisma(), radio, agent, {
        serverOnSite: false
      });
      c.radioSettingsController = new RadioSettingsController(
        stack.reveal,
        stack.rename,
        c.getLogger()
      );
    }));
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await cleanAgents(prisma);
    await cleanDatabase(prisma);
    await container.disconnect();
  });

  beforeEach(async () => {
    radio.reset();
    agent.reset();
    await cleanAgents(prisma);
    await cleanDatabase(prisma);
    deviceModelId = await seedWirelessDeviceModel(prisma);
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
    operatorToken = await seedAndGetToken(app, prisma, 'OPERATOR');
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
  });

  // The stack runs off site, so every radio is reached through its agent.
  const seedRadioBehindAgent = async (
    opts: { withCredentials?: boolean } = {}
  ) => {
    const deviceId = await seedDiagnosableDevice(
      prisma,
      deviceModelId,
      {
        ip: '10.0.0.10',
        deviceType: 'ACCESS_POINT',
        ...opts
      }
    );
    const seeded = await seedAgent(prisma, { status: 'ACTIVE' });
    await prisma.device.update({
      where: { id: deviceId },
      data: { agentId: seeded.id }
    });
    return deviceId;
  };

  describe('[WLS-220] POST /api/devices/:id/wireless/key/reveal', () => {
    const path = (id: string) =>
      `/api/devices/${id}/wireless/key/reveal`;
    const unlock = async (token: string) => {
      const res = await request(app)
        .post('/api/users/me/credential-reveal')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD });
      expect(res.status).toBe(200);
      return res.body.data.revealToken as string;
    };
    const reveal = (
      id: string,
      token: string,
      revealToken?: string
    ) => {
      const req = request(app)
        .post(path(id))
        .set('Authorization', `Bearer ${token}`);
      return revealToken
        ? req.set('X-Credential-Reveal-Token', revealToken)
        : req;
    };

    it('200 — an unlocked operator sees the key in plaintext, uncached, with no envelope', async () => {
      const deviceId = await seedRadioBehindAgent();
      agent.config = { ok: true, value: AP_CONFIG };

      const res = await reveal(
        deviceId,
        operatorToken,
        await unlock(operatorToken)
      );

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toEqual({
        deviceId,
        role: 'ACCESS_POINT',
        ssid: 'AP NORTE 1',
        security: 'WPA_PSK',
        key: 'clave-del-ap',
        readAt: expect.any(String)
      });
    });

    it('[IDN-086] 403 — without an unlock, and the radio is never read', async () => {
      const deviceId = await seedRadioBehindAgent();

      const res = await reveal(deviceId, operatorToken);

      expect(res.status).toBe(403);
      expect(agent.calls).toHaveLength(0);
    });

    it('[IDN-035] 403 — a viewer cannot reveal the key', async () => {
      const deviceId = await seedRadioBehindAgent();

      const res = await reveal(deviceId, viewerToken);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('409 — the agent is not connected', async () => {
      const deviceId = await seedRadioBehindAgent();

      const res = await reveal(
        deviceId,
        adminToken,
        await unlock(adminToken)
      );

      expect(res.status).toBe(409);
      expect(res.body.error).toContain(
        'its on-site agent is not connected'
      );
    });

    it('504 — the agent did not answer in time', async () => {
      const deviceId = await seedRadioBehindAgent();
      agent.config = {
        ok: false,
        reason: 'TIMEOUT',
        error: 'The agent did not answer in time'
      };

      const res = await reveal(
        deviceId,
        adminToken,
        await unlock(adminToken)
      );

      expect(res.status).toBe(504);
    });

    it('502 — the agent could not reach the radio', async () => {
      const deviceId = await seedRadioBehindAgent();
      agent.config = {
        ok: false,
        reason: 'AGENT_ERROR',
        error: 'Authentication failed: HTTP 401'
      };

      const res = await reveal(
        deviceId,
        adminToken,
        await unlock(adminToken)
      );

      expect(res.status).toBe(502);
    });

    it('[WLS-225] 409 — off site, a radio with no agent', async () => {
      const deviceId = await seedDiagnosableDevice(
        prisma,
        deviceModelId,
        {
          ip: '10.0.0.11'
        }
      );

      const res = await reveal(
        deviceId,
        adminToken,
        await unlock(adminToken)
      );

      expect(res.status).toBe(409);
    });

    it('400 — the device has no HTTP login', async () => {
      const deviceId = await seedRadioBehindAgent({
        withCredentials: false
      });

      const res = await reveal(
        deviceId,
        adminToken,
        await unlock(adminToken)
      );

      expect(res.status).toBe(400);
    });

    it('400 — rejects a malformed device id', async () => {
      const res = await reveal(
        INVALID_ID,
        adminToken,
        await unlock(adminToken)
      );

      expect(res.status).toBe(400);
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app).post(path(GHOST_ID));

      expect(res.status).toBe(401);
    });
  });

  describe('[WLS-224] PUT /api/devices/:id/wireless/hostname', () => {
    const path = (id: string) =>
      `/api/devices/${id}/wireless/hostname`;
    const rename = (id: string, token: string, body: object) =>
      request(app)
        .put(path(id))
        .set('Authorization', `Bearer ${token}`)
        .send(body);

    it('200 — an operator renames the radio through its agent', async () => {
      const deviceId = await seedRadioBehindAgent();
      agent.rename = { ok: true, value: undefined };

      const res = await rename(deviceId, operatorToken, {
        hostname: 'AP Norte 2'
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        deviceId,
        hostname: 'AP Norte 2',
        renamedAt: expect.any(String)
      });
      expect(agent.calls).toMatchObject([{ hostname: 'AP Norte 2' }]);
    });

    it('[WLS-223] 400 — a name AirOS cannot take', async () => {
      const deviceId = await seedRadioBehindAgent();

      const res = await rename(deviceId, adminToken, {
        hostname: 'AP Peña'
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('must be letters');
      expect(agent.calls).toHaveLength(0);
    });

    it('400 — a body with no name', async () => {
      const deviceId = await seedRadioBehindAgent();

      const res = await rename(deviceId, adminToken, {});

      expect(res.status).toBe(400);
    });

    it('[AGT-120] 409 — the agent must be updated first', async () => {
      const deviceId = await seedRadioBehindAgent();
      agent.rename = {
        ok: false,
        reason: 'PROBE_UNSUPPORTED',
        error: 'The agent must be updated to rename radios'
      };

      const res = await rename(deviceId, adminToken, {
        hostname: 'AP Norte 2'
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('must be updated');
    });

    it('404 — a device with no wireless config', async () => {
      const deviceId = await seedDiagnosableDevice(
        prisma,
        deviceModelId,
        {
          ip: '10.0.0.12',
          withConfig: false
        }
      );
      const seeded = await seedAgent(prisma, { status: 'ACTIVE' });
      await prisma.device.update({
        where: { id: deviceId },
        data: { agentId: seeded.id }
      });

      const res = await rename(deviceId, adminToken, {
        hostname: 'AP Norte 2'
      });

      expect(res.status).toBe(404);
    });

    it('403 — a viewer cannot rename a radio', async () => {
      const deviceId = await seedRadioBehindAgent();

      const res = await rename(deviceId, viewerToken, {
        hostname: 'AP Norte 2'
      });

      expect(res.status).toBe(403);
    });

    it('400 — rejects a malformed device id', async () => {
      const res = await rename(INVALID_ID, adminToken, {
        hostname: 'AP Norte 2'
      });

      expect(res.status).toBe(400);
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app)
        .put(path(GHOST_ID))
        .send({ hostname: 'AP Norte 2' });

      expect(res.status).toBe(401);
    });
  });
});
