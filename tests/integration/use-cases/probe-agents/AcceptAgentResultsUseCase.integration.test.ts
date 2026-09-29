import { randomUUID } from 'crypto';
import { PrismaClient } from '../../../../src/generated/prisma/client';
import { AcceptAgentResultsUseCase } from 'application/probe-agents/use-cases';
import { IngestPingResultsUseCase } from 'application/device-monitoring/use-cases/IngestPingResultsUseCase';
import { PrismaAgentDeviceIndex } from 'infrastructure/probe-agents/queries';
import { PrismaAgentRepository } from 'infrastructure/probe-agents/repositories';
import { AgentResultDTO } from 'application/probe-agents/dtos';
import { DeviceMonitoringPingResultSink } from 'infrastructure/probe-agents/adapters';
import { PrismaPollingConfigurationRepository } from 'infrastructure/persistence/PrismaPollingConfigurationRepository';
import { PrismaPingResultRepository } from 'infrastructure/persistence/PrismaPingResultRepository';
import { PrismaDeviceStateRepository } from 'infrastructure/persistence/PrismaDeviceStateRepository';
import { AgentId } from 'domain/shared/ids';
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
import { makeAdapters } from './shared';

describe('AcceptAgentResultsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: AcceptAgentResultsUseCase;
  let index: PrismaAgentDeviceIndex;
  let deviceModelId: string;
  let agentId: string;
  let deviceId: string;
  let deviceIndex: number;
  let now: Date;
  const minutesBefore = (minutes: number) =>
    new Date(now.getTime() - minutes * 60_000);

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);
    const { logger } = makeAdapters(prisma);
    index = new PrismaAgentDeviceIndex(prisma);
    useCase = new AcceptAgentResultsUseCase(
      new PrismaAgentRepository(prisma),
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
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    now = new Date();
    await prisma.alertEvent.deleteMany();
    await cleanAgents(prisma);
    await cleanDatabase(prisma);
    ({ id: agentId } = await seedAgent(prisma, { status: 'ACTIVE' }));
    ({ deviceId } = await seedMonitoredDevice(prisma, deviceModelId));
    await prisma.device.update({
      where: { id: deviceId },
      data: { agentId }
    });
    const indexes = await index.indexesFor(
      AgentId.parse(agentId).value,
      [deviceId]
    );
    deviceIndex = indexes.value.get(deviceId)!;
  });

  const result = (
    reachable: boolean,
    measuredAt: Date,
    id: string = randomUUID()
  ): AgentResultDTO => ({
    id,
    deviceIndex,
    measuredAt,
    outcome: {
      kind: 'measured',
      isReachable: reachable,
      latencyMs: reachable ? 7 : null,
      attempts: 1
    }
  });

  const sendBatch = (results: AgentResultDTO[]) =>
    useCase.execute({ agentId, receivedAt: now, results });

  const send = (reachable: boolean) =>
    sendBatch([result(reachable, now, 'r1')]);

  const history = () =>
    prisma.pingResult.count({ where: { deviceId } });
  const alerts = () =>
    prisma.alertEvent.count({ where: { deviceId } });
  const state = () =>
    prisma.deviceState.findUnique({ where: { deviceId } });

  it('[AGT-043] stores the result as the device’s state and history', async () => {
    const result = await send(false);

    expect(result.value.acknowledged).toEqual(['r1']);
    const state = await prisma.deviceState.findUnique({
      where: { deviceId }
    });
    expect(state!.status).toBe('DOWN');
    expect(state!.lastCheckedAt).toEqual(now);
    expect(
      await prisma.pingResult.count({ where: { deviceId } })
    ).toBe(1);
  });

  it('[MON-007] stores a resent batch once and acknowledges it again', async () => {
    const batch = [
      result(false, now),
      result(false, minutesBefore(0.5))
    ];
    await sendBatch(batch);

    const again = await sendBatch(batch);

    expect(again.value.acknowledged).toEqual(batch.map((r) => r.id));
    expect(await history()).toBe(2);
    expect(await alerts()).toBe(1);
  });

  it('[MON-008] an older result arriving late is history only', async () => {
    await sendBatch([result(true, now)]);

    await sendBatch([result(false, minutesBefore(1))]);

    expect(await history()).toBe(2);
    expect((await state())!.status).toBe('UP');
    expect((await state())!.lastCheckedAt).toEqual(now);
  });

  it('[MON-008] an outage that began and ended while offline is recorded, never alerted', async () => {
    const backlog = [
      result(false, minutesBefore(60)),
      result(false, minutesBefore(55)),
      result(true, minutesBefore(50))
    ];

    const sent = await sendBatch(backlog);

    expect(sent.value.acknowledged).toHaveLength(3);
    expect(await history()).toBe(3);
    expect(await state()).toBeNull();
    expect(await alerts()).toBe(0);
  });

  it('[MON-008] a device still down after reconnect alerts once, from the live result', async () => {
    // R11: the agent sends the live result first, then the backlog.
    await sendBatch([
      result(false, now),
      result(false, minutesBefore(30)),
      result(false, minutesBefore(20))
    ]);

    const current = await state();
    expect(current!.status).toBe('DOWN');
    expect(current!.downSince).toEqual(now);
    expect(await history()).toBe(3);
    expect(await alerts()).toBe(1);
  });

  it('[AGT-046] corrects the agent clock before judging the result', async () => {
    // The PC runs 90 s ahead: its "now" is ours plus 90 s.
    await prisma.probeAgent.update({
      where: { id: agentId },
      data: { clockOffsetMs: 90_000 }
    });

    await sendBatch([result(true, new Date(now.getTime() + 90_000))]);

    const row = await prisma.pingResult.findFirst({
      where: { deviceId }
    });
    expect(row!.checkedAt).toEqual(now);
    expect((await state())!.status).toBe('UP');
  });

  it('[AGT-043] drops a result for a device moved back in-process', async () => {
    await prisma.device.update({
      where: { id: deviceId },
      data: { agentId: null }
    });

    const result = await send(true);

    expect(result.value.acknowledged).toEqual(['r1']);
    expect(
      await prisma.pingResult.count({ where: { deviceId } })
    ).toBe(0);
  });

  it('[AGT-043] drops a result another agent sends with this index', async () => {
    const { id: intruder } = await seedAgent(prisma, {
      status: 'ACTIVE'
    });

    const result = await useCase.execute({
      agentId: intruder,
      receivedAt: now,
      results: [
        {
          id: 'r9',
          deviceIndex,
          measuredAt: now,
          outcome: {
            kind: 'measured',
            isReachable: true,
            latencyMs: 1,
            attempts: 1
          }
        }
      ]
    });

    expect(result.value.acknowledged).toEqual(['r9']);
    expect(
      await prisma.pingResult.count({ where: { deviceId } })
    ).toBe(0);
  });
});
