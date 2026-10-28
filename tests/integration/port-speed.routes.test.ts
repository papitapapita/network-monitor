// Source: src/presentation/http/routes/port-speed.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { Result } from '../../src/domain/shared/core';
import { createTestApp } from './helpers/createTestApp';
import { cleanDatabase, GHOST_ID, INVALID_ID } from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import {
  FakeRouterPortReader,
  linkedPort
} from './helpers/FakeRouterPortReader';
import {
  buildPortSpeeds,
  expectedSpeedsOf,
  seedMikrotikModel,
  seedRouter
} from './helpers/portSpeeds';
import { DependencyContainer } from '../../src/infrastructure/di/container';
import { PortSpeedController } from '../../src/presentation/http/controllers/PortSpeedController';

const LIST_PATH = '/api/routers/port-speeds';
const expectedPath = (id: string) =>
  `/api/routers/${id}/port-speeds/expected`;
const acceptPath = (id: string) =>
  `/api/routers/${id}/port-speeds/accept-current`;

describe('Port speed routes', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let viewerToken: string;
  let operatorToken: string;
  let adminToken: string;
  let coreId: string;
  const reader = new FakeRouterPortReader();

  beforeAll(async () => {
    ({ app, container } = await createTestApp((c) => {
      const stack = buildPortSpeeds(c.getPrisma(), reader);
      c.portSpeedController = new PortSpeedController(
        stack.list,
        stack.setExpected,
        stack.acceptCurrent,
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
    operatorToken = await seedAndGetToken(app, prisma, 'OPERATOR');
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
    coreId = await seedRouter(prisma, {
      name: 'Core',
      deviceModelId: await seedMikrotikModel(prisma),
      ip: '10.0.0.1'
    });
    reader.serve(
      '10.0.0.1',
      [linkedPort('ether1', 1000), linkedPort('ether2', 100)],
      'Core-Insetel'
    );
  });

  describe('GET /api/routers/port-speeds', () => {
    it('[MON-140] should answer 200 with every router and its ports to a viewer', async () => {
      const res = await request(app)
        .get(LIST_PATH)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.success).toBe(true);
      expect(res.body.data.checkedAt).toEqual(expect.any(String));
      expect(res.body.data.routers).toEqual([
        expect.objectContaining({
          deviceId: coreId,
          name: 'Core',
          identity: 'Core-Insetel',
          readable: true,
          ports: [
            expect.objectContaining({
              name: 'ether1',
              rateMbps: 1000,
              verdict: 'NO_EXPECTATION'
            }),
            expect.objectContaining({
              name: 'ether2',
              rateMbps: 100,
              verdict: 'NO_EXPECTATION'
            })
          ]
        })
      ]);
    });

    it('should answer 401 without a token', async () => {
      const res = await request(app).get(LIST_PATH);

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/routers/:id/port-speeds/expected', () => {
    const put = (id: string, body: object, token = operatorToken) =>
      request(app)
        .put(expectedPath(id))
        .set('Authorization', `Bearer ${token}`)
        .send(body);

    it('[MON-146] should answer 200 and store the speed for an operator', async () => {
      const res = await put(coreId, {
        portName: 'ether2',
        expectedMbps: 1000
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          deviceId: coreId,
          portName: 'ether2',
          expectedMbps: 1000
        }
      });
      expect(await expectedSpeedsOf(prisma, coreId)).toEqual({
        ether2: 1000
      });
    });

    it('[MON-142] should answer 200 and clear the speed for an admin', async () => {
      await put(coreId, { portName: 'ether2', expectedMbps: 1000 });

      const res = await put(
        coreId,
        { portName: 'ether2', expectedMbps: null },
        adminToken
      );

      expect(res.status).toBe(200);
      expect(res.body.data.expectedMbps).toBeNull();
      expect(await expectedSpeedsOf(prisma, coreId)).toEqual({});
    });

    it('[MON-143] should then show the port as SLOW in the list', async () => {
      await put(coreId, { portName: 'ether2', expectedMbps: 1000 });

      const res = await request(app)
        .get(LIST_PATH)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.body.data.routers[0].ports[1]).toMatchObject({
        name: 'ether2',
        expectedMbps: 1000,
        verdict: 'SLOW'
      });
    });

    it('[MON-146] should answer 403 to a viewer', async () => {
      const res = await put(
        coreId,
        { portName: 'ether2', expectedMbps: 1000 },
        viewerToken
      );

      expect(res.status).toBe(403);
    });

    it('should answer 401 without a token', async () => {
      const res = await request(app)
        .put(expectedPath(coreId))
        .send({ portName: 'ether2', expectedMbps: 1000 });

      expect(res.status).toBe(401);
    });

    it('[MON-142] should answer 400 for a speed ports do not link at', async () => {
      const res = await put(coreId, {
        portName: 'ether2',
        expectedMbps: 500
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/must be one of/);
    });

    it.each([
      ['a missing port name', { expectedMbps: 1000 }],
      ['a blank port name', { portName: '  ', expectedMbps: 1000 }],
      ['a missing speed', { portName: 'ether2' }],
      [
        'a speed as text',
        { portName: 'ether2', expectedMbps: '1000' }
      ]
    ])('should answer 400 for %s', async (_case, body) => {
      const res = await put(coreId, body);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should answer 400 for a malformed id', async () => {
      const res = await put(INVALID_ID, {
        portName: 'ether2',
        expectedMbps: 1000
      });

      expect(res.status).toBe(400);
    });

    it('should answer 404 for a device that is not one of the MikroTiks', async () => {
      const res = await put(GHOST_ID, {
        portName: 'ether2',
        expectedMbps: 1000
      });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/routers/:id/port-speeds/accept-current', () => {
    const post = (id: string, token = operatorToken) =>
      request(app)
        .post(acceptPath(id))
        .set('Authorization', `Bearer ${token}`);

    it('[MON-144] should answer 200 with the router judged against its new speeds', async () => {
      const res = await post(coreId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(
        res.body.data.ports.map(
          (p: {
            name: string;
            expectedMbps: number;
            verdict: string;
          }) => [p.name, p.expectedMbps, p.verdict]
        )
      ).toEqual([
        ['ether1', 1000, 'OK'],
        ['ether2', 100, 'OK']
      ]);
      expect(await expectedSpeedsOf(prisma, coreId)).toEqual({
        ether1: 1000,
        ether2: 100
      });
    });

    it('[MON-146] should answer 403 to a viewer', async () => {
      const res = await post(coreId, viewerToken);

      expect(res.status).toBe(403);
    });

    it('should answer 401 without a token', async () => {
      const res = await request(app).post(acceptPath(coreId));

      expect(res.status).toBe(401);
    });

    it('should answer 400 for a malformed id', async () => {
      expect((await post(INVALID_ID)).status).toBe(400);
    });

    it('should answer 404 for a device that is not one of the MikroTiks', async () => {
      expect((await post(GHOST_ID)).status).toBe(404);
    });

    it('[MON-145] should answer 409 for a router that cannot be read', async () => {
      const noLoginId = await seedRouter(prisma, {
        name: 'No login',
        deviceModelId: await seedMikrotikModel(prisma),
        login: null
      });

      const res = await post(noLoginId);

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(
        /no username and password saved/
      );
    });

    it('[MON-144] should answer 502 when the router does not answer', async () => {
      reader.answer(
        '10.0.0.1',
        Result.fail('RouterOS API error: timeout')
      );

      const res = await post(coreId);

      expect(res.status).toBe(502);
      expect(await expectedSpeedsOf(prisma, coreId)).toEqual({});
    });
  });
});
