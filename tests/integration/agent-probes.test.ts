// Source: src/presentation/ws/agent/ConnectedAgents.ts, src/agent/probes/ProbeRunner.ts
// The backend asking an agent to measure a device now, end to end: an
// install hosted off site, its HTTP routes and agent gateway on one server,
// the real database, and the agent's own runtime answering the probe
// requests. Only the agent's ping and its radio are faked.

import { Server } from 'http';
import { AddressInfo } from 'net';
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
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
import type {
  IRouterQueueService,
  RouterConnection,
  SuspensionQueue
} from '../../src/application/service-enforcement/interfaces';
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
import type {
  DecryptedCredentials,
  IWirelessCollector
} from '../../src/application/wireless-monitoring/interfaces';
import { AGENT_READ_FAILURES } from '../../src/application/wireless-monitoring/use-cases';
import { AGENT_POLL_FAILURES } from '../../src/application/device-monitoring/use-cases';
import { WinstonLogger } from '../../src/infrastructure/logging/WinstonLogger';
import { createTestApp } from './helpers/createTestApp';
import { seedAndGetToken } from './helpers/auth';
import {
  cleanCustomers,
  cleanDatabase,
  seedAgent,
  seedCustomer,
  seedServicePlan,
  seedDeviceModel,
  seedMonitoredDevice,
  seedWirelessDeviceModel
} from './helpers/db';
import { seedDiagnosableDevice } from './helpers/linkDiagnosis';
import { FakeWirelessCollector } from './helpers/FakeWirelessCollector';

const AGENT_VERSION = '0.3.0-test';

describe('Agent probes — end to end, server hosted off site', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let server: Server;
  let backendUrl: string;
  let dataDir: string;
  let runtime: AgentRuntime | null;
  let token: string;
  let pings: Array<{ ip: string; attempts: number }>;
  let radioReads: Array<{
    ip: string;
    credentials: DecryptedCredentials;
    deviceType: string;
  }>;
  let radioAnswer: Result<
    ReturnType<typeof FakeWirelessCollector.reading>
  >;
  // The router behind the agent: what it was asked, and its queues.
  let routerCalls: Array<{
    action: string;
    router: RouterConnection;
    queue?: SuspensionQueue;
    name?: string;
  }>;
  let routerQueues: SuspensionQueue[];
  const fakeRouter: IRouterQueueService = {
    listSuspensionQueues: async (router) => {
      routerCalls.push({ action: 'list', router });
      return Result.ok([...routerQueues]);
    },
    addSuspensionQueue: async (router, queue) => {
      routerCalls.push({ action: 'add', router, queue });
      routerQueues.push(queue);
      return Result.ok();
    },
    removeSuspensionQueue: async (router, name) => {
      routerCalls.push({ action: 'remove', router, name });
      routerQueues = routerQueues.filter((q) => q.name !== name);
      return Result.ok();
    }
  };

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
    await prisma.alertEvent.deleteMany();
    await cleanDatabase(prisma);
    token = await seedAndGetToken(app, prisma, 'ADMIN');
    dataDir = mkdtempSync(
      path.join(os.tmpdir(), 'nms-agent-probes-')
    );
    runtime = null;
    pings = [];
    radioReads = [];
    routerCalls = [];
    routerQueues = [];
    radioAnswer = Result.ok(
      FakeWirelessCollector.reading({
        deviceName: 'CPE Torre Norte',
        wirelessTxBytes: 9007199254740993n,
        wirelessRxBytes: 42n
      })
    );
  });

  afterEach(async () => {
    await runtime?.stop();
    rmSync(dataDir, { recursive: true, force: true });
  });

  async function startAgent(
    pairingKey: string,
    capabilities: readonly AgentCapability[] = AGENT_CAPABILITIES
  ): Promise<void> {
    const logger = new WinstonLogger({
      component: 'agent-probes-e2e'
    });
    logger.setLevel('error' as never);
    const buffer = await ResultBuffer.open(dataDir, logger);
    const ping = {
      run: async (ip: string, attempts: number) => {
        pings.push({ ip, attempts });
        return {
          kind: 'measured' as const,
          isReachable: true,
          latencyMs: 7,
          attempts: 1
        };
      }
    };
    const radio: IWirelessCollector = {
      method: 'http_api',
      collect: async (ip, credentials, deviceType) => {
        radioReads.push({ ip, credentials, deviceType });
        return radioAnswer;
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
        new WirelessCollectorRegistry({ ubiquiti: radio }),
        new ConfigFetcherRegistry([]),
        logger
      ),
      enforcer: new EnforceRunner(fakeRouter, logger),
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
  // send it probe requests.
  async function connectedAgentWith(
    deviceId: string,
    capabilities?: readonly AgentCapability[]
  ): Promise<string> {
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
    return agent.id;
  }

  const pingDevice = async () =>
    (
      await seedMonitoredDevice(
        prisma,
        await seedDeviceModel(prisma),
        '192.168.77.10'
      )
    ).deviceId;

  const radioDevice = async () =>
    seedDiagnosableDevice(
      prisma,
      await seedWirelessDeviceModel(prisma),
      {
        ip: '192.168.77.20'
      }
    );

  describe('[MON-022] [AGT-103] a manual ping', () => {
    it('is measured by the agent and applied as a live reading', async () => {
      const deviceId = await pingDevice();
      await connectedAgentWith(deviceId);
      pings = [];

      const res = await request(app)
        .post(`/api/devices/${deviceId}/poll`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(pings).toContainEqual({
        ip: '192.168.77.10',
        attempts: 3
      });
      const state = await prisma.deviceState.findUnique({
        where: { deviceId }
      });
      expect(state!.status).toBe('UP');
    });

    it('409 — an agent older than 0.3.0 is not asked, and stays connected', async () => {
      const deviceId = await pingDevice();
      const agentId = await connectedAgentWith(deviceId, []);

      const res = await request(app)
        .post(`/api/devices/${deviceId}/poll`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain(
        AGENT_POLL_FAILURES.PROBE_UNSUPPORTED
      );
      // Its scheduled pings keep arriving over the same connection.
      await eventually(
        () => prisma.deviceState.findUnique({ where: { deviceId } }),
        (row) => row?.status === 'UP'
      );
      const agent = await prisma.probeAgent.findUnique({
        where: { id: agentId }
      });
      expect(agent!.status).toBe('ACTIVE');
    });

    it('409 — an agent that stopped is reported as not connected', async () => {
      const deviceId = await pingDevice();
      await connectedAgentWith(deviceId);
      await runtime!.stop();
      runtime = null;

      const res = await request(app)
        .post(`/api/devices/${deviceId}/poll`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain(
        AGENT_POLL_FAILURES.AGENT_OFFLINE
      );
    });
  });

  describe('[WLS-029] [AGT-101] [AGT-102] a radio behind the agent', () => {
    it('a manual poll is read by the agent with the stored credentials, and the reading is stored', async () => {
      const deviceId = await radioDevice();
      await connectedAgentWith(deviceId);

      const res = await request(app)
        .post(`/api/devices/${deviceId}/wireless/poll`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(202);
      expect(res.body.metricsCollected).toBe(true);
      expect(radioReads).toEqual([
        {
          ip: '192.168.77.20',
          credentials: expect.objectContaining({
            httpUsername: 'ubnt',
            httpPassword: 'secret'
          }),
          deviceType: 'STATION'
        }
      ]);
      const snapshot = await prisma.wirelessSnapshot.findFirst({
        where: { deviceId }
      });
      expect(snapshot!.deviceName).toBe('CPE Torre Norte');
      expect(snapshot!.collectionMethod).toBe('http_api');
    });

    it('the schedule reads it through the agent too', async () => {
      const deviceId = await radioDevice();
      await connectedAgentWith(deviceId);

      container.wirelessPollingOrchestrator.start();
      try {
        await eventually(
          () =>
            prisma.wirelessSnapshot.count({ where: { deviceId } }),
          (count) => count === 1
        );
      } finally {
        await container.wirelessPollingOrchestrator.stop();
      }
      expect(radioReads).toHaveLength(1);
    });

    it('502 — passes on why the agent could not read the radio', async () => {
      const deviceId = await radioDevice();
      await connectedAgentWith(deviceId);
      radioAnswer = Result.fail('Authentication failed: HTTP 401');

      const res = await request(app)
        .post(`/api/devices/${deviceId}/wireless/poll`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(502);
      expect(res.body.error).toBe(
        `Cannot poll device — ${AGENT_READ_FAILURES.AGENT_ERROR}: Authentication failed: HTTP 401`
      );
      expect(
        await prisma.wirelessSnapshot.count({ where: { deviceId } })
      ).toBe(0);
    });

    it('409 — an agent older than 0.3.0 is not sent the credentials', async () => {
      const deviceId = await radioDevice();
      await connectedAgentWith(deviceId, []);

      const res = await request(app)
        .post(`/api/devices/${deviceId}/wireless/poll`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain(
        AGENT_READ_FAILURES.PROBE_UNSUPPORTED
      );
      expect(radioReads).toHaveLength(0);
    });
  });

  describe("[SVC-070] [AGT-111] suspensions go through the router's agent", () => {
    let routerId: string;

    beforeEach(async () => {
      await cleanCustomers(prisma);
      routerId = await seedDiagnosableDevice(
        prisma,
        await seedWirelessDeviceModel(prisma),
        { ip: '192.168.77.1', withConfig: false }
      );
      await prisma.vendorSettings.create({
        data: {
          id: 1,
          subscriptionPaidUntil: new Date('2099-01-01T00:00:00Z'),
          subscriptionGraceDays: 1,
          subscriptionReadOnlyDays: 2,
          pingResultRetentionDays: 3,
          alertRetentionDays: 4,
          wirelessSnapshotRetentionDays: 5,
          wirelessAlertRecordRetentionDays: 6,
          enforcementRouterDeviceId: routerId,
          enforcementRouterApiPort: 8728
        }
      });
    });

    afterAll(async () => {
      await cleanCustomers(prisma);
    });

    async function suspendedService(): Promise<string> {
      const customerId = await seedCustomer(prisma, {
        phone: '3000000777'
      });
      const planId = await seedServicePlan(prisma, {
        name: 'Plan 50',
        monthlyPrice: 80000
      });
      const cpe = await seedMonitoredDevice(
        prisma,
        await seedDeviceModel(prisma),
        '192.168.77.30'
      );
      const service = await prisma.contractedService.create({
        data: {
          customerId,
          servicePlanId: planId,
          deviceId: cpe.deviceId,
          status: 'SUSPENDED',
          startDate: new Date('2026-01-10T15:00:00Z')
        }
      });
      return service.id;
    }

    it('reconciliation applies the 1k queue through the agent, with the router login', async () => {
      await connectedAgentWith(routerId);
      const serviceId = await suspendedService();

      await container.suspensionReconciliationOrchestrator!.reconcile();

      expect(routerCalls.map((c) => c.action)).toEqual([
        'list',
        'add'
      ]);
      expect(routerCalls[0].router).toEqual({
        host: '192.168.77.1',
        port: 8728,
        username: 'ubnt',
        password: 'secret'
      });
      expect(routerCalls[1].queue).toEqual({
        name: `suspend-${serviceId}`,
        targetIp: '192.168.77.30'
      });
    });

    it('the suspensions list is read from the router through the agent', async () => {
      await connectedAgentWith(routerId);
      routerQueues = [
        { name: 'suspend-x', targetIp: '192.168.77.99' }
      ];

      const res = await request(app)
        .get('/api/enforcement/suspensions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body.data)).toContain(
        '192.168.77.99'
      );
    });

    it('an agent without enforce is never sent the router login', async () => {
      await connectedAgentWith(routerId, ['probe']);
      await suspendedService();

      await container.suspensionReconciliationOrchestrator!.reconcile();

      expect(routerCalls).toHaveLength(0);
    });
  });
});
