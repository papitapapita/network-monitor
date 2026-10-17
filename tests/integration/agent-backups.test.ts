// Source: src/presentation/ws/agent/ConnectedAgents.ts (fetchConfig), src/agent/probes/ProbeRunner.ts
// Backups of devices behind an agent, end to end: an install hosted off
// site, its HTTP routes and agent gateway on one server, the real database,
// and the agent's own runtime answering the backup requests. Only the
// agent's ping and the device it reads are faked. Its own suite because the
// enroll limit (10 per 15 minutes per address) is shared by every agent a
// suite starts.

import { Server } from 'http';
import { FakeRouterTrafficReader } from './helpers/FakeRouterTrafficReader';
import { AddressInfo } from 'net';
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { Result } from '../../src/domain/shared/core/Result';
import { BackupFormat } from '../../src/domain/device-backups';
import { DependencyContainer } from '../../src/infrastructure/di/container';
import { AgentRuntime } from '../../src/agent/AgentRuntime';
import { ConfigStore } from '../../src/agent/config/ConfigStore';
import { CredentialStore } from '../../src/agent/identity/CredentialStore';
import { PairingKeySource } from '../../src/agent/identity/PairingKeySource';
import { FilePermissionProtector } from '../../src/agent/identity/SecretProtector';
import { enrollAgent } from '../../src/agent/identity/enrollAgent';
import { PollScheduler } from '../../src/agent/polling/PollScheduler';
import { ResultBuffer } from '../../src/agent/results/ResultBuffer';
import { ProbeRunner } from '../../src/agent/probes/ProbeRunner';
import { EnforceRunner } from '../../src/agent/enforce/EnforceRunner';
import {
  BackendConnection,
  DEFAULT_CONNECTION_OPTIONS
} from '../../src/agent/connection/BackendConnection';
import {
  AGENT_CAPABILITIES,
  AgentCapability,
  formatPairingKey
} from '../../src/agent/protocol';
import { WirelessCollectorRegistry } from '../../src/infrastructure/wireless-monitoring/collectors';
import { ConfigFetcherRegistry } from '../../src/infrastructure/device-backups/fetchers';
import { RouterOsQueueService } from '../../src/infrastructure/service-enforcement/RouterOsQueueService';
import type {
  BackupCredentials,
  FetchedConfig
} from '../../src/application/device-backups/interfaces';
import { AGENT_BACKUP_FAILURES } from '../../src/application/device-backups/services';
import { RunScheduledBackupsUseCase } from '../../src/application/device-backups/use-cases';
import { WinstonLogger } from '../../src/infrastructure/logging/WinstonLogger';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import { cleanDatabase, seedAgent } from './helpers/db';
import {
  FAKE_ROUTEROS_EXPORT,
  seedRouter
} from './helpers/deviceBackups';

const AGENT_VERSION = '0.5.0-test';

describe('Agent backups — end to end, server hosted off site', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let server: Server;
  let backendUrl: string;
  let dataDir: string;
  let runtime: AgentRuntime | null;
  let token: string;
  // The device behind the agent: what it was asked, and what it answers.
  let fetches: Array<{ ip: string; credentials: BackupCredentials }>;
  let answer: Result<FetchedConfig>;

  beforeAll(async () => {
    process.env.SERVER_ON_SITE = 'false';
    try {
      ({ app, container } = await createTestApp());
    } finally {
      delete process.env.SERVER_ON_SITE;
    }
    prisma = container.getPrisma();
    server = app.listen(0);
    container.agentGateway.attach(server);
    await new Promise((resolve) => server.once('listening', resolve));
    backendUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    container.agentGateway.closeAll();
    await new Promise((resolve) => server.close(resolve));
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    token = await seedAndGetToken(app, prisma, 'ADMIN');
    dataDir = mkdtempSync(
      path.join(os.tmpdir(), 'nms-agent-backups-')
    );
    runtime = null;
    fetches = [];
    answer = Result.ok({
      format: BackupFormat.ROUTEROS_EXPORT,
      content: FAKE_ROUTEROS_EXPORT
    });
  });

  afterEach(async () => {
    await runtime?.stop();
    rmSync(dataDir, { recursive: true, force: true });
  });

  async function startAgent(
    pairingKey: string,
    capabilities: readonly AgentCapability[]
  ): Promise<void> {
    const logger = new WinstonLogger({
      component: 'agent-backups-e2e'
    });
    logger.setLevel('error' as never);
    const buffer = await ResultBuffer.open(dataDir, logger);
    const ping = {
      run: async () => ({
        kind: 'measured' as const,
        isReachable: true,
        latencyMs: 7,
        attempts: 1
      })
    };
    runtime = new AgentRuntime({
      credentials: new CredentialStore(
        dataDir,
        new FilePermissionProtector()
      ),
      pairingKey: new PairingKeySource(dataDir, pairingKey),
      enroll: (key) => enrollAgent(key),
      config: new ConfigStore(dataDir),
      buffer,
      scheduler: new PollScheduler(
        ping,
        (result) => buffer.add(result),
        logger,
        { tickMs: 50 }
      ),
      probes: new ProbeRunner(
        ping,
        new WirelessCollectorRegistry({}),
        new ConfigFetcherRegistry([
          {
            vendor: 'mikrotik',
            kinds: ['ACCESS_POINT', 'ROUTER', 'SWITCH'],
            fetcher: {
              fetch: async (ip, credentials) => {
                fetches.push({ ip, credentials });
                return answer;
              }
            }
          }
        ]),
        new FakeRouterTrafficReader(),
        logger
      ),
      enforcer: new EnforceRunner(
        new RouterOsQueueService(logger),
        logger
      ),
      connect: (credentials, callbacks) =>
        new BackendConnection(
          credentials,
          buffer,
          callbacks,
          logger,
          {
            ...DEFAULT_CONNECTION_OPTIONS,
            agentVersion: AGENT_VERSION,
            capabilities,
            flushEveryMs: 50
          }
        ),
      logger
    });
    await runtime.start();
  }

  async function eventually<T>(
    read: () => Promise<T>,
    done: (value: T) => boolean,
    timeoutMs = 8_000
  ): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const value = await read();
      if (done(value)) return value;
      if (Date.now() > deadline) {
        throw new Error(
          `Timed out; last value ${JSON.stringify(value)}`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  // A MikroTik router behind a connected agent. Resolves once the agent has
  // said hello: from then on the backend may send it requests.
  async function routerBehindAgent(
    capabilities: readonly AgentCapability[] = AGENT_CAPABILITIES
  ): Promise<string> {
    const deviceId = await seedRouter(prisma, {
      ip: '192.168.77.1',
      sshPort: 2222
    });
    const agent = await seedAgent(prisma, { name: 'Torre Norte' });
    await prisma.device.update({
      where: { id: deviceId },
      data: { agentId: agent.id }
    });
    await startAgent(
      formatPairingKey({
        backendUrl,
        pairingCode: agent.pairingCode
      }),
      capabilities
    );
    await eventually(
      () => prisma.probeAgent.findUnique({ where: { id: agent.id } }),
      (row) => row?.agentVersion === AGENT_VERSION
    );
    return deviceId;
  }

  const backUpNow = (deviceId: string) =>
    request(app)
      .post(`/api/devices/${deviceId}/backups`)
      .set('Authorization', `Bearer ${token}`);

  describe('[BKP-016] [AGT-114] [AGT-115] a device behind an agent', () => {
    it('201 — a manual backup is read by the agent with the stored login, and saved', async () => {
      const deviceId = await routerBehindAgent();

      const res = await backUpNow(deviceId);

      expect(res.status).toBe(201);
      expect(res.body.backup.format).toBe('ROUTEROS_EXPORT');
      expect(fetches).toEqual([
        {
          ip: '192.168.77.1',
          credentials: {
            username: 'admin',
            password: 'router-secret',
            httpPort: 443,
            sshPort: 2222
          }
        }
      ]);
      const download = await request(app)
        .get(
          `/api/devices/${deviceId}/backups/${res.body.backup.id}/download`
        )
        .set('Authorization', `Bearer ${token}`);
      expect(download.text).toBe(FAKE_ROUTEROS_EXPORT);
    });

    it('502 — passes on why the agent could not read the device', async () => {
      answer = Result.fail(
        'SSH login rejected: check the device username and password'
      );
      const deviceId = await routerBehindAgent();

      const res = await backUpNow(deviceId);

      expect(res.status).toBe(502);
      expect(res.body.error).toContain('SSH login rejected');
      expect(
        await prisma.configBackup.count({ where: { deviceId } })
      ).toBe(0);
    });
  });

  describe('[BKP-015] the nightly run off site', () => {
    it('backs up the devices behind an agent, and leaves out the rest', async () => {
      const deviceId = await routerBehindAgent();
      const unreachable = await seedRouter(prisma, {
        ip: '192.168.77.2'
      });
      // The orchestrator only starts the run from 3:00; the run itself is
      // what is under test.
      const runScheduled = (
        container.configBackupOrchestrator as unknown as {
          runScheduledBackups: RunScheduledBackupsUseCase;
        }
      ).runScheduledBackups;

      const run = await runScheduled.execute({ now: new Date() });

      expect(run.value.saved).toBe(1);
      expect(fetches.map((f) => f.ip)).toEqual(['192.168.77.1']);
      expect(
        await prisma.configBackup.count({ where: { deviceId } })
      ).toBe(1);
      expect(
        await prisma.deviceBackupState.count({
          where: { deviceId: unreachable }
        })
      ).toBe(0);
    });

    it('409 — a manual backup of a device behind no agent is refused', async () => {
      const deviceId = await seedRouter(prisma, {
        ip: '192.168.77.3'
      });

      const res = await backUpNow(deviceId);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('not behind an on-site agent');
    });
  });

  describe('[AGT-113] an agent that does not take backups', () => {
    it('409 — is never sent the login, and the refusal is recorded', async () => {
      const deviceId = await routerBehindAgent(['probe', 'enforce']);

      const res = await backUpNow(deviceId);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain(
        AGENT_BACKUP_FAILURES.PROBE_UNSUPPORTED
      );
      expect(fetches).toHaveLength(0);
      const state = await prisma.deviceBackupState.findUnique({
        where: { deviceId }
      });
      expect(state?.lastError).toBe(
        AGENT_BACKUP_FAILURES.PROBE_UNSUPPORTED
      );
    });
  });
});
