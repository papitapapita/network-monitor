import { PrismaClient } from '../../../../src/generated/prisma/client';
import { RunNetworkSweepUseCase } from 'application/device-monitoring/use-cases/RunNetworkSweepUseCase';
import {
  NetworkSweepResultDTO,
  RunNetworkSweepDTO
} from 'application/device-monitoring/dtos';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  seedAgent,
  seedDeviceModel,
  seedLocation
} from '../../helpers/db';
import { FakePingService } from '../../helpers/FakePingService';
import {
  buildNetworkSweep,
  seedSweepDevice
} from '../../helpers/networkSweep';

function collect(filters: RunNetworkSweepDTO['filters'] = {}): {
  request: RunNetworkSweepDTO;
  results: NetworkSweepResultDTO[];
} {
  const results: NetworkSweepResultDTO[] = [];
  return {
    results,
    request: {
      filters,
      onStart: () => undefined,
      onResult: (result) => results.push(result)
    }
  };
}

describe('RunNetworkSweepUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let ping: FakePingService;
  let useCase: RunNetworkSweepUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    deviceModelId = await seedDeviceModel(prisma);
    ping = new FakePingService();
    useCase = buildNetworkSweep(prisma, ping, new WinstonLogger());
  });

  it('reports which devices answered and which did not', async () => {
    const alive = await seedSweepDevice(prisma, deviceModelId, {
      name: 'Alive',
      ip: '10.50.0.1'
    });
    const dead = await seedSweepDevice(prisma, deviceModelId, {
      name: 'Dead',
      ip: '10.50.0.2'
    });
    ping.setResultFor('10.50.0.1', {
      isReachable: true,
      latencyMs: 7
    });
    ping.setResultFor('10.50.0.2', {
      isReachable: false,
      latencyMs: null
    });
    const { request, results } = collect();

    const result = await useCase.execute(request);

    expect(result.value).toMatchObject({ total: 2, up: 1, down: 1 });
    const byId = new Map(results.map((r) => [r.deviceId, r]));
    expect(byId.get(alive)).toMatchObject({
      outcome: 'UP',
      latencyMs: 7
    });
    expect(byId.get(dead)).toMatchObject({
      outcome: 'DOWN',
      attempts: 3
    });
  });

  // MON-082
  it('waits 1 second for each reply', async () => {
    await seedSweepDevice(prisma, deviceModelId, {
      name: 'A',
      ip: '10.50.0.3'
    });

    await useCase.execute(collect().request);

    expect(ping.pinged).toEqual([
      { ipAddress: '10.50.0.3', timeoutMs: 1_000 }
    ]);
  });

  // MON-080
  it('writes nothing: no device state, no ping history, no last-polled time', async () => {
    const deviceId = await seedSweepDevice(prisma, deviceModelId, {
      name: 'Dead',
      ip: '10.50.0.4'
    });
    ping.setResult({ isReachable: false, latencyMs: null });

    await useCase.execute(collect().request);

    expect(
      await prisma.deviceState.count({ where: { deviceId } })
    ).toBe(0);
    expect(
      await prisma.pingResult.count({ where: { deviceId } })
    ).toBe(0);
    expect(
      await prisma.pollingConfiguration.findUnique({
        where: { deviceId }
      })
    ).toMatchObject({ lastPolledAt: null });
    expect(
      await prisma.alertEvent.count({ where: { deviceId } })
    ).toBe(0);
  });

  // MON-081
  describe('which devices', () => {
    it('leaves out devices out of service and in the recycle bin', async () => {
      const commissioning = await seedSweepDevice(
        prisma,
        deviceModelId,
        {
          name: 'Commissioning',
          ip: '10.50.1.1',
          status: 'COMMISSIONING'
        }
      );
      await seedSweepDevice(prisma, deviceModelId, {
        name: 'Stock',
        ip: '10.50.1.2',
        status: 'INVENTORY'
      });
      await seedSweepDevice(prisma, deviceModelId, {
        name: 'Retired',
        ip: '10.50.1.3',
        status: 'DECOMMISSIONED'
      });
      await seedSweepDevice(prisma, deviceModelId, {
        name: 'Deleted',
        ip: '10.50.1.4',
        deleted: true
      });
      const { request, results } = collect();

      await useCase.execute(request);

      expect(results.map((r) => r.deviceId)).toEqual([commissioning]);
    });

    it('skips devices nobody monitors or with no address', async () => {
      const off = await seedSweepDevice(prisma, deviceModelId, {
        name: 'Off',
        ip: '10.50.2.1',
        monitoringEnabled: false
      });
      const configOff = await seedSweepDevice(prisma, deviceModelId, {
        name: 'Config off',
        ip: '10.50.2.2',
        pollingEnabled: false
      });
      const noConfig = await seedSweepDevice(prisma, deviceModelId, {
        name: 'No config',
        ip: '10.50.2.3',
        withPollingConfig: false
      });
      const noIp = await seedSweepDevice(prisma, deviceModelId, {
        name: 'No IP',
        ip: null
      });
      const { request, results } = collect();

      const result = await useCase.execute(request);

      expect(ping.pinged).toHaveLength(0);
      expect(result.value).toMatchObject({ total: 4, skipped: 4 });
      const reasons = Object.fromEntries(
        results.map((r) => [r.deviceId, r.reason])
      );
      expect(reasons).toEqual({
        [off]: 'MONITORING_DISABLED',
        [configOff]: 'MONITORING_DISABLED',
        [noConfig]: 'MONITORING_DISABLED',
        [noIp]: 'NO_IP_ADDRESS'
      });
    });

    it('sweeps only one location when asked', async () => {
      const locationId = await seedLocation(prisma);
      const there = await seedSweepDevice(prisma, deviceModelId, {
        name: 'At the tower',
        ip: '10.50.3.1',
        locationId
      });
      await seedSweepDevice(prisma, deviceModelId, {
        name: 'Elsewhere',
        ip: '10.50.3.2'
      });
      const { request, results } = collect({ locationId });

      await useCase.execute(request);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        deviceId: there,
        locationId,
        locationName: 'Test Tower Location'
      });
    });

    it('sweeps only one category when asked', async () => {
      const gateway = await seedSweepDevice(prisma, deviceModelId, {
        name: 'Core',
        ip: '10.50.4.1',
        category: 'GATEWAY'
      });
      await seedSweepDevice(prisma, deviceModelId, {
        name: 'Customer',
        ip: '10.50.4.2'
      });
      const { request, results } = collect({ category: 'GATEWAY' });

      await useCase.execute(request);

      expect(results.map((r) => r.deviceId)).toEqual([gateway]);
      expect(results[0].category).toBe('GATEWAY');
    });
  });

  // MON-084
  describe('devices behind an agent', () => {
    it('asks their agent, with its name on each result', async () => {
      const agent = await seedAgent(prisma, {
        name: 'Torre Norte',
        status: 'ACTIVE'
      });
      const remote = await seedSweepDevice(prisma, deviceModelId, {
        name: 'Remote',
        ip: '10.50.6.1',
        agentId: agent.id
      });
      const local = await seedSweepDevice(prisma, deviceModelId, {
        name: 'Local',
        ip: '10.50.6.2'
      });
      const asked: [string, string[], number][] = [];
      const agentSweep = buildNetworkSweep(
        prisma,
        ping,
        new WinstonLogger(),
        true,
        {
          sweep: async (agentId, ips, attempts) => {
            asked.push([agentId, ips, attempts]);
            return {
              kind: 'measured',
              outcomes: ips.map(() => ({
                kind: 'measured',
                isReachable: true,
                latencyMs: 12,
                attempts: 1
              }))
            };
          }
        }
      );
      const { request, results } = collect();

      await agentSweep.execute(request);

      expect(asked).toEqual([[agent.id, ['10.50.6.1'], 3]]);
      expect(ping.pinged.map((p) => p.ipAddress)).toEqual([
        '10.50.6.2'
      ]);
      const byId = new Map(results.map((r) => [r.deviceId, r]));
      expect(byId.get(remote)).toMatchObject({
        agentName: 'Torre Norte',
        outcome: 'UP',
        latencyMs: 12
      });
      expect(byId.get(local)).toMatchObject({ agentName: null });
    });

    it('reports them as errors when their agent is not connected', async () => {
      const agent = await seedAgent(prisma, { status: 'ACTIVE' });
      const remote = await seedSweepDevice(prisma, deviceModelId, {
        name: 'Remote',
        ip: '10.50.6.3',
        agentId: agent.id
      });
      const { request, results } = collect();

      const result = await useCase.execute(request);

      expect(ping.pinged).toHaveLength(0);
      expect(results).toEqual([
        expect.objectContaining({
          deviceId: remote,
          outcome: 'ERROR',
          detail: 'The agent is not connected'
        })
      ]);
      expect(result.value).toMatchObject({ error: 1, skipped: 0 });
    });
  });

  // MON-023
  it('pings nothing without an agent on a server hosted off site', async () => {
    const offSite = buildNetworkSweep(
      prisma,
      ping,
      new WinstonLogger(),
      false
    );
    await seedSweepDevice(prisma, deviceModelId, {
      name: 'A',
      ip: '10.50.5.1'
    });
    const { request, results } = collect();

    await offSite.execute(request);

    expect(ping.pinged).toHaveLength(0);
    expect(results[0].reason).toBe('NOT_ON_MONITORED_NETWORK');
  });
});
