// Source: src/presentation/http/routes/installation.routes.ts

import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
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
        SERVER_ON_SITE: undefined,
        INSTALLERS_DIR: undefined
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
          agentPairingAvailable: true,
          installersAvailable: false
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
        agentPairingAvailable: false,
        installersAvailable: false
      });
    });
  });

  describe('[INS-042] installers — GET /api/installation/installers', () => {
    const INSTALLERS = `${PATH}/installers`;
    const EXE = 'nms-agent-setup-0.1.0.exe';
    let dir: string;
    let app: Application;
    let container: DependencyContainer;
    let prisma: PrismaClient;
    let token: string;

    beforeAll(async () => {
      dir = await mkdtemp(join(tmpdir(), 'nms-installers-'));
      await writeFile(join(dir, EXE), 'windows installer');
      await writeFile(
        join(dir, 'nms-agent-0.1.0-linux-x64.tar.gz'),
        'tgz'
      );
      await writeFile(join(dir, 'notes.txt'), 'not an installer');
      ({ app, container } = await appWith({ INSTALLERS_DIR: dir }));
      prisma = container.getPrisma();
      await cleanDatabase(prisma);
      token = await seedAndGetToken(app, prisma, 'VIEWER');
    });

    afterAll(async () => {
      await container.disconnect();
      await rm(dir, { recursive: true, force: true });
    });

    const get = (path: string) =>
      request(app).get(path).set('Authorization', `Bearer ${token}`);

    it('200 — reports installers as available', async () => {
      const res = await get(PATH);

      expect(res.body.data.installersAvailable).toBe(true);
    });

    it('200 — a VIEWER lists the installers, nothing else', async () => {
      const res = await get(INSTALLERS);

      expect(res.status).toBe(200);
      expect(
        res.body.data.installers
          .map((i: { fileName: string }) => i.fileName)
          .sort()
      ).toEqual(['nms-agent-0.1.0-linux-x64.tar.gz', EXE]);
      expect(res.body.data.installers).toContainEqual({
        fileName: EXE,
        platform: 'windows',
        version: '0.1.0',
        sizeBytes: 17,
        modifiedAt: expect.any(String)
      });
    });

    it('200 — downloads an installer as an attachment', async () => {
      const res = await get(`${INSTALLERS}/${EXE}`)
        .buffer(true)
        .parse((response, done) => {
          const chunks: Buffer[] = [];
          response.on('data', (c: Buffer) => chunks.push(c));
          response.on('end', () => done(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe(
        'application/octet-stream'
      );
      expect(res.headers['content-disposition']).toBe(
        `attachment; filename="${EXE}"`
      );
      expect(res.headers['content-length']).toBe('17');
      expect((res.body as Buffer).toString()).toBe(
        'windows installer'
      );
    });

    it('[INS-043] 404 — a file in the folder that is not an installer', async () => {
      const res = await get(`${INSTALLERS}/notes.txt`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Installer not found: notes.txt');
    });

    it.each(['..%2F..%2Fetc%2Fpasswd', '.env', '..%5Cwin.ini'])(
      '[INS-043] 400 — refuses %s as a file name',
      async (name) => {
        const res = await get(`${INSTALLERS}/${name}`);

        expect(res.status).toBe(400);
      }
    );

    it('401 — downloads need a token', async () => {
      const res = await request(app).get(`${INSTALLERS}/${EXE}`);

      expect(res.status).toBe(401);
    });
  });

  describe('[INS-042] installers on an install without INSTALLERS_DIR', () => {
    let app: Application;
    let container: DependencyContainer;
    let token: string;

    beforeAll(async () => {
      ({ app, container } = await appWith({
        INSTALLERS_DIR: undefined
      }));
      const prisma = container.getPrisma();
      await cleanDatabase(prisma);
      token = await seedAndGetToken(app, prisma, 'ADMIN');
    });

    afterAll(async () => {
      await container.disconnect();
    });

    it.each([
      '/api/installation/installers',
      '/api/installation/installers/nms-agent-setup-0.1.0.exe'
    ])('503 — %s', async (path) => {
      const res = await request(app)
        .get(path)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(503);
      expect(res.body.error).toBe(
        'Installer downloads are not configured on this install'
      );
    });
  });

  describe('[INS-042] installers and the subscription', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const lastPaidDayAgo = (days: number) =>
      new Date(Date.now() - 5 * 60 * 60 * 1000 - days * DAY_MS)
        .toISOString()
        .slice(0, 10);
    const EXE = 'nms-agent-setup-0.1.0.exe';
    let dir: string;

    beforeAll(async () => {
      dir = await mkdtemp(join(tmpdir(), 'nms-installers-'));
      await writeFile(join(dir, EXE), 'windows installer');
    });

    afterAll(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    const bootAt = async (daysSincePaid: number) => {
      const built = await appWith({
        INSTALLERS_DIR: dir,
        SUBSCRIPTION_PAID_UNTIL: lastPaidDayAgo(daysSincePaid),
        SUBSCRIPTION_GRACE_DAYS: '3',
        SUBSCRIPTION_READ_ONLY_DAYS: '7'
      });
      const prisma = built.container.getPrisma();
      await cleanDatabase(prisma);
      const token = await seedAndGetToken(built.app, prisma, 'ADMIN');
      return { ...built, token };
    };

    it('200 — a read-only install still hands out installers', async () => {
      const { app, container, token } = await bootAt(6);
      try {
        const list = await request(app)
          .get('/api/installation/installers')
          .set('Authorization', `Bearer ${token}`);
        const download = await request(app)
          .get(`/api/installation/installers/${EXE}`)
          .set('Authorization', `Bearer ${token}`);

        expect(list.status).toBe(200);
        expect(download.status).toBe(200);
      } finally {
        await container.disconnect();
      }
    });

    it('402 — a locked install refuses them', async () => {
      const { app, container, token } = await bootAt(30);
      try {
        const res = await request(app)
          .get(`/api/installation/installers/${EXE}`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(402);
      } finally {
        await container.disconnect();
      }
    });
  });
});
