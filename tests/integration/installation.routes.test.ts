// Source: src/presentation/http/routes/installation.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { cleanDatabase } from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { DependencyContainer } from '../../src/infrastructure/di/container';

const PATH = '/api/installation';

// Builds an app under the given environment, restoring it afterwards: the
// container reads these settings once, at construction.
async function appWith(
  env: Record<string, string | undefined>
): Promise<{ app: Application; container: DependencyContainer }> {
  const saved = Object.fromEntries(
    Object.keys(env).map((name) => [name, process.env[name]])
  );
  const apply = (values: Record<string, string | undefined>) => {
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
  apply(env);
  try {
    return await createTestApp();
  } finally {
    apply(saved);
  }
}

describe('[INS-009] Installation Routes — GET /api/installation', () => {
  describe('a default install', () => {
    let app: Application;
    let container: DependencyContainer;
    let prisma: PrismaClient;

    beforeAll(async () => {
      ({ app, container } = await appWith({
        ENABLED_MODULES: undefined,
        SERVER_ON_SITE: undefined
      }));
      prisma = container.getPrisma();
    });

    afterAll(async () => {
      await container.disconnect();
    });

    beforeEach(async () => {
      await cleanDatabase(prisma);
    });

    it('200 — a VIEWER reads every module on, server on site, pairing available', async () => {
      const token = await seedAndGetToken(app, prisma, 'VIEWER');

      const res = await request(app)
        .get(PATH)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          modules: {
            customers: true,
            billing: true,
            quoting: true,
            tickets: true,
            enforcement: true
          },
          serverOnSite: true,
          agentPairingAvailable: true
        }
      });
    });

    it('401 — rejects a request with no Authorization header', async () => {
      const res = await request(app).get(PATH);

      expect(res.status).toBe(401);
    });
  });

  describe('a monitoring-only install hosted off site, without pairing', () => {
    let app: Application;
    let container: DependencyContainer;
    let prisma: PrismaClient;

    beforeAll(async () => {
      ({ app, container } = await appWith({
        ENABLED_MODULES: 'monitoring,tickets',
        SERVER_ON_SITE: 'false',
        AGENT_PUBLIC_URL: ''
      }));
      prisma = container.getPrisma();
    });

    afterAll(async () => {
      await container.disconnect();
    });

    it('200 — reports exactly what it runs', async () => {
      await cleanDatabase(prisma);
      const token = await seedAndGetToken(app, prisma, 'ADMIN');

      const res = await request(app)
        .get(PATH)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        modules: {
          customers: false,
          billing: false,
          quoting: false,
          tickets: true,
          enforcement: false
        },
        serverOnSite: false,
        agentPairingAvailable: false
      });
    });
  });
});
