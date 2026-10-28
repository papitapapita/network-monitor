// Source: src/presentation/ws/agent/ConnectedAgents.ts (discover), src/agent/probes/ProbeRunner.ts
// The network scan through an agent, end to end: an install hosted off
// site, its HTTP routes and agent gateway on one server, the real database,
// and the agent's own runtime answering the discover requests. Only the
// agent's pings and ARP table are faked. Its own suite because the enroll
// limit (10 per 15 minutes per address) is shared by every agent a suite
// starts.

import { Server } from 'http';
import { AddressInfo } from 'net';
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
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
import { WinstonLogger } from '../../src/infrastructure/logging/WinstonLogger';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import { cleanDatabase, seedAgent } from './helpers/db';
import { FakeRouterTrafficReader } from './helpers/FakeRouterTrafficReader';

const AGENT_VERSION = '0.9.0-test';
const SCAN = '/api/network/scan';
const SEGMENT = '192.168.88.0/28';
const ROUTER_MAC = 'DC:2C:6E:11:22:33';

describe('Agent network scan — end to end, server hosted off site', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let server: Server;
  let backendUrl: string;
  let dataDir: string;
  let runtime: AgentRuntime | null;
  let token: string;
  let pinged: string[];

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
      path.join(os.tmpdir(), 'nms-agent-discover-')
    );
    runtime = null;
    pinged = [];
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
      component: 'agent-discover-e2e'
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
    // The router at .1 and a host behind it at .9 answer.
    const sweepPing = {
      run: async (ip: string, attempts: number) => {
        pinged.push(ip);
        const alive = ip.endsWith('.1') || ip.endsWith('.9');
        return {
          kind: 'measured' as const,
          isReachable: alive,
          latencyMs: alive ? 4 : null,
          attempts
        };
      }
    };
    const arp = {
      read: async () => new Map([['192.168.88.1', ROUTER_MAC]])
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
        sweepPing,
        new RadioHostnameWriterRegistry({}),
        arp
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

  // Resolves once the agent has said hello: from then on the backend may
  // send it requests.
  async function connectedAgent(
    capabilities: readonly AgentCapability[] = AGENT_CAPABILITIES
  ): Promise<string> {
    const agent = await seedAgent(prisma, { name: 'Torre Norte' });
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
    return agent.id;
  }

  const scan = (body: object) =>
    request(app)
      .post(SCAN)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  it('[DEV-214] [AGT-121] a manual scan sweeps the segment from the agent', async () => {
    const agentId = await connectedAgent();

    const res = await scan({ segment: SEGMENT, agentId });

    expect(res.status).toBe(200);
    expect(pinged).toHaveLength(14);
    expect(res.body.data).toMatchObject({
      segment: SEGMENT,
      agentId,
      scannedCount: 14,
      responsiveCount: 2,
      newCount: 1
    });
    expect(res.body.data.discoveredHosts).toEqual([
      expect.objectContaining({
        ipAddress: '192.168.88.1',
        macAddress: ROUTER_MAC,
        manufacturer: expect.any(String),
        isNew: true
      }),
      expect.objectContaining({
        ipAddress: '192.168.88.9',
        macAddress: null,
        discoveredDeviceId: null
      })
    ]);
    const stored = await prisma.discoveredDevice.findMany();
    expect(stored.map((d) => [d.macAddress, d.segment])).toEqual([
      [ROUTER_MAC, SEGMENT]
    ]);
  });

  it('[DEV-214] the scheduled scan sweeps an agent segment', async () => {
    const agentId = await connectedAgent();
    const saved = await request(app)
      .put('/api/network/discovery-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        enabled: true,
        intervalHours: 24,
        segments: [{ cidr: SEGMENT, agentId }]
      });
    expect(saved.status).toBe(200);

    await container.discoveryScanOrchestrator.tick();

    expect(pinged).toHaveLength(14);
    const stored = await prisma.discoveredDevice.findMany();
    expect(stored.map((d) => d.macAddress)).toEqual([ROUTER_MAC]);
  });

  it('[AGT-121] never sends a scan to an agent that does not name it', async () => {
    const agentId = await connectedAgent(
      AGENT_CAPABILITIES.filter((c) => c !== 'discover')
    );

    const res = await scan({ segment: SEGMENT, agentId });

    expect(res.status).toBe(502);
    expect(res.body).toEqual({
      success: false,
      error:
        'The agent could not scan: The agent must be updated to scan the network'
    });
    expect(pinged).toHaveLength(0);
  });

  it('[DEV-214] answers 502 when the agent is not connected', async () => {
    const agent = await seedAgent(prisma);

    const res = await scan({ segment: SEGMENT, agentId: agent.id });

    expect(res.status).toBe(502);
    expect(res.body.error).toBe(
      'The agent could not scan: The agent is not connected'
    );
  });
});
