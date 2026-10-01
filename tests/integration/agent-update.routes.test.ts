// Source: src/presentation/http/routes/agent-update.routes.ts
// Agents download release binaries with their own token, never a user's JWT.
// The release folder is a fake (the real catalogue checks the vendor's
// signature, which a test cannot produce); authentication is real.

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { cleanAgents, cleanDatabase, seedAgent } from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { FakeAgentReleaseCatalog } from './helpers/FakeAgentReleaseCatalog';
import { DependencyContainer } from '../../src/infrastructure/di/container';
import { AgentUpdateController } from '../../src/presentation/http/controllers';
import {
  AuthenticateAgentUseCase,
  OpenAgentReleaseFileUseCase
} from '../../src/application/probe-agents/use-cases';
import { PrismaAgentRepository } from '../../src/infrastructure/probe-agents/repositories';
import { NodeAgentSecretService } from '../../src/infrastructure/probe-agents/crypto';

const FILE = 'nms-agent-0.2.1-win-x64.gz';

describe('Agent Update Routes — /agent/v1/updates', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  const releases = new FakeAgentReleaseCatalog();

  beforeAll(async () => {
    ({ app, container } = await createTestApp((c) => {
      const logger = c.getLogger();
      c.agentUpdateController = new AgentUpdateController(
        new AuthenticateAgentUseCase(
          new PrismaAgentRepository(c.getPrisma()),
          new NodeAgentSecretService(),
          logger
        ),
        new OpenAgentReleaseFileUseCase(releases, logger),
        logger
      );
    }));
    prisma = container.getPrisma();
    releases.publish('0.2.1', 'win-x64');
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanAgents(prisma);
  });

  const download = (fileName: string, token?: string) => {
    const req = request(app).get(`/agent/v1/updates/${fileName}`);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  it('[AGT-083] 200 — streams the binary to an active agent', async () => {
    const { token } = await seedAgent(prisma, { status: 'ACTIVE' });

    const res = await download(FILE, token).buffer(true);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/gzip');
    expect(res.headers['content-length']).toBe(
      String(Buffer.byteLength('binary 0.2.1'))
    );
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.toString()).toBe('binary 0.2.1');
  });

  describe('[AGT-083] 401', () => {
    it('without a token', async () => {
      expect((await download(FILE)).status).toBe(401);
    });

    it('with a token nobody holds', async () => {
      expect((await download(FILE, 'forged')).status).toBe(401);
    });

    it('with a revoked agent’s token', async () => {
      const { token } = await seedAgent(prisma, {
        status: 'ACTIVE',
        token: 'was-valid'
      });
      await prisma.probeAgent.updateMany({
        data: {
          status: 'REVOKED',
          tokenHash: null,
          revokedAt: new Date()
        }
      });

      expect((await download(FILE, token)).status).toBe(401);
    });

    it('with a user’s JWT, even the vendor’s', async () => {
      await cleanDatabase(prisma);
      const jwt = await seedAndGetToken(app, prisma, 'VENDOR');

      expect((await download(FILE, jwt)).status).toBe(401);
    });

    it('before looking at the file name', async () => {
      expect((await download('..%2Fsecrets')).status).toBe(401);
    });
  });

  it('[AGT-083] 400 — a name that is not a release binary', async () => {
    const { token } = await seedAgent(prisma, { status: 'ACTIVE' });

    const res = await download('nms-agent-setup-0.2.1.exe', token);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('[AGT-083] 404 — a release binary no manifest lists', async () => {
    const { token } = await seedAgent(prisma, { status: 'ACTIVE' });

    const res = await download('nms-agent-0.9.9-win-x64.gz', token);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: 'Release file not found'
    });
  });
});
