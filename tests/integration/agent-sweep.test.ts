// Source: src/presentation/ws/agent/ConnectedAgents.ts (sweep), src/agent/probes/ProbeRunner.ts
// The network sweep through an agent, end to end: an install hosted off
// site, its HTTP routes and agent gateway on one server, the real database,
// and the agent's own runtime answering the sweep requests. Only the agent's
// pings are faked. Its own suite because the enroll limit (10 per 15 minutes
// per address) is shared by every agent a suite starts.

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
import { RouterOsQueueService } from '../../src/infrastructure/service-enforcement/RouterOsQueueService';
import { NetworkSweepResultDTO } from '../../src/application/device-monitoring/dtos';
import { WinstonLogger } from '../../src/infrastructure/logging/WinstonLogger';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import {
  cleanDatabase,
  seedAgent,
  seedDeviceModel
} from './helpers/db';
import { readSseStream } from './helpers/sse';
import { FakeRouterTrafficReader } from './helpers/FakeRouterTrafficReader';
import { seedSweepDevice } from './helpers/networkSweep';

const AGENT_VERSION = '0.7.0-test';
const STREAM = '/api/network/sweep/stream';
const DEAD_IP = '192.168.88.2';

describe('Agent network sweep — end to end, server hosted off site', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let server: Server;
  let backendUrl: string;
  let dataDir: string;
  let runtime: AgentRuntime | null;
  let token: string;
  let deviceModelId: string;
  // What the agent's quick ping was asked, address and attempts.
  let swept: [string, number][];

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
    token = await seedAndGetToken(app, prisma, 'OPERATOR');
    deviceModelId = await seedDeviceModel(prisma);
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'nms-agent-sweep-'));
    runtime = null;
    swept = [];
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
      component: 'agent-sweep-e2e'
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
    const sweepPing = {
      run: async (ip: string, attempts: number) => {
        swept.push([ip, attempts]);
        return ip === DEAD_IP
          ? {
              kind: 'measured' as const,
              isReachable: false,
              latencyMs: null,
              attempts
            }
          : {
              kind: 'measured' as const,
              isReachable: true,
              latencyMs: 4,
              attempts: 1
            };
      }
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
        sweepPing
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

  // Two devices behind a connected agent, one of them dead. Resolves once
  // the agent has said hello: from then on the backend may send it requests.
  async function devicesBehindAgent(
    capabilities: readonly AgentCapability[] = AGENT_CAPABILITIES
  ): Promise<{ alive: string; dead: string }> {
    const agent = await seedAgent(prisma, { name: 'Torre Norte' });
    const alive = await seedSweepDevice(prisma, deviceModelId, {
      name: 'Alive',
      ip: '192.168.88.1',
      agentId: agent.id
    });
    const dead = await seedSweepDevice(prisma, deviceModelId, {
      name: 'Dead',
      ip: DEAD_IP,
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
    return { alive, dead };
  }

  const sweep = async (): Promise<{
    results: NetworkSweepResultDTO[];
    done: Record<string, unknown>;
  }> => {
    const res = await readSseStream(app, STREAM, {
      token,
      expectEvents: 4,
      timeoutMs: 8_000
    });
    expect(res.status).toBe(200);
    expect(res.events.map((e) => e.event)).toEqual([
      'sweep-start',
      'sweep-result',
      'sweep-result',
      'sweep-done'
    ]);
    return {
      results: res.events
        .slice(1, 3)
        .map((e) => e.data as NetworkSweepResultDTO),
      done: res.events[3].data as Record<string, unknown>
    };
  };

  it('[MON-084] [AGT-119] sweeps the devices behind the agent with its quick ping', async () => {
    const { alive, dead } = await devicesBehindAgent();

    const { results, done } = await sweep();

    expect(swept.sort()).toEqual([
      ['192.168.88.1', 3],
      [DEAD_IP, 3]
    ]);
    const byId = new Map(results.map((r) => [r.deviceId, r]));
    expect(byId.get(alive)).toMatchObject({
      outcome: 'UP',
      latencyMs: 4,
      agentName: 'Torre Norte'
    });
    expect(byId.get(dead)).toMatchObject({
      outcome: 'DOWN',
      attempts: 3,
      agentName: 'Torre Norte'
    });
    expect(done).toMatchObject({
      up: 1,
      down: 1,
      error: 0,
      skipped: 0
    });
  });

  it('[MON-080] the agent sweep writes nothing either', async () => {
    const { dead } = await devicesBehindAgent();

    await sweep();

    expect(
      await prisma.pingResult.count({ where: { deviceId: dead } })
    ).toBe(0);
    expect(
      await prisma.deviceState.count({ where: { deviceId: dead } })
    ).toBe(0);
  });

  it('[AGT-119] never sends a sweep to an agent that does not name it', async () => {
    await devicesBehindAgent([
      'probe',
      'enforce',
      'backup',
      'traffic'
    ]);

    const { results, done } = await sweep();

    expect(swept).toHaveLength(0);
    expect(results.map((r) => [r.outcome, r.detail])).toEqual([
      ['ERROR', 'The agent must be updated to sweep the network'],
      ['ERROR', 'The agent must be updated to sweep the network']
    ]);
    expect(done).toMatchObject({ error: 2 });
  });
});
