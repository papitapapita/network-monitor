// Source: src/presentation/ws/agent/ConnectedAgents.ts (setHostname), src/agent/probes/ProbeRunner.ts
// A radio's Wi-Fi key and name through an agent, end to end: an install
// hosted off site, its HTTP routes and agent gateway on one server, the real
// database, and the agent's own runtime answering. Only what the agent does
// to the radio is faked. Its own suite because the enroll limit (10 per 15
// minutes per address) is shared by every agent a suite starts.

import { Server } from 'http';
import { AddressInfo } from 'net';
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { Result } from '../../src/domain/shared/core';
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
import { RadioHostnameWriterRegistry } from '../../src/infrastructure/wireless-monitoring/radio-settings';
import { ConfigFetcherRegistry } from '../../src/infrastructure/device-backups/fetchers';
import { RouterOsQueueService } from '../../src/infrastructure/service-enforcement/RouterOsQueueService';
import { WinstonLogger } from '../../src/infrastructure/logging/WinstonLogger';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import {
  cleanAgents,
  cleanDatabase,
  seedAgent,
  seedWirelessDeviceModel
} from './helpers/db';
import { seedDiagnosableDevice } from './helpers/linkDiagnosis';
import { FakeRadio } from './helpers/FakeRadio';
import { FakeRouterTrafficReader } from './helpers/FakeRouterTrafficReader';
import { AP_CONFIG } from './helpers/radioSettings';

const AGENT_VERSION = '0.8.0-test';
const PASSWORD = 'integration-test-pass';

describe('Agent radio settings — end to end, server hosted off site', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let server: Server;
  let backendUrl: string;
  let dataDir: string;
  let runtime: AgentRuntime | null;
  let token: string;
  let deviceModelId: string;
  const radio = new FakeRadio();
  // What the agent's config fetcher was asked: address and login user.
  let fetched: [string, string][];

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
    await cleanAgents(prisma);
    await container.disconnect();
  });

  beforeEach(async () => {
    radio.reset();
    fetched = [];
    await cleanAgents(prisma);
    await cleanDatabase(prisma);
    token = await seedAndGetToken(app, prisma, 'OPERATOR');
    deviceModelId = await seedWirelessDeviceModel(prisma);
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'nms-agent-radio-'));
    runtime = null;
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
      component: 'agent-radio-e2e'
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
            vendor: 'ubiquiti',
            kinds: ['ACCESS_POINT', 'STATION'],
            fetcher: {
              fetch: async (ip, login) => {
                fetched.push([ip, login.username]);
                return Result.ok({
                  format: BackupFormat.AIROS_CFG,
                  content: AP_CONFIG
                });
              }
            }
          }
        ]),
        new FakeRouterTrafficReader(),
        logger,
        DEFAULT_PROBE_RUNNER_OPTIONS,
        ping,
        new RadioHostnameWriterRegistry({ ubiquiti: radio })
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

  // An AP behind a connected agent. Resolves once the agent has said hello.
  async function radioBehindAgent(
    capabilities: readonly AgentCapability[] = AGENT_CAPABILITIES
  ): Promise<string> {
    const agent = await seedAgent(prisma, { name: 'Torre Norte' });
    const deviceId = await seedDiagnosableDevice(
      prisma,
      deviceModelId,
      {
        ip: '10.0.0.10',
        deviceType: 'ACCESS_POINT'
      }
    );
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

  const rename = (deviceId: string, hostname: string) =>
    request(app)
      .put(`/api/devices/${deviceId}/wireless/hostname`)
      .set('Authorization', `Bearer ${token}`)
      .send({ hostname });

  it('[AGT-120] renames the radio with the agent writer and its stored login', async () => {
    const deviceId = await radioBehindAgent();

    const res = await rename(deviceId, 'AP Norte 2');

    expect(res.status).toBe(200);
    expect(res.body.hostname).toBe('AP Norte 2');
    expect(radio.renames).toEqual([
      {
        ip: '10.0.0.10',
        login: {
          username: 'ubnt',
          password: 'secret',
          httpPort: 443,
          sshPort: 22
        },
        hostname: 'AP Norte 2'
      }
    ]);
  });

  it('[AGT-120] 502 — passes on what the radio said', async () => {
    const deviceId = await radioBehindAgent();
    radio.rename = Result.fail('SSH login rejected');

    const res = await rename(deviceId, 'AP Norte 2');

    expect(res.status).toBe(502);
    expect(res.body.error).toContain('SSH login rejected');
  });

  it('[AGT-120] never asks an agent that does not name hostname', async () => {
    const deviceId = await radioBehindAgent([
      'probe',
      'enforce',
      'backup',
      'traffic',
      'sweep'
    ]);

    const res = await rename(deviceId, 'AP Norte 2');

    expect(res.status).toBe(409);
    expect(res.body.error).toContain(
      'The agent must be updated to rename radios'
    );
    expect(radio.renames).toHaveLength(0);
  });

  it('[WLS-225] reads the Wi-Fi key with the agent backup request, even from an older agent', async () => {
    const deviceId = await radioBehindAgent([
      'probe',
      'enforce',
      'backup'
    ]);
    const unlock = await request(app)
      .post('/api/users/me/credential-reveal')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: PASSWORD });

    const res = await request(app)
      .post(`/api/devices/${deviceId}/wireless/key/reveal`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Credential-Reveal-Token', unlock.body.data.revealToken);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      role: 'ACCESS_POINT',
      security: 'WPA_PSK',
      key: 'clave-del-ap'
    });
    expect(fetched).toEqual([['10.0.0.10', 'ubnt']]);
  });
});
