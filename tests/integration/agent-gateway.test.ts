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
import {
  AgentGateway,
  ConnectedAgents
} from '../../src/presentation/ws/agent';
import {
  AcceptAgentResultsUseCase,
  AuthenticateAgentUseCase,
  BuildAgentConfigSnapshotUseCase,
  GetAgentUpdateOfferUseCase,
  GetAgentUseCase,
  RecordAgentContactUseCase,
  RecordAgentUpdateOutcomeUseCase
} from '../../src/application/probe-agents/use-cases';
import { IngestPingResultsUseCase } from '../../src/application/device-monitoring/use-cases/IngestPingResultsUseCase';
import { PrismaAgentRepository } from '../../src/infrastructure/probe-agents/repositories';
import { NodeAgentSecretService } from '../../src/infrastructure/probe-agents/crypto';
import {
  PrismaAgentDeviceIndex,
  PrismaAgentPollingTargetsQuery,
  PrismaAgentDeviceCountQuery
} from '../../src/infrastructure/probe-agents/queries';
import { DeviceMonitoringPingResultSink } from '../../src/infrastructure/probe-agents/adapters';
import { PrismaPollingConfigurationRepository } from '../../src/infrastructure/persistence/PrismaPollingConfigurationRepository';
import { PrismaPingResultRepository } from '../../src/infrastructure/persistence/PrismaPingResultRepository';
import { PrismaDeviceStateRepository } from '../../src/infrastructure/persistence/PrismaDeviceStateRepository';
import { WinstonLogger } from '../../src/infrastructure/logging/WinstonLogger';
import { GetSubscriptionStatusUseCase } from '../../src/application/shared/use-cases/GetSubscriptionStatusUseCase';
import { Result } from '../../src/domain/shared/core/Result';
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
import { FakeAgentReleaseCatalog } from './helpers/FakeAgentReleaseCatalog';
import { toWirelessReadingWire } from '../../src/agent/probes/ProbeRunner';
import { makeWirelessCollectionResult } from '../fixtures/wirelessCollection';

interface Client {
  ws: WebSocket;
  inbox: BackendMessage[];
  next(type: BackendMessage['type']): Promise<BackendMessage>;
  closed: Promise<{ code: number; reason: string }>;
  send(message: object): void;
}

describe('Agent Gateway — ' + AGENT_WS_PATH, () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let server: Server;
  let gateway: AgentGateway;
  let connected: ConnectedAgents;
  let url: string;
  let deviceModelId: string;
  const openClients: WebSocket[] = [];
  const releases = new FakeAgentReleaseCatalog();
  // The terms are fixed at boot, so a test flips the answer instead.
  let subscriptionExpired = false;
  const subscriptionStatus = {
    execute: async () =>
      Result.ok({
        state: subscriptionExpired ? 'READ_ONLY' : 'ACTIVE',
        paidThrough: null,
        graceEndsAt: null,
        lockedAt: null,
        readOnly: subscriptionExpired,
        locked: false
      })
  } as unknown as GetSubscriptionStatusUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    const logger = new WinstonLogger();
    const agents = new PrismaAgentRepository(prisma);
    const index = new PrismaAgentDeviceIndex(prisma);
    connected = new ConnectedAgents(logger, {
      pingMs: 300,
      wirelessMs: 300
    });
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
          agents,
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
        getAgent: new GetAgentUseCase(
          agents,
          new PrismaAgentDeviceCountQuery(prisma),
          logger
        ),
        subscriptionStatus,
        updateOffer: new GetAgentUpdateOfferUseCase(
          agents,
          releases,
          logger
        ),
        recordUpdateOutcome: new RecordAgentUpdateOutcomeUseCase(
          agents,
          logger
        )
      },
      connected,
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
    subscriptionExpired = false;
    releases.release = null;
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
      inbox,
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

  const hello = (
    protocolVersion = PROTOCOL_VERSION,
    platform: string | undefined = undefined,
    capabilities: string[] | undefined = undefined
  ) => ({
    type: 'hello',
    protocolVersion,
    agentVersion: '1.0.0',
    ...(platform ? { platform } : {}),
    ...(capabilities ? { capabilities } : {}),
    sentAt: Date.now()
  });

  // Long enough for at least one configuration refresh (250 ms here).
  const settle = () =>
    new Promise((resolve) => setTimeout(resolve, 400));

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
      expect(connected.isConnected(id)).toBe(true);
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

  describe('[AGT-082] updates', () => {
    it('offers a newer release for the agent’s platform after its configuration', async () => {
      const { token } = await agentWithDevice();
      releases.publish('1.1.0', 'linux-x64');
      const client = connect(token);

      client.send(hello(PROTOCOL_VERSION, 'linux-x64'));

      await client.next('config');
      expect(await client.next('update')).toEqual({
        type: 'update',
        version: '1.1.0',
        file: 'nms-agent-1.1.0-linux-x64.gz',
        sha256: 'a'.repeat(64),
        bytes: 1000,
        signature: 'c2lnbmF0dXJl'
      });
    });

    it('offers a release published while the agent is connected, once', async () => {
      const { token } = await agentWithDevice();
      const client = connect(token);
      client.send(hello(PROTOCOL_VERSION, 'win-x64'));
      await client.next('config');

      releases.publish('1.1.0', 'win-x64');

      expect(
        (await client.next('update')) as { version: string }
      ).toMatchObject({ version: '1.1.0' });
      await settle();
      expect(
        client.inbox.filter((m) => m.type === 'update')
      ).toHaveLength(0);
    });

    it.each([
      ['names no platform', undefined, '1.1.0'],
      ['runs on the other platform', 'win-x64', '1.1.0'],
      ['already runs that version', 'linux-x64', '1.0.0']
    ])(
      'offers nothing to an agent that %s',
      async (_label, platform, version) => {
        const { token } = await agentWithDevice();
        releases.publish(version, 'linux-x64');
        const client = connect(token);

        client.send(hello(PROTOCOL_VERSION, platform));
        await client.next('config');
        await settle();

        expect(client.inbox.some((m) => m.type === 'update')).toBe(
          false
        );
      }
    );

    it('[AGT-044] tells an outdated agent where the update is, then closes', async () => {
      const { token } = await agentWithDevice();
      releases.publish('1.1.0', 'linux-x64');
      const client = connect(token);

      client.send(hello(0, 'linux-x64'));

      expect(
        (await client.next('update')) as { version: string }
      ).toMatchObject({ version: '1.1.0' });
      expect((await client.closed).code).toBe(
        CloseCode.UPDATE_REQUIRED
      );
    });

    it('[AGT-084] records the outcome the agent reports, and stops offering a release that failed', async () => {
      const { token, id } = await agentWithDevice();
      releases.publish('1.1.0', 'linux-x64');
      const first = connect(token);
      first.send(hello(PROTOCOL_VERSION, 'linux-x64'));
      await first.next('update');

      first.send({
        type: 'update.result',
        version: '1.1.0',
        outcome: 'rolled-back',
        reason: 'No connection within 2 minutes'
      });
      await settle();

      const row = await prisma.probeAgent.findUnique({
        where: { id }
      });
      expect(row).toMatchObject({
        lastUpdateVersion: '1.1.0',
        lastUpdateOutcome: 'ROLLED_BACK',
        lastUpdateReason: 'No connection within 2 minutes'
      });
      expect(row!.lastUpdateAt).not.toBeNull();

      first.ws.close();
      const second = connect(token);
      second.send(hello(PROTOCOL_VERSION, 'linux-x64'));
      await second.next('config');
      await settle();
      expect(second.inbox.some((m) => m.type === 'update')).toBe(
        false
      );
    });
  });

  describe('[INS-022] an expired subscription', () => {
    it('refuses the hello before anything is recorded', async () => {
      subscriptionExpired = true;
      const { token, id } = await agentWithDevice();
      const client = connect(token);

      client.send(hello());

      expect((await client.closed).code).toBe(
        CloseCode.SUBSCRIPTION_EXPIRED
      );
      const row = await prisma.probeAgent.findUnique({
        where: { id }
      });
      expect(row!.lastSeenAt).toBeNull();
    });

    it('cuts off an agent already connected when the grace ends', async () => {
      const { token } = await agentWithDevice();
      const client = connect(token);
      client.send(hello());
      await client.next('welcome');

      subscriptionExpired = true;

      expect((await client.closed).code).toBe(
        CloseCode.SUBSCRIPTION_EXPIRED
      );
    });
  });

  describe('[AGT-103] probe requests', () => {
    const CREDENTIALS = {
      snmpVersion: 2 as const,
      snmpCommunity: 'public',
      snmpV3AuthUser: null,
      snmpV3AuthProto: null,
      snmpV3AuthKey: null,
      snmpV3PrivProto: null,
      snmpV3PrivKey: null,
      httpUsername: 'ubnt',
      httpPassword: 'secreto',
      snmpPort: 161,
      httpPort: 443
    };

    async function probingAgent(capabilities = ['probe']) {
      const agent = await agentWithDevice();
      const client = connect(agent.token);
      client.send(hello(PROTOCOL_VERSION, undefined, capabilities));
      await client.next('config');
      return { ...agent, client };
    }

    it('answers "offline" for an agent that is not connected', async () => {
      const { id } = await agentWithDevice();

      expect(await connected.ping(id, '10.20.0.5', 3)).toEqual({
        ok: false,
        reason: 'AGENT_OFFLINE',
        error: 'The agent is not connected'
      });
    });

    it('[AGT-100] never asks an agent that did not say it answers probes', async () => {
      const { id, client } = await probingAgent([]);

      const outcome = await connected.ping(id, '10.20.0.5', 3);
      await settle();

      expect(outcome).toMatchObject({
        ok: false,
        reason: 'PROBE_UNSUPPORTED'
      });
      expect(client.inbox.map((m) => m.type)).not.toContain('probe');
      expect(connected.isConnected(id)).toBe(true);
    });

    it('[AGT-104] sends a ping and gives back the answer, timed on the backend clock', async () => {
      const { id, client } = await probingAgent();
      const before = Date.now();

      const pending = connected.ping(id, '10.20.0.5', 3);
      const request = await client.next('probe');
      client.send({
        type: 'probe.result',
        requestId: (request as { requestId: string }).requestId,
        kind: 'ping',
        // An agent clock an hour behind.
        at: before - 3_600_000,
        reading: { reachable: true, latencyMs: 4, attempts: 1 }
      });
      const outcome = await pending;

      expect(request).toMatchObject({
        type: 'probe',
        kind: 'ping',
        ip: '10.20.0.5',
        attempts: 3
      });
      expect(outcome).toEqual({
        ok: true,
        reading: {
          kind: 'measured',
          isReachable: true,
          latencyMs: 4,
          attempts: 1
        },
        measuredAt: expect.any(Date)
      });
      const at = (
        outcome as { measuredAt: Date }
      ).measuredAt.getTime();
      expect(at).toBeGreaterThanOrEqual(before);
      expect(at).toBeLessThanOrEqual(Date.now());
    });

    it('sends the credentials with a radio read and gives back the reading', async () => {
      const { id, client } = await probingAgent();
      const reading = makeWirelessCollectionResult();

      const pending = connected.readRadio(id, {
        ipAddress: '10.20.0.5',
        vendor: 'ubiquiti',
        deviceType: 'ACCESS_POINT',
        credentials: CREDENTIALS
      });
      const request = (await client.next('probe')) as {
        requestId: string;
      };
      client.send({
        type: 'probe.result',
        requestId: request.requestId,
        kind: 'wireless',
        at: Date.now(),
        reading: toWirelessReadingWire(reading)
      });

      expect(request).toMatchObject({
        kind: 'wireless',
        ip: '10.20.0.5',
        vendor: 'ubiquiti',
        deviceType: 'ACCESS_POINT',
        credentials: CREDENTIALS
      });
      expect(await pending).toMatchObject({ ok: true, reading });
    });

    it('passes on the error the agent answers', async () => {
      const { id, client } = await probingAgent();

      const pending = connected.ping(id, '10.20.0.5', 3);
      const request = (await client.next('probe')) as {
        requestId: string;
      };
      client.send({
        type: 'probe.result',
        requestId: request.requestId,
        error: 'The agent is busy with other probes'
      });

      expect(await pending).toEqual({
        ok: false,
        reason: 'AGENT_ERROR',
        error: 'The agent is busy with other probes'
      });
    });

    it('gives up on an agent that does not answer, and drops its late answer', async () => {
      const { id, client } = await probingAgent();

      const outcome = await connected.ping(id, '10.20.0.5', 3);
      const request = (await client.next('probe')) as {
        requestId: string;
      };
      client.send({
        type: 'probe.result',
        requestId: request.requestId,
        kind: 'ping',
        at: Date.now(),
        reading: { reachable: true, latencyMs: 1, attempts: 1 }
      });
      await settle();

      expect(outcome).toMatchObject({ ok: false, reason: 'TIMEOUT' });
      expect(connected.isConnected(id)).toBe(true);
    });

    it('ends a request at once when the agent disconnects', async () => {
      const { id, client } = await probingAgent();

      const pending = connected.ping(id, '10.20.0.5', 3);
      await client.next('probe');
      client.ws.close();

      expect(await pending).toMatchObject({
        ok: false,
        reason: 'AGENT_OFFLINE',
        error: 'The agent disconnected'
      });
    });

    it('matches each answer to its own request', async () => {
      const { id, client } = await probingAgent();

      const first = connected.ping(id, '10.20.0.5', 1);
      const second = connected.ping(id, '10.20.0.6', 1);
      const requests = [
        (await client.next('probe')) as {
          requestId: string;
          ip: string;
        },
        (await client.next('probe')) as {
          requestId: string;
          ip: string;
        }
      ];
      for (const request of [...requests].reverse()) {
        client.send({
          type: 'probe.result',
          requestId: request.requestId,
          kind: 'ping',
          at: Date.now(),
          reading: {
            reachable: request.ip === '10.20.0.5',
            latencyMs: 1,
            attempts: 1
          }
        });
      }

      expect(await first).toMatchObject({
        reading: { isReachable: true }
      });
      expect(await second).toMatchObject({
        reading: { isReachable: false }
      });
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
