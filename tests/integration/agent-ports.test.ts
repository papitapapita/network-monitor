// Source: src/presentation/ws/agent/ConnectedAgents.ts (readPorts), src/agent/probes/ProbeRunner.ts
// Port speeds through an agent, end to end: an install hosted off site, its
// HTTP routes and agent gateway on one server, the real database, and the
// agent's own runtime answering the ports requests. Only the agent's ping and
// the router it reads are faked. Its own suite because the enroll limit (10
// per 15 minutes per address) is shared by every agent a suite starts.

import request from 'supertest';
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
import { RouterPortSpeedsDTO } from '../../src/application/device-monitoring/dtos';
import { WinstonLogger } from '../../src/infrastructure/logging/WinstonLogger';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import { cleanDatabase, seedAgent } from './helpers/db';
import { FakeRouterTrafficReader } from './helpers/FakeRouterTrafficReader';
import {
  FakeRouterPortReader,
  linkedPort
} from './helpers/FakeRouterPortReader';
import {
  seedExpectedSpeed,
  seedMikrotikModel,
  seedRouter
} from './helpers/portSpeeds';

const AGENT_VERSION = '0.10.0-test';
const LIST = '/api/routers/port-speeds';

describe('Agent port speeds — end to end, server hosted off site', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let server: Server;
  let backendUrl: string;
  let dataDir: string;
  let runtime: AgentRuntime | null;
  let token: string;
  // The router behind the agent.
  let router: FakeRouterPortReader;

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
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'nms-agent-ports-'));
    runtime = null;
    router = new FakeRouterPortReader();
    router.serve(
      '192.168.77.1',
      [
        linkedPort('ether1', 1000, 'Uplink'),
        linkedPort('ether2', 100)
      ],
      'Core-Norte'
    );
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
      component: 'agent-ports-e2e'
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
        router
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

  const listRouters = async (): Promise<RouterPortSpeedsDTO[]> => {
    const res = await request(app)
      .get(LIST)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body.data.routers;
  };

  it('[MON-145] [AGT-122] reads a router behind the agent with its API login', async () => {
    const deviceId = await routerBehindAgent();
    await seedExpectedSpeed(prisma, deviceId, 'ether2', 1000);

    const [core] = await listRouters();

    expect(core).toMatchObject({
      name: 'Core',
      identity: 'Core-Norte',
      readable: true,
      error: null
    });
    expect(
      core!.ports.map((p) => [
        p.name,
        p.comment,
        p.rateMbps,
        p.verdict
      ])
    ).toEqual([
      ['ether1', 'Uplink', 1000, 'NO_EXPECTATION'],
      ['ether2', null, 100, 'SLOW']
    ]);
    expect(router.reads).toEqual([
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
  });

  it('[MON-145] passes on why the agent could not read the router', async () => {
    router.answer(
      '192.168.77.1',
      Result.fail('RouterOS API error: invalid user name or password')
    );
    await routerBehindAgent();

    const [core] = await listRouters();

    expect(core).toMatchObject({
      readable: true,
      error: 'RouterOS API error: invalid user name or password',
      ports: []
    });
  });

  it('[AGT-122] never sends the login to an agent that does not read ports', async () => {
    await routerBehindAgent(['probe', 'traffic', 'discover']);

    const [core] = await listRouters();

    expect(core!.error).toBe(
      'The agent must be updated to read port speeds'
    );
    expect(router.reads).toHaveLength(0);
  });

  it('[MON-147] the scheduled check reads the router through the agent', async () => {
    const deviceId = await routerBehindAgent();
    await seedExpectedSpeed(prisma, deviceId, 'ether2', 1000);

    await container.portSpeedCheckOrchestrator.tick();

    const row = await prisma.portExpectedSpeed.findFirstOrThrow({
      where: { deviceId, portName: 'ether2' }
    });
    expect(row.slowChecks).toBe(1);
    expect(router.reads).toHaveLength(1);
  });
});
