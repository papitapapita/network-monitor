import { PrismaClient } from '../../../../src/generated/prisma/client';
import { AcceptAgentResultsUseCase } from 'application/probe-agents/use-cases';
import { IngestPingResultsUseCase } from 'application/device-monitoring/use-cases/IngestPingResultsUseCase';
import { PrismaAgentDeviceIndex } from 'infrastructure/probe-agents/queries';
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
  const measuredAt = new Date('2026-09-28T12:00:00.000Z');

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);
    const { logger } = makeAdapters(prisma);
    index = new PrismaAgentDeviceIndex(prisma);
    useCase = new AcceptAgentResultsUseCase(
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

  const send = (reachable: boolean) =>
    useCase.execute({
      agentId,
      results: [
        {
          id: 'r1',
          deviceIndex,
          measuredAt,
          outcome: {
            kind: 'measured',
            isReachable: reachable,
            latencyMs: reachable ? 7 : null,
            attempts: 1
          }
        }
      ]
    });

  it('[AGT-043] stores the result as the device’s state and history', async () => {
    const result = await send(false);

    expect(result.value.acknowledged).toEqual(['r1']);
    const state = await prisma.deviceState.findUnique({
      where: { deviceId }
    });
    expect(state!.status).toBe('DOWN');
    expect(state!.lastCheckedAt).toEqual(measuredAt);
    expect(
      await prisma.pingResult.count({ where: { deviceId } })
    ).toBe(1);
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
      results: [
        {
          id: 'r9',
          deviceIndex,
          measuredAt,
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
