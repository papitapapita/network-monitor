// Source: src/presentation/http/routes/power-control.routes.ts

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
import {
  FakePoeSwitchReader,
  poweredPort
} from './helpers/FakePoeSwitchReader';
import {
  buildPowerControl,
  seedPoeSwitchModel,
  seedSite,
  seedSiteDevice
} from './helpers/powerControl';
import { DependencyContainer } from '../../src/infrastructure/di/container';
import { PowerControlController } from '../../src/presentation/http/controllers/PowerControlController';

const portsPath = (id: string) => `/api/locations/${id}/poe-ports`;
const sourcePath = (id: string) => `/api/devices/${id}/power-source`;

// Both routes only read, so every role may use them: there is no 403 case.
describe('Power control routes', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let viewerToken: string;
  let towerId: string;
  let rocketId: string;
  const reader = new FakePoeSwitchReader();

  beforeAll(async () => {
    ({ app, container } = await createTestApp((c) => {
      const stack = buildPowerControl(c.getPrisma(), reader);
      c.powerControlController = new PowerControlController(
        stack.listSitePorts,
        stack.getPowerSource,
        c.getLogger()
      );
    }));
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    reader.reset();
    await cleanDatabase(prisma);
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
    towerId = await seedSite(prisma, 'Torre Norte');
    await seedSiteDevice(prisma, {
      name: 'hEX Torre Norte',
      deviceModelId: await seedPoeSwitchModel(prisma, 'ROUTEROS'),
      locationId: towerId,
      ip: '10.0.5.2',
      login: { username: 'admin', password: 'secret' }
    });
    rocketId = await seedSiteDevice(prisma, {
      name: 'Rocket Norte',
      deviceModelId: await seedWirelessDeviceModel(prisma),
      locationId: towerId,
      ip: '10.0.5.21'
    });
    reader.serve('10.0.5.2', [poweredPort('ether2', '10.0.5.21')]);
  });

  const get = (path: string) =>
    request(app)
      .get(path)
      .set('Authorization', `Bearer ${viewerToken}`);

  describe('GET /api/locations/:id/poe-ports', () => {
    it('[PWR-050] should answer 200 with the switches and their ports to a viewer', async () => {
      const res = await get(portsPath(towerId));

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toMatchObject({
        locationId: towerId,
        locationName: 'Torre Norte',
        switches: [
          {
            name: 'hEX Torre Norte',
            ports: [
              {
                port: 'ether2',
                match: { kind: 'MATCHED', deviceId: rocketId }
              }
            ]
          }
        ]
      });
    });

    it('[PWR-050] should not return the switch login', async () => {
      const res = await get(portsPath(towerId));

      expect(JSON.stringify(res.body)).not.toContain('secret');
    });

    it('should answer 404 for an unknown location', async () => {
      const res = await get(portsPath(GHOST_ID));

      expect(res.status).toBe(404);
    });

    it('should answer 400 for a malformed id', async () => {
      const res = await get(portsPath(INVALID_ID));

      expect(res.status).toBe(400);
    });

    it('should answer 401 without a token', async () => {
      const res = await request(app).get(portsPath(towerId));

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/devices/:id/power-source', () => {
    it('should answer 200 with the port that powers the device', async () => {
      const res = await get(sourcePath(rocketId));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        deviceId: rocketId,
        kind: 'FOUND',
        sources: [{ switchName: 'hEX Torre Norte', port: 'ether2' }]
      });
    });

    it('should answer 404 for an unknown device', async () => {
      const res = await get(sourcePath(GHOST_ID));

      expect(res.status).toBe(404);
    });

    it('should answer 400 for a malformed id', async () => {
      const res = await get(sourcePath(INVALID_ID));

      expect(res.status).toBe(400);
    });

    it('should answer 401 without a token', async () => {
      const res = await request(app).get(sourcePath(rocketId));

      expect(res.status).toBe(401);
    });
  });
});
