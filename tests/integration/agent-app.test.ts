// Source: src/agent/ (AgentRuntime and everything it wires)
// The on-site agent against the real backend: the enrollment route and the
// agent gateway on one HTTP server, the real database, and the agent's own
// runtime with its files in a temp directory. Only the ping is faked.

import { Server } from 'http';
import { AddressInfo } from 'net';
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
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
  BackendConnection,
  DEFAULT_CONNECTION_OPTIONS
} from '../../src/agent/connection/BackendConnection';
import { formatPairingKey } from '../../src/agent/protocol';
import { WinstonLogger } from '../../src/infrastructure/logging/WinstonLogger';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanAgents,
  cleanDatabase,
  seedAgent,
  seedDeviceModel,
  seedMonitoredDevice
} from './helpers/db';

describe('Agent app — end to end', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let server: Server;
  let backendUrl: string;
  let deviceModelId: string;
  let dataDir: string;
  let runtime: AgentRuntime | null;
  let buffer: ResultBuffer;
  let reachable: boolean;

  beforeAll(async () => {
    let app;
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);
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
    await prisma.alertEvent.deleteMany();
    await cleanAgents(prisma);
    await cleanDatabase(prisma);
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'nms-agent-e2e-'));
    reachable = true;
    runtime = null;
  });

  afterEach(async () => {
    await runtime?.stop();
    rmSync(dataDir, { recursive: true, force: true });
  });

  async function startAgent(
    pairingKey: string | null
  ): Promise<void> {
    const logger = new WinstonLogger({ component: 'agent-e2e' });
    logger.setLevel('error' as never);
    buffer = await ResultBuffer.open(dataDir, logger);
    const scheduler = new PollScheduler(
      {
        run: async () => ({
          kind: 'measured',
          isReachable: reachable,
          latencyMs: reachable ? 4 : null,
          attempts: reachable ? 1 : 3
        })
      },
      (result) => buffer.add(result),
      logger,
      { tickMs: 50 }
    );
    runtime = new AgentRuntime({
      credentials: new CredentialStore(
        dataDir,
        new FilePermissionProtector()
      ),
      pairingKey: new PairingKeySource(dataDir, pairingKey),
      enroll: (key) => enrollAgent(key),
      config: new ConfigStore(dataDir),
      buffer,
      scheduler,
      connect: (credentials, callbacks) =>
        new BackendConnection(
          credentials,
          buffer,
          callbacks,
          logger,
          {
            ...DEFAULT_CONNECTION_OPTIONS,
            agentVersion: '0.1.0-test',
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

  async function pairedAgentWithDevice() {
    const agent = await seedAgent(prisma, { name: 'Torre Norte' });
    const { deviceId } = await seedMonitoredDevice(
      prisma,
      deviceModelId
    );
    await prisma.device.update({
      where: { id: deviceId },
      data: { agentId: agent.id }
    });
    const pairingKey = formatPairingKey({
      backendUrl,
      pairingCode: agent.pairingCode
    });
    return { agentId: agent.id, deviceId, pairingKey };
  }

  it('[AGT-060] [AGT-061] pairs with the key alone, polls its device and the result reaches it', async () => {
    const { agentId, deviceId, pairingKey } =
      await pairedAgentWithDevice();
    reachable = false;

    await startAgent(pairingKey);

    const state = await eventually(
      () => prisma.deviceState.findUnique({ where: { deviceId } }),
      (row) => row !== null
    );
    expect(state!.status).toBe('DOWN');
    const agent = await prisma.probeAgent.findUnique({
      where: { id: agentId }
    });
    expect(agent!.status).toBe('ACTIVE');
    expect(agent!.agentVersion).toBe('0.1.0-test');
    expect(
      await new CredentialStore(
        dataDir,
        new FilePermissionProtector()
      ).load()
    ).toMatchObject({ agentName: 'Torre Norte', backendUrl });
    // Acknowledged results leave the buffer.
    await eventually(
      async () => buffer.size,
      (size) => size === 0
    );
  });

  it('[AGT-062] [AGT-064] after a restart, a backlog measured while offline fills history without changing state', async () => {
    const { deviceId, pairingKey } = await pairedAgentWithDevice();
    await startAgent(pairingKey);
    await eventually(
      () => prisma.deviceState.findUnique({ where: { deviceId } }),
      (row) => row?.status === 'UP'
    );
    await runtime!.stop();
    runtime = null;
    const saved = await new ConfigStore(dataDir).load();
    const index = saved!.devices[0].d;

    // What the agent would have buffered through a 30-minute outage.
    const offline = await ResultBuffer.open(
      dataDir,
      new WinstonLogger()
    );
    const halfHourAgo = Date.now() - 30 * 60_000;
    for (let minute = 0; minute < 5; minute++) {
      offline.add({
        id: `backlog-${minute}`,
        d: index,
        at: halfHourAgo + minute * 60_000,
        reachable: false,
        latencyMs: null,
        attempts: 3
      });
    }
    await offline.close();

    await startAgent(null);

    await eventually(
      () =>
        prisma.pingResult.count({
          where: {
            deviceId,
            sourceResultId: { startsWith: 'backlog-' }
          }
        }),
      (count) => count === 5
    );
    const state = await prisma.deviceState.findUnique({
      where: { deviceId }
    });
    expect(state!.status).toBe('UP');
    expect(
      await prisma.alertEvent.count({ where: { deviceId } })
    ).toBe(0);
  });

  it('[AGT-060] a pairing key works once: a second PC cannot enroll with it', async () => {
    const { agentId, pairingKey } = await pairedAgentWithDevice();
    await startAgent(pairingKey);
    await eventually(
      () => prisma.probeAgent.findUnique({ where: { id: agentId } }),
      (row) => row?.status === 'ACTIVE'
    );

    const outcome = await enrollAgent(pairingKey);

    expect(outcome.kind).toBe('rejected');
  });
});
