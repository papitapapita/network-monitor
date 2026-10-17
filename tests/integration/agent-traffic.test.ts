// Source: src/presentation/ws/agent/ConnectedAgents.ts (readTraffic), src/agent/probes/ProbeRunner.ts
// Live router traffic through an agent, end to end: an install hosted off
// site, its HTTP routes and agent gateway on one server, the real database,
// and the agent's own runtime answering the traffic requests. Only the
// agent's ping and the router it reads are faked. Its own suite because the
// enroll limit (10 per 15 minutes per address) is shared by every agent a
// suite starts.

import { Server } from 'http';
import { AddressInfo } from 'net';
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { Result } from '../../src/domain/shared/core/Result';
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
import { RouterTrafficDTO } from '../../src/application/device-monitoring/dtos';
import { WinstonLogger } from '../../src/infrastructure/logging/WinstonLogger';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import { cleanDatabase, seedAgent } from './helpers/db';
import { readSseStream } from './helpers/sse';
import { FakeRouterTrafficReader } from './helpers/FakeRouterTrafficReader';
import { seedMainRouter } from './helpers/routerTraffic';

const AGENT_VERSION = '0.6.0-test';
const STREAM = '/api/routers/traffic/stream';

const ETHER1 = {
  name: 'ether1-wan',
  type: 'ether',
  running: true,
  rxBps: 120_000_000,
  txBps: 15_000_000
};

describe('Agent router traffic — end to end, server hosted off site', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let server: Server;
  let backendUrl: string;
  let dataDir: string;
  let runtime: AgentRuntime | null;
  let token: string;
  // The router behind the agent.
  let router: FakeRouterTrafficReader;

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
      path.join(os.tmpdir(), 'nms-agent-traffic-')
    );
    runtime = null;
    router = new FakeRouterTrafficReader();
    router.answer('192.168.77.1', Result.ok([ETHER1]));
  });

  afterEach(async () => {
    await container.routerTrafficMonitor.stop();
    container.eventStreamHub.closeAll();
    await runtime?.stop();
    rmSync(dataDir, { recursive: true, force: true });
  });

  async function startAgent(
    pairingKey: string,
    capabilities: readonly AgentCapability[]
  ): Promise<void> {
    const logger = new WinstonLogger({
      component: 'agent-traffic-e2e'
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
        router,
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

  // A MikroTik main router behind a connected agent. Resolves once the agent
  // has said hello: from then on the backend may send it requests.
  async function routerBehindAgent(
    capabilities: readonly AgentCapability[] = AGENT_CAPABILITIES
  ): Promise<void> {
    const agent = await seedAgent(prisma, { name: 'Torre Norte' });
    await seedMainRouter(prisma, {
      name: 'Core',
      ip: '192.168.77.1',
      login: {
        username: 'api',
        password: 'router-secret',
        apiPort: 8729
      },
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
  }

  const firstReading = async (): Promise<RouterTrafficDTO> => {
    const res = await readSseStream(app, STREAM, {
      token,
      expectEvents: 2,
      timeoutMs: 8_000
    });
    expect(res.status).toBe(200);
    expect(res.events[1].event).toBe('router-traffic');
    return res.events[1].data as RouterTrafficDTO;
  };

  it('[MON-065] [AGT-117] reads a router behind the agent with its API login', async () => {
    await routerBehindAgent();

    const reading = await firstReading();

    expect(reading).toEqual(
      expect.objectContaining({
        deviceName: 'Core',
        error: null,
        interfaces: [ETHER1]
      })
    );
    expect(router.reads[0]).toEqual({
      host: '192.168.77.1',
      port: 8729,
      username: 'api',
      password: 'router-secret',
      agentId: null
    });
  });

  it('[MON-065] passes on why the agent could not read the router', async () => {
    router.answer(
      '192.168.77.1',
      Result.fail('RouterOS API error: invalid user name or password')
    );
    await routerBehindAgent();

    const reading = await firstReading();

    expect(reading.error).toBe(
      'RouterOS API error: invalid user name or password'
    );
    expect(reading.interfaces).toEqual([]);
  });

  it('[AGT-116] never sends the login to an agent that does not read traffic', async () => {
    await routerBehindAgent(['probe', 'enforce', 'backup']);

    const reading = await firstReading();

    expect(reading.error).toBe(
      'The agent must be updated to read router traffic'
    );
    expect(router.reads).toHaveLength(0);
  });

  it('[MON-065] a router behind no agent shows why it is not read', async () => {
    await seedMainRouter(prisma, {
      name: 'Alone',
      ip: '192.168.77.2',
      login: { username: 'api', password: 'x', apiPort: 8728 }
    });

    const reading = await firstReading();

    expect(reading.error).toBe('The router is not behind an agent');
  });
});
