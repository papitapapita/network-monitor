// Source: src/presentation/ws/agent/AgentGateway.ts
// The agents' WebSocket, end to end: a real HTTP server, a real `ws` client
// and the real database. Timers are shortened so revocation and config
// refresh can be observed within a test.

import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import WebSocket from 'ws';
import { PrismaClient } from '../../src/generated/prisma/client';
import {
  setupDependencies,
  DependencyContainer
} from '../../src/infrastructure/di/container';
import { AgentGateway } from '../../src/presentation/ws/agent';
import {
  AcceptAgentResultsUseCase,
  AuthenticateAgentUseCase,
  BuildAgentConfigSnapshotUseCase,
  GetAgentUseCase,
  RecordAgentContactUseCase
} from '../../src/application/probe-agents/use-cases';
import { IngestPingResultsUseCase } from '../../src/application/device-monitoring/use-cases/IngestPingResultsUseCase';
import { PrismaAgentRepository } from '../../src/infrastructure/probe-agents/repositories';
import { NodeAgentSecretService } from '../../src/infrastructure/probe-agents/crypto';
import {
  PrismaAgentDeviceIndex,
  PrismaAgentPollingTargetsQuery
} from '../../src/infrastructure/probe-agents/queries';
import { DeviceMonitoringPingResultSink } from '../../src/infrastructure/probe-agents/adapters';
import { PrismaPollingConfigurationRepository } from '../../src/infrastructure/persistence/PrismaPollingConfigurationRepository';
import { PrismaPingResultRepository } from '../../src/infrastructure/persistence/PrismaPingResultRepository';
import { PrismaDeviceStateRepository } from '../../src/infrastructure/persistence/PrismaDeviceStateRepository';
import { WinstonLogger } from '../../src/infrastructure/logging/WinstonLogger';
import {
  AGENT_WS_PATH,
  BackendMessage,
  CloseCode,
  ConfigMessage,
  PROTOCOL_VERSION
} from '../../src/agent/protocol';
import {
  cleanAgents,
  cleanDatabase,
  seedAgent,
  seedDeviceModel,
  seedMonitoredDevice
} from './helpers/db';

interface Client {
  ws: WebSocket;
  next(type: BackendMessage['type']): Promise<BackendMessage>;
  closed: Promise<{ code: number; reason: string }>;
  send(message: object): void;
}

describe('Agent Gateway — ' + AGENT_WS_PATH, () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let server: Server;
  let gateway: AgentGateway;
  let url: string;
  let deviceModelId: string;
  const openClients: WebSocket[] = [];

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    const logger = new WinstonLogger();
    const agents = new PrismaAgentRepository(prisma);
    const index = new PrismaAgentDeviceIndex(prisma);
    gateway = new AgentGateway(
      new AuthenticateAgentUseCase(
        agents,
        new NodeAgentSecretService(),
        logger
      ),
      {
        recordContact: new RecordAgentContactUseCase(agents, logger),
        buildConfig: new BuildAgentConfigSnapshotUseCase(
          new PrismaAgentPollingTargetsQuery(prisma),
          index,
          logger
        ),
        acceptResults: new AcceptAgentResultsUseCase(
          index,
          new DeviceMonitoringPingResultSink(
            new IngestPingResultsUseCase(
              new PrismaPollingConfigurationRepository(prisma),
              new PrismaPingResultRepository(prisma),
              new PrismaDeviceStateRepository(prisma),
              logger
            )
          ),
          logger
        ),
        getAgent: new GetAgentUseCase(agents, logger)
      },
      logger,
      {
        minProtocolVersion: PROTOCOL_VERSION,
        heartbeatIntervalMs: 30_000,
        helloTimeoutMs: 300,
        configRefreshMs: 250,
        pingIntervalMs: 30_000
      }
    );

    server = createServer();
    gateway.attach(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    gateway.closeAll();
    await new Promise((resolve) => server.close(resolve));
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanAgents(prisma);
    await cleanDatabase(prisma);
  });

  afterEach(() => {
    for (const ws of openClients.splice(0)) ws.terminate();
  });

  function connect(
    token: string | null,
    path = AGENT_WS_PATH
  ): Client {
    const ws = new WebSocket(`${url}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    openClients.push(ws);
    // Rejected upgrades and terminated sockets surface as errors; the
    // assertions look at the status or close code instead.
    ws.on('error', () => {});
    const inbox: BackendMessage[] = [];
    const waiters: Array<() => void> = [];
    ws.on('message', (data) => {
      inbox.push(JSON.parse(data.toString()));
      waiters.splice(0).forEach((wake) => wake());
    });
    const closed = new Promise<{ code: number; reason: string }>(
      (resolve) =>
        ws.on('close', (code, reason) =>
          resolve({ code, reason: reason.toString() })
        )
    );
    return {
      ws,
      closed,
      send: (message) => {
        const payload = JSON.stringify(message);
        if (ws.readyState === WebSocket.OPEN) ws.send(payload);
        else ws.once('open', () => ws.send(payload));
      },
      async next(type) {
        for (;;) {
          const at = inbox.findIndex((m) => m.type === type);
          if (at >= 0) return inbox.splice(at, 1)[0];
          await new Promise<void>((wake) => waiters.push(wake));
        }
      }
    };
  }

  const hello = (protocolVersion = PROTOCOL_VERSION) => ({
    type: 'hello',
    protocolVersion,
    agentVersion: '1.0.0',
    sentAt: Date.now()
  });

  function rejectedStatus(token: string | null, path?: string) {
    const { ws } = connect(token, path);
    return new Promise<number>((resolve) =>
      ws.on('unexpected-response', (_req, res) =>
        resolve(res.statusCode!)
      )
    );
  }

  async function agentWithDevice() {
    const agent = await seedAgent(prisma, {
      name: 'Torre Norte',
      status: 'ACTIVE'
    });
    const { deviceId } = await seedMonitoredDevice(
      prisma,
      deviceModelId,
      '10.20.0.5'
    );
    await prisma.device.update({
      where: { id: deviceId },
      data: { agentId: agent.id }
    });
    return { ...agent, deviceId };
  }

  describe('the upgrade', () => {
    it('[AGT-040] 401 — without a token', async () => {
      expect(await rejectedStatus(null)).toBe(401);
    });

    it('[AGT-040] 401 — with a token nobody holds', async () => {
      await seedAgent(prisma, { status: 'ACTIVE' });

      expect(await rejectedStatus('forged')).toBe(401);
    });

    it('[AGT-040] 401 — with a pending agent’s pairing code', async () => {
      const { pairingCode } = await seedAgent(prisma);

      expect(await rejectedStatus(pairingCode)).toBe(401);
    });

    it('404 — on any other path', async () => {
      const { token } = await seedAgent(prisma, { status: 'ACTIVE' });

      expect(await rejectedStatus(token, '/agent/v1/other')).toBe(
        404
      );
    });
  });

  describe('the conversation', () => {
    it('[AGT-020] [AGT-041] answers hello with welcome and the configuration', async () => {
      const { token, id } = await agentWithDevice();
      const client = connect(token);

      client.send(hello());

      expect(await client.next('welcome')).toMatchObject({
        agentName: 'Torre Norte',
        heartbeatIntervalMs: 30_000
      });
      const config = (await client.next('config')) as ConfigMessage;
      expect(config.devices).toEqual([
        {
          d: 0,
          ip: '10.20.0.5',
          intervalSeconds: 60,
          failuresBeforeDown: 3
        }
      ]);
      const row = await prisma.probeAgent.findUnique({
        where: { id }
      });
      expect(row!.lastSeenAt).not.toBeNull();
      expect(row!.agentVersion).toBe('1.0.0');
      expect(gateway.isConnected(id)).toBe(true);
    });

    it('[AGT-043] stores a results batch and acknowledges each result', async () => {
      const { token, deviceId } = await agentWithDevice();
      const client = connect(token);
      client.send(hello());
      const config = (await client.next('config')) as ConfigMessage;

      client.send({
        type: 'results',
        batchId: 'b1',
        results: [
          {
            id: 'r1',
            d: config.devices[0].d,
            at: Date.now(),
            reachable: true,
            latencyMs: 12.5,
            attempts: 1
          }
        ]
      });

      expect(await client.next('results.ack')).toEqual({
        type: 'results.ack',
        batchId: 'b1',
        ids: ['r1']
      });
      const state = await prisma.deviceState.findUnique({
        where: { deviceId }
      });
      expect(state!.status).toBe('UP');
    });

    it('[AGT-042] pushes a new configuration when a setting changes', async () => {
      const { token, deviceId } = await agentWithDevice();
      const client = connect(token);
      client.send(hello());
      const first = (await client.next('config')) as ConfigMessage;

      await prisma.pollingConfiguration.update({
        where: { deviceId },
        data: { pingIntervalSecs: 30 }
      });

      const second = (await client.next('config')) as ConfigMessage;
      expect(second.version).not.toBe(first.version);
      expect(second.devices[0].intervalSeconds).toBe(30);
    });

    it('[AGT-044] closes with "update required" for an old protocol', async () => {
      const { token, id } = await agentWithDevice();
      const client = connect(token);

      client.send(hello(0));

      expect((await client.closed).code).toBe(
        CloseCode.UPDATE_REQUIRED
      );
      const row = await prisma.probeAgent.findUnique({
        where: { id }
      });
      expect(row!.lastSeenAt).toBeNull();
    });
  });

  describe('closing', () => {
    it('[AGT-005] cuts off an agent revoked while connected', async () => {
      const { token, id } = await agentWithDevice();
      const client = connect(token);
      client.send(hello());
      await client.next('welcome');

      await prisma.probeAgent.update({
        where: { id },
        data: {
          status: 'REVOKED',
          tokenHash: null,
          revokedAt: new Date()
        }
      });

      expect((await client.closed).code).toBe(CloseCode.REVOKED);
    });

    it('[AGT-045] keeps only the newest connection of an agent', async () => {
      const { token } = await agentWithDevice();
      const first = connect(token);
      first.send(hello());
      await first.next('welcome');

      const second = connect(token);
      second.send(hello());

      expect((await first.closed).code).toBe(CloseCode.REPLACED);
      expect(await second.next('welcome')).toBeDefined();
    });

    it('closes an agent that talks before saying hello', async () => {
      const { token } = await agentWithDevice();
      const client = connect(token);

      client.send({
        type: 'heartbeat',
        agentVersion: '1',
        sentAt: 1
      });

      expect((await client.closed).code).toBe(
        CloseCode.PROTOCOL_ERROR
      );
    });

    it('closes an agent that sends something malformed', async () => {
      const { token } = await agentWithDevice();
      const client = connect(token);
      client.send(hello());
      await client.next('welcome');

      client.ws.send('{not json');

      expect((await client.closed).code).toBe(
        CloseCode.PROTOCOL_ERROR
      );
    });

    it('closes an agent that never says hello', async () => {
      const { token } = await agentWithDevice();
      const client = connect(token);

      expect((await client.closed).code).toBe(
        CloseCode.HELLO_TIMEOUT
      );
    });
  });
});
