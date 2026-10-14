import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ListDevicePollingStatusesUseCase } from 'application/device-monitoring/use-cases/ListDevicePollingStatusesUseCase';
import { PrismaPollingStatusListQuery } from 'infrastructure/persistence/PrismaPollingStatusListQuery';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { PrismaAgentStatusQuery } from 'infrastructure/probe-agents/queries';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanAgents,
  cleanDatabase,
  seedAgent,
  seedDeviceModel,
  seedMonitoredDevice
} from '../../helpers/db';

describe('ListDevicePollingStatusesUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ListDevicePollingStatusesUseCase;
  let deviceModelId: string;

  function makeUseCase(serverOnSite = true) {
    return new ListDevicePollingStatusesUseCase(
      new PrismaPollingStatusListQuery(prisma),
      new WinstonLogger(),
      new PrismaAgentStatusQuery(prisma, serverOnSite)
    );
  }

  async function seedPing(
    deviceId: string,
    checkedAt: Date,
    latencyMs: number | null
  ) {
    await prisma.pingResult.create({
      data: {
        deviceId,
        isReachable: latencyMs !== null,
        latencyMs,
        checkedAt
      }
    });
  }

  async function seedUpState(deviceId: string, checkedAt: Date) {
    await prisma.deviceState.create({
      data: {
        deviceId,
        status: 'UP',
        lastSeen: checkedAt,
        lastLatencyMs: 20,
        consecutiveFailures: 0,
        lastCheckedAt: checkedAt
      }
    });
  }

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);
    useCase = makeUseCase();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanAgents(prisma);
    await cleanDatabase(prisma);
  });

  it('returns an empty list when no device is monitored', async () => {
    const result = await useCase.execute();

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual([]);
  });

  it('returns each device with its most recent ping only', async () => {
    const { deviceId } = await seedMonitoredDevice(
      prisma,
      deviceModelId
    );
    const latest = new Date('2026-10-13T10:02:00.000Z');
    await seedPing(
      deviceId,
      new Date('2026-10-13T10:00:00.000Z'),
      10
    );
    await seedPing(deviceId, latest, 20.5);
    await seedPing(
      deviceId,
      new Date('2026-10-13T10:01:00.000Z'),
      15
    );
    await seedUpState(deviceId, latest);

    const result = await useCase.execute();

    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toMatchObject({
      deviceId,
      pollingEnabled: true,
      currentStatus: 'ONLINE',
      consecutiveFailures: 0,
      lastPolled: latest,
      lastResult: {
        timestamp: latest,
        status: 'SUCCESS',
        metrics: { latencyMs: 20.5 }
      }
    });
  });

  it('reports a failed last ping with no metrics', async () => {
    const { deviceId } = await seedMonitoredDevice(
      prisma,
      deviceModelId
    );
    await seedPing(deviceId, new Date(), null);

    const result = await useCase.execute();

    expect(result.value[0].lastResult).toMatchObject({
      status: 'FAILED',
      metrics: null
    });
  });

  it('returns a never-polled device with lastResult null', async () => {
    const polled = await seedMonitoredDevice(
      prisma,
      deviceModelId,
      '192.168.99.1'
    );
    const fresh = await seedMonitoredDevice(
      prisma,
      deviceModelId,
      '192.168.99.2'
    );
    await seedPing(polled.deviceId, new Date(), 5);

    const result = await useCase.execute();

    const byId = new Map(result.value.map((s) => [s.deviceId, s]));
    expect(byId.size).toBe(2);
    expect(byId.get(polled.deviceId)!.lastResult).not.toBeNull();
    expect(byId.get(fresh.deviceId)).toMatchObject({
      currentStatus: 'UNKNOWN',
      lastPolled: null,
      lastResult: null
    });
  });

  it('includes a device whose polling is disabled', async () => {
    const { deviceId } = await seedMonitoredDevice(
      prisma,
      deviceModelId
    );
    await prisma.pollingConfiguration.update({
      where: { deviceId },
      data: { enabled: false }
    });

    const result = await useCase.execute();

    expect(result.value).toHaveLength(1);
    expect(result.value[0].pollingEnabled).toBe(false);
  });

  it('leaves out a deleted device', async () => {
    const kept = await seedMonitoredDevice(
      prisma,
      deviceModelId,
      '192.168.99.1'
    );
    const deleted = await seedMonitoredDevice(
      prisma,
      deviceModelId,
      '192.168.99.2'
    );
    await prisma.device.update({
      where: { id: deleted.deviceId },
      data: { deletedAt: new Date() }
    });

    const result = await useCase.execute();

    expect(result.value.map((s) => s.deviceId)).toEqual([
      kept.deviceId
    ]);
  });

  describe('[MON-006] a device nobody is measuring', () => {
    it('reports UNKNOWN behind an offline agent, keeping the stored state', async () => {
      const { deviceId } = await seedMonitoredDevice(
        prisma,
        deviceModelId
      );
      await seedUpState(deviceId, new Date());
      const { id: agentId } = await seedAgent(prisma, {
        status: 'ACTIVE'
      });
      await prisma.probeAgent.update({
        where: { id: agentId },
        data: { offlineSince: new Date() }
      });
      await prisma.device.update({
        where: { id: deviceId },
        data: { agentId }
      });

      const result = await useCase.execute();

      expect(result.value[0].currentStatus).toBe('UNKNOWN');
      const state = await prisma.deviceState.findUnique({
        where: { deviceId }
      });
      expect(state!.status).toBe('UP');
    });

    it('reports UNKNOWN for a device with no agent on a server hosted off site', async () => {
      const { deviceId } = await seedMonitoredDevice(
        prisma,
        deviceModelId
      );
      await seedUpState(deviceId, new Date());

      const result = await makeUseCase(false).execute();

      expect(result.value[0].currentStatus).toBe('UNKNOWN');
    });
  });
});
