import { PrismaClient } from '../../../../src/generated/prisma/client';
import { BuildAgentConfigSnapshotUseCase } from 'application/probe-agents/use-cases';
import {
  PrismaAgentDeviceIndex,
  PrismaAgentPollingTargetsQuery
} from 'infrastructure/probe-agents/queries';
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

describe('BuildAgentConfigSnapshotUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: BuildAgentConfigSnapshotUseCase;
  let deviceModelId: string;
  let agentId: string;
  let ip = 10;

  const deviceBehind = async (agent: string | null) => {
    const { deviceId } = await seedMonitoredDevice(
      prisma,
      deviceModelId,
      `10.9.0.${ip++}`
    );
    await prisma.device.update({
      where: { id: deviceId },
      data: { agentId: agent }
    });
    return deviceId;
  };
  const build = async () =>
    (await useCase.execute({ agentId })).value;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);
    useCase = new BuildAgentConfigSnapshotUseCase(
      new PrismaAgentPollingTargetsQuery(prisma),
      new PrismaAgentDeviceIndex(prisma),
      makeAdapters(prisma).logger
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanAgents(prisma);
    await cleanDatabase(prisma);
    ({ id: agentId } = await seedAgent(prisma, { status: 'ACTIVE' }));
  });

  it('[AGT-041] lists only this agent’s pollable devices', async () => {
    const mine = await deviceBehind(agentId);
    const { id: other } = await seedAgent(prisma);
    await deviceBehind(other);
    await deviceBehind(null);
    const disabled = await deviceBehind(agentId);
    await prisma.pollingConfiguration.update({
      where: { deviceId: disabled },
      data: { enabled: false }
    });

    const snapshot = await build();

    const ips = snapshot.devices.map((d) => d.ipAddress);
    const mineRow = await prisma.pollingConfiguration.findUnique({
      where: { deviceId: mine }
    });
    expect(ips).toEqual([mineRow!.ipAddress]);
    expect(snapshot.devices[0]).toMatchObject({
      intervalSeconds: 60,
      failuresBeforeDown: 3
    });
  });

  it('[AGT-041] never reuses an index, even after its device is purged', async () => {
    const first = await deviceBehind(agentId);
    await build();
    await prisma.device.delete({ where: { id: first } });
    await deviceBehind(agentId);

    const snapshot = await build();

    expect(snapshot.devices.map((d) => d.index)).toEqual([1]);
  });

  it('[AGT-041] keeps an index through a move away and back', async () => {
    const device = await deviceBehind(agentId);
    const before = (await build()).devices[0].index;
    await prisma.device.update({
      where: { id: device },
      data: { agentId: null }
    });
    await build();
    await prisma.device.update({
      where: { id: device },
      data: { agentId }
    });

    expect((await build()).devices[0].index).toBe(before);
  });

  it('[AGT-041] assigns distinct indexes when two snapshots race', async () => {
    await deviceBehind(agentId);
    await deviceBehind(agentId);

    const [a, b] = await Promise.all([build(), build()]);

    expect(a.devices).toEqual(b.devices);
    expect(new Set(a.devices.map((d) => d.index)).size).toBe(2);
  });

  it('[AGT-042] reports the same version until something changes', async () => {
    const device = await deviceBehind(agentId);
    const v1 = (await build()).version;
    const v2 = (await build()).version;
    await prisma.pollingConfiguration.update({
      where: { deviceId: device },
      data: { failuresBeforeDown: 5 }
    });

    expect(v2).toBe(v1);
    expect((await build()).version).not.toBe(v1);
  });
});
