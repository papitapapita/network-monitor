// Source: src/presentation/ws/agent/ConnectedAgents.ts (printRouterOs), src/agent/probes/ProbeRunner.ts
// RouterOS reads through an agent, end to end: an install hosted off site,
// its HTTP routes and agent gateway on one server, the real database, and
// the agent's own runtime with the real RouterOS printer answering the
// requests. Only the agent's ping and the router's API session are faked.
// Its own suite because the enroll limit (10 per 15 minutes per address) is
// shared by every agent a suite starts.

import request from 'supertest';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { DependencyContainer } from '../../src/infrastructure/di/container';
import { AgentRuntime } from '../../src/agent/AgentRuntime';
import { ConfigStore } from '../../src/agent/config/ConfigStore';
import { CredentialStore } from '../../src/agent/identity/CredentialStore';
import { PairingKeySource } from '../../src/agent/identity/PairingKeySource';
import { FilePermissionProtector } from '../../src/agent/identity/SecretProtector';
import { enrollAgent } from '../../src/agent/identity/enrollAgent';
import { PollScheduler } from '../../src/agent/polling/PollScheduler';
import { ResultBuffer } from '../../src/agent/results/ResultBuffer';
import {
  DEFAULT_PROBE_RUNNER_OPTIONS,
  ProbeRunner
} from '../../src/agent/probes/ProbeRunner';
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
import { RadioHostnameWriterRegistry } from '../../src/infrastructure/wireless-monitoring/radio-settings';
import { RouterOsQueueService } from '../../src/infrastructure/service-enforcement/RouterOsQueueService';
import { RouterSystemDTO } from '../../src/application/device-monitoring/dtos';
import { RouterPortConnection } from '../../src/application/device-monitoring/interfaces';
import {
  RouterOsApiPrinter,
  RouterOsSession
} from '../../src/infrastructure/monitoring/routeros/RouterOsApiPrinter';
import { WinstonLogger } from '../../src/infrastructure/logging/WinstonLogger';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import { cleanDatabase, seedAgent } from './helpers/db';
import { FakeRouterTrafficReader } from './helpers/FakeRouterTrafficReader';
import { rb4011 } from './helpers/FakeRouterOsPrinter';
import { seedMikrotikModel, seedRouter } from './helpers/portSpeeds';

const AGENT_VERSION = '0.11.0-test';
const routerPath = (id: string) => `/api/routers/${id}/system`;

// The MikroTik behind the agent, at the API session level: what the agent's
// printer logged in with and every command it sent.
class FakeRouterOsApi {
  readonly logins: RouterPortConnection[] = [];
  readonly commands: string[] = [];
  loginError: string | null = null;
  private readonly rows = rb4011('Core-Norte');

  connect = async (
    connection: RouterPortConnection
  ): Promise<RouterOsSession> => {
    this.logins.push(connection);
    if (this.loginError) throw new Error(this.loginError);
    return {
      write: async (command) => {
        this.commands.push(command);
        const rows = this.rows[command];
        if (!rows) throw new Error('no such command');
        return rows;
      },
      close: async () => undefined
    };
  };
}

describe('Agent RouterOS reads — end to end, server hosted off site', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let server: Server;
  let backendUrl: string;
  let dataDir: string;
  let runtime: AgentRuntime | null;
  let token: string;
  // The router behind the agent.
  let router: FakeRouterOsApi;

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
      path.join(os.tmpdir(), 'nms-agent-routeros-')
    );
    runtime = null;
    router = new FakeRouterOsApi();
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
      component: 'agent-routeros-e2e'
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
        new ConfigFetcherRegistry([]),
        new FakeRouterTrafficReader(),
        logger,
        DEFAULT_PROBE_RUNNER_OPTIONS,
        ping,
        new RadioHostnameWriterRegistry({}),
        undefined,
        undefined,
        new RouterOsApiPrinter(logger, router.connect)
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

  // A MikroTik behind a connected agent. Resolves once the agent has said
  // hello: from then on the backend may send it requests.
  async function routerBehindAgent(
    capabilities: readonly AgentCapability[] = AGENT_CAPABILITIES
  ): Promise<string> {
    const agent = await seedAgent(prisma, { name: 'Torre Norte' });
    const deviceId = await seedRouter(prisma, {
      name: 'Core',
      deviceModelId: await seedMikrotikModel(prisma, 'ROUTERBOARD'),
      ip: '192.168.77.1',
      login: { username: 'api', password: 'router-secret' },
      agentId: agent.id
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

  const readRouter = async (
    deviceId: string
  ): Promise<RouterSystemDTO> => {
    const res = await request(app)
      .get(routerPath(deviceId))
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body.data.router;
  };

  it('[MON-163] [MON-180] [AGT-123] reads a router behind the agent with its API login', async () => {
    const deviceId = await routerBehindAgent();

    const core = await readRouter(deviceId);

    expect(core).toMatchObject({
      name: 'Core',
      lastError: null,
      system: expect.objectContaining({
        identity: 'Core-Norte',
        serialNumber: 'D4440E1A2B3C',
        routerOsVersion: '7.15.3'
      })
    });
    expect(router.logins).toEqual([
      {
        host: '192.168.77.1',
        login: {
          username: 'api',
          password: 'router-secret',
          apiPort: 8729
        },
        agentId: null
      }
    ]);
    expect(router.commands).toEqual([
      '/system/identity/print',
      '/system/resource/print',
      '/system/routerboard/print',
      '/system/health/print',
      '/interface/ethernet/print',
      '/ip/service/print',
      '/user/print',
      '/ip/neighbor/discovery-settings/print'
    ]);
    expect(
      await prisma.routerSystemState.findUnique({
        where: { deviceId }
      })
    ).toMatchObject({ identity: 'Core-Norte' });
  });

  it('[AGT-123] passes on why the agent could not log into the router', async () => {
    router.loginError = 'invalid user name or password';
    const deviceId = await routerBehindAgent();

    const core = await readRouter(deviceId);

    expect(core).toMatchObject({
      system: null,
      lastError: 'RouterOS API error: invalid user name or password'
    });
  });

  it('[AGT-123] never sends the login to an agent that does not run RouterOS prints', async () => {
    const deviceId = await routerBehindAgent([
      'probe',
      'traffic',
      'ports'
    ]);

    const core = await readRouter(deviceId);

    expect(core.lastError).toBe(
      'The agent must be updated to read this from routers'
    );
    expect(router.logins).toHaveLength(0);
  });

  it('[MON-161] the scheduled check reads the router through the agent', async () => {
    const deviceId = await routerBehindAgent();

    await container.routerSystemCheckOrchestrator.tick();

    expect(
      await prisma.routerSystemState.findUnique({
        where: { deviceId }
      })
    ).toMatchObject({ identity: 'Core-Norte', lastError: null });
    expect(router.logins).toHaveLength(1);
  });
});
