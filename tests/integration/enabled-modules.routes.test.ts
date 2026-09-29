// Source: src/presentation/http/routes/index.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanDatabase,
  seedDevice,
  seedDeviceModel
} from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { DependencyContainer } from '../../src/infrastructure/di/container';

const DISABLED_ROUTES = [
  '/api/customers',
  '/api/service-plans',
  '/api/contracted-services',
  '/api/enforcement/suspensions',
  '/api/bills',
  '/api/collection-accounts',
  '/api/bank-accounts',
  '/api/quotations',
  '/api/tickets',
  '/api/technicians'
];

describe('[INS-005] [INS-006] Routes — monitoring-only install (ENABLED_MODULES=monitoring)', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let adminToken: string;
  const saved = {
    modules: process.env.ENABLED_MODULES,
    router: process.env.ENFORCEMENT_ROUTER_DEVICE_ID
  };

  beforeAll(async () => {
    process.env.ENABLED_MODULES = 'monitoring';
    // Set on purpose: the router variable alone must not wire enforcement.
    process.env.ENFORCEMENT_ROUTER_DEVICE_ID =
      '3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b';
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
    for (const [name, value] of [
      ['ENABLED_MODULES', saved.modules],
      ['ENFORCEMENT_ROUTER_DEVICE_ID', saved.router]
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
  });

  function get(path: string) {
    return request(app)
      .get(path)
      .set('Authorization', `Bearer ${adminToken}`);
  }

  it.each(['/api/devices', '/api/locations', '/api/alerts'])(
    '200 — serves the monitoring route %s',
    async (path) => {
      const res = await get(path);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }
  );

  it.each(DISABLED_ROUTES)(
    "404 — does not mount a disabled module's route %s",
    async (path) => {
      const res = await get(path);

      expect(res.status).toBe(404);
    }
  );

  it('401 — a disabled route still sits behind authentication', async () => {
    const res = await request(app).get('/api/bills');

    expect(res.status).toBe(401);
  });

  it('[SVC-063] wires no enforcement even though a router is configured', () => {
    expect(container.modules.has('enforcement')).toBe(false);
    expect(container.suspensionReconciliationOrchestrator).toBeNull();
    expect(container.enforcementController).toBeNull();
  });

  it('[INS-007] still deletes a device — its contract and ticket checks read empty tables', async () => {
    const deviceId = await seedDevice(
      prisma,
      await seedDeviceModel(prisma)
    );

    const res = await request(app)
      .delete(`/api/devices/${deviceId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
  });

  it('builds no controller for a disabled module', () => {
    expect(container.customerController).toBeNull();
    expect(container.billController).toBeNull();
    expect(container.quotationController).toBeNull();
    expect(container.ticketController).toBeNull();
    expect(container.technicianController).toBeNull();
  });
});
